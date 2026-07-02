'use client';

import { useEffect } from 'react';
import { pretendard } from './fonts';
import './globals.css';

// Next 16.2: global-error 는 루트 레이아웃을 대체하므로 자체 html/body + 전역 스타일/폰트를 포함해야 한다.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko" className={`h-full antialiased ${pretendard.variable}`}>
      <body className="min-h-full bg-cream font-sans text-ink">
        <main className="flex min-h-screen items-center justify-center px-6">
          <section className="max-w-md rounded-3xl border border-line bg-white p-6 text-center shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-sage">모리의 이야기 숲</p>
            <h1 className="mt-2 text-2xl font-black text-ink">잠시 이야기 숲이 멈췄어요</h1>
            <p className="mt-3 text-sm font-medium leading-relaxed text-ink2">
              모리가 곧 길을 다시 열 거예요. 잠깐 기다렸다가 다시 시도해 주세요.
            </p>
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-saged px-6 text-sm font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
            >
              다시 시도
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
