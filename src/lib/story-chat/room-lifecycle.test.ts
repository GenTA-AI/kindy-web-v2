import assert from 'node:assert/strict';
import test from 'node:test';

import type { StoryChatRoomRecord } from '@/types/story-chat-api';
import {
  mapOpenSessionDatabaseError,
  StoryChatOpenSessionRequestSchema,
  StoryChatRoomLifecycle,
  StoryChatRoomLifecycleError,
  type StoryChatOpenSessionResult,
  type StoryChatRoomLifecycleRepository,
} from './room-lifecycle';
import {
  StoryChatRateLimitError,
  type StoryChatRateLimiter,
  type StoryChatRateLimitResult,
} from './rate-limit';

const PARENT_ID = 'parent-1';
const CHILD_ID = '11111111-1111-4111-8111-111111111111';
const ROOM_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_SESSION_ID = '33333333-3333-4333-8333-333333333333';
const SESSION_ID = '44444444-4444-4444-8444-444444444444';
const NOW = '2026-08-21T00:00:00.000Z';

function room(
  status: StoryChatRoomRecord['status'] = 'invited',
): StoryChatRoomRecord {
  return {
    id: ROOM_ID,
    childId: CHILD_ID,
    experienceId: 'seurat.river',
    releaseId: 'release.seurat-river-1',
    releaseVersion: '1.0.0',
    releaseChannel: 'staging',
    releaseManifestSha256: 'a'.repeat(64),
    currentNodeId: 'n.intro',
    status,
    revision: 0,
    messageSequence: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

class FakeRepository implements StoryChatRoomLifecycleRepository {
  calls: string[] = [];
  owned = true;
  consented = true;
  currentRoom: StoryChatRoomRecord | null = room();
  openedInput: {
    parentId: string;
    childId: string;
    roomId: string;
    clientSessionId: string;
    expectedReleaseChannel: 'staging' | 'production';
  } | null = null;

  async findOwnedChild(): Promise<boolean> {
    this.calls.push('ownership');
    return this.owned;
  }

  async hasActiveConsent(): Promise<boolean> {
    this.calls.push('consent');
    return this.consented;
  }

  async findRoom(): Promise<StoryChatRoomRecord | null> {
    this.calls.push('room');
    return this.currentRoom;
  }

  async openSession(input: {
    parentId: string;
    childId: string;
    roomId: string;
    clientSessionId: string;
    expectedReleaseChannel: 'staging' | 'production';
  }): Promise<StoryChatOpenSessionResult> {
    this.calls.push('open');
    this.openedInput = input;
    return {
      session: {
        id: SESSION_ID,
        clientSessionId: input.clientSessionId,
        roomId: input.roomId,
        openedRevision: 0,
        startedAt: NOW,
        endedAt: null,
        resumedExisting: false,
        idempotentReplay: false,
      },
      room: room('active'),
    };
  }
}

class FakeRateLimiter implements StoryChatRateLimiter {
  inputs: Array<Parameters<StoryChatRateLimiter['consume']>[0]> = [];
  result: StoryChatRateLimitResult = {
    allowed: true,
    retryAfterSeconds: 0,
    idempotentReplay: false,
  };

  async consume(
    input: Parameters<StoryChatRateLimiter['consume']>[0],
  ): Promise<StoryChatRateLimitResult> {
    this.inputs.push(input);
    return this.result;
  }
}

function lifecycle(
  repository = new FakeRepository(),
  runtimeEnabled = true,
  rateLimiter = new FakeRateLimiter(),
  releaseChannel: 'staging' | 'production' | null = 'staging',
) {
  return {
    repository,
    rateLimiter,
    service: new StoryChatRoomLifecycle({
      config: {
        runtimeEnabled,
        freeTextEnabled: false,
        releaseChannel,
      },
      repository,
      rateLimiter,
    }),
  };
}

function request() {
  return {
    child_id: CHILD_ID,
    client_session_id: CLIENT_SESSION_ID,
  };
}

async function rejectsWithCode(
  promise: Promise<unknown>,
  code: StoryChatRoomLifecycleError['code'],
) {
  await assert.rejects(
    promise,
    (error: unknown) =>
      error instanceof StoryChatRoomLifecycleError && error.code === code,
  );
}

test('open-session request accepts only two UUID identifiers', () => {
  assert.equal(StoryChatOpenSessionRequestSchema.safeParse(request()).success, true);
  assert.equal(StoryChatOpenSessionRequestSchema.safeParse({
    ...request(),
    text: 'raw child text must not cross this boundary',
  }).success, false);
  assert.equal(StoryChatOpenSessionRequestSchema.safeParse({
    ...request(),
    release_channel: 'production',
  }).success, false);
  assert.equal(StoryChatOpenSessionRequestSchema.safeParse({
    child_id: CHILD_ID,
    client_session_id: 'not-a-uuid',
  }).success, false);
});

test('route-level lifecycle checks ownership then active consent before room access', async (t) => {
  await t.test('runtime disabled performs no storage read', async () => {
    const context = lifecycle(new FakeRepository(), false);
    await rejectsWithCode(
      context.service.openSession({
        parentId: PARENT_ID,
        roomId: ROOM_ID,
        request: request(),
      }),
      'runtime_disabled',
    );
    assert.deepEqual(context.repository.calls, []);
    assert.deepEqual(context.rateLimiter.inputs, []);
  });

  await t.test('ownership denial stops before consent', async () => {
    const context = lifecycle();
    context.repository.owned = false;
    await rejectsWithCode(
      context.service.openSession({
        parentId: PARENT_ID,
        roomId: ROOM_ID,
        request: request(),
      }),
      'child_not_found',
    );
    assert.deepEqual(context.repository.calls, ['ownership']);
    assert.deepEqual(context.rateLimiter.inputs, []);
  });

  await t.test('revoked or absent consent stops before room access', async () => {
    const context = lifecycle();
    context.repository.consented = false;
    await rejectsWithCode(
      context.service.openSession({
        parentId: PARENT_ID,
        roomId: ROOM_ID,
        request: request(),
      }),
      'consent_required',
    );
    assert.deepEqual(context.repository.calls, ['ownership', 'consent']);
    assert.deepEqual(context.rateLimiter.inputs, []);
  });
});

test('only invited, active, awaiting_child, and paused rooms reach the atomic RPC', async (t) => {
  for (const status of ['invited', 'active', 'awaiting_child', 'paused'] as const) {
    await t.test(`${status} is openable`, async () => {
      const context = lifecycle();
      context.repository.currentRoom = room(status);
      await context.service.openSession({
        parentId: PARENT_ID,
        roomId: ROOM_ID,
        request: request(),
      });
      assert.deepEqual(context.repository.calls, ['ownership', 'consent', 'room', 'open']);
    });
  }

  for (const status of [
    'cinematic_ready',
    'generating_art',
    'chapter_complete',
    'locked',
  ] as const) {
    await t.test(`${status} fails closed`, async () => {
      const context = lifecycle();
      context.repository.currentRoom = room(status);
      await rejectsWithCode(
        context.service.openSession({
          parentId: PARENT_ID,
          roomId: ROOM_ID,
          request: request(),
        }),
        'room_not_openable',
      );
      assert.deepEqual(context.repository.calls, ['ownership', 'consent', 'room']);
      assert.deepEqual(context.rateLimiter.inputs, []);
    });
  }
});

test('server deploy channel mismatch fails before limiter or session mutation', async (t) => {
  for (const releaseChannel of ['production', null] as const) {
    await t.test(releaseChannel ?? 'missing channel', async () => {
      const context = lifecycle(
        new FakeRepository(),
        true,
        new FakeRateLimiter(),
        releaseChannel,
      );
      await rejectsWithCode(
        context.service.openSession({
          parentId: PARENT_ID,
          roomId: ROOM_ID,
          request: request(),
        }),
        'release_unavailable',
      );
      assert.deepEqual(
        context.repository.calls,
        releaseChannel
          ? ['ownership', 'consent', 'room']
          : ['ownership', 'consent'],
      );
      assert.deepEqual(context.rateLimiter.inputs, []);
      assert.equal(context.repository.openedInput, null);
    });
  }
});

test('session response returns canonical IDs and the atomic room snapshot', async () => {
  const context = lifecycle();
  const result = await context.service.openSession({
    parentId: PARENT_ID,
    roomId: ROOM_ID,
    request: request(),
  });

  assert.deepEqual(context.repository.openedInput, {
    parentId: PARENT_ID,
    childId: CHILD_ID,
    roomId: ROOM_ID,
    clientSessionId: CLIENT_SESSION_ID,
    expectedReleaseChannel: 'staging',
  });
  assert.deepEqual(context.rateLimiter.inputs, [{
    parentId: PARENT_ID,
    childId: CHILD_ID,
    roomId: ROOM_ID,
    action: 'session_open',
    idempotencyKey: CLIENT_SESSION_ID,
  }]);
  assert.equal(result.session.id, SESSION_ID);
  assert.equal(result.session.client_session_id, CLIENT_SESSION_ID);
  assert.equal(result.session.resumed_existing, false);
  assert.equal(result.session.idempotent_replay, false);
  assert.equal(result.room.status, 'active');
  assert.equal(result.room.release_manifest_sha256, 'a'.repeat(64));
});

test('session rate-limit denial stops before the release-gated open RPC', async () => {
  const context = lifecycle();
  context.rateLimiter.result = {
    allowed: false,
    retryAfterSeconds: 19,
    idempotentReplay: false,
  };

  await assert.rejects(
    context.service.openSession({
      parentId: PARENT_ID,
      roomId: ROOM_ID,
      request: request(),
    }),
    (error: unknown) =>
      error instanceof StoryChatRateLimitError
      && error.code === 'rate_limited'
      && error.retryAfterSeconds === 19,
  );
  assert.deepEqual(context.repository.calls, ['ownership', 'consent', 'room']);
  assert.equal(context.repository.openedInput, null);
});

test('atomic RPC markers map to narrow lifecycle errors without leaking details', () => {
  for (const [marker, code] of [
    ['CHAT_INVALID_SESSION_REQUEST', 'invalid_request'],
    ['CHAT_CHILD_ACCESS_DENIED', 'child_not_found'],
    ['CHAT_CONSENT_REQUIRED', 'consent_required'],
    ['CHAT_ROOM_NOT_FOUND', 'room_not_found'],
    ['CHAT_ROOM_NOT_OPENABLE', 'room_not_openable'],
    ['CHAT_RELEASE_UNAVAILABLE', 'release_unavailable'],
    ['CHAT_CLIENT_SESSION_CONFLICT', 'client_session_conflict'],
  ] as const) {
    assert.equal(mapOpenSessionDatabaseError({ message: marker }).code, code);
  }
  assert.equal(
    mapOpenSessionDatabaseError({ message: 'database detail that must stay private' }).code,
    'storage_unavailable',
  );
});
