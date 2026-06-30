/**
 * Inngest serve handler (Next.js 16 App Router).
 *
 * 엔드포인트:
 *   GET  /api/inngest — 함수 메타데이터 (Inngest 대시보드 인식용)
 *   PUT  /api/inngest — 함수 재등록 (deploy 시 자동 호출됨)
 *   POST /api/inngest — 이벤트 실행 콜백
 *
 * 로컬 개발:
 *   npx inngest-cli@latest dev
 *   → http://localhost:8288 에서 실시간 이벤트 로그 + 재실행 가능
 */

import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { videoGenerate } from '@/inngest/functions/video-generation';
import { subscriptionRenewal } from '@/inngest/functions/subscription-renewal';

// signingKey 는 src/inngest/client.ts 에서 client options 로 주입됨.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [videoGenerate, subscriptionRenewal],
});

// Seedance/nano-banana 호출이 합쳐 5~15분 걸리므로 상한 충분히.
export const maxDuration = 800;
