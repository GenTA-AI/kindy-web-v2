/**
 * Seedance 2.0 (ByteDance, via fal.ai) — reference-to-video provider
 *
 * Endpoint: bytedance/seedance-2.0/reference-to-video
 *   - image_urls (최대 9) : 캐릭터 레퍼런스 시트 + 시작 키프레임
 *   - audio_urls (최대 3) : Gemini TTS 음성 (립싱크 + 리듬 레퍼런스)
 *   - prompt : @Image1/@Image2/@Audio1 tagged 영화 스크립트
 *   - duration : "4"~"15" string enum (or "auto")
 *   - aspect_ratio : "16:9" 권장
 *   - resolution : "480p" | "720p"
 *   - generate_audio : false → 영상만, 우리 TTS 로 후처리 합성 (품질 제어 유리)
 *
 * Pricing (2026-04): 720p standard $0.3024/s, fast $0.2419/s (reference inputs 은 0.6x 할인 가능).
 */

import { readFileSync } from 'node:fs';
import { fal } from '@fal-ai/client';

export type SeedanceTier = 'standard' | 'fast';
export type SeedanceResolution = '480p' | '720p';

export interface SeedanceInput {
  /**
   * 전체 프롬프트. @Image1, @Image2, @Video1, @Audio1 등 태그 사용.
   * 첫 문단 top-level cinematic statement + 타임스탬프 breakdown 권장.
   */
  prompt: string;
  /** 로컬 파일 경로들. [0]=캐릭터 레퍼런스 시트, [1]=시작 키프레임 권장 */
  imageFilePaths: string[];
  /**
   * 로컬 비디오 파일 경로 (mp4). Video Extension 용.
   * 이전 클립을 @Video1 으로 넣어 30s+ 체이닝. 최대 3, 합산 15s 이하.
   */
  videoFilePaths?: string[];
  /** 로컬 오디오 파일 경로 (WAV). 있으면 립싱크/리듬 레퍼런스로 사용 */
  audioFilePaths?: string[];
  /** 씬 길이 (4~15초). Seedance 2.0 문자열 enum 으로 자동 변환 */
  durationSec: number;
  /** 기본 "720p" */
  resolution?: SeedanceResolution;
  /** 기본 "16:9" */
  aspectRatio?: '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16';
  /**
   * true = fal 이 audio track (SFX/BGM/voice) 도 생성.
   * false = 영상만, audio_urls 는 lip-sync/rhythm 레퍼런스로만 사용.
   *   우리 TTS 를 그대로 보존하려면 false 권장.
   */
  generateAudio?: boolean;
  /** fast tier 면 비용 20% 절감 */
  tier?: SeedanceTier;
  /**
   * 재현성/일관성 보조 (voice 보장 안 됨, 시각 drift 억제용).
   * 같은 seed 로 반복해도 결과는 '유사' 수준.
   */
  seed?: number;
}

export interface SeedanceOutput {
  /** 다운로드 가능한 영상 URL (fal CDN 임시) */
  videoUrl: string;
  /** 실측 비용 USD */
  costUsd: number;
  /** 요청 씬 길이 */
  durationSec: number;
  /** 사용 모델 endpoint */
  endpoint: string;
  /** fal request_id (재조회/디버깅용) */
  requestId?: string;
  /** 실제 사용된 seed (재현성 기록용) */
  seed?: number;
  /** 소요 시간 ms */
  elapsedMs: number;
}

/** 720p per-second pricing (2026-04). reference inputs 0.6x 할인은 적용하지 않음 (보수적 estimate). */
const PRICE_PER_SEC: Record<SeedanceTier, Record<SeedanceResolution, number>> = {
  standard: { '720p': 0.3024, '480p': 0.1344 },
  fast: { '720p': 0.2419, '480p': 0.1075 },
};

const ENDPOINT = 'bytedance/seedance-2.0/reference-to-video';

export class Seedance2Provider {
  name = 'seedance-2.0';

  constructor(falApiKey: string) {
    if (!falApiKey) throw new Error('FAL_KEY required for Seedance2Provider');
    fal.config({ credentials: falApiKey });
  }

  /**
   * 로컬 파일 → fal CDN 업로드 → reference-to-video 호출 → 영상 URL 반환.
   * 영상 다운로드 저장은 caller 책임 (스모크/orchestrator).
   */
  async generateFromFiles(input: SeedanceInput): Promise<SeedanceOutput> {
    const startedAt = Date.now();
    const resolution = input.resolution ?? '720p';
    const aspect = input.aspectRatio ?? '16:9';
    const tier = input.tier ?? 'standard';
    const generateAudio = input.generateAudio ?? false;

    if (input.durationSec < 4 || input.durationSec > 15) {
      throw new Error(`Seedance 2.0 durationSec must be 4-15 (got ${input.durationSec})`);
    }
    const durationStr = String(Math.round(input.durationSec)) as
      | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | '13' | '14' | '15';

    // 1) 파일 업로드 (fal storage)
    const imageUrls = await Promise.all(
      input.imageFilePaths.map((p) => uploadLocalFile(p))
    );
    const videoUrls = input.videoFilePaths
      ? await Promise.all(input.videoFilePaths.map((p) => uploadLocalFile(p)))
      : [];
    const audioUrls = input.audioFilePaths
      ? await Promise.all(input.audioFilePaths.map((p) => uploadLocalFile(p)))
      : [];

    // 2) subscribe (작업 제출 + 폴링 + 결과)
    const result = await fal.subscribe(ENDPOINT, {
      input: {
        prompt: input.prompt,
        image_urls: imageUrls,
        ...(videoUrls.length > 0 ? { video_urls: videoUrls } : {}),
        ...(audioUrls.length > 0 ? { audio_urls: audioUrls } : {}),
        resolution,
        duration: durationStr,
        aspect_ratio: aspect,
        generate_audio: generateAudio,
        ...(input.seed !== undefined ? { seed: input.seed } : {}),
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          for (const log of update.logs ?? []) {
            const msg = (log as { message?: string }).message;
            if (msg) console.log(`    [fal] ${msg}`);
          }
        }
      },
    });

    const data = (result as { data: { video?: { url: string }; seed?: number }; requestId?: string }).data;
    const videoUrl = data?.video?.url;
    if (!videoUrl) {
      throw new Error(`Seedance 2.0 response missing video.url: ${JSON.stringify(result).slice(0, 400)}`);
    }

    // Video extension 할인 (reference video 포함 시 0.6x) 추정 — 보수적 full price 청구 기록
    const fullCost = input.durationSec * PRICE_PER_SEC[tier][resolution];
    const costUsd = videoUrls.length > 0 ? fullCost * 0.6 : fullCost;

    return {
      videoUrl,
      costUsd,
      durationSec: input.durationSec,
      endpoint: ENDPOINT,
      requestId: (result as { requestId?: string }).requestId,
      seed: data?.seed,
      elapsedMs: Date.now() - startedAt,
    };
  }

  estimateCostUsd(durationSec: number, tier: SeedanceTier = 'standard', resolution: SeedanceResolution = '720p'): number {
    return durationSec * PRICE_PER_SEC[tier][resolution];
  }
}

function getMimeType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  return 'application/octet-stream';
}

async function uploadLocalFile(filePath: string): Promise<string> {
  const bytes = readFileSync(filePath);
  const mimeType = getMimeType(filePath);
  const filename = filePath.split('/').pop() ?? 'upload';
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  // fal.storage.upload accepts Blob/File in Node 20+
  const file = new File([blob], filename, { type: mimeType });
  return await fal.storage.upload(file);
}
