import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WENIT_MINIMUM_POLL_START_SPACING_MS,
  type WenitPollScheduleRequest,
} from './poll-scheduler';
import {
  SupabaseWenitPollScheduler,
  type PollSchedulerSupabaseClient,
} from './supabase-poll-scheduler';

const RESERVATION_ID = '018f60f7-f9c2-7d61-8e61-8fbffef932a1';

type Rpc = PollSchedulerSupabaseClient['rpc'];

function schedulerRequest(
  overrides: Partial<WenitPollScheduleRequest> = {},
): WenitPollScheduleRequest {
  return {
    credentialScope: 'wenit-primary-v1',
    earliestStartAtMs: 1_000,
    deadlineAtMs: 10_000,
    minimumStartSpacingMs: WENIT_MINIMUM_POLL_START_SPACING_MS,
    ...overrides,
  };
}

function mockClient(rpc: Rpc): PollSchedulerSupabaseClient {
  return { rpc };
}

test('reserves an opaque scope and waits outside PostgreSQL until the slot', async () => {
  let nowMs = 1_000;
  const sleeps: number[] = [];
  const calls: Array<Readonly<{
    name: string;
    arguments: Record<string, unknown>;
  }>> = [];

  const rpc = (async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, arguments: args });
    return name === 'reserve_wenit_poll_start'
      ? {
          data: [{
            acquired: true,
            start_after: '1970-01-01T00:00:02.100Z',
            reservation_replay: false,
          }],
          error: null,
        }
      : {
          data: [{
            claim_status: 'claimed',
            start_after: '1970-01-01T00:00:02.100Z',
            claim_replay: false,
          }],
          error: null,
        };
  }) as Rpc;

  const scheduler = new SupabaseWenitPollScheduler(mockClient(rpc), {
    now: () => nowMs,
    sleep: async (durationMs) => {
      sleeps.push(durationMs);
      nowMs += durationMs;
    },
    createReservationId: () => RESERVATION_ID,
  });

  assert.deepEqual(await scheduler.acquire(schedulerRequest()), {
    acquired: true,
    startedAtMs: 2_100,
  });
  assert.deepEqual(calls, [
    {
      name: 'reserve_wenit_poll_start',
      arguments: {
        p_credential_scope: 'wenit-primary-v1',
        p_reservation_id: RESERVATION_ID,
        p_earliest_start_at: '1970-01-01T00:00:01.000Z',
        p_deadline_at: '1970-01-01T00:00:10.000Z',
      },
    },
    {
      name: 'claim_wenit_poll_start',
      arguments: {
        p_credential_scope: 'wenit-primary-v1',
        p_reservation_id: RESERVATION_ID,
        p_deadline_at: '1970-01-01T00:00:10.000Z',
      },
    },
  ]);
  assert.deepEqual(sleeps, [1_100]);
});

test('rounds PostgreSQL microseconds upward and never starts early', async () => {
  let nowMs = 1_000;
  const sleeps: number[] = [];
  const rpc = (async (name: string) => name === 'reserve_wenit_poll_start'
    ? {
        data: [{
          acquired: true,
          start_after: '1970-01-01T00:00:02.100001+00:00',
          reservation_replay: false,
        }],
        error: null,
      }
    : {
        data: [{
          claim_status: 'claimed',
          start_after: '1970-01-01T00:00:02.100001+00:00',
          claim_replay: false,
        }],
        error: null,
      }) as Rpc;

  const scheduler = new SupabaseWenitPollScheduler(mockClient(rpc), {
    now: () => nowMs,
    sleep: async (durationMs) => {
      sleeps.push(durationMs);
      nowMs += durationMs;
    },
    createReservationId: () => RESERVATION_ID,
  });

  assert.deepEqual(await scheduler.acquire(schedulerRequest()), {
    acquired: true,
    startedAtMs: 2_101,
  });
  assert.deepEqual(sleeps, [1_101]);
});

