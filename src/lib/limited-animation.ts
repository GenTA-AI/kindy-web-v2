import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';

export type LimitedAnimationCameraPreset =
  | 'push_in'
  | 'pull_out'
  | 'drift_left'
  | 'drift_right'
  | 'drift_up'
  | 'drift_down'
  | 'hold';

export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LimitedAnimationInput {
  keyframePath: string;
  audioPath: string;
  outputPath: string;
  durationSec: number;
  isSpeakingScene?: boolean;
  speechDurationSec?: number;
  mouthBox?: NormalizedBox;
  cameraPreset?: LimitedAnimationCameraPreset;
  width?: number;
  height?: number;
  fps?: number;
}

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_FPS = 24;
const DEFAULT_MOUTH_BOX: NormalizedBox = {
  x: 0.5,
  y: 0.455,
  width: 0.082,
  height: 0.03,
};

export function renderLimitedAnimationScene(input: LimitedAnimationInput): void {
  const width = input.width ?? DEFAULT_WIDTH;
  const height = input.height ?? DEFAULT_HEIGHT;
  const fps = input.fps ?? DEFAULT_FPS;
  const frames = Math.max(1, Math.round(input.durationSec * fps));
  const camera = input.cameraPreset ?? 'push_in';
  const videoFilter = [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
    kenBurnsFilter(camera, frames, width, height, fps),
    `trim=duration=${input.durationSec.toFixed(3)}`,
    'setpts=PTS-STARTPTS',
    'fade=in:st=0:d=0.15',
    `fade=out:st=${Math.max(0, input.durationSec - 0.25).toFixed(3)}:d=0.25`,
  ].join(',');

  mkdirSync(dirname(input.outputPath), { recursive: true });

  if (!input.isSpeakingScene) {
    runFfmpeg([
      '-y', '-v', 'error',
      '-i', input.keyframePath,
      '-i', input.audioPath,
      '-filter_complex',
      `[0:v]${videoFilter},format=yuv420p[v];[1:a]apad,atrim=0:${input.durationSec.toFixed(3)},asetpts=PTS-STARTPTS[a]`,
      '-map', '[v]',
      '-map', '[a]',
      '-c:v', 'libx264',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-r', String(fps),
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '44100',
      '-ac', '2',
      '-t', input.durationSec.toFixed(3),
      input.outputPath,
    ], 'limited narration render');
    return;
  }

  const mouth = clampBox(input.mouthBox ?? DEFAULT_MOUTH_BOX);
  const mouthW = Math.max(24, Math.round(mouth.width * width));
  const mouthH = Math.max(10, Math.round(mouth.height * height));
  const mouthX = Math.round(mouth.x * width - mouthW / 2);
  const mouthY = Math.round(mouth.y * height - mouthH / 2);
  const assets = createMouthAssets(dirname(input.outputPath), mouthW, mouthH);
  const speakUntil = Math.max(0.15, Math.min(input.durationSec, input.speechDurationSec ?? input.durationSec));
  const speakWindow = `between(t,0,${speakUntil.toFixed(3)})`;
  const flapWindow = `${speakWindow}*lt(mod(t,0.22),0.11)`;

  runFfmpeg([
    '-y', '-v', 'error',
    '-i', input.keyframePath,
    '-i', input.audioPath,
    '-loop', '1', '-framerate', String(fps), '-t', input.durationSec.toFixed(3), '-i', assets.closedPath,
    '-loop', '1', '-framerate', String(fps), '-t', input.durationSec.toFixed(3), '-i', assets.openPath,
    '-filter_complex',
    `[0:v]${videoFilter}[base];` +
      `[base][2:v]overlay=${mouthX}:${mouthY}:enable='${speakWindow}'[closed];` +
      `[closed][3:v]overlay=${mouthX}:${mouthY}:enable='${flapWindow}',format=yuv420p[v];` +
      `[1:a]apad,atrim=0:${input.durationSec.toFixed(3)},asetpts=PTS-STARTPTS[a]`,
    '-map', '[v]',
    '-map', '[a]',
    '-c:v', 'libx264',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-r', String(fps),
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '44100',
    '-ac', '2',
    '-t', input.durationSec.toFixed(3),
    input.outputPath,
  ], 'limited speaking render');
}

export function cameraPresetFromDirective(
  directive: string | undefined,
  sceneIndex: number,
  isSpeakingScene: boolean
): LimitedAnimationCameraPreset {
  if (isSpeakingScene) return 'push_in';
  const text = (directive ?? '').toLowerCase();
  if (text.includes('zoom out') || text.includes('pull out') || text.includes('wide')) return 'pull_out';
  if (text.includes('pan left') || text.includes('left')) return 'drift_left';
  if (text.includes('pan right') || text.includes('right')) return 'drift_right';
  if (text.includes('up')) return 'drift_up';
  if (text.includes('down')) return 'drift_down';
  return sceneIndex % 2 === 0 ? 'drift_right' : 'drift_left';
}

