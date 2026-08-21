import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adaptRenderedStoryMessage,
  adaptRenderedStoryMessages,
  createRenderedStoryMessageAction,
} from './rendered-message-ui';
import type {
  StoryChatRenderAsset,
  StoryChatRenderedMessage,
} from '@/types/story-chat-render';

const ASSET: StoryChatRenderAsset = {
  asset_id: 'asset.poster',
  url: 'https://media.example.test/signed/story.webp?token=short-lived',
  expires_at: '2026-08-21T02:10:00.000Z',
  mime_type: 'image/webp',
  width: 1080,
  height: 1920,
  duration_ms: null,
};

const BASE = {
  room_id: '11111111-1111-4111-8111-111111111111',
  created_at: '2026-08-21T02:00:00.000Z',
} as const;

const MESSAGES: StoryChatRenderedMessage[] = [
  {
    ...BASE,
    id: 'message.child',
    sequence_no: 1,
    actor: 'child',
    type: 'child_choice',
    source_node_id: 'node.choice',
    option_id: 'option.left',
    label: '왼쪽 문을 열어 볼래',
  },
  {
    ...BASE,
    id: 'message.character',
    sequence_no: 2,
    actor: 'character',
    type: 'character_text',
    node_id: 'node.character',
    character: {
      id: 'character.mori',
      display_name: '모리',
      avatar: ASSET,
    },
    text: '좋아, 같이 가 보자.',
  },
  {
    ...BASE,
    id: 'message.prompt',
    sequence_no: 3,
    actor: 'system',
    type: 'child_prompt',
    node_id: 'node.prompt',
    prompt: '어떤 단서를 먼저 보고 싶어?',
    input_mode: 'authored_only',
  },
  {
    ...BASE,
    id: 'message.choice',
    sequence_no: 4,
    actor: 'system',
    type: 'choice',
    node_id: 'node.choice',
    prompt: '어디로 갈까?',
    options: [{ id: 'option.left', label: '왼쪽 문' }],
  },
  {
    ...BASE,
    id: 'message.quick',
    sequence_no: 5,
    actor: 'system',
    type: 'quick_reply',
    node_id: 'node.quick',
    prompt: '모리에게 답해 볼까?',
    options: [{ id: 'option.yes', label: '응, 좋아!' }],
  },
  {
    ...BASE,
    id: 'message.cinematic',
    sequence_no: 6,
    actor: 'system',
    type: 'cinematic',
    node_id: 'node.cinematic',
    title: '빛의 문이 열리다',
    description: '선택으로 열린 짧은 이야기 장면이에요.',
    video: { ...ASSET, asset_id: 'asset.video', mime_type: 'video/mp4', duration_ms: 8_000 },
    poster: ASSET,
    subtitles: { ...ASSET, asset_id: 'asset.subtitles', mime_type: 'text/vtt', width: null, height: null },
    autoplay: false,
    subtitles_default_on: true,
    can_replay: true,
  },
  {
    ...BASE,
    id: 'message.image',
    sequence_no: 7,
    actor: 'system',
    type: 'generated_image',
    node_id: 'node.image',
    status: 'not_generated',
    alt_text: '아이가 별빛 열쇠를 든 세로 장면',
    aspect_ratio: '9:16',
  },
  {
    ...BASE,
    id: 'message.quiz',
    sequence_no: 8,
    actor: 'system',
    type: 'quiz',
    node_id: 'node.quiz',
    prompt: '빛은 어디에서 왔을까?',
    options: [{ id: 'option.window', label: '창문' }],
  },
  {
    ...BASE,
    id: 'message.game',
    sequence_no: 9,
    actor: 'system',
    type: 'minigame',
    node_id: 'node.game',
    template: 'sequence',
    prompt: '단서를 발견한 순서대로 골라 보자.',
    items: [{ id: 'item.key', label: '별빛 열쇠', media: ASSET }],
  },
  {
    ...BASE,
    id: 'message.transition',
    sequence_no: 10,
    actor: 'system',
    type: 'system_transition',
    node_id: 'node.transition',
    transition_kind: 'chapter',
    message: '이제 두 번째 장으로 가요.',
  },
  {
    ...BASE,
    id: 'message.ending',
    sequence_no: 11,
    actor: 'system',
    type: 'ending',
    node_id: 'node.ending',
    ending_kind: 'complete',
    summary: '빛의 방향을 관찰해 숨은 문을 찾았어요.',
  },
];

