import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import {
  mapRateLimitDatabaseError,
  StoryChatRateLimitError,
} from './rate-limit';
import type {
  StoryChatReadRateLimiter,
  StoryChatReadRateLimitResult,
} from './read-rate-limit';

type ReadRateLimitSupabaseClient = Pick<SupabaseClient, 'rpc'>;

const ReadRateLimitResultSchema = z.object({
  allowed: z.boolean(),
  retry_after_seconds: z.number().int().min(0).max(60),
}).superRefine((value, context) => {
  if (value.allowed && value.retry_after_seconds !== 0) {
    context.addIssue({ code: 'custom', message: 'allowed result has retry delay' });
  }
  if (!value.allowed && value.retry_after_seconds < 1) {
    context.addIssue({ code: 'custom', message: 'denied result has no retry delay' });
  }
});

/** Server-only adapter for the 0036 RPC. No browser-derived network or device
 * value is accepted by this type or sent to persistence. */
export class SupabaseStoryChatReadRateLimiter implements StoryChatReadRateLimiter {
  constructor(private readonly client: ReadRateLimitSupabaseClient) {}

  async consume(
    input: Parameters<StoryChatReadRateLimiter['consume']>[0],
  ): Promise<StoryChatReadRateLimitResult> {
    const { data, error } = await this.client.rpc(
      'consume_world_chat_read_rate_limit',
      {
        p_parent_id: input.parentId,
        p_child_id: input.childId,
        p_action: input.action,
      },
    );
    if (error) throw mapRateLimitDatabaseError(error);

    const first = Array.isArray(data) ? data[0] : data;
    const parsed = ReadRateLimitResultSchema.safeParse(first);
    if (!parsed.success) {
      throw new StoryChatRateLimitError('storage_unavailable', {
        cause: parsed.error,
      });
    }
    return {
      allowed: parsed.data.allowed,
      retryAfterSeconds: parsed.data.retry_after_seconds,
    };
  }
}
