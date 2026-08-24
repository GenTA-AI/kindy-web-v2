import {
  StoryChatRateLimitError,
  type StoryChatRateLimitResult,
} from './rate-limit';

export type StoryChatReadRateLimitAction = 'rooms_read' | 'messages_read';

export type StoryChatReadRateLimitResult = Omit<
  StoryChatRateLimitResult,
  'idempotentReplay'
>;

export interface StoryChatReadRateLimiter {
  consume(input: {
    parentId: string;
    childId: string;
    action: StoryChatReadRateLimitAction;
  }): Promise<StoryChatReadRateLimitResult>;
}

/**
 * Fail-closed enforcement shared by both server-rendered chat GET surfaces.
 * Database authorization races remain typed StoryChatRateLimitErrors so the
 * Route Handler can return the same bounded 403/404/429/503 classes used by
 * mutation limits without exposing backend details.
 */
export async function enforceStoryChatReadRateLimit(
  limiter: StoryChatReadRateLimiter,
  input: Parameters<StoryChatReadRateLimiter['consume']>[0],
): Promise<StoryChatReadRateLimitResult> {
  let result: StoryChatReadRateLimitResult;
  try {
    result = await limiter.consume(input);
  } catch (error) {
    if (error instanceof StoryChatRateLimitError) throw error;
    throw new StoryChatRateLimitError('storage_unavailable', { cause: error });
  }

  if (!result.allowed) {
    throw new StoryChatRateLimitError('rate_limited', {
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
  return result;
}
