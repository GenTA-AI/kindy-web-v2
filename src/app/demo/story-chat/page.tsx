import type { Metadata, Viewport } from 'next';

import StoryChatDemo from '@/components/chat/StoryChatDemo';

export const metadata: Metadata = {
  title: '대화형 이야기 시제품 — Kindy',
  description: '저장이나 AI 전송 없이 대화형 이야기 흐름을 확인하는 Kindy 시제품.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FBF7EF',
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default function StoryChatPrototypePage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#F1EEE7] text-ink">
      <aside
        className="relative z-[120] flex shrink-0 items-center justify-center border-b border-sages bg-sagebg px-3 pb-2 pt-[max(8px,env(safe-area-inset-top))] text-center text-[14px] font-bold leading-5 text-saged"
        role="note"
        aria-label="시제품 안내"
      >
        시제품 · 저장/AI 전송 없음
      </aside>

      <div className="relative min-h-0 flex-1 overflow-hidden [&>main]:!h-full [&>main]:!min-h-full [&>main>div]:!h-full [&>main>div]:!min-h-full [&_[role=dialog]]:!absolute [&_[role=dialog]>div]:!h-full">
        <StoryChatDemo />
      </div>
    </div>
  );
}
