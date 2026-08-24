import assert from 'node:assert/strict';
import test from 'node:test';

import type { ContentRelease } from '@/contracts/content-release.v1';
import { validContentReleaseUnsignedFixture } from '@/contracts/fixtures/content-release.v1.fixtures';
import { validExperienceGraphFixture } from '@/contracts/fixtures/experience-graph.v1.fixtures';
import { parseExperienceGraph } from '@/contracts/experience-graph.v1';
import type { VerifiedContentReleaseGraphSnapshot } from '@/lib/releases/runtime-content-release';
import {
  toStoryChatApiMessage,
  toStoryChatApiRoom,
  type StoryChatMessageRecord,
  type StoryChatRoomRecord,
} from '@/types/story-chat-api';
import { StoryChatRuntimeError } from './authored-runtime';
import { StoryChatRateLimitError } from './rate-limit';
import {
  STORY_CHAT_BROWSER_PAGE_LIMIT,
  STORY_CHAT_SAFE_CHILD_ALIAS,
  StoryChatBrowserSurface,
  type StoryChatBrowserSurfaceDependencies,
} from './browser-surface';

const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const CHILD_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const TURN_ID = '44444444-4444-4444-8444-444444444444';
const CLIENT_TURN_ID = '55555555-5555-4555-8555-555555555555';

const release = {
  ...validContentReleaseUnsignedFixture,
  manifestSha256: '9'.repeat(64),
  signature: {
    algorithm: 'ed25519',
    canonicalization: 'RFC8785-JCS',
    keyId: 'key.staging-2026',
    signedAt: '2026-08-20T06:10:00.000Z',
    value: 'A'.repeat(86),
  },
} as unknown as ContentRelease;

const graph = parseExperienceGraph({
  ...validExperienceGraphFixture,
  presentation: {
    ...validExperienceGraphFixture.presentation,
    title: '{{child_name}} 의 빛 탐정단',
  },
});
const snapshot: VerifiedContentReleaseGraphSnapshot = { release, graph };

const room: StoryChatRoomRecord = {
  id: ROOM_ID,
  childId: CHILD_ID,
  experienceId: release.experienceId,
  releaseId: release.releaseId,
  releaseVersion: release.releaseVersion,
  releaseChannel: 'staging',
  releaseManifestSha256: release.manifestSha256,
  currentNodeId: 'n.reply',
  status: 'awaiting_child',
  revision: 1,
  messageSequence: 2,
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:01:00.000Z',
};

const messages: StoryChatMessageRecord[] = [
  {
    id: '66666666-6666-4666-8666-666666666661',
    roomId: ROOM_ID,
    sessionId: SESSION_ID,
    turnId: TURN_ID,
    sequenceNo: 1,
    actor: 'character',
    messageKind: 'character_text',
    authoredContentId: 'n.intro',
    authoredContextId: null,
    createdAt: '2026-08-24T00:00:01.000Z',
  },
  {
    id: '66666666-6666-4666-8666-666666666662',
    roomId: ROOM_ID,
    sessionId: SESSION_ID,
    turnId: TURN_ID,
    sequenceNo: 2,
    actor: 'system',
    messageKind: 'quick_reply',
    authoredContentId: 'n.reply',
    authoredContextId: null,
    createdAt: '2026-08-24T00:00:02.000Z',
  },
];

function dependencies(overrides: Partial<StoryChatBrowserSurfaceDependencies> = {}) {
  const calls: string[] = [];
  const base: StoryChatBrowserSurfaceDependencies = {
    releaseChannel: 'staging',
    releaseLoader: {
      async load() {
        calls.push('load');
        return snapshot;
      },
    },
    signAsset: async ({ assetId }) => ({
      url: `https://kindy-preview.supabase.co/storage/v1/object/sign/content-releases/${assetId}?token=test`,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }),
    readRateLimiter: {
      async consume(input) {
        calls.push(`limit:${input.action}`);
        return { allowed: true, retryAfterSeconds: 0 };
      },
    },
    async assertActiveAccess() {
      calls.push('access');
    },
    authoredRuntime: {
      async listRooms() {
        calls.push('rooms');
        return { rooms: [toStoryChatApiRoom(room)] };
      },
      async getRoomMessages() {
        calls.push('read');
        return {
          room: toStoryChatApiRoom(room),
          messages: messages.map(toStoryChatApiMessage),
          next_after: 2,
        };
      },
      async submitTurn() {
        calls.push('commit');
        return {
          kind: 'committed' as const,
          turn_id: TURN_ID,
          client_turn_id: CLIENT_TURN_ID,
          committed_revision: 1,
          from_node_id: 'n.intro',
          current_node_id: 'n.reply',
          last_message_sequence: 2,
          idempotent_replay: false,
          messages: messages.map(toStoryChatApiMessage),
        };
      },
    },
    roomLifecycle: {
      async openSession() {
        calls.push('session');
        return {
          session: {
            id: SESSION_ID,
            client_session_id: '77777777-7777-4777-8777-777777777777',
            room_id: ROOM_ID,
            opened_revision: 1,
            started_at: '2026-08-24T00:00:00.000Z',
            ended_at: null,
            resumed_existing: false,
            idempotent_replay: false,
          },
          room: toStoryChatApiRoom(room),
        };
      },
    },
  };
  return { surface: new StoryChatBrowserSurface({ ...base, ...overrides }), calls };
}

