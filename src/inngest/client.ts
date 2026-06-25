/**
 * Inngest client (싱글톤).
 *
 * 환경:
 *   - 로컬 개발: INNGEST_DEV=1 일 때만 dev server 사용.
 *   - 프로덕션: INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY 환경변수 필요 (Inngest Cloud).
 */

import { Inngest } from 'inngest';

export const isInngestDevMode = process.env.INNGEST_DEV === '1';

export const inngest = new Inngest({
  id: 'eduvid',
  // INNGEST_DEV=1 로 명시한 경우에만 로컬 dev 모드. env 미설정 또는 EVENT_KEY 설정 시 production mode.
  isDev: isInngestDevMode,
  signingKey: process.env.INNGEST_SIGNING_KEY,
  eventKey: process.env.INNGEST_EVENT_KEY,
});

/** 이벤트 타입 — typesafe `inngest.send({ name: 'video/generate', data: {...} })` 용 */
export interface VideoGenerateEvent {
  name: 'video/generate';
  data: {
    videoId: string;
    brief: {
      topic: string;
      audience: string;
      targetDurationSec: number;
      learningGoals: string[];
      styleReference: string;
      tone: string;
      roughSynopsis?: string;
      protagonistHint?: string;
      adjectives?: string[];
    };
    targetDurationSec?: number;
    seedanceTier?: 'standard' | 'fast';
  };
}
