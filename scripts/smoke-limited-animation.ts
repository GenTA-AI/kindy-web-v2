import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { renderLimitedAnimationScene, analyzeMouthWindows } from '../src/lib/limited-animation';

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
const narrationRawPath = join(workDir, 'narration-raw.wav');
const narrationDelayedPath = join(workDir, 'narration-delayed.wav');
const narrationOutputPath = join(workDir, 'limited-narration.mp4');

// 말소리 흉내 — 유성 버스트 + 휴지(입 동기화가 눈에 보이도록). 0.85s 주기 중 0.6s만 소리.
run('ffmpeg', [
  '-y', '-v', 'error',
  '-f', 'lavfi',
  '-i', "aevalsrc=exprs='0.12*sin(2*PI*520*t)*gt(mod(t\\,0.85)\\,0.25)':s=22050:d=3.2",
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

// 음성 동기화 검증: 유성 버스트마다 입 열림 구간이 잡히고, 휴지가 있어야 한다.
const analysis = analyzeMouthWindows(audioPath, 24, 3.2);
const gaps = analysis.windows.length - 1;
console.log(`limited animation smoke ok`);
console.log(`mouth-sync windows=${analysis.windows.length} (voiced bursts detected, gaps=${gaps})`);
if (!analysis.ok || analysis.windows.length < 2) {
  throw new Error(`audio-driven mouth sync failed: expected multiple voiced windows, got ${analysis.windows.length}`);
}

run('ffmpeg', [
  '-y', '-v', 'error',
  '-f', 'lavfi',
  '-i', "sine=frequency=440:sample_rate=22050:duration=2.4",
  '-ar', '22050',
  '-ac', '1',
  '-c:a', 'pcm_s16le',
  narrationRawPath,
]);

run('ffmpeg', [
  '-y', '-v', 'error',
  '-i', narrationRawPath,
  '-af', 'adelay=500:all=1,apad,atrim=0:4,asetpts=PTS-STARTPTS',
  '-ar', '22050',
  '-ac', '1',
  '-c:a', 'pcm_s16le',
  narrationDelayedPath,
]);

renderLimitedAnimationScene({
  keyframePath,
  audioPath: narrationDelayedPath,
  outputPath: narrationOutputPath,
  durationSec: 4,
  isSpeakingScene: false,
  cameraPreset: 'drift_left',
  fadeInSec: 0.4,
  fadeOutSec: 0.5,
});

if (!existsSync(narrationOutputPath)) {
  throw new Error(`limited narration render missing: ${narrationOutputPath}`);
}
const narrationDurationSec = probeDurationSec(narrationOutputPath);
if (Math.abs(narrationDurationSec - 4) > 0.3) {
  throw new Error(`limited narration duration mismatch: expected 4s, got ${narrationDurationSec.toFixed(3)}s`);
}
console.log(`narration-delay duration=${narrationDurationSec.toFixed(2)}s`);
console.log(`video=${outputPath}`);
console.log(`narration=${narrationOutputPath}`);
console.log(`preview=${previewPath}`);

function run(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, { encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`${cmd} failed: ${result.stderr}`);
  }
}

function probeDurationSec(videoPath: string): number {
  const result = spawnSync('ffprobe', [
    '-v', 'quiet',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    videoPath,
  ], { encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`ffprobe failed: ${result.stderr}`);
  }
  const durationSec = Number.parseFloat(result.stdout.trim());
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error(`ffprobe returned invalid duration for ${videoPath}: ${result.stdout}`);
  }
  return durationSec;
}
