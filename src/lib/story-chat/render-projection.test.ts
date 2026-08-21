import assert from 'node:assert/strict';
import test from 'node:test';

import type { ContentRelease } from '@/contracts/content-release.v1';
import { validContentReleaseUnsignedFixture } from '@/contracts/fixtures/content-release.v1.fixtures';
import { validExperienceGraphFixture } from '@/contracts/fixtures/experience-graph.v1.fixtures';
import { parseExperienceGraph } from '@/contracts/experience-graph.v1';
import type { VerifiedContentReleaseGraphSnapshot } from '@/lib/releases/runtime-content-release';
import type {
  StoryChatMessageRecord,
  StoryChatRoomRecord,
} from '@/types/story-chat-api';
import {
  projectStoryChatRenderResponse,
  StoryChatProjectionError,
  type StoryChatAssetSigner,
} from './render-projection';

const NOW = new Date('2026-08-21T00:00:00.000Z');
const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';

const release = {
  ...validContentReleaseUnsignedFixture,
  manifestSha256: '9999999999999999999999999999999999999999999999999999999999999999',
  signature: {
    algorithm: 'ed25519',
    canonicalization: 'RFC8785-JCS',
    keyId: 'key.production-2026',
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
  childId: '33333333-3333-4333-8333-333333333333',
  experienceId: release.experienceId,
  releaseId: release.releaseId,
  releaseVersion: release.releaseVersion,
  releaseChannel: 'staging',
  releaseManifestSha256: release.manifestSha256,
  currentNodeId: 'n.ending',
  status: 'chapter_complete',
  revision: 3,
  messageSequence: 11,
  createdAt: '2026-08-20T23:00:00.000Z',
  updatedAt: '2026-08-21T00:00:00.000Z',
};

function message(
  sequenceNo: number,
  actor: StoryChatMessageRecord['actor'],
  messageKind: StoryChatMessageRecord['messageKind'],
  authoredContentId: string,
  authoredContextId: string | null = null,
): StoryChatMessageRecord {
  return {
    id: `44444444-4444-4444-8444-${String(sequenceNo).padStart(12, '0')}`,
    roomId: ROOM_ID,
    sessionId: SESSION_ID,
    turnId: '55555555-5555-4555-8555-555555555555',
    sequenceNo,
    actor,
    messageKind,
    authoredContentId,
    authoredContextId,
    createdAt: `2026-08-21T00:00:${String(sequenceNo).padStart(2, '0')}.000Z`,
  };
}

const messages: StoryChatMessageRecord[] = [
  message(1, 'child', 'child_choice', 'option.watch', 'n.reply'),
  message(2, 'character', 'character_text', 'n.intro'),
  message(3, 'system', 'child_prompt', 'n.prompt'),
  message(4, 'system', 'quick_reply', 'n.reply'),
  message(5, 'system', 'cinematic', 'n.cinematic'),
  message(6, 'system', 'system_transition', 'n.transition'),
  message(7, 'system', 'choice', 'n.choice'),
  message(8, 'system', 'generated_image', 'n.image'),
  message(9, 'system', 'quiz', 'n.quiz'),
  message(10, 'system', 'minigame', 'n.game'),
  message(11, 'system', 'ending', 'n.ending'),
];

function createSigner(
  calls: Array<Parameters<StoryChatAssetSigner>[0]>,
): StoryChatAssetSigner {
  return async (input) => {
    calls.push(input);
    return {
      url: `https://media.kindy.test/assets/${encodeURIComponent(input.assetId)}?token=test`,
      expiresAt: '2026-08-21T00:10:00.000Z',
    };
  };
}

test('projects every authored message kind without leaking private graph data', async () => {
  const signerCalls: Array<Parameters<StoryChatAssetSigner>[0]> = [];
  const response = await projectStoryChatRenderResponse(
    {
      room,
      messages,
      snapshot,
      childDisplayName: '서연',
      nextAfter: 11,
    },
    {
      signAsset: createSigner(signerCalls),
      now: () => NOW,
      signedAssetTtlSeconds: 600,
    },
  );

  assert.equal(response.room.title, '서연 의 빛 탐정단');
  assert.equal(response.room.primary_character.display_name, '모리');
  assert.deepEqual(response.messages.map((item) => item.type), [
    'child_choice',
    'character_text',
    'child_prompt',
    'quick_reply',
    'cinematic',
    'system_transition',
    'choice',
    'generated_image',
    'quiz',
    'minigame',
    'ending',
  ]);
  const childChoice = response.messages[0];
  assert.equal(childChoice.type, 'child_choice');
  if (childChoice.type === 'child_choice') {
    assert.equal(childChoice.label, '빛을 자세히 본다');
    assert.equal(childChoice.source_node_id, 'n.reply');
  }

  const quiz = response.messages.find((item) => item.type === 'quiz');
  assert.equal(quiz?.type, 'quiz');
  if (quiz?.type === 'quiz') {
    assert.deepEqual(quiz.options.map((option) => option.id), [
      'answer.light',
      'answer.paint',
    ]);
  }
  const game = response.messages.find((item) => item.type === 'minigame');
  assert.equal(game?.type, 'minigame');
  if (game?.type === 'minigame') {
    assert.deepEqual(game.items.map((item) => item.id), [
      'item.look',
      'item.compare',
      'item.explain',
    ]);
  }

  const serialized = JSON.stringify(response);
  for (const forbidden of [
    'storageKey',
    'sha256',
    'signature',
    'allowedNextNodeIds',
    'correctOptionId',
    'feedback',
    'orderedItemIds',
    'evidenceClaims',
    'sourceRefs',
    'releaseManifestSha256',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.ok(signerCalls.length > 0);
  assert.equal(new Set(signerCalls.map((call) => call.assetId)).size, signerCalls.length);
  assert.equal(signerCalls.every((call) => call.expiresInSeconds === 600), true);
});

test('fails closed for stale release pins and malformed authored references', async () => {
  const signAsset = createSigner([]);
  await assert.rejects(
    projectStoryChatRenderResponse(
      {
        room: { ...room, releaseManifestSha256: '0'.repeat(64) },
        messages: [],
        snapshot,
        childDisplayName: '서연',
        nextAfter: 0,
      },
      { signAsset, now: () => NOW },
    ),
    (error: unknown) => (
      error instanceof StoryChatProjectionError && error.code === 'release_mismatch'
    ),
  );

  await assert.rejects(
    projectStoryChatRenderResponse(
      {
        room,
        messages: [message(1, 'system', 'quiz', 'n.ending')],
        snapshot,
        childDisplayName: '서연',
        nextAfter: 1,
      },
      { signAsset, now: () => NOW },
    ),
    (error: unknown) => (
      error instanceof StoryChatProjectionError
      && error.code === 'invalid_message_reference'
    ),
  );
});

test('rejects unsafe or overlong signed URLs before returning browser data', async () => {
  for (const signedResult of [
    { url: 'http://media.kindy.test/cover', expiresAt: '2026-08-21T00:10:00.000Z' },
    { url: 'https://user:pass@media.kindy.test/cover', expiresAt: '2026-08-21T00:10:00.000Z' },
    { url: 'https://media.kindy.test/cover#secret', expiresAt: '2026-08-21T00:10:00.000Z' },
    { url: 'https://media.kindy.test/cover', expiresAt: '2026-08-21T01:00:00.000Z' },
  ]) {
    await assert.rejects(
      projectStoryChatRenderResponse(
        {
          room,
          messages: [],
          snapshot,
          childDisplayName: '서연',
          nextAfter: 0,
        },
        {
          signAsset: async () => signedResult,
          now: () => NOW,
          signedAssetTtlSeconds: 600,
        },
      ),
      (error: unknown) => (
        error instanceof StoryChatProjectionError && error.code === 'media_unavailable'
      ),
    );
  }
});
