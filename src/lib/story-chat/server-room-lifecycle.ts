import 'server-only';

import { getSupabase } from '@/lib/supabase';
import { StoryChatRoomLifecycle } from './room-lifecycle';
import { getStoryChatRuntimeConfig } from './runtime-config';
import { SupabaseStoryChatRateLimiter } from './supabase-rate-limiter';
import { SupabaseStoryChatRoomLifecycleRepository } from './supabase-room-lifecycle-repository';

export function createStoryChatRoomLifecycle(): StoryChatRoomLifecycle {
  const supabase = getSupabase();
  return new StoryChatRoomLifecycle({
    config: getStoryChatRuntimeConfig(),
    repository: new SupabaseStoryChatRoomLifecycleRepository(supabase),
    rateLimiter: new SupabaseStoryChatRateLimiter(supabase),
  });
}
