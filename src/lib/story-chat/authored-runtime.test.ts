import assert from 'node:assert/strict';
import test from 'node:test';

import { validExperienceGraphFixture } from '@/contracts/fixtures/experience-graph.v1.fixtures';
import { parseExperienceGraph } from '@/contracts/experience-graph.v1';
import type {
  StoryChatMessageRecord,
  StoryChatRoomRecord,
  StoryChatSessionRecord,
  StoryChatTurnRecord,
  StoryChatTurnRequest,
} from '@/types/story-chat-api';
import {
  STORY_CHAT_FREE_TEXT_FALLBACK,
  StoryChatRuntime,
  StoryChatRuntimeError,
  hashTurnRequest,
  mapAuthoredCommitDatabaseError,
  resolveAuthoredSelection,
  type ApprovedStoryGraphProvider,
  type StoryChatCommitInput,
  type StoryChatCommitResult,
  type StoryChatRepository,
} from './authored-runtime';
import {
  StoryChatRateLimitError,
  type StoryChatRateLimiter,
  type StoryChatRateLimitResult,
} from './rate-limit';

const PARENT_ID = 'parent-1';
const CHILD_ID = '11111111-1111-4111-8111-111111111111';
const ROOM_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const CLIENT_TURN_ID = '44444444-4444-4444-8444-444444444444';
const TURN_ID = '55555555-5555-4555-8555-555555555555';
const RELEASE_HASH = 'a'.repeat(64);
const NOW = '2026-08-21T00:00:00.000Z';

