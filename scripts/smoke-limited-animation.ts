import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { renderLimitedAnimationScene } from '../src/lib/limited-animation';

const workDir = join(process.cwd(), 'tmp', 'limited-animation-smoke');
mkdirSync(workDir, { recursive: true });

const keyframePath = [
  join(process.cwd(), 'public', 'ip', 'mori-reference-no-a.jpg'),
  join(process.cwd(), 'public', 'ip', 'generated', 'mori-cutout.png'),
  join(process.cwd(), 'public', 'ip', 'generated', 'starlight-seed.png'),
].find((candidate) => existsSync(candidate));

if (!keyframePath) {
  throw new Error('No local keyframe asset found for smoke test');
}

const audioPath = join(workDir, 'speech-tone.wav');
const outputPath = join(workDir, 'limited-speaking.mp4');
const previewPath = join(workDir, 'preview.jpg');

run('ffmpeg', [
  '-y', '-v', 'error',
  '-f', 'lavfi',
  '-i', 'sine=frequency=520:duration=3.2',
  '-af', 'volume=0.12',
  '-ar', '22050',
  '-ac', '1',
  '-c:a', 'pcm_s16le',
  audioPath,
]);

renderLimitedAnimationScene({
  keyframePath,
  audioPath,
  outputPath,
  durationSec: 4,
  isSpeakingScene: true,
  speechDurationSec: 3.2,
  cameraPreset: 'push_in',
  mouthBox: {
    x: 0.5,
    y: 0.455,
    width: 0.082,
    height: 0.03,
  },
});

run('ffmpeg', [
  '-y', '-v', 'error',
  '-ss', '1.0',
  '-i', outputPath,
  '-vframes', '1',
  '-q:v', '2',
  previewPath,
]);

console.log(`limited animation smoke ok`);
console.log(`video=${outputPath}`);
console.log(`preview=${previewPath}`);

function run(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, { encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`${cmd} failed: ${result.stderr}`);
  }
}
