import assert from 'node:assert/strict';
import test from 'node:test';

import { getContentReleaseRuntimeConfig } from './runtime-content-release-config';

const storageBoundary = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  STORY_CONTENT_RELEASE_STORAGE_READER_KEY: 'separate-read-only-storage-jwt',
} as const;

test('content release runtime config requires an explicit channel and rejects bucket drift', () => {
  assert.deepEqual(getContentReleaseRuntimeConfig({}), { configured: false });
  assert.deepEqual(getContentReleaseRuntimeConfig({
    ...storageBoundary,
    STORY_CONTENT_RELEASE_BUCKET: 'another-private-bucket',
    STORY_CONTENT_RELEASE_CHANNEL: 'production',
  }), { configured: false });
  assert.deepEqual(getContentReleaseRuntimeConfig({
    ...storageBoundary,
    STORY_CONTENT_RELEASE_BUCKET: 'https://storage.invalid/bucket',
    STORY_CONTENT_RELEASE_CHANNEL: 'production',
  }), { configured: false });
  assert.deepEqual(getContentReleaseRuntimeConfig({
    ...storageBoundary,
    STORY_CONTENT_RELEASE_BUCKET: 'content-releases',
    STORY_CONTENT_RELEASE_CHANNEL: 'preview',
  }), { configured: false });
});

test('content release runtime config preserves an exact environment channel', () => {
  assert.deepEqual(getContentReleaseRuntimeConfig({
    ...storageBoundary,
    STORY_CONTENT_RELEASE_CHANNEL: 'staging',
  }), {
    configured: true,
    bucket: 'content-releases',
    channel: 'staging',
    storageOrigin: 'https://example.supabase.co',
    storageReaderKey: 'separate-read-only-storage-jwt',
  });
});

test('content release runtime config rejects missing or malformed storage reader identity', () => {
  assert.deepEqual(getContentReleaseRuntimeConfig({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    STORY_CONTENT_RELEASE_CHANNEL: 'staging',
  }), { configured: false });
  assert.deepEqual(getContentReleaseRuntimeConfig({
    STORY_CONTENT_RELEASE_STORAGE_READER_KEY: 'reader-jwt',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co/path',
    STORY_CONTENT_RELEASE_CHANNEL: 'staging',
  }), { configured: false });
});
