import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import {
  mapRateLimitDatabaseError,
  StoryChatRateLimitError,
  type StoryChatRateLimiter,
  type StoryChatRateLimitResult,
} from './rate-limit';

type RateLimitSupabaseClient = Pick<SupabaseClient, 'rpc'>;

const RateLimitResultSchema = z.object({
  allowed: z.boolean(),
  retry_after_seconds: z.number().int().min(0).max(60),
  idempotent_replay: z.boolean(),
}).superRefine((value, context) => {
  if (value.allowed && value.retry_after_seconds !== 0) {
    context.addIssue({ code: 'custom', message: 'allowed result has retry delay' });
  }
  if (!value.allowed && value.retry_after_seconds < 1) {
    context.addIssue({ code: 'custom', message: 'denied result has no retry delay' });
  }
  if (value.idempotent_replay && !value.allowed) {
    context.addIssue({ code: 'custom', message: 'denied result cannot be a replay' });
  }
});

export class SupabaseStoryChatRateLimiter implements StoryChatRateLimiter {
  constructor(private readonly client: RateLimitSupabaseClient) {}

  async consume(
    input: Parameters<StoryChatRateLimiter['consume']>[0],
  ): Promise<StoryChatRateLimitResult> {
    const { data, error } = await this.client.rpc('consume_world_chat_rate_limit', {
      p_parent_id: input.parentId,
      p_child_id: input.childId,
      p_room_id: input.roomId,
      p_action: input.action,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error) throw mapRateLimitDatabaseError(error);

    const first = Array.isArray(data) ? data[0] : data;
    const parsed = RateLimitResultSchema.safeParse(first);
    if (!parsed.success) {
      throw new StoryChatRateLimitError('storage_unavailable', {
        cause: parsed.error,
      });
    }
    return {
      allowed: parsed.data.allowed,
      retryAfterSeconds: parsed.data.retry_after_seconds,
      idempotentReplay: parsed.data.idempotent_replay,
    };
  }
}
