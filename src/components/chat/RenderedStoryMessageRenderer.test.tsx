import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import RenderedStoryMessageRenderer from './RenderedStoryMessageRenderer';
import type {
  StoryChatRenderAsset,
  StoryChatRenderedMessage,
} from '@/types/story-chat-render';

const VIDEO: StoryChatRenderAsset = {
  asset_id: 'asset.video',
  url: 'https://media.example.test/video.mp4?token=short-lived',
  expires_at: '2026-08-21T02:10:00.000Z',
  mime_type: 'video/mp4',
  width: 1080,
  height: 1920,
  duration_ms: 8_000,
};

const POSTER: StoryChatRenderAsset = {
  ...VIDEO,
  asset_id: 'asset.poster',
  url: 'https://media.example.test/poster.webp?token=short-lived',
  mime_type: 'image/webp',
  duration_ms: null,
};

const SUBTITLES: StoryChatRenderAsset = {
  ...VIDEO,
  asset_id: 'asset.subtitles',
  url: 'https://media.example.test/subtitles.vtt?token=short-lived',
  mime_type: 'text/vtt',
  width: null,
  height: null,
  duration_ms: null,
};

const BASE = {
  id: 'message.cinematic',
  room_id: '11111111-1111-4111-8111-111111111111',
  sequence_no: 1,
  actor: 'system',
  created_at: '2026-08-21T02:00:00.000Z',
} as const;

test('cinematic markup is a non-autoplaying exact 9:16 stage with subtitles and explicit controls', () => {
  const message: StoryChatRenderedMessage = {
    ...BASE,
    type: 'cinematic',
    node_id: 'node.cinematic',
    title: '빛의 문이 열리다',
    description: '선택으로 열린 짧은 이야기 장면이에요.',
    video: VIDEO,
    poster: POSTER,
    subtitles: SUBTITLES,
    autoplay: false,
    subtitles_default_on: true,
    can_replay: true,
  };

  const markup = renderToStaticMarkup(
    <RenderedStoryMessageRenderer message={message} />,
  );

  assert.match(markup, /aspect-\[9\/16\]/);
  assert.match(markup, /class="h-full w-full object-contain"/);
  assert.match(markup, /poster="https:\/\/media\.example\.test\/poster\.webp\?token=short-lived"/);
  assert.match(markup, /<track[^>]+kind="subtitles"[^>]+default=""/);
  assert.match(markup, />영상 재생</);
  assert.match(markup, />처음으로 되감기</);
  assert.match(markup, /min-h-12/);
  assert.doesNotMatch(markup, /autoplay/i);
});

test('quiz markup keeps 16px+ copy, 48px+ actions, and strips answer metadata', () => {
  const message = {
    ...BASE,
    id: 'message.quiz',
    type: 'quiz',
    node_id: 'node.quiz',
    prompt: '빛은 어디에서 왔을까?',
    options: [
      { id: 'option.window', label: '창문' },
      { id: 'option.lamp', label: '등불' },
    ],
    correct_option_id: 'never-render-this-answer',
    solution: 'never-render-this-solution',
  } as unknown as StoryChatRenderedMessage;

  const markup = renderToStaticMarkup(
    <RenderedStoryMessageRenderer message={message} onAction={() => undefined} />,
  );

  assert.match(markup, /data-message-kind="quiz"/);
  assert.match(markup, /text-\[17px\]/);
  assert.match(markup, /text-\[16px\]/);
  assert.match(markup, /min-h-14/);
  assert.doesNotMatch(markup, /never-render-this-answer/);
  assert.doesNotMatch(markup, /never-render-this-solution/);
});

test('not-generated image stays a labelled placeholder without an image URL', () => {
  const message = {
    ...BASE,
    id: 'message.image',
    type: 'generated_image',
    node_id: 'node.image',
    status: 'not_generated',
    alt_text: '아이가 별빛 열쇠를 든 세로 장면',
    aspect_ratio: '9:16',
    image_url: 'https://media.example.test/never-render-unapproved.webp',
  } as unknown as StoryChatRenderedMessage;

  const markup = renderToStaticMarkup(
    <RenderedStoryMessageRenderer message={message} />,
  );

  assert.match(markup, /role="img"/);
  assert.match(markup, /아직 만들지 않은 장면이에요/);
  assert.match(markup, /text-\[16px\]/);
  assert.doesNotMatch(markup, /never-render-unapproved/);
});
