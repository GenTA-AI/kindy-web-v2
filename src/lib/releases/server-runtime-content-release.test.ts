import assert from 'node:assert/strict';
import test from 'node:test';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  CONTENT_RELEASE_GCS_BUCKETS,
  CONTENT_RELEASE_GCS_SIGNERS,
} from './gcs-runtime-content-release-config';
import { GcsPrivateReleaseObjectStore } from './gcs-runtime-content-release';
import { VerifiedContentReleaseGraphLoader } from './runtime-content-release';
import {
  createContentReleaseStoryChatServerComponents,
} from './server-runtime-content-release';
import { SupabaseContentReleaseRuntimeRegistry } from './supabase-runtime-content-release';

const PREVIEW_ENVIRONMENT = {
  KINDY_DEPLOY_ENV: 'preview',
  STORY_CONTENT_RELEASE_STORAGE_BACKEND: 'gcs',
  STORY_CONTENT_RELEASE_BUCKET: CONTENT_RELEASE_GCS_BUCKETS.staging,
  STORY_CONTENT_RELEASE_CHANNEL: 'staging',
  STORY_CONTENT_RELEASE_GCS_SIGNER_SERVICE_ACCOUNT:
    CONTENT_RELEASE_GCS_SIGNERS.staging,
} as const;

const ACCESS_TOKEN = 'metadata-access-token-value-123456';
const NOW = new Date('2026-08-24T01:02:03.987Z');
const SIGNATURE = Buffer.alloc(256, 0xab).toString('base64');
const STORAGE_KEY = 'releases/story.one/1.0.0/media/cover.png';

test('server composition returns null before database access on missing or drifting GCS config', () => {
  let databaseAccesses = 0;
  const getDatabaseClient = () => {
    databaseAccesses += 1;
    return {} as SupabaseClient;
  };

  for (const environment of [
    {},
    {
      NEXT_PUBLIC_SUPABASE_URL: 'https://legacy.supabase.co',
      STORY_CONTENT_RELEASE_STORAGE_READER_KEY: 'legacy-reader-jwt',
      STORY_CONTENT_RELEASE_BUCKET: 'content-releases',
      STORY_CONTENT_RELEASE_CHANNEL: 'staging',
    },
    {
      ...PREVIEW_ENVIRONMENT,
      STORY_CONTENT_RELEASE_BUCKET: CONTENT_RELEASE_GCS_BUCKETS.production,
    },
    {
      ...PREVIEW_ENVIRONMENT,
      GOOGLE_APPLICATION_CREDENTIALS: '/tmp/forbidden-key.json',
    },
  ]) {
    assert.equal(createContentReleaseStoryChatServerComponents({
      environment,
      getDatabaseClient,
    }), null);
  }

  assert.equal(databaseAccesses, 0);
});

test('server composition keeps the Supabase registry but uses only GCS metadata storage and signing', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const objectBytes = Buffer.from('kindy', 'utf8');
  const fetcher = (async (resource: URL | RequestInfo, init?: RequestInit) => {
    const url = String(resource);
    calls.push({ url, init: init ?? {} });
    if (url.endsWith('/email')) {
      return new Response(CONTENT_RELEASE_GCS_SIGNERS.staging, {
        status: 200,
        headers: { 'metadata-flavor': 'Google' },
      });
    }
    if (url.endsWith('/token')) {
      return new Response(JSON.stringify({
        access_token: ACCESS_TOKEN,
        expires_in: 3_599,
        token_type: 'Bearer',
      }), {
        status: 200,
        headers: { 'metadata-flavor': 'Google' },
      });
    }
    if (url.includes('iamcredentials.googleapis.com')) {
      return new Response(JSON.stringify({ signedBlob: SIGNATURE }), {
        status: 200,
      });
    }
    if (url.includes('storage.googleapis.com/storage/v1/')) {
      return new Response(objectBytes, {
        status: 200,
        headers: {
          'content-encoding': 'identity',
          'content-length': String(objectBytes.byteLength),
        },
      });
    }
    throw new Error(`unexpected release request: ${url}`);
  }) as typeof fetch;
  let databaseAccesses = 0;

  const components = createContentReleaseStoryChatServerComponents({
    environment: PREVIEW_ENVIRONMENT,
    getDatabaseClient() {
      databaseAccesses += 1;
      return {} as SupabaseClient;
    },
    fetcher,
    now: () => NOW,
  });

  assert.ok(components);
  assert.equal(databaseAccesses, 1);
  assert.ok(components.loader instanceof VerifiedContentReleaseGraphLoader);

  const dependencies = (
    components.loader as unknown as {
      dependencies: {
        registry: unknown;
        objectStore: GcsPrivateReleaseObjectStore;
        channel: string;
      };
    }
  ).dependencies;
  assert.ok(dependencies.registry instanceof SupabaseContentReleaseRuntimeRegistry);
  assert.ok(dependencies.objectStore instanceof GcsPrivateReleaseObjectStore);
  assert.equal(dependencies.channel, 'staging');

  assert.deepEqual(await dependencies.objectStore.readObject({
    storageKey: STORAGE_KEY,
    expectedSizeBytes: objectBytes.byteLength,
    maximumBytes: 100,
  }), new Uint8Array(objectBytes));

  const signed = await components.signAsset({
    assetId: 'asset.cover',
    storageKey: STORAGE_KEY,
    sha256: 'a'.repeat(64),
    mimeType: 'image/png',
    expiresInSeconds: 600,
  });
  const signedUrl = new URL(signed.url);
  assert.equal(signed.expiresAt, '2026-08-24T01:12:03.000Z');
  assert.equal(signedUrl.origin, 'https://storage.googleapis.com');
  assert.equal(
    signedUrl.pathname,
    `/${CONTENT_RELEASE_GCS_BUCKETS.staging}/${STORAGE_KEY}`,
  );
  assert.equal(
    signedUrl.searchParams.get('X-Goog-Credential')?.startsWith(
      `${CONTENT_RELEASE_GCS_SIGNERS.staging}/`,
    ),
    true,
  );

  assert.deepEqual(calls.map(({ url }) => url), [
    'http://metadata.google.internal/computeMetadata/v1/instance/'
      + 'service-accounts/default/email',
    'http://metadata.google.internal/computeMetadata/v1/instance/'
      + 'service-accounts/default/token',
    `https://storage.googleapis.com/storage/v1/b/`
      + `${CONTENT_RELEASE_GCS_BUCKETS.staging}/o/`
      + 'releases%2Fstory.one%2F1.0.0%2Fmedia%2Fcover.png?alt=media',
    'http://metadata.google.internal/computeMetadata/v1/instance/'
      + 'service-accounts/default/email',
    'http://metadata.google.internal/computeMetadata/v1/instance/'
      + 'service-accounts/default/token',
    'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'
      + 'kindy-preview-runtime%40kindy-493701.iam.gserviceaccount.com:signBlob',
  ]);
  assert.equal(
    calls.some(({ url }) => url.includes('supabase.co/storage')),
    false,
  );
  for (const call of calls.filter(({ url }) => url.includes('googleapis.com'))) {
    assert.equal(
      new Headers(call.init.headers).get('authorization'),
      `Bearer ${ACCESS_TOKEN}`,
    );
  }
});
