/**
 * VEED Fabric 1.0 provider via fal.ai
 *
 * Ported from: art&science/ocean-edu-imagen/generate_ep01_veed.py (generate_veed function)
 *
 * Input: image URL + audio URL → lipsync video
 * Pricing (2026-04-17): $0.08/sec (480p), $0.15/sec (720p)
 * Max clip duration: 30s per request, stitching via ffmpeg for longer
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fal } from '@fal-ai/client';
import type { SceneInput, SceneOutput, Resolution, VideoProvider, VideoPlan } from './types';

const FAL_API_URL = 'https://fal.run/veed/fabric-1.0';

const COST_PER_SEC: Record<Resolution, number> = {
  '480p': 0.08,
  '720p': 0.15,
  '1080p': 0.25, // not officially documented, upper bound estimate
};

interface FalVeedRequest {
  image_url: string;
  audio_url: string;
  resolution: '480p' | '720p';
}

interface FalVeedResponse {
  video: { url: string };
  // fal may return additional fields (duration, seed, etc.)
}

export interface VeedFabricFileInput {
  imageFilePath: string;
  audioFilePath: string;
  resolution: '480p' | '720p';
}

export interface VeedFabricFileOutput {
  videoUrl: string;
  costUsd: number;
  elapsedMs: number;
}

export class VeedFabricProvider implements VideoProvider {
  name = 'veed-fabric';

  constructor(private readonly falApiKey: string) {
    if (!falApiKey) throw new Error('FAL_KEY required for VeedFabricProvider');
    fal.config({ credentials: falApiKey });
  }

  async generateScene(
    input: SceneInput,
    imageUrl: string,
    audioUrl: string,
    resolution: Resolution
  ): Promise<SceneOutput> {
    // VEED Fabric 480p/720p only — fall back to 720p if 1080p requested
    const veedResolution: '480p' | '720p' = resolution === '480p' ? '480p' : '720p';

    const body: FalVeedRequest = {
      image_url: imageUrl,
      audio_url: audioUrl,
      resolution: veedResolution,
    };

    const res = await fetch(FAL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${this.falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`VEED Fabric failed (${res.status}): ${text.slice(0, 500)}`);
    }

    const data: FalVeedResponse = await res.json();
    if (!data.video?.url) {
      throw new Error(`VEED Fabric response missing video.url: ${JSON.stringify(data).slice(0, 300)}`);
    }

    const costUsd = input.durationSec * COST_PER_SEC[resolution];

    return {
      sceneId: input.sceneId,
      imageUrl,
      ttsAudioUrl: audioUrl,
      videoClipUrl: data.video.url,
      costUsd,
    };
  }

  async generateSceneFromFiles(input: VeedFabricFileInput): Promise<VeedFabricFileOutput> {
    const startedAt = Date.now();
    const imageUrl = await uploadLocalFile(input.imageFilePath);
    const audioUrl = await uploadLocalFile(input.audioFilePath);

    const result = await fal.subscribe('veed/fabric-1.0', {
      input: {
        image_url: imageUrl,
        audio_url: audioUrl,
        resolution: input.resolution,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          for (const log of update.logs ?? []) {
            const msg = (log as { message?: string }).message;
            if (msg) console.log(`    [fal veed] ${msg}`);
          }
        }
      },
    });

    const data = (result as { data?: FalVeedResponse; requestId?: string }).data;
    const videoUrl = data?.video?.url;
    if (!videoUrl) {
      throw new Error(`VEED Fabric response missing video.url: ${JSON.stringify(result).slice(0, 400)}`);
    }

    const audioDurationSec = probeAudioDurationSec(input.audioFilePath);
    return {
      videoUrl,
      costUsd: audioDurationSec * COST_PER_SEC[input.resolution],
      elapsedMs: Date.now() - startedAt,
    };
  }

  estimateCostUsd(plan: VideoPlan): number {
    const pricePerSec = COST_PER_SEC[plan.resolution];
    const dialogueScenes = plan.scenes.filter((s) => s.dialogue);
    return dialogueScenes.reduce((sum, s) => sum + s.durationSec * pricePerSec, 0);
  }

  async healthCheck(): Promise<boolean> {
    // fal.ai doesn't expose a dedicated health endpoint for VEED.
    // Best signal: attempt a HEAD on the base URL. If 200/405/401 → reachable.
    try {
      const res = await fetch(FAL_API_URL, { method: 'HEAD' });
      return res.status < 500;
    } catch {
      return false;
    }
  }
}

function getMimeType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  return 'application/octet-stream';
}

async function uploadLocalFile(filePath: string): Promise<string> {
  const bytes = readFileSync(filePath);
  const mimeType = getMimeType(filePath);
  const filename = filePath.split('/').pop() ?? 'upload';
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });
  return await fal.storage.upload(file);
}

function probeAudioDurationSec(audioPath: string): number {
  const wavDuration = probeWavDurationSec(audioPath);
  if (wavDuration !== null) return wavDuration;

  const result = spawnSync('ffprobe', [
    '-v', 'quiet',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath,
  ], { encoding: 'utf-8' });
  const parsed = result.status === 0 ? Number.parseFloat(result.stdout.trim()) : Number.NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  throw new Error(`Unable to measure audio duration for VEED input: ${audioPath}`);
}

function probeWavDurationSec(audioPath: string): number | null {
  if (!audioPath.toLowerCase().endsWith('.wav')) return null;
  const bytes = readFileSync(audioPath);
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let dataBytes = 0;
  while (offset + 8 <= bytes.length) {
    const chunkId = bytes.toString('ascii', offset, offset + 4);
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkId === 'fmt ' && chunkSize >= 16) {
      channels = bytes.readUInt16LE(chunkStart + 2);
      sampleRate = bytes.readUInt32LE(chunkStart + 4);
      bitsPerSample = bytes.readUInt16LE(chunkStart + 14);
    } else if (chunkId === 'data') {
      dataBytes = chunkSize;
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
  return bytesPerSecond > 0 && dataBytes > 0 ? dataBytes / bytesPerSecond : null;
}