test('returns deadline without calling PostgreSQL when the request is expired', async () => {
  let calls = 0;
  const rpc = (async () => {
    calls += 1;
    throw new Error('must not be called');
  }) as Rpc;
  const scheduler = new SupabaseWenitPollScheduler(mockClient(rpc), {
    now: () => 10_000,
    createReservationId: () => RESERVATION_ID,
  });

  assert.deepEqual(await scheduler.acquire(schedulerRequest()), {
    acquired: false,
    reason: 'deadline',
  });
  assert.equal(calls, 0);
});

test('maps a database deadline denial without waiting', async () => {
  let sleepCalled = false;
  const rpc = (async () => ({
    data: [{ acquired: false, start_after: null, reservation_replay: false }],
    error: null,
  })) as Rpc;
  const scheduler = new SupabaseWenitPollScheduler(mockClient(rpc), {
    now: () => 1_000,
    sleep: async () => { sleepCalled = true; },
    createReservationId: () => RESERVATION_ID,
  });

  assert.deepEqual(await scheduler.acquire(schedulerRequest()), {
    acquired: false,
    reason: 'deadline',
  });
  assert.equal(sleepCalled, false);
});

test('fails closed on RPC errors, malformed rows, and invalid scope or spacing', async () => {
  const cases: Array<unknown> = [
    { data: null, error: { message: 'offline' } },
    { data: [], error: null },
    { data: [{ acquired: true, start_after: null, reservation_replay: false }], error: null },
    { data: [{ acquired: false, start_after: null, reservation_replay: true }], error: null },
    { data: [{ acquired: true, start_after: 'not-a-time', reservation_replay: false }], error: null },
    { data: [
      { acquired: true, start_after: '1970-01-01T00:00:02.100Z', reservation_replay: false },
      { acquired: true, start_after: '1970-01-01T00:00:03.200Z', reservation_replay: false },
    ], error: null },
  ];

  for (const response of cases) {
    const rpc = (async () => response) as Rpc;
    const scheduler = new SupabaseWenitPollScheduler(mockClient(rpc), {
      now: () => 1_000,
      createReservationId: () => RESERVATION_ID,
    });
    assert.deepEqual(await scheduler.acquire(schedulerRequest()), {
      acquired: false,
      reason: 'unavailable',
    });
  }

  let calls = 0;
  const rpc = (async () => {
    calls += 1;
    return { data: null, error: null };
  }) as Rpc;
  const scheduler = new SupabaseWenitPollScheduler(mockClient(rpc), {
    now: () => 1_000,
    createReservationId: () => RESERVATION_ID,
  });

  assert.deepEqual(
    await scheduler.acquire(schedulerRequest({ credentialScope: 'raw/key' })),
    { acquired: false, reason: 'unavailable' },
  );
  const invalidSpacingRequest = {
    ...schedulerRequest(),
    minimumStartSpacingMs: 1_000,
  } as unknown as WenitPollScheduleRequest;
  assert.deepEqual(
    await scheduler.acquire(invalidSpacingRequest),
    { acquired: false, reason: 'unavailable' },
  );
  assert.equal(calls, 0);
});

test('fails closed if an outside-database timer does not reach the reserved slot', async () => {
  let sleepCalls = 0;
  const rpc = (async () => ({
    data: [{
      acquired: true,
      start_after: '1970-01-01T00:00:02.100Z',
      reservation_replay: false,
    }],
    error: null,
  })) as Rpc;
  const scheduler = new SupabaseWenitPollScheduler(mockClient(rpc), {
    now: () => 1_000,
    sleep: async () => { sleepCalls += 1; },
    createReservationId: () => RESERVATION_ID,
  });

  assert.deepEqual(await scheduler.acquire(schedulerRequest()), {
    acquired: false,
    reason: 'unavailable',
  });
  assert.equal(sleepCalls, 3);
});

test('fails closed when the process wakes after the request deadline', async () => {
  let nowMs = 1_000;
  const rpc = (async () => ({
    data: [{
      acquired: true,
      start_after: '1970-01-01T00:00:09.900Z',
      reservation_replay: false,
    }],
    error: null,
  })) as Rpc;
  const scheduler = new SupabaseWenitPollScheduler(mockClient(rpc), {
    now: () => nowMs,
    sleep: async () => { nowMs = 10_001; },
    createReservationId: () => RESERVATION_ID,
  });

  assert.deepEqual(await scheduler.acquire(schedulerRequest()), {
    acquired: false,
    reason: 'deadline',
  });
});

