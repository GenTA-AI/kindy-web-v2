import assert from 'node:assert/strict';
import test from 'node:test';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  isAllowedPrivateReleaseAssetSignedUrl,
} from './runtime-content-release';
import { SupabasePrivateReleaseAssetSigner } from './private-release-asset-signer';

const ORIGIN = 'https://kindy-preview.supabase.co';
const BUCKET = 'content-releases';
const STORAGE_KEY = 'releases/story.one/1.0.0/media/cover.png';
const NOW = new Date('2026-08-24T00:00:00.000Z');

function input() {
  return {
    assetId: 'asset.cover',
    storageKey: STORAGE_KEY,
    sha256: 'a'.repeat(64),
    mimeType: 'image/png',
    expiresInSeconds: 600,
  };
}

function storageClient(
  signedUrl: string,
  calls: Array<{ bucket: string; path: string; expiry: number }>,
): SupabaseClient {
  return {
    storage: {
      from(bucket: string) {
        return {
          async createSignedUrl(path: string, expiry: number) {
            calls.push({ bucket, path, expiry });
            return { data: { signedUrl }, error: null };
          },
        };
      },
    },
  } as unknown as SupabaseClient;
}

test('signs only the exact approved private release object', async () => {
  const calls: Array<{ bucket: string; path: string; expiry: number }> = [];
  const url = `${ORIGIN}/storage/v1/object/sign/${BUCKET}/${STORAGE_KEY}?token=signed`;
  const signer = new SupabasePrivateReleaseAssetSigner(
    storageClient(url, calls),
    BUCKET,
    ORIGIN,
    () => NOW,
  );

  assert.deepEqual(await signer.sign(input()), {
    url,
    expiresAt: '2026-08-24T00:10:00.000Z',
  });
  assert.deepEqual(calls, [{ bucket: BUCKET, path: STORAGE_KEY, expiry: 600 }]);
});

test('rejects foreign origins, ignored paths, traversal encodings, and widened queries', async () => {
  const invalidUrls = [
    `https://attacker.example/storage/v1/object/sign/${BUCKET}/${STORAGE_KEY}?token=signed`,
    `${ORIGIN}/storage/v1/object/sign/${BUCKET}/releases/story.one/1.0.0/media/other.png?token=signed`,
    `${ORIGIN}/storage/v1/object/sign/${BUCKET}/releases/story.one/1.0.0/media/%2e%2e/cover.png?token=signed`,
    `${ORIGIN}/storage/v1/object/sign/${BUCKET}/${STORAGE_KEY}?token=signed&download=1`,
  ];

  for (const url of invalidUrls) {
    const signer = new SupabasePrivateReleaseAssetSigner(
      storageClient(url, []),
      BUCKET,
      ORIGIN,
      () => NOW,
    );
    await assert.rejects(
      signer.sign(input()),
      /release asset signing unavailable/,
    );
  }
});

test('exact signed URL helper binds origin, bucket, path, and one token', () => {
  const valid = `${ORIGIN}/storage/v1/object/sign/${BUCKET}/${STORAGE_KEY}?token=signed`;
  assert.equal(isAllowedPrivateReleaseAssetSignedUrl(valid, {
    allowedOrigin: ORIGIN,
    bucket: BUCKET,
    storageKey: STORAGE_KEY,
  }), true);
  assert.equal(isAllowedPrivateReleaseAssetSignedUrl(
    valid.replace(STORAGE_KEY, `${STORAGE_KEY}.bak`),
    { allowedOrigin: ORIGIN, bucket: BUCKET, storageKey: STORAGE_KEY },
  ), false);
});
