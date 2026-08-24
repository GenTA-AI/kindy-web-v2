import assert from 'node:assert/strict';
import test from 'node:test';

import { storyChatGetErrorResponse } from './http';
import { StoryChatRateLimitError } from './rate-limit';
import {
  enforceStoryChatReadRateLimit,
  type StoryChatReadRateLimiter,
  type StoryChatReadRateLimitResult,
} from './read-rate-limit';

const INPUT = {
  parentId: 'parent-1',
  childId: '11111111-1111-4111-8111-111111111111',
  action: 'rooms_read' as const,
};

class FakeReadLimiter implements StoryChatReadRateLimiter {
  result: StoryChatReadRateLimitResult = {
    allowed: true,
    retryAfterSeconds: 0,
  };
  error: Error | null = null;
  inputs: Parameters<StoryChatReadRateLimiter['consume']>[0][] = [];

  async consume(
    input: Parameters<StoryChatReadRateLimiter['consume']>[0],
  ): Promise<StoryChatReadRateLimitResult> {
    this.inputs.push(input);
    if (this.error) throw this.error;
    return this.result;
  }
}

test('read limiter accepts only bounded parent, child, and finite action input', async () => {
  const limiter = new FakeReadLimiter();
  assert.deepEqual(await enforceStoryChatReadRateLimit(limiter, INPUT), {
    allowed: true,
    retryAfterSeconds: 0,
  });
  assert.deepEqual(limiter.inputs, [INPUT]);
  assert.deepEqual(Object.keys(limiter.inputs[0]).sort(), [
    'action',
    'childId',
    'parentId',
  ]);
});

test('read denial produces a bounded shared 429 error', async () => {
  const limiter = new FakeReadLimiter();
  limiter.result = { allowed: false, retryAfterSeconds: 19 };
  await assert.rejects(
    enforceStoryChatReadRateLimit(limiter, {
      ...INPUT,
      action: 'messages_read',
    }),
    (error: unknown) => (
      error instanceof StoryChatRateLimitError
      && error.code === 'rate_limited'
      && error.retryAfterSeconds === 19
    ),
  );
});

test('GET route error boundary maps read denial to private 429 with Retry-After', async () => {
  const response = storyChatGetErrorResponse(
    new StoryChatRateLimitError('rate_limited', { retryAfterSeconds: 11 }),
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '11');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await response.json()).error.code, 'rate_limited');
});

test('typed access races survive and unknown backend failures fail closed', async (t) => {
  await t.test('typed consent race', async () => {
    const limiter = new FakeReadLimiter();
    limiter.error = new StoryChatRateLimitError('consent_required');
    await assert.rejects(
      enforceStoryChatReadRateLimit(limiter, INPUT),
      (error: unknown) => (
        error instanceof StoryChatRateLimitError
        && error.code === 'consent_required'
      ),
    );
  });

  await t.test('unknown backend failure', async () => {
    const limiter = new FakeReadLimiter();
    limiter.error = new Error('private connection detail');
    await assert.rejects(
      enforceStoryChatReadRateLimit(limiter, INPUT),
      (error: unknown) => (
        error instanceof StoryChatRateLimitError
        && error.code === 'storage_unavailable'
        && !error.message.includes('private connection detail')
      ),
    );
  });
});
