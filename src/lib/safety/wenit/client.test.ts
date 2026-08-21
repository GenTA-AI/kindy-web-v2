import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WenitSafeGuardClient,
  WENIT_MODERATION_ENDPOINT,
} from './client';
import type {
  WenitPollScheduleRequest,
  WenitPollScheduleResult,
  WenitPollScheduler,
} from './poll-scheduler';
import {
  makeWenitCompletedPayload,
  WENIT_TEST_CONTRACT,
} from './test-fixtures';

const TEST_API_KEY = 'unit-test-api-key-exact';
const TEST_TEXT = '합성 테스트 문장';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

class AdvancingScheduler implements WenitPollScheduler {
  readonly calls: WenitPollScheduleRequest[] = [];

  constructor(private readonly clock: { now: number }) {}

  async acquire(
    request: WenitPollScheduleRequest,
  ): Promise<WenitPollScheduleResult> {
    this.calls.push(request);
    this.clock.now = Math.max(this.clock.now, request.earliestStartAtMs);
    return { acquired: true, startedAtMs: this.clock.now };
  }
}

function makeClient(input: {
  fetch: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;
  scheduler: WenitPollScheduler;
  clock?: { now: number };
  requestTimeoutMs?: number;
  totalDeadlineMs?: number;
}): WenitSafeGuardClient {
  return new WenitSafeGuardClient({
    apiKey: TEST_API_KEY,
    credentialScope: 'kindy-test-primary',
    contract: WENIT_TEST_CONTRACT,
    scheduler: input.scheduler,
    fetch: input.fetch,
    now: input.clock ? () => input.clock?.now ?? 0 : undefined,
    random: () => 0,
    requestTimeoutMs: input.requestTimeoutMs,
    totalDeadlineMs: input.totalDeadlineMs,
  });
}

test('POST 1회와 task GET만 수행하고 exact X-API-Key 외 인증 헤더를 쓰지 않는다', async () => {
  const clock = { now: 0 };
  const scheduler = new AdvancingScheduler(clock);
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const responses = [
    jsonResponse({ success: true, data: { task_id: 'task_123' } }),
    jsonResponse({ success: true, data: { status: 'processing' } }),
    jsonResponse(makeWenitCompletedPayload()),
  ];
  const client = makeClient({
    clock,
    scheduler,
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      const response = responses.shift();
      assert.ok(response);
      return response;
    },
  });

  const result = await client.moderateText(TEST_TEXT);
  assert.equal(result.decision, 'allow');
  assert.equal(result.allowsExposure, true);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, WENIT_MODERATION_ENDPOINT);
  assert.equal(calls[0].init?.method, 'POST');
  assert.equal(
    (calls[0].init?.body as FormData).get('prompt'),
    TEST_TEXT,
  );
  assert.equal(calls[1].url, `${WENIT_MODERATION_ENDPOINT}/task_123`);
  assert.equal(calls[2].url, `${WENIT_MODERATION_ENDPOINT}/task_123`);

  for (const call of calls) {
    const headers = call.init?.headers as Record<string, string>;
    assert.equal(headers['X-API-Key'], TEST_API_KEY);
    assert.equal(Object.hasOwn(headers, 'Authorization'), false);
    assert.deepEqual(Object.keys(headers).sort(), ['Accept', 'X-API-Key']);
  }
  assert.equal(scheduler.calls.length, 2);
  assert.equal(scheduler.calls[0].credentialScope, 'kindy-test-primary');
  assert.equal(
    JSON.stringify(scheduler.calls).includes(TEST_API_KEY),
    false,
  );
  assert.equal(JSON.stringify(result).includes(TEST_TEXT), false);
  assert.equal(JSON.stringify(result).includes(TEST_API_KEY), false);
  assert.equal(JSON.stringify(client).includes(TEST_API_KEY), false);
});

