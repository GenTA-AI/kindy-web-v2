import assert from 'node:assert/strict';
import test from 'node:test';

import { getStoryChatRuntimeConfig } from './runtime-config';

test('story chat runtime remains hard-disabled before the immutable boundary ships', () => {
  for (const value of [undefined, '', '0', 'true', '01', '1 ', 'enabled']) {
    assert.equal(
      getStoryChatRuntimeConfig({
        KINDY_LAUNCH_MODE: 'protected_chat_pilot',
        STORY_CHAT_RUNTIME_ENABLED: value,
      }).runtimeEnabled,
      false,
      JSON.stringify(value),
    );
  }

  assert.equal(getStoryChatRuntimeConfig({
    KINDY_LAUNCH_MODE: 'protected_chat_pilot',
    STORY_CHAT_RUNTIME_ENABLED: '1',
  }).runtimeEnabled, false);
});

test('runtime opt-in is inert outside the exact protected pilot launch mode', () => {
  for (const launchMode of [
    undefined,
    '',
    'unknown',
    'open_preview',
    'production_presale',
    'protected-chat-pilot',
    'protected_chat_pilot ',
  ]) {
    assert.equal(
      getStoryChatRuntimeConfig({
        KINDY_LAUNCH_MODE: launchMode,
        STORY_CHAT_RUNTIME_ENABLED: '1',
      }).runtimeEnabled,
      false,
      JSON.stringify(launchMode),
    );
  }
});

test('free text remains off even when its future flag is set', () => {
  assert.deepEqual(
    getStoryChatRuntimeConfig({
      STORY_CHAT_RUNTIME_ENABLED: '1',
      STORY_CHAT_FREE_TEXT_ENABLED: '1',
      STORY_CONTENT_RELEASE_CHANNEL: 'production',
      KINDY_LAUNCH_MODE: 'protected_chat_pilot',
    }),
    {
      runtimeEnabled: false,
      freeTextEnabled: false,
      releaseChannel: 'production',
    },
  );
});

test('release channel is exact, server-only configuration and fails closed', () => {
  for (const value of [undefined, '', 'preview', 'prod', 'Production', 'production ']) {
    assert.equal(
      getStoryChatRuntimeConfig({ STORY_CONTENT_RELEASE_CHANNEL: value }).releaseChannel,
      null,
      JSON.stringify(value),
    );
  }

  assert.equal(
    getStoryChatRuntimeConfig({ STORY_CONTENT_RELEASE_CHANNEL: 'staging' }).releaseChannel,
    'staging',
  );
  assert.equal(
    getStoryChatRuntimeConfig({ STORY_CONTENT_RELEASE_CHANNEL: 'production' }).releaseChannel,
    'production',
  );
});
