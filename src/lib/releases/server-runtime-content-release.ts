import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase';
import { getGcsContentReleaseRuntimeConfig } from './gcs-runtime-content-release-config';
import {
  GcsPrivateReleaseAssetSigner,
  GcsPrivateReleaseObjectStore,
} from './gcs-runtime-content-release';
import {
  VerifiedContentReleaseGraphLoader,
} from './runtime-content-release';
import { SupabaseContentReleaseRuntimeRegistry } from './supabase-runtime-content-release';
import type { StoryChatAssetSigner } from '@/lib/story-chat/render-projection';

export type ContentReleaseStoryChatServerComponents = Readonly<{
  loader: VerifiedContentReleaseGraphLoader;
  signAsset: StoryChatAssetSigner;
}>;

export type ContentReleaseStoryChatServerCompositionOptions = Readonly<{
  /** Test seam only; production always reads the process environment. */
  environment?: Readonly<Record<string, string | undefined>>;
  /** Test seam only; production uses the existing Supabase service client. */
  getDatabaseClient?: () => SupabaseClient;
  /** Test seam for exact metadata/GCS/IAM request assertions. */
  fetcher?: typeof fetch;
  /** Test seam for deterministic V4 URL timestamps. */
  now?: () => Date;
}>;

/**
 * Constructs the verified loader and exact-object browser signer only from the
 * immutable GCS configuration. Supabase remains the release registry database,
 * but its Storage client/JWT is never constructed or used here. Missing or
 * drifting GCS configuration has no legacy fallback.
 */
export function createContentReleaseStoryChatServerComponents(
  options: ContentReleaseStoryChatServerCompositionOptions = {},
):
  ContentReleaseStoryChatServerComponents | null {
  const config = getGcsContentReleaseRuntimeConfig(
    options.environment ?? process.env,
  );
  if (!config.configured) return null;
  const databaseClient = (options.getDatabaseClient ?? getSupabase)();
  const objectStore = new GcsPrivateReleaseObjectStore(config.bucket, {
    workloadServiceAccount: config.signerServiceAccount,
    ...(options.fetcher ? { fetcher: options.fetcher } : {}),
  });
  const loader = new VerifiedContentReleaseGraphLoader({
    registry: new SupabaseContentReleaseRuntimeRegistry(databaseClient),
    objectStore,
    channel: config.channel,
  });
  const assetSigner = new GcsPrivateReleaseAssetSigner({
    bucket: config.bucket,
    signerServiceAccount: config.signerServiceAccount,
    ...(options.fetcher ? { fetcher: options.fetcher } : {}),
    ...(options.now ? { now: options.now } : {}),
  });
  return {
    loader,
    signAsset: (input) => assetSigner.sign(input),
  };
}

/** Shared server composition for authored turns and future verified renderers. */
export function createContentReleaseGraphLoader():
  VerifiedContentReleaseGraphLoader | null {
  return createContentReleaseStoryChatServerComponents()?.loader ?? null;
}