export function parseNormalizedBox(raw: string | undefined): NormalizedBox | undefined {
  if (!raw) return undefined;
  const parts = raw.split(',').map((part) => Number.parseFloat(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`LIMITED_MOUTH_BOX must be "x,y,width,height" normalized floats, got: ${raw}`);
  }
  return clampBox({
    x: parts[0],
    y: parts[1],
    width: parts[2],
    height: parts[3],
  });
}

function kenBurnsFilter(
  preset: LimitedAnimationCameraPreset,
  frames: number,
  width: number,
  height: number,
  fps: number
): string {
  const denom = Math.max(1, frames - 1);
  const progress = `on/${denom}`;
  const zoomByPreset: Record<LimitedAnimationCameraPreset, string> = {
    push_in: `1+0.10*${progress}`,
    pull_out: `1.10-0.10*${progress}`,
    drift_left: '1.08',
    drift_right: '1.08',
    drift_up: '1.08',
    drift_down: '1.08',
    hold: '1.02',
  };
  const xByPreset: Record<LimitedAnimationCameraPreset, string> = {
    push_in: 'iw/2-(iw/zoom/2)',
    pull_out: 'iw/2-(iw/zoom/2)',
    drift_left: `(iw-iw/zoom)*(0.62-0.24*${progress})`,
    drift_right: `(iw-iw/zoom)*(0.38+0.24*${progress})`,
    drift_up: 'iw/2-(iw/zoom/2)',
    drift_down: 'iw/2-(iw/zoom/2)',
    hold: 'iw/2-(iw/zoom/2)',
  };
  const yByPreset: Record<LimitedAnimationCameraPreset, string> = {
    push_in: 'ih/2-(ih/zoom/2)',
    pull_out: 'ih/2-(ih/zoom/2)',
    drift_left: 'ih/2-(ih/zoom/2)',
    drift_right: 'ih/2-(ih/zoom/2)',
    drift_up: `(ih-ih/zoom)*(0.62-0.24*${progress})`,
    drift_down: `(ih-ih/zoom)*(0.38+0.24*${progress})`,
    hold: 'ih/2-(ih/zoom/2)',
  };

  return `zoompan=z='${zoomByPreset[preset]}':x='${xByPreset[preset]}':y='${yByPreset[preset]}':d=${frames}:s=${width}x${height}:fps=${fps}`;
}

function clampBox(box: NormalizedBox): NormalizedBox {
  return {
    x: clamp(box.x, 0, 1),
    y: clamp(box.y, 0, 1),
    width: clamp(box.width, 0.015, 0.25),
    height: clamp(box.height, 0.012, 0.16),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createMouthAssets(dir: string, width: number, height: number): { closedPath: string; openPath: string } {
  const assetDir = join(dir, '_limited_assets');
  mkdirSync(assetDir, { recursive: true });
  const closedPath = join(assetDir, `mouth_closed_${width}x${height}.png`);
  const openPath = join(assetDir, `mouth_open_${width}x${height}.png`);
  writeFileSync(closedPath, encodeMouthPng(width, height, 'closed'));
  writeFileSync(openPath, encodeMouthPng(width, height, 'open'));
  return { closedPath, openPath };
}

function encodeMouthPng(width: number, height: number, state: 'closed' | 'open'): Buffer {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = state === 'open'
        ? openMouthPixel(x + 0.5, y + 0.5, width, height)
        : closedMouthPixel(x + 0.5, y + 0.5, width, height);
      if (!color) continue;
      const idx = (y * width + x) * 4;
      pixels[idx] = color.r;
      pixels[idx + 1] = color.g;
      pixels[idx + 2] = color.b;
      pixels[idx + 3] = color.a;
    }
  }
  return encodePng(width, height, pixels);
}

function openMouthPixel(x: number, y: number, width: number, height: number): Rgba | null {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.46;
  const ry = height * 0.42;
  const dist = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
  const highlightDist = ((x - cx) / (rx * 0.55)) ** 2 + ((y - height * 0.37) / (ry * 0.22)) ** 2;
  if (dist <= 1 && highlightDist <= 1) {
    return { r: 246, g: 168, b: 156, a: 170 };
  }
  if (dist <= 1) {
    const edge = dist > 0.82 ? Math.round((1 - dist) / 0.18 * 235) : 235;
    return { r: 55, g: 33, b: 29, a: clampByte(edge) };
  }
  return null;
}

function closedMouthPixel(x: number, y: number, width: number, height: number): Rgba | null {
  const t = x / width;
  const curveY = height * 0.42 + Math.sin(t * Math.PI) * height * 0.2;
  const thickness = Math.max(1.25, height * 0.12);
  const dist = Math.abs(y - curveY);
  if (dist > thickness) return null;
  const sideFade = Math.sin(t * Math.PI);
  const alpha = clampByte((1 - dist / thickness) * 210 * sideFade);
  return { r: 56, g: 36, b: 31, a: alpha };
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function runFfmpeg(args: string[], label: string): void {
  const result = spawnSync('ffmpeg', args, { encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`ffmpeg ${label} failed: ${result.stderr}`);
  }
}
