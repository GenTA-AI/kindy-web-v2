import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase';
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

/** Shared server composition for authored turns and future verified renderers. */
export function createContentReleaseGraphLoader():
  VerifiedContentReleaseGraphLoader | null {
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
  return new VerifiedContentReleaseGraphLoader({
    registry: new SupabaseContentReleaseRuntimeRegistry(databaseClient),
    objectStore: new SupabasePrivateReleaseObjectStore(
      storageReaderClient,
      config.bucket,
      config.storageOrigin,
    ),
    channel: config.channel,
  });
}
