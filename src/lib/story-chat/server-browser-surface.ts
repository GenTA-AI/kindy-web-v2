import 'server-only';

import {
  createContentReleaseStoryChatServerComponents,
} from '@/lib/releases/server-runtime-content-release';
import { VerifiedStoryGraphProvider } from '@/lib/releases/runtime-content-release';
import { getSupabase } from '@/lib/supabase';
import {
  STORY_CHAT_ACTIVITY_CONSENT_SCOPE,
  StoryChatRuntime,
  StoryChatRuntimeError,
} from './authored-runtime';
import { StoryChatBrowserSurface } from './browser-surface';
import { StoryChatRoomLifecycle } from './room-lifecycle';
import { getStoryChatRuntimeConfig } from './runtime-config';
import { SupabaseStoryChatRateLimiter } from './supabase-rate-limiter';
import { SupabaseStoryChatReadRateLimiter } from './supabase-read-rate-limiter';
import { SupabaseStoryChatRepository } from './supabase-repository';
import { SupabaseStoryChatRoomLifecycleRepository } from './supabase-room-lifecycle-repository';

/**
 * Single production composition root for every serializable story-chat API.
 * It owns the backend identity, consent-gated repositories, shared limiter,
 * verified release loader, exact-object signer, and browser projection.
 */
export function createStoryChatServerBrowserSurface(): StoryChatBrowserSurface {
  const config = getStoryChatRuntimeConfig();
  if (!config.runtimeEnabled) {
    throw new StoryChatRuntimeError('runtime_disabled');
  }
  if (!config.releaseChannel) {
    throw new StoryChatRuntimeError('release_unavailable');
  }
  const release = createContentReleaseStoryChatServerComponents();
  if (!release) throw new StoryChatRuntimeError('release_unavailable');

  const supabase = getSupabase();
  const limiter = new SupabaseStoryChatRateLimiter(supabase);
  const repository = new SupabaseStoryChatRepository(supabase);
  const authoredRuntime = new StoryChatRuntime({
    config,
    repository,
    rateLimiter: limiter,
    graphProvider: new VerifiedStoryGraphProvider(release.loader),
  });
  const roomLifecycle = new StoryChatRoomLifecycle({
    config,
    repository: new SupabaseStoryChatRoomLifecycleRepository(supabase),
    rateLimiter: limiter,
  });

  return new StoryChatBrowserSurface({
    authoredRuntime,
    roomLifecycle,
    releaseLoader: release.loader,
    signAsset: release.signAsset,
    readRateLimiter: new SupabaseStoryChatReadRateLimiter(supabase),
    releaseChannel: config.releaseChannel,
    async assertActiveAccess({ parentId, childId }) {
      if (!await repository.findOwnedChild(parentId, childId)) {
        throw new StoryChatRuntimeError('child_not_found');
      }
      if (!await repository.hasActiveConsent({
        parentId,
        childId,
        scope: STORY_CHAT_ACTIVITY_CONSENT_SCOPE,
      })) {
        throw new StoryChatRuntimeError('consent_required');
      }
    },
  });
}
