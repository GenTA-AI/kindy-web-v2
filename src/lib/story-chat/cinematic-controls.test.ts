import assert from 'node:assert/strict';
import test from 'node:test';

import {
  rewindCinematic,
  toggleCinematicPlayback,
  type CinematicMediaController,
} from './cinematic-controls';

function createMedia(paused: boolean, currentTime = 7.5) {
  const calls: string[] = [];
  const media: CinematicMediaController = {
    paused,
    currentTime,
    async play() {
      calls.push('play');
    },
    pause() {
      calls.push('pause');
    },
  };
  return { media, calls };
}

test('explicit playback control plays only after the child presses play', async () => {
  const { media, calls } = createMedia(true);
  assert.deepEqual(calls, []);
  assert.equal(await toggleCinematicPlayback(media), 'playing');
  assert.deepEqual(calls, ['play']);
});

test('explicit playback control pauses a playing cinematic', async () => {
  const { media, calls } = createMedia(false);
  assert.equal(await toggleCinematicPlayback(media), 'paused');
  assert.deepEqual(calls, ['pause']);
});

test('rewind pauses and moves to the first frame without starting playback', () => {
  const { media, calls } = createMedia(false);
  assert.equal(rewindCinematic(media), 'ready');
  assert.equal(media.currentTime, 0);
  assert.deepEqual(calls, ['pause']);
});
