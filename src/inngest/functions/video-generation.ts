/**
 * Inngest function — `video/generate` 이벤트를 받아 runPipeline 호출.
 *
 * 전략:
 *   - 전체 파이프라인을 하나의 step.run 으로 감싼다. Inngest retries 2회.
 *   - runPipeline 이 실패하면 videos.status='failed' + error_reason 기록 후 throw.
 *   - Inngest 가 throw 를 감지해 재실행. pipeline 이 내부에서 attempt_count 증가.
 *   - concurrency: 5 (fal.ai quota 폭발 방지. 프로덕션에서 환경에 맞게 조정).
 *   - 장시간 실행 (5~15분) 은 Inngest 가 알아서 처리 (Next.js maxDuration 제약 밖).
 */

import { inngest } from '../client';
import { runPipeline } from '@/lib/video-pipeline';
import type { VideoBrief } from '@/lib/video-providers/director.types';

interface VideoGeneratePayload {
  videoId: string;
  brief: VideoBrief;
  targetDurationSec?: number;
  seedanceTier?: 'standard' | 'fast';
}

export const videoGenerate = inngest.createFunction(
  {
    id: 'video-generate',
    retries: 2, // 첫 시도 실패 시 최대 2회 더 — 총 3회
    concurrency: { limit: 5 },
    triggers: [{ event: 'video/generate' }],
  },
  async ({ event, step, logger }) => {
    const data = event.data as VideoGeneratePayload;

    logger.info('video.generate start', { videoId: data.videoId, duration: data.targetDurationSec });

    // 전체 파이프라인을 step 으로 감싼다. 성공 시 결과 캐싱, 실패 시 Inngest 가 재시도.
    const result = await step.run('run-pipeline', async () => {
      return await runPipeline({
        videoId: data.videoId,
        brief: data.brief,
        targetDurationSec: data.targetDurationSec,
        seedanceTier: data.seedanceTier,
      });
    });

    logger.info('video.generate done', {
      videoId: result.videoId,
      durationSec: result.durationSec,
      totalCost: result.cost.total,
      elapsedMs: result.elapsedMs,
    });

    return {
      videoId: result.videoId,
      signedUrl: result.signedUrl,
      durationSec: result.durationSec,
      cost: result.cost,
      elapsedMs: result.elapsedMs,
      seed: result.seed,
    };
  }
);
