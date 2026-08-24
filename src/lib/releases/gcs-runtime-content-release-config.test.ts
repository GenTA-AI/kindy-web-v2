import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONTENT_RELEASE_GCS_BUCKETS,
  CONTENT_RELEASE_GCS_SIGNERS,
  getGcsContentReleaseRuntimeConfig,
} from './gcs-runtime-content-release-config';

const previewEnvironment = {
  KINDY_DEPLOY_ENV: 'preview',
  STORY_CONTENT_RELEASE_STORAGE_BACKEND: 'gcs',
  STORY_CONTENT_RELEASE_BUCKET: CONTENT_RELEASE_GCS_BUCKETS.staging,
  STORY_CONTENT_RELEASE_CHANNEL: 'staging',
  STORY_CONTENT_RELEASE_GCS_SIGNER_SERVICE_ACCOUNT:
    CONTENT_RELEASE_GCS_SIGNERS.staging,
} as const;

test('GCS release config binds preview to a distinct staging bucket and identity', () => {
  assert.deepEqual(getGcsContentReleaseRuntimeConfig(previewEnvironment), {
    configured: true,
    backend: 'gcs',
    bucket: CONTENT_RELEASE_GCS_BUCKETS.staging,
    channel: 'staging',
    signerServiceAccount: CONTENT_RELEASE_GCS_SIGNERS.staging,
  });
});

test('GCS release config binds production to its own bucket and identity', () => {
  assert.deepEqual(getGcsContentReleaseRuntimeConfig({
    KINDY_DEPLOY_ENV: 'production',
    STORY_CONTENT_RELEASE_STORAGE_BACKEND: 'gcs',
    STORY_CONTENT_RELEASE_BUCKET: CONTENT_RELEASE_GCS_BUCKETS.production,
    STORY_CONTENT_RELEASE_CHANNEL: 'production',
    STORY_CONTENT_RELEASE_GCS_SIGNER_SERVICE_ACCOUNT:
      CONTENT_RELEASE_GCS_SIGNERS.production,
  }), {
    configured: true,
    backend: 'gcs',
    bucket: CONTENT_RELEASE_GCS_BUCKETS.production,
    channel: 'production',
    signerServiceAccount: CONTENT_RELEASE_GCS_SIGNERS.production,
  });
});

test('GCS release config fails closed on environment, bucket, channel, or signer drift', () => {
  const invalidEnvironments = [
    {},
    { ...previewEnvironment, KINDY_DEPLOY_ENV: 'local' },
    { ...previewEnvironment, STORY_CONTENT_RELEASE_STORAGE_BACKEND: 'supabase' },
    { ...previewEnvironment, STORY_CONTENT_RELEASE_CHANNEL: 'production' },
    {
      ...previewEnvironment,
      STORY_CONTENT_RELEASE_BUCKET: CONTENT_RELEASE_GCS_BUCKETS.production,
    },
    {
      ...previewEnvironment,
      STORY_CONTENT_RELEASE_GCS_SIGNER_SERVICE_ACCOUNT:
        CONTENT_RELEASE_GCS_SIGNERS.production,
    },
    {
      ...previewEnvironment,
      STORY_CONTENT_RELEASE_GCS_SIGNER_SERVICE_ACCOUNT:
        ` ${CONTENT_RELEASE_GCS_SIGNERS.staging}`,
    },
  ];

  for (const environment of invalidEnvironments) {
    assert.deepEqual(getGcsContentReleaseRuntimeConfig(environment), {
      configured: false,
    });
  }
});

test('GCS release config has no embedded credential fallback', () => {
  for (const credentialEnvironment of [
    { STORY_CONTENT_RELEASE_STORAGE_READER_KEY: 'legacy-reader-jwt' },
    { STORY_CONTENT_RELEASE_GCS_CREDENTIALS_JSON: 'embedded-json-credential' },
    { STORY_CONTENT_RELEASE_GCS_PRIVATE_KEY: 'secret' },
    { GOOGLE_APPLICATION_CREDENTIALS: '/tmp/service-account-key.json' },
  ]) {
    assert.deepEqual(getGcsContentReleaseRuntimeConfig({
      ...previewEnvironment,
      ...credentialEnvironment,
    }), { configured: false });
  }
});
