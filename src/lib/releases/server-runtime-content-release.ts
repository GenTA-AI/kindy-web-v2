import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase';
import { SupabasePrivateReleaseAssetSigner } from './private-release-asset-signer';
import { getContentReleaseRuntimeConfig } from './runtime-content-release-config';
import {
  SupabaseContentReleaseRuntimeRegistry,
  SupabasePrivateReleaseObjectStore,
} from './supabase-runtime-content-release';
import {
  CONTENT_RELEASE_OBJECT_DEADLINE_MS,
  VerifiedContentReleaseGraphLoader,
  createDeadlineFetch,
} from './runtime-content-release';
import type { StoryChatAssetSigner } from '@/lib/story-chat/render-projection';

export type ContentReleaseStoryChatServerComponents = Readonly<{
  loader: VerifiedContentReleaseGraphLoader;
  signAsset: StoryChatAssetSigner;
}>;

/**
 * Constructs the reusable verified loader and exact-object browser signer from
 * one server-only release configuration. Missing configuration has no fallback.
 */
export function createContentReleaseStoryChatServerComponents():
  ContentReleaseStoryChatServerComponents | null {
  const config = getContentReleaseRuntimeConfig();
  if (!config.configured) return null;
  const databaseClient = getSupabase();
  const storageReaderClient = createClient(
    config.storageOrigin,
    config.storageReaderKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: createDeadlineFetch(CONTENT_RELEASE_OBJECT_DEADLINE_MS) },
    },
  );
  const loader = new VerifiedContentReleaseGraphLoader({
    registry: new SupabaseContentReleaseRuntimeRegistry(databaseClient),
    objectStore: new SupabasePrivateReleaseObjectStore(
      storageReaderClient,
      config.bucket,
      config.storageOrigin,
    ),
    channel: config.channel,
  });
  const assetSigner = new SupabasePrivateReleaseAssetSigner(
    storageReaderClient,
    config.bucket,
    config.storageOrigin,
  );
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
