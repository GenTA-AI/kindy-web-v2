export type StoryChatRateLimitAction = 'session_open' | 'authored_turn';

export type StoryChatRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  idempotentReplay: boolean;
};

export interface StoryChatRateLimiter {
  consume(input: {
    parentId: string;
    childId: string;
    roomId: string;
    action: StoryChatRateLimitAction;
    idempotencyKey: string;
  }): Promise<StoryChatRateLimitResult>;
}

export type StoryChatRateLimitErrorCode =
  | 'rate_limited'
  | 'storage_unavailable'
  | 'child_not_found'
  | 'consent_required'
  | 'room_not_found';

export class StoryChatRateLimitError extends Error {
  readonly code: StoryChatRateLimitErrorCode;
  readonly retryAfterSeconds: number | null;

  constructor(
    code: StoryChatRateLimitErrorCode,
    options?: { cause?: unknown; retryAfterSeconds?: number },
  ) {
    super(code, { cause: options?.cause });
    this.name = 'StoryChatRateLimitError';
    this.code = code;
    this.retryAfterSeconds = code === 'rate_limited'
      ? normalizeRetryAfter(options?.retryAfterSeconds)
      : null;
  }
}

export async function enforceStoryChatRateLimit(
  limiter: StoryChatRateLimiter,
  input: Parameters<StoryChatRateLimiter['consume']>[0],
): Promise<StoryChatRateLimitResult> {
  let result: StoryChatRateLimitResult;
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

export function isStoryChatRateLimitError(
  error: unknown,
): error is StoryChatRateLimitError {
  return error instanceof StoryChatRateLimitError;
}

export function mapRateLimitDatabaseError(error: unknown): StoryChatRateLimitError {
  const record = error && typeof error === 'object'
    ? error as Record<string, unknown>
    : {};
  const marker = [record.code, record.message, record.details, record.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');

  if (marker.includes('CHAT_CHILD_ACCESS_DENIED')) {
    return new StoryChatRateLimitError('child_not_found', { cause: error });
  }
  if (marker.includes('CHAT_CONSENT_REQUIRED')) {
    return new StoryChatRateLimitError('consent_required', { cause: error });
  }
  if (marker.includes('CHAT_ROOM_NOT_FOUND')) {
    return new StoryChatRateLimitError('room_not_found', { cause: error });
  }
  return new StoryChatRateLimitError('storage_unavailable', { cause: error });
}

function normalizeRetryAfter(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || (value ?? 0) < 1) return 1;
  return value as number;
}
