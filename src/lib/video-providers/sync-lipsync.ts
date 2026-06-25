/**
 * Sync Labs Lipsync v2 / v2-pro (via fal.ai) — 립싱크 후처리 provider
 *
 * 왜 필요한가?
 *   Seedance 2.0 reference-to-video 의 audio_urls 는 "rhythm 레퍼런스"지 립싱크 소스가 아니다.
 *   외부 TTS 에 입모양을 맞추려면 별도의 립싱크 툴이 필수.
 *   입력: 기존 영상 (mouth 영역 visible) + 목표 오디오 (우리 Gemini TTS)
 *   출력: mouth 영역만 교체된 영상, 나머지 motion/style 은 보존.
 *
 * Endpoint: fal-ai/sync-lipsync/v2 (standard, $3/min) or fal-ai/sync-lipsync/v2/pro ($5/min)
 *
 * Pricing:
 *   standard: $3/min = $0.050/sec
 *   pro:      $5/min = $0.083/sec (close-up / commercial quality)
 */

import { readFileSync } from 'node:fs';
import { fal } from '@fal-ai/client';

export type LipsyncTier = 'standard' | 'pro';
export type LipsyncSyncMode = 'cut_off' | 'loop' | 'bounce' | 'silence' | 'remap';

const ENDPOINT_STANDARD = 'fal-ai/sync-lipsync/v2';
const ENDPOINT_PRO = 'fal-ai/sync-lipsync/v2/pro';

const PRICE_PER_SEC: Record<LipsyncTier, number> = {
  standard: 3 / 60, // $3/min → $0.05/s
  pro: 5 / 60,      // $5/min → $0.0833/s
};

export interface SyncLipsyncInput {
  /** 입력 영상 파일 경로 (mp4 권장) */
  videoFilePath: string;
  /** 목표 오디오 파일 경로 (wav/mp3) — 우리 Gemini TTS */
  audioFilePath: string;
  /** 기본 "standard" */
  tier?: LipsyncTier;
  /** 오디오/영상 길이 불일치 처리: 기본 cut_off */
  syncMode?: LipsyncSyncMode;
  /** 비용 추정에 쓸 영상 길이 (초). 미지정 시 fal 응답으로부터 추정 */
  videoDurationSec: number;
}

export interface SyncLipsyncOutput {
  videoUrl: string;
  costUsd: number;
  durationSec: number;
  endpoint: string;
  requestId?: string;
  elapsedMs: number;
}

export class SyncLipsyncProvider {
  name = 'sync-lipsync';

  constructor(falApiKey: string) {
    if (!falApiKey) throw new Error('FAL_KEY required for SyncLipsyncProvider');
    fal.config({ credentials: falApiKey });
  }

  async generateFromFiles(input: SyncLipsyncInput): Promise<SyncLipsyncOutput> {
    const startedAt = Date.now();
    const tier = input.tier ?? 'standard';
    const syncMode = input.syncMode ?? 'cut_off';
    const endpoint = tier === 'pro' ? ENDPOINT_PRO : ENDPOINT_STANDARD;

    const videoUrl = await uploadLocalFile(input.videoFilePath);
    const audioUrl = await uploadLocalFile(input.audioFilePath);

    const result = await fal.subscribe(endpoint, {
      input: {
        video_url: videoUrl,
        audio_url: audioUrl,
        model: tier === 'pro' ? 'lipsync-2-pro' : 'lipsync-2',
        sync_mode: syncMode,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          for (const log of update.logs ?? []) {
            const msg = (log as { message?: string }).message;
            if (msg) console.log(`    [fal lipsync] ${msg}`);
          }
        }
      },
    });

    const data = (result as { data: { video?: { url: string } }; requestId?: string }).data;
    const outUrl = data?.video?.url;
    if (!outUrl) {
      throw new Error(`sync-lipsync response missing video.url: ${JSON.stringify(result).slice(0, 400)}`);
    }

    const costUsd = input.videoDurationSec * PRICE_PER_SEC[tier];

    return {
      videoUrl: outUrl,
      costUsd,
      durationSec: input.videoDurationSec,
      endpoint,
      requestId: (result as { requestId?: string }).requestId,
      elapsedMs: Date.now() - startedAt,
    };
  }

  estimateCostUsd(durationSec: number, tier: LipsyncTier = 'standard'): number {
    return durationSec * PRICE_PER_SEC[tier];
  }
}

function getMimeType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
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