test('adapter covers every rendered message kind in timeline order', () => {
  assert.deepEqual(
    adaptRenderedStoryMessages(MESSAGES).map((message) => message.kind),
    [
      'child_choice',
      'character_text',
      'child_prompt',
      'choice',
      'quick_reply',
      'cinematic',
      'generated_image',
      'quiz',
      'minigame',
      'system_transition',
      'ending',
    ],
  );
});

test('adapter strips wider answer, solution, release, and asset metadata', () => {
  const unsafeQuiz = {
    ...MESSAGES[7],
    correct_option_id: 'never-ship-correct-answer',
    explanation: 'never-ship-explanation',
    release_signature: 'never-ship-signature',
    options: [{
      id: 'option.window',
      label: '창문',
      is_correct: true,
      score: 100,
    }],
  } as unknown as StoryChatRenderedMessage;
  const unsafeGame = {
    ...MESSAGES[8],
    solution: ['never-ship-solution'],
    items: [{
      id: 'item.key',
      label: '별빛 열쇠',
      media: {
        ...ASSET,
        storage_key: 'private/never-ship-storage-key',
        sha256: 'never-ship-hash',
      },
    }],
  } as unknown as StoryChatRenderedMessage;

  const serialized = JSON.stringify([
    adaptRenderedStoryMessage(unsafeQuiz),
    adaptRenderedStoryMessage(unsafeGame),
  ]);

  for (const forbidden of [
    'never-ship-correct-answer',
    'never-ship-explanation',
    'never-ship-signature',
    'never-ship-solution',
    'private/never-ship-storage-key',
    'never-ship-hash',
    'is_correct',
    'score',
    'asset_id',
    'expires_at',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('cinematic and generated-image presentation policies cannot be widened by input', () => {
  const unsafeCinematic = {
    ...MESSAGES[5],
    autoplay: true,
    subtitles_default_on: false,
    can_replay: false,
  } as unknown as StoryChatRenderedMessage;
  const unsafeGeneratedImage = {
    ...MESSAGES[6],
    status: 'ready',
    image_url: 'https://media.example.test/unapproved.webp',
  } as unknown as StoryChatRenderedMessage;

  const cinematic = adaptRenderedStoryMessage(unsafeCinematic);
  const image = adaptRenderedStoryMessage(unsafeGeneratedImage);
  assert.equal(cinematic.kind, 'cinematic');
  if (cinematic.kind !== 'cinematic') assert.fail('expected cinematic');
  assert.equal(cinematic.autoplay, false);
  assert.equal(cinematic.subtitlesDefaultOn, true);
  assert.equal(cinematic.canReplay, true);
  assert.equal(image.kind, 'generated_image');
  if (image.kind !== 'generated_image') assert.fail('expected generated image');
  assert.equal(image.status, 'not_generated');
  assert.equal(JSON.stringify(image).includes('unapproved.webp'), false);
});

test('action adapter emits only authored selection references and rejects unknown IDs', () => {
  const choice = adaptRenderedStoryMessage(MESSAGES[3]);
  if (choice.kind !== 'choice') assert.fail('expected choice');

  assert.deepEqual(createRenderedStoryMessageAction(choice, 'option.left'), {
    messageId: 'message.choice',
    nodeId: 'node.choice',
    kind: 'choice',
    selectionId: 'option.left',
  });
  assert.throws(
    () => createRenderedStoryMessageAction(choice, 'option.not-rendered'),
    /Unknown rendered story selection/,
  );
});
