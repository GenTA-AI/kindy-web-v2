import type { SupabaseClient } from '@supabase/supabase-js';

import { isAllowedPrivateReleaseAssetSignedUrl } from './runtime-content-release';

type RuntimeReleaseStorageClient = Pick<SupabaseClient, 'storage'>;

const RELEASE_STORAGE_KEY_PATTERN = /^releases\/[a-zA-Z0-9._\/-]+$/;
const RELEASE_ASSET_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const RELEASE_SHA256_PATTERN = /^[a-f0-9]{64}$/;
const RELEASE_MIME_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

/**
 * Signs one exact media object already declared by a verified ContentRelease.
 * The adapter never accepts a browser URL or chooses a different object path.
 */
export class SupabasePrivateReleaseAssetSigner {
  constructor(
    private readonly client: RuntimeReleaseStorageClient,
    private readonly bucket: string,
    private readonly allowedOrigin: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (!/^[a-z0-9][a-z0-9._-]{1,62}$/.test(bucket)) {
      throw new Error('invalid private release bucket');
    }
    const origin = new URL(allowedOrigin);
    if (origin.origin !== allowedOrigin || origin.username || origin.password) {
      throw new Error('invalid private release origin');
    }
  }

  async sign(input: {
    assetId: string;
    storageKey: string;
    sha256: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<{ url: string; expiresAt: string }> {
    if (
      !RELEASE_ASSET_ID_PATTERN.test(input.assetId)
      || !RELEASE_STORAGE_KEY_PATTERN.test(input.storageKey)
      || input.storageKey.includes('..')
      || input.storageKey.includes('//')
      || input.storageKey.includes('/./')
      || input.storageKey.endsWith('/')
      || !RELEASE_SHA256_PATTERN.test(input.sha256)
      || !RELEASE_MIME_PATTERN.test(input.mimeType)
      || !Number.isSafeInteger(input.expiresInSeconds)
      || input.expiresInSeconds < 1
      || input.expiresInSeconds > 15 * 60
    ) {
      throw new Error('release asset signing unavailable');
    }

    const issuedAt = this.now();
    if (!Number.isFinite(issuedAt.getTime())) {
      throw new Error('release asset signing unavailable');
    }
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(input.storageKey, input.expiresInSeconds);
    if (
      error
      || !data?.signedUrl
      || !isAllowedPrivateReleaseAssetSignedUrl(data.signedUrl, {
        allowedOrigin: this.allowedOrigin,
        bucket: this.bucket,
        storageKey: input.storageKey,
      })
    ) {
      throw new Error('release asset signing unavailable');
    }

    return {
      url: data.signedUrl,
      expiresAt: new Date(
        issuedAt.getTime() + input.expiresInSeconds * 1_000,
      ).toISOString(),
    };
  }
}