test('poll 429는 2초, 4초 backoff 후 GET만 재개하고 POST를 반복하지 않는다', async () => {
  const clock = { now: 0 };
  const scheduler = new AdvancingScheduler(clock);
  let postCount = 0;
  let getCount = 0;
  const client = makeClient({
    clock,
    scheduler,
    fetch: async (_url, init) => {
      if (init?.method === 'POST') {
        postCount += 1;
        return jsonResponse({ success: true, data: { task_id: 'task_backoff' } });
      }
      getCount += 1;
      if (getCount <= 2) return jsonResponse({ error: 'limited' }, 429);
      return jsonResponse(makeWenitCompletedPayload());
    },
  });

  const result = await client.moderateText(TEST_TEXT);
  assert.equal(result.decision, 'allow');
  assert.equal(postCount, 1);
  assert.equal(getCount, 3);
  assert.deepEqual(
    scheduler.calls.map((call) => call.earliestStartAtMs),
    [1_100, 3_100, 7_100],
  );
});

test('submit 429는 idempotency 미확인 POST를 재시도하지 않고 닫는다', async () => {
  let calls = 0;
  const client = makeClient({
    scheduler: new AdvancingScheduler({ now: 0 }),
    fetch: async () => {
      calls += 1;
      return jsonResponse({ error: 'limited' }, 429);
    },
  });

  assert.deepEqual(await client.moderateText(TEST_TEXT), {
    decision: 'unavailable',
    allowsExposure: false,
    reason: 'rate_limited',
  });
  assert.equal(calls, 1);
});

test('분산 scheduler가 없거나 deadline을 넘기면 fail closed한다', async (t) => {
  for (const [name, scheduleResult, expectedReason] of [
    [
      'unavailable',
      { acquired: false, reason: 'unavailable' },
      'scheduler_unavailable',
    ],
    ['deadline', { acquired: false, reason: 'deadline' }, 'timeout'],
  ] as const) {
    await t.test(name, async () => {
      const scheduler: WenitPollScheduler = {
        acquire: async () => scheduleResult,
      };
      let calls = 0;
      const client = makeClient({
        scheduler,
        fetch: async () => {
          calls += 1;
          return jsonResponse({ success: true, data: { task_id: 'task_no_slot' } });
        },
      });

      const result = await client.moderateText(TEST_TEXT);
      assert.equal(result.decision, 'unavailable');
      if (result.decision === 'unavailable') {
        assert.equal(result.reason, expectedReason);
      }
      assert.equal(calls, 1);
    });
  }
});

test('request timeout과 malformed/unknown payload는 예외나 원문 없이 닫는다', async (t) => {
  await t.test('timeout', async () => {
    const client = makeClient({
      scheduler: new AdvancingScheduler({ now: 0 }),
      requestTimeoutMs: 5,
      totalDeadlineMs: 50,
      fetch: async (_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true },
        );
      }),
    });
    assert.deepEqual(await client.moderateText(TEST_TEXT), {
      decision: 'unavailable',
      allowsExposure: false,
      reason: 'timeout',
    });
  });

  for (const [name, pollPayload, expectedReason] of [
    ['malformed', { success: true, data: { status: 'completed' } }, 'malformed_response'],
    ['unknown', { success: true, data: { status: 'new_status' } }, 'unknown_response'],
  ] as const) {
    await t.test(name, async () => {
      let call = 0;
      const clock = { now: 0 };
      const client = makeClient({
        clock,
        scheduler: new AdvancingScheduler(clock),
        fetch: async () => {
          call += 1;
          return call === 1
            ? jsonResponse({ success: true, data: { task_id: 'task_bad' } })
            : jsonResponse(pollPayload);
        },
      });
      const result = await client.moderateText(TEST_TEXT);
      assert.equal(result.decision, 'unavailable');
      if (result.decision === 'unavailable') {
        assert.equal(result.reason, expectedReason);
      }
      assert.equal(JSON.stringify(result).includes(TEST_TEXT), false);
      assert.equal(JSON.stringify(result).includes(TEST_API_KEY), false);
    });
  }
});

test('공백·4KiB 초과 입력은 vendor 호출 전에 거절한다', async () => {
  let calls = 0;
  const client = makeClient({
    scheduler: new AdvancingScheduler({ now: 0 }),
    fetch: async () => {
      calls += 1;
      return jsonResponse({});
    },
  });

  for (const input of ['   ', '가'.repeat(1_366)]) {
    const result = await client.moderateText(input);
    assert.equal(result.decision, 'unavailable');
    if (result.decision === 'unavailable') {
      assert.equal(result.reason, 'invalid_input');
    }
  }
  assert.equal(calls, 0);
});