test('rechecks a late initial wake and waits for the DB actual-start claim', async () => {
  let nowMs = 1_000;
  let claimCalls = 0;
  const rpc = (async (name: string) => {
    if (name === 'reserve_wenit_poll_start') {
      return {
        data: [{
          acquired: true,
          start_after: '1970-01-01T00:00:02.100Z',
          reservation_replay: false,
        }],
        error: null,
      };
    }
    claimCalls += 1;
    return claimCalls === 1
      ? {
          data: [{
            claim_status: 'wait',
            start_after: '1970-01-01T00:00:03.700Z',
            claim_replay: false,
          }],
          error: null,
        }
      : {
          data: [{
            claim_status: 'claimed',
            start_after: '1970-01-01T00:00:03.700Z',
            claim_replay: false,
          }],
          error: null,
        };
  }) as Rpc;
  const scheduler = new SupabaseWenitPollScheduler(mockClient(rpc), {
    now: () => nowMs,
    sleep: async (durationMs) => {
      nowMs = nowMs === 1_000 ? 3_190 : nowMs + durationMs;
    },
    createReservationId: () => RESERVATION_ID,
  });

  assert.deepEqual(await scheduler.acquire(schedulerRequest()), {
    acquired: true,
    startedAtMs: 3_700,
  });
  assert.equal(claimCalls, 2);
});

test('fails closed when an actual-start claim response arrives over 250 ms late', async () => {
  let nowMs = 1_000;
  const rpc = (async (name: string) => {
    if (name === 'reserve_wenit_poll_start') {
      return {
        data: [{
          acquired: true,
          start_after: '1970-01-01T00:00:02.100Z',
          reservation_replay: false,
        }],
        error: null,
      };
    }
    nowMs += 251;
    return {
      data: [{
        claim_status: 'claimed',
        start_after: '1970-01-01T00:00:02.100Z',
        claim_replay: false,
      }],
      error: null,
    };
  }) as Rpc;
  const scheduler = new SupabaseWenitPollScheduler(mockClient(rpc), {
    now: () => nowMs,
    sleep: async (durationMs) => { nowMs += durationMs; },
    createReservationId: () => RESERVATION_ID,
  });

  assert.deepEqual(await scheduler.acquire(schedulerRequest()), {
    acquired: false,
    reason: 'unavailable',
  });
});

test('fails closed on malformed, replayed, or failed actual-start claims', async () => {
  const claimResponses: Array<unknown> = [
    { data: null, error: { message: 'offline' } },
    { data: [], error: null },
    { data: [{ claim_status: 'claimed', start_after: null, claim_replay: false }], error: null },
    { data: [{ claim_status: 'wait', start_after: null, claim_replay: false }], error: null },
    { data: [{ claim_status: 'deadline', start_after: '1970-01-01T00:00:02.100Z', claim_replay: false }], error: null },
    { data: [{ claim_status: 'claimed', start_after: '1970-01-01T00:00:02.100Z', claim_replay: true }], error: null },
  ];

  for (const claimResponse of claimResponses) {
    let nowMs = 1_000;
    const rpc = (async (name: string) => name === 'reserve_wenit_poll_start'
      ? {
          data: [{
            acquired: true,
            start_after: '1970-01-01T00:00:02.100Z',
            reservation_replay: false,
          }],
          error: null,
        }
      : claimResponse) as Rpc;
    const scheduler = new SupabaseWenitPollScheduler(mockClient(rpc), {
      now: () => nowMs,
      sleep: async (durationMs) => { nowMs += durationMs; },
      createReservationId: () => RESERVATION_ID,
    });

    assert.deepEqual(await scheduler.acquire(schedulerRequest()), {
      acquired: false,
      reason: 'unavailable',
    });
  }
});
