import assert from 'node:assert/strict';
import test from 'node:test';

import { storyChatRateLimitErrorResponse } from './http';
import {
  enforceStoryChatRateLimit,
  mapRateLimitDatabaseError,
  StoryChatRateLimitError,
  type StoryChatRateLimiter,
  type StoryChatRateLimitResult,
} from './rate-limit';

const INPUT = {
  parentId: 'parent-1',
  childId: '11111111-1111-4111-8111-111111111111',
  roomId: '22222222-2222-4222-8222-222222222222',
  action: 'authored_turn' as const,
  idempotencyKey: '33333333-3333-4333-8333-333333333333',
};

class FakeLimiter implements StoryChatRateLimiter {
  result: StoryChatRateLimitResult = {
    allowed: true,
    retryAfterSeconds: 0,
    idempotentReplay: false,
  };
  error: Error | null = null;

  async consume(): Promise<StoryChatRateLimitResult> {
    if (this.error) throw this.error;
    return this.result;
  }
}

test('allowed and idempotent limiter decisions continue without client details', async () => {
  const limiter = new FakeLimiter();
  assert.deepEqual(await enforceStoryChatRateLimit(limiter, INPUT), limiter.result);

  limiter.result = {
    allowed: true,
    retryAfterSeconds: 0,
    idempotentReplay: true,
  };
  assert.equal((await enforceStoryChatRateLimit(limiter, INPUT)).idempotentReplay, true);
});

test('denial becomes a bounded rate-limit error and backend failure stays closed', async (t) => {
  await t.test('denied decision', async () => {
    const limiter = new FakeLimiter();
    limiter.result = {
      allowed: false,
      retryAfterSeconds: 23,
      idempotentReplay: false,
    };
    await assert.rejects(
      enforceStoryChatRateLimit(limiter, INPUT),
      (error: unknown) =>
        error instanceof StoryChatRateLimitError
        && error.code === 'rate_limited'
        && error.retryAfterSeconds === 23,
    );
  });

  await t.test('unclassified backend failure', async () => {
    const limiter = new FakeLimiter();
    limiter.error = new Error('private database detail');
    await assert.rejects(
      enforceStoryChatRateLimit(limiter, INPUT),
      (error: unknown) =>
        error instanceof StoryChatRateLimitError
        && error.code === 'storage_unavailable'
        && error.message.includes('private database detail') === false,
    );
  });
});

test('database access races map to existing generic authorization classes', () => {
  assert.equal(
    mapRateLimitDatabaseError({ message: 'CHAT_CHILD_ACCESS_DENIED' }).code,
    'child_not_found',
  );
  assert.equal(
    mapRateLimitDatabaseError({ details: 'CHAT_CONSENT_REQUIRED' }).code,
    'consent_required',
  );
  assert.equal(
    mapRateLimitDatabaseError({ hint: 'CHAT_ROOM_NOT_FOUND' }).code,
    'room_not_found',
  );
  assert.equal(
    mapRateLimitDatabaseError({ message: 'connection refused' }).code,
    'storage_unavailable',
  );
});

test('429 response is generic, private, and carries an integer Retry-After', async () => {
  const response = storyChatRateLimitErrorResponse(
    new StoryChatRateLimitError('rate_limited', { retryAfterSeconds: 17 }),
  );
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('retry-after'), '17');
  assert.deepEqual(body, {
    error: {
      code: 'rate_limited',
      message: '요청이 너무 빨라요. 잠시 후 다시 시도해 주세요.',
    },
  });
  assert.equal(JSON.stringify(body).includes('parent'), false);
  assert.equal(JSON.stringify(body).includes('room'), false);
});

test('limiter storage failure returns 503 without Retry-After', async () => {
  const response = storyChatRateLimitErrorResponse(
    new StoryChatRateLimitError('storage_unavailable'),
  );

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('retry-after'), null);
  assert.equal((await response.json()).error.code, 'storage_unavailable');
});
