import 'server-only';

import {
  createContentReleaseGraphLoader,
} from '@/lib/releases/server-runtime-content-release';
import { VerifiedStoryGraphProvider } from '@/lib/releases/runtime-content-release';
import { getSupabase } from '@/lib/supabase';
import { StoryChatRuntime } from './authored-runtime';
import { SupabaseStoryChatRateLimiter } from './supabase-rate-limiter';
import { getStoryChatRuntimeConfig } from './runtime-config';
import {
  SupabaseStoryChatRepository,
  UnavailableStoryGraphProvider,
} from './supabase-repository';

/**
 * Server-only composition root. Missing release registry/storage/channel
 * configuration stays unavailable; no unsigned or demo graph is substituted.
 */
export function createStoryChatServerRuntime(): StoryChatRuntime {
  const graphLoader = createContentReleaseGraphLoader();
  const supabase = getSupabase();
  return new StoryChatRuntime({
    config: getStoryChatRuntimeConfig(),
    repository: new SupabaseStoryChatRepository(supabase),
    rateLimiter: new SupabaseStoryChatRateLimiter(supabase),
    graphProvider: graphLoader
      ? new VerifiedStoryGraphProvider(graphLoader)
      : new UnavailableStoryGraphProvider(),
  });
}