function room(overrides: Partial<StoryChatRoomRecord> = {}): StoryChatRoomRecord {
  return {
    id: ROOM_ID,
    childId: CHILD_ID,
    experienceId: validExperienceGraphFixture.experienceId,
    releaseId: 'release.seurat-river-1',
    releaseVersion: validExperienceGraphFixture.releaseVersion,
    releaseChannel: 'staging',
    releaseManifestSha256: RELEASE_HASH,
    currentNodeId: 'n.reply',
    status: 'awaiting_child',
    revision: 3,
    messageSequence: 10,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function session(): StoryChatSessionRecord {
  return {
    id: SESSION_ID,
    roomId: ROOM_ID,
    openedRevision: 0,
    closedRevision: null,
    startedAt: NOW,
    endedAt: null,
  };
}

function quickReplyRequest(
  overrides: Partial<Extract<StoryChatTurnRequest, { kind: 'quick_reply' }>> = {},
): Extract<StoryChatTurnRequest, { kind: 'quick_reply' }> {
  return {
    kind: 'quick_reply',
    child_id: CHILD_ID,
    session_id: SESSION_ID,
    client_turn_id: CLIENT_TURN_ID,
    expected_revision: 3,
    selection: { node_id: 'n.reply', option_id: 'option.watch' },
    ...overrides,
  };
}

class FakeRepository implements StoryChatRepository {
  calls: string[] = [];
  owned = true;
  consented = true;
  currentRoom: StoryChatRoomRecord | null = room();
  currentSession: StoryChatSessionRecord | null = session();
  existingTurn: StoryChatTurnRecord | null = null;
  committedInput: StoryChatCommitInput | null = null;
  commitWasReplay = false;
  listedMessagesInput: {
    roomId: string;
    afterSequence: number;
    upToSequence: number;
    limit: number;
  } | null = null;

  async findOwnedChild(): Promise<boolean> {
    this.calls.push('ownership');
    return this.owned;
  }

  async hasActiveConsent(): Promise<boolean> {
    this.calls.push('consent');
    return this.consented;
  }

  async listRooms(): Promise<StoryChatRoomRecord[]> {
    this.calls.push('rooms');
    return this.currentRoom ? [this.currentRoom] : [];
  }

  async findRoom(): Promise<StoryChatRoomRecord | null> {
    this.calls.push('room');
    return this.currentRoom;
  }

  async listMessages(input: {
    roomId: string;
    afterSequence: number;
    upToSequence: number;
    limit: number;
  }): Promise<StoryChatMessageRecord[]> {
    this.calls.push('messages');
    this.listedMessagesInput = input;
    return [];
  }

  async findOpenSession(): Promise<StoryChatSessionRecord | null> {
    this.calls.push('session');
    return this.currentSession;
  }

  async findTurnByClientId(): Promise<StoryChatTurnRecord | null> {
    this.calls.push('turn');
    return this.existingTurn;
  }

  async commitAuthoredTurn(input: StoryChatCommitInput): Promise<StoryChatCommitResult> {
    this.calls.push('commit');
    this.committedInput = input;
    const messages = input.messages.map((message, index): StoryChatMessageRecord => ({
      id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      roomId: input.roomId,
      sessionId: input.sessionId,
      turnId: TURN_ID,
      sequenceNo: 11 + index,
      actor: message.actor,
      messageKind: message.messageKind,
      authoredContentId: message.authoredContentId,
      authoredContextId: index === 0 ? input.fromNodeId : null,
      createdAt: NOW,
    }));
    this.existingTurn = {
      id: TURN_ID,
      roomId: input.roomId,
      sessionId: input.sessionId,
      clientTurnId: input.clientTurnId,
      requestSha256: input.requestSha256,
      sourceKind: input.sourceKind,
      authoredInputId: input.authoredInputId,
      fromNodeId: input.fromNodeId,
      toNodeId: input.toNodeId,
      expectedRevision: input.expectedRevision,
      committedRevision: input.expectedRevision + 1,
      createdAt: NOW,
      messages,
    };
    return {
      turnId: TURN_ID,
      committedRevision: input.expectedRevision + 1,
      lastMessageSequence: messages.at(-1)?.sequenceNo ?? 0,
      committedNodeId: input.toNodeId,
      idempotentReplay: this.commitWasReplay,
    };
  }
}

class FakeGraphProvider implements ApprovedStoryGraphProvider {
  calls = 0;
  available = true;

  async loadApprovedGraph(roomRecord: StoryChatRoomRecord) {
    this.calls += 1;
    if (!this.available) return null;
    return {
      releaseId: roomRecord.releaseId,
      releaseManifestSha256: roomRecord.releaseManifestSha256,
      graph: validExperienceGraphFixture,
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
  error: Error | null = null;

  async consume(
    input: Parameters<StoryChatRateLimiter['consume']>[0],
  ): Promise<StoryChatRateLimitResult> {
    this.inputs.push(input);
    if (this.error) throw this.error;
    return this.result;
  }
}

function runtime(
  repository = new FakeRepository(),
  graphProvider = new FakeGraphProvider(),
  rateLimiter = new FakeRateLimiter(),
  releaseChannel: 'staging' | 'production' | null = 'staging',
) {
  return {
    repository,
    graphProvider,
    rateLimiter,
    service: new StoryChatRuntime({
      config: {
        runtimeEnabled: true,
        freeTextEnabled: false,
        releaseChannel,
      },
      repository,
      graphProvider,
      rateLimiter,
    }),
  };
}

async function rejectsWithCode(
  promise: Promise<unknown>,
  code: StoryChatRuntimeError['code'],
) {
  await assert.rejects(
    promise,
    (error: unknown) => error instanceof StoryChatRuntimeError && error.code === code,
  );
}

test('access checks fail closed in ownership then consent order', async (t) => {
  await t.test('cross-child access stops before consent and room reads', async () => {
    const context = runtime();
    context.repository.owned = false;

    await rejectsWithCode(
      context.service.listRooms({ parentId: PARENT_ID, childId: CHILD_ID }),
      'child_not_found',
    );
    assert.deepEqual(context.repository.calls, ['ownership']);
    assert.deepEqual(context.rateLimiter.inputs, []);
  });

  await t.test('missing active consent stops before room reads', async () => {
    const context = runtime();
    context.repository.consented = false;

    await rejectsWithCode(
      context.service.listRooms({ parentId: PARENT_ID, childId: CHILD_ID }),
      'consent_required',
    );
    assert.deepEqual(context.repository.calls, ['ownership', 'consent']);
    assert.deepEqual(context.rateLimiter.inputs, []);
  });
});

test('server deploy channel isolates room reads and mutations', async (t) => {
  await t.test('list omits a room pinned to another channel', async () => {
    const context = runtime();
    context.repository.currentRoom = room({ releaseChannel: 'production' });

    assert.deepEqual(
      await context.service.listRooms({ parentId: PARENT_ID, childId: CHILD_ID }),
      { rooms: [] },
    );
    assert.deepEqual(context.repository.calls, ['ownership', 'consent', 'rooms']);
  });

  await t.test('turn mismatch stops before UUID lookup, limiter, graph, or commit', async () => {
    const context = runtime();
    context.repository.currentRoom = room({ releaseChannel: 'production' });

    await rejectsWithCode(
      context.service.submitTurn({
        parentId: PARENT_ID,
        roomId: ROOM_ID,
        request: quickReplyRequest(),
      }),
      'release_unavailable',
    );
    assert.deepEqual(context.repository.calls, ['ownership', 'consent', 'room']);
    assert.deepEqual(context.rateLimiter.inputs, []);
    assert.equal(context.graphProvider.calls, 0);
    assert.equal(context.repository.committedInput, null);
  });

  await t.test('missing server channel fails closed after access checks', async () => {
    const context = runtime(
      new FakeRepository(),
      new FakeGraphProvider(),
      new FakeRateLimiter(),
      null,
    );

    await rejectsWithCode(
      context.service.listRooms({ parentId: PARENT_ID, childId: CHILD_ID }),
      'release_unavailable',
    );
    assert.deepEqual(context.repository.calls, ['ownership', 'consent']);
  });
});

test('message reads are bounded by the room snapshot sequence', async () => {
  const context = runtime();
  const result = await context.service.getRoomMessages({
    parentId: PARENT_ID,
    childId: CHILD_ID,
    roomId: ROOM_ID,
    afterSequence: 4,
  });

  assert.equal(result.room.message_sequence, 10);
  assert.deepEqual(context.repository.listedMessagesInput, {
    roomId: ROOM_ID,
    afterSequence: 4,
    upToSequence: 10,
    limit: 100,
  });
});

test('authored quick reply resolves only allowlisted graph nodes and commits one CAS turn', async () => {
  const context = runtime();
  const result = await context.service.submitTurn({
    parentId: PARENT_ID,
    roomId: ROOM_ID,
    request: quickReplyRequest(),
  });

  assert.equal(result.kind, 'committed');
  if (result.kind !== 'committed') return;
  assert.equal(result.committed_revision, 4);
  assert.equal(result.current_node_id, 'n.choice');
  assert.equal(result.from_node_id, 'n.reply');
  assert.equal(result.idempotent_replay, false);
  assert.deepEqual(
    context.repository.committedInput?.messages,
    [
      { actor: 'child', messageKind: 'child_choice', authoredContentId: 'option.watch' },
      { actor: 'system', messageKind: 'cinematic', authoredContentId: 'n.cinematic' },
      { actor: 'system', messageKind: 'choice', authoredContentId: 'n.choice' },
    ],
  );
  assert.equal(context.repository.committedInput?.parentId, PARENT_ID);
  assert.equal(context.repository.committedInput?.expectedReleaseChannel, 'staging');
  assert.equal(
    context.repository.committedInput?.expectedReleaseId,
    'release.seurat-river-1',
  );
  assert.equal(
    context.repository.committedInput?.expectedReleaseVersion,
    validExperienceGraphFixture.releaseVersion,
  );
  assert.equal(
    context.repository.committedInput?.expectedReleaseManifestSha256,
    RELEASE_HASH,
  );
  assert.equal(context.repository.committedInput?.targetStatus, 'awaiting_child');
  assert.deepEqual(context.rateLimiter.inputs, [{
    parentId: PARENT_ID,
    childId: CHILD_ID,
    roomId: ROOM_ID,
    action: 'authored_turn',
    idempotencyKey: CLIENT_TURN_ID,
  }]);
  assert.deepEqual(context.repository.calls, [
    'ownership',
    'consent',
    'room',
    'turn',
    'session',
    'commit',
    'turn',
  ]);
});

test('resolver rejects action-kind and option mismatches without inventing a transition', () => {
  const graph = parseExperienceGraph(validExperienceGraphFixture);
  assert.throws(
    () => resolveAuthoredSelection(graph, 'n.reply', {
      kind: 'choice',
      optionId: 'option.watch',
    }),
    (error: unknown) => error instanceof StoryChatRuntimeError && error.code === 'invalid_transition',
  );
  assert.throws(
    () => resolveAuthoredSelection(graph, 'n.reply', {
      kind: 'quick_reply',
      optionId: 'option.not-allowed',
    }),
    (error: unknown) => error instanceof StoryChatRuntimeError && error.code === 'invalid_transition',
  );
});

test('authored traversal crosses a disabled free-text prompt to the next authored control', () => {
  const graphInput = structuredClone(parseExperienceGraph(validExperienceGraphFixture));
  const intro = graphInput.chatGraph.nodes.find((node) => node.id === 'n.intro');
  const prompt = graphInput.chatGraph.nodes.find((node) => node.id === 'n.prompt');
  const reply = graphInput.chatGraph.nodes.find((node) => node.id === 'n.reply');
  assert.ok(intro && prompt && reply?.type === 'quick_reply');
  intro.allowedNextNodeIds = ['n.reply'];
  prompt.allowedNextNodeIds = ['n.cinematic'];
  reply.allowedNextNodeIds = ['n.prompt', 'n.transition'];
  reply.options[0].nextNodeId = 'n.prompt';

  const graph = parseExperienceGraph(graphInput);
  const resolved = resolveAuthoredSelection(graph, 'n.reply', {
    kind: 'quick_reply',
    optionId: 'option.watch',
  });
  assert.equal(resolved.toNodeId, 'n.choice');
  assert.deepEqual(
    resolved.messages.map((message) => message.authoredContentId),
    ['option.watch', 'n.prompt', 'n.cinematic', 'n.choice'],
  );
});

test('ending targets atomically close the chapter status', () => {
  const graph = structuredClone(parseExperienceGraph(validExperienceGraphFixture));
  const reply = graph.chatGraph.nodes.find((node) => node.id === 'n.reply');
  assert.ok(reply?.type === 'quick_reply');
  reply.allowedNextNodeIds = ['n.ending', 'n.transition'];
  reply.options[0].nextNodeId = 'n.ending';

  const resolved = resolveAuthoredSelection(graph, 'n.reply', {
    kind: 'quick_reply',
    optionId: 'option.watch',
  });
  assert.equal(resolved.toNodeId, 'n.ending');
  assert.equal(resolved.targetStatus, 'chapter_complete');
});

test('authored traversal refuses more descriptors than the atomic RPC can commit', () => {
  const graph = structuredClone(parseExperienceGraph(validExperienceGraphFixture));
  const reply = graph.chatGraph.nodes.find((node) => node.id === 'n.reply');
  assert.ok(reply?.type === 'quick_reply');
  reply.allowedNextNodeIds = ['n.long-1', 'n.transition'];
  reply.options[0].nextNodeId = 'n.long-1';

  for (let index = 1; index <= 8; index += 1) {
    graph.chatGraph.nodes.push({
      id: `n.long-${index}`,
      releaseVersion: graph.releaseVersion,
      allowedNextNodeIds: [index === 8 ? 'n.choice' : `n.long-${index + 1}`],
      evidenceClaimIds: [],
      safetyTags: ['age:7-8', 'safety:human-approved'],
      type: 'system_transition',
      transitionKind: 'chapter',
      message: `승인된 연결 ${index}`,
    });
  }

  assert.throws(
    () => resolveAuthoredSelection(graph, 'n.reply', {
      kind: 'quick_reply',
      optionId: 'option.watch',
    }),
    (error: unknown) => error instanceof StoryChatRuntimeError && error.code === 'invalid_transition',
  );
});

test('a committed client_turn_id replays before stale room or closed-session checks', async () => {
  const context = runtime();
  const request = quickReplyRequest();
  const requestSha256 = hashTurnRequest(room(), request);
  context.repository.currentRoom = room({ revision: 99, status: 'locked' });
  context.repository.currentSession = null;
  context.graphProvider.available = false;
  context.repository.existingTurn = {
    id: TURN_ID,
    roomId: ROOM_ID,
    sessionId: SESSION_ID,
    clientTurnId: CLIENT_TURN_ID,
    requestSha256,
    sourceKind: 'quick_reply',
    authoredInputId: 'option.watch',
    fromNodeId: 'n.reply',
    toNodeId: 'n.choice',
    expectedRevision: 3,
    committedRevision: 4,
    createdAt: NOW,
    messages: [],
  };

  const result = await context.service.submitTurn({
    parentId: PARENT_ID,
    roomId: ROOM_ID,
    request,
  });
  assert.equal(result.kind, 'committed');
  assert.equal(result.kind === 'committed' && result.idempotent_replay, true);
  assert.deepEqual(context.repository.calls, ['ownership', 'consent', 'room', 'turn']);
  assert.deepEqual(context.rateLimiter.inputs, []);
  assert.equal(context.graphProvider.calls, 0);
});

test('a committed UUID cannot replay across a changed release pin', async () => {
  const context = runtime();
  const request = quickReplyRequest();
  context.repository.existingTurn = {
    id: TURN_ID,
    roomId: ROOM_ID,
    sessionId: SESSION_ID,
    clientTurnId: CLIENT_TURN_ID,
    requestSha256: hashTurnRequest(room(), request),
    sourceKind: 'quick_reply',
    authoredInputId: 'option.watch',
    fromNodeId: 'n.reply',
    toNodeId: 'n.choice',
    expectedRevision: 3,
    committedRevision: 4,
    createdAt: NOW,
    messages: [],
  };
  context.repository.currentRoom = room({
    releaseId: 'release.seurat-river-2',
    releaseVersion: '2.0.0',
    releaseManifestSha256: 'b'.repeat(64),
  });

  await rejectsWithCode(
    context.service.submitTurn({
      parentId: PARENT_ID,
      roomId: ROOM_ID,
      request,
    }),
    'client_turn_conflict',
  );
  assert.deepEqual(context.repository.calls, ['ownership', 'consent', 'room', 'turn']);
  assert.equal(context.rateLimiter.inputs.length, 1);
  assert.equal(context.graphProvider.calls, 0);
  assert.equal(context.repository.committedInput, null);
});

test('reusing a client_turn_id with a different authored request fails closed', async () => {
  const context = runtime();
  context.repository.existingTurn = {
    id: TURN_ID,
    roomId: ROOM_ID,
    sessionId: SESSION_ID,
    clientTurnId: CLIENT_TURN_ID,
    requestSha256: 'b'.repeat(64),
    sourceKind: 'quick_reply',
    authoredInputId: 'option.ask',
    fromNodeId: 'n.reply',
    toNodeId: 'n.transition',
    expectedRevision: 3,
    committedRevision: 4,
    createdAt: NOW,
    messages: [],
  };

  await rejectsWithCode(
    context.service.submitTurn({
      parentId: PARENT_ID,
      roomId: ROOM_ID,
      request: quickReplyRequest(),
    }),
    'client_turn_conflict',
  );
  assert.equal(context.repository.committedInput, null);
  assert.equal(context.rateLimiter.inputs.length, 1);
});

test('an RPC race replay is reported as idempotent instead of a new commit', async () => {
  const context = runtime();
  context.repository.commitWasReplay = true;

  const result = await context.service.submitTurn({
    parentId: PARENT_ID,
    roomId: ROOM_ID,
    request: quickReplyRequest(),
  });
  assert.equal(result.kind, 'committed');
  assert.equal(result.kind === 'committed' && result.idempotent_replay, true);
});

test('expected_revision and current node mismatches stop before graph or commit', async (t) => {
  await t.test('stale revision', async () => {
    const context = runtime();
    await rejectsWithCode(
      context.service.submitTurn({
        parentId: PARENT_ID,
        roomId: ROOM_ID,
        request: quickReplyRequest({ expected_revision: 2 }),
      }),
      'stale_revision',
    );
    assert.equal(context.graphProvider.calls, 0);
    assert.equal(context.repository.committedInput, null);
  });

  await t.test('wrong current node', async () => {
    const context = runtime();
    await rejectsWithCode(
      context.service.submitTurn({
        parentId: PARENT_ID,
        roomId: ROOM_ID,
        request: quickReplyRequest({
          selection: { node_id: 'n.choice', option_id: 'option.quiz' },
        }),
      }),
      'current_node_mismatch',
    );
    assert.equal(context.graphProvider.calls, 0);
    assert.equal(context.repository.committedInput, null);
  });
});

test('rate-limit denial stops before state, session, release, or commit work', async () => {
  const context = runtime();
  context.rateLimiter.result = {
    allowed: false,
    retryAfterSeconds: 37,
    idempotentReplay: false,
  };

  await assert.rejects(
    context.service.submitTurn({
      parentId: PARENT_ID,
      roomId: ROOM_ID,
      request: quickReplyRequest(),
    }),
    (error: unknown) =>
      error instanceof StoryChatRateLimitError
      && error.code === 'rate_limited'
      && error.retryAfterSeconds === 37,
  );
  assert.deepEqual(context.repository.calls, ['ownership', 'consent', 'room', 'turn']);
  assert.equal(context.graphProvider.calls, 0);
  assert.equal(context.repository.committedInput, null);
});

test('free text never persists or echoes raw text and always returns fixed authored guidance', async () => {
  const context = runtime();
  const first: Extract<StoryChatTurnRequest, { kind: 'free_text' }> = {
    kind: 'free_text',
    child_id: CHILD_ID,
    session_id: SESSION_ID,
    client_turn_id: CLIENT_TURN_ID,
    expected_revision: 3,
    node_id: 'n.reply',
    text: '우리 학교와 집 주소를 말할게',
  };
  const second = { ...first, text: '전혀 다른 자유 입력' };

  const result = await context.service.submitTurn({
    parentId: PARENT_ID,
    roomId: ROOM_ID,
    request: first,
  });
  assert.deepEqual(result, {
    kind: 'authored_fallback',
    code: 'free_text_disabled',
    current_node_id: 'n.reply',
    revision: 3,
    message: STORY_CHAT_FREE_TEXT_FALLBACK,
  });
  assert.equal(context.repository.committedInput, null);
  assert.equal(context.graphProvider.calls, 0);
  assert.equal(hashTurnRequest(room(), first), hashTurnRequest(room(), second));
  assert.equal(JSON.stringify(result).includes(first.text), false);
});

test('missing signed release graph returns 503-class domain failure before commit', async () => {
  const context = runtime();
  context.graphProvider.available = false;

  await rejectsWithCode(
    context.service.submitTurn({
      parentId: PARENT_ID,
      roomId: ROOM_ID,
      request: quickReplyRequest(),
    }),
    'release_unavailable',
  );
  assert.equal(context.repository.committedInput, null);
});

test('commit RPC release revocation marker maps to the existing generic 503 class', () => {
  const mapped = mapAuthoredCommitDatabaseError({
    code: '55000',
    message: 'CHAT_RELEASE_UNAVAILABLE',
    details: 'private registry detail',
  });
  assert.equal(mapped.code, 'release_unavailable');
  assert.equal(mapped.message.includes('private registry detail'), false);
});