test('rooms and messages expose only rendered presentation with a fixed safe alias', async () => {
  const { surface, calls } = dependencies();
  const rooms = await surface.listRooms({ parentId: 'parent', childId: CHILD_ID });
  const timeline = await surface.getRoomMessages({
    parentId: 'parent',
    childId: CHILD_ID,
    roomId: ROOM_ID,
    afterSequence: 0,
  });

  assert.equal(rooms.rooms[0].title, `${STORY_CHAT_SAFE_CHILD_ALIAS} 의 빛 탐정단`);
  assert.equal(timeline.room.title, `${STORY_CHAT_SAFE_CHILD_ALIAS} 의 빛 탐정단`);
  assert.deepEqual(timeline.messages.map((message) => message.type), [
    'character_text',
    'quick_reply',
  ]);
  assert.deepEqual(calls.slice(0, 4), [
    'limit:rooms_read',
    'rooms',
    'load',
    'access',
  ]);
  assert.deepEqual(calls.slice(4, 8), [
    'limit:messages_read',
    'read',
    'load',
    'access',
  ]);

  const serialized = JSON.stringify({ rooms, timeline });
  for (const forbidden of [
    'release_id',
    'release_version',
    'release_manifest_sha256',
    'session_id',
    'turn_id',
    'authored_content_id',
    'authored_context_id',
    'storageKey',
    'sha256',
    'signature',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('read denial happens before database reads, release loads, or asset signing', async () => {
  let loaded = false;
  let signed = false;
  let listed = false;
  const { surface } = dependencies({
    readRateLimiter: {
      async consume() {
        return { allowed: false, retryAfterSeconds: 7 };
      },
    },
    releaseLoader: {
      async load() {
        loaded = true;
        return snapshot;
      },
    },
    async signAsset() {
      signed = true;
      throw new Error('must not sign');
    },
    authoredRuntime: {
      async listRooms() {
        listed = true;
        return { rooms: [toStoryChatApiRoom(room)] };
      },
      async getRoomMessages() {
        listed = true;
        return {
          room: toStoryChatApiRoom(room),
          messages: messages.map(toStoryChatApiMessage),
          next_after: 2,
        };
      },
      async submitTurn() {
        throw new Error('unused');
      },
    },
  });

  await assert.rejects(
    surface.getRoomMessages({
      parentId: 'parent',
      childId: CHILD_ID,
      roomId: ROOM_ID,
      afterSequence: 0,
    }),
    (error: unknown) => (
      error instanceof StoryChatRateLimitError
      && error.code === 'rate_limited'
      && error.retryAfterSeconds === 7
    ),
  );
  assert.equal(listed, false);
  assert.equal(loaded, false);
  assert.equal(signed, false);
});

test('room list hard-bounds projection and response to twenty rooms', async () => {
  const manyRooms = Array.from({ length: 25 }, (_, index) => ({
    ...room,
    id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  }));
  let loadCount = 0;
  const { surface } = dependencies({
    authoredRuntime: {
      async listRooms() {
        return { rooms: manyRooms.map(toStoryChatApiRoom) };
      },
      async getRoomMessages() {
        throw new Error('unused');
      },
      async submitTurn() {
        throw new Error('unused');
      },
    },
    releaseLoader: {
      async load() {
        loadCount += 1;
        return snapshot;
      },
    },
  });

  const result = await surface.listRooms({
    parentId: 'parent',
    childId: CHILD_ID,
  });

  assert.equal(result.rooms.length, STORY_CHAT_BROWSER_PAGE_LIMIT);
  assert.equal(loadCount, STORY_CHAT_BROWSER_PAGE_LIMIT);
});

test('message query, projection, response, and cursor are hard-bounded to twenty', async () => {
  const manyMessages: StoryChatMessageRecord[] = Array.from(
    { length: STORY_CHAT_BROWSER_PAGE_LIMIT + 1 },
    (_, index) => ({
      ...messages[0],
      id: `77777777-7777-4777-8777-${String(index + 1).padStart(12, '0')}`,
      sequenceNo: index + 1,
    }),
  );
  let observedLimit: number | undefined;
  const { surface } = dependencies({
    authoredRuntime: {
      async listRooms() {
        throw new Error('unused');
      },
      async getRoomMessages(input) {
        observedLimit = input.limit;
        return {
          room: toStoryChatApiRoom({
            ...room,
            messageSequence: manyMessages.length,
          }),
          // Deliberately ignore the requested limit to exercise the surface's
          // independent response/projection bound.
          messages: manyMessages.map(toStoryChatApiMessage),
          next_after: manyMessages.length,
        };
      },
      async submitTurn() {
        throw new Error('unused');
      },
    },
  });

  const result = await surface.getRoomMessages({
    parentId: 'parent',
    childId: CHILD_ID,
    roomId: ROOM_ID,
    afterSequence: 0,
    limit: 100,
  });

  assert.equal(observedLimit, STORY_CHAT_BROWSER_PAGE_LIMIT);
  assert.equal(result.messages.length, STORY_CHAT_BROWSER_PAGE_LIMIT);
  assert.equal(result.next_after, STORY_CHAT_BROWSER_PAGE_LIMIT);
});

test('session projects its room and omits release pins and client receipt echo', async () => {
  const { surface } = dependencies();
  const result = await surface.openSession({
    parentId: 'parent',
    roomId: ROOM_ID,
    request: {
      child_id: CHILD_ID,
      client_session_id: '77777777-7777-4777-8777-777777777777',
    },
  });

  assert.equal(result.room.title, `${STORY_CHAT_SAFE_CHILD_ALIAS} 의 빛 탐정단`);
  assert.equal('client_session_id' in result.session, false);
  assert.equal(JSON.stringify(result).includes('release_manifest_sha256'), false);
});

test('authored turn commits first, confirms persisted rows, then renders the exact commit', async () => {
  const { surface, calls } = dependencies();
  const result = await surface.submitTurn({
    parentId: 'parent',
    childId: CHILD_ID,
    roomId: ROOM_ID,
    request: {
      kind: 'quick_reply',
      child_id: CHILD_ID,
      session_id: SESSION_ID,
      client_turn_id: CLIENT_TURN_ID,
      expected_revision: 0,
      selection: { node_id: 'n.reply', option_id: 'option.watch' },
    },
  });

  assert.equal(result.kind, 'committed');
  assert.deepEqual(calls.slice(0, 4), ['commit', 'read', 'load', 'access']);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('"turn_id":'), false);
  assert.equal(serialized.includes('"authored_content_id":'), false);
  assert.equal(serialized.includes('"release_manifest_sha256":'), false);
});

test('a consent revocation after projection discards the complete rendered response', async () => {
  let signed = false;
  const { surface } = dependencies({
    signAsset: async ({ assetId }) => {
      signed = true;
      return {
        url: `https://kindy-preview.supabase.co/storage/v1/object/sign/content-releases/${assetId}?token=test`,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
    },
    async assertActiveAccess() {
      throw new StoryChatRuntimeError('consent_required');
    },
  });

  await assert.rejects(
    surface.getRoomMessages({
      parentId: 'parent',
      childId: CHILD_ID,
      roomId: ROOM_ID,
      afterSequence: 0,
    }),
    (error: unknown) => (
      error instanceof StoryChatRuntimeError
      && error.code === 'consent_required'
    ),
  );
  assert.equal(signed, true, 'projection completes before the final consent check');
});

test('loader or persistence mismatch fails closed with no raw DTO fallback', async () => {
  const unavailable = dependencies({
    releaseLoader: { async load() { return null; } },
  }).surface;
  await assert.rejects(
    unavailable.getRoomMessages({
      parentId: 'parent',
      childId: CHILD_ID,
      roomId: ROOM_ID,
      afterSequence: 0,
    }),
    (error: unknown) => (
      error instanceof StoryChatRuntimeError
      && error.code === 'release_unavailable'
    ),
  );

  const mismatched = dependencies({
    authoredRuntime: {
      async listRooms() { return { rooms: [toStoryChatApiRoom(room)] }; },
      async getRoomMessages() {
        return {
          room: toStoryChatApiRoom(room),
          messages: messages.slice(0, 1).map(toStoryChatApiMessage),
          next_after: 1,
        };
      },
      async submitTurn() {
        return {
          kind: 'committed' as const,
          turn_id: TURN_ID,
          client_turn_id: CLIENT_TURN_ID,
          committed_revision: 1,
          from_node_id: 'n.intro',
          current_node_id: 'n.reply',
          last_message_sequence: 2,
          idempotent_replay: false,
          messages: messages.map(toStoryChatApiMessage),
        };
      },
    },
  }).surface;
  await assert.rejects(
    mismatched.submitTurn({
      parentId: 'parent',
      childId: CHILD_ID,
      roomId: ROOM_ID,
      request: {
        kind: 'quick_reply',
        child_id: CHILD_ID,
        session_id: SESSION_ID,
        client_turn_id: CLIENT_TURN_ID,
        expected_revision: 0,
        selection: { node_id: 'n.reply', option_id: 'option.watch' },
      },
    }),
    (error: unknown) => (
      error instanceof StoryChatRuntimeError
      && error.code === 'storage_unavailable'
    ),
  );
});
