'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import MoriCharacter from '@/components/MoriCharacter';

// Next 16.2 error 컨벤션: 'use client' 필수. 일시적(예: Supabase 연결) 오류는
// unstable_retry 로 세그먼트를 다시 불러온다(reset 은 재요청 없이 재렌더만 하므로 데이터 오류를 못 살림).
export default function Error({
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
    <main className="flex min-h-screen items-center justify-center bg-cream px-6">
      <section className="max-w-md rounded-3xl border border-line bg-white p-6 text-center shadow-sm">
        <MoriCharacter
          className="mx-auto h-28 w-28 overflow-hidden rounded-full border border-line bg-white"
          imageClassName="scale-125"
          label="모리"
          withGlow={false}
        />
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-sage">모리의 이야기 숲</p>
        <h1 className="mt-2 text-2xl font-black text-ink">잠시 연결이 매끄럽지 않아요</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-ink2">
          모리가 이야기를 여는 길을 다시 찾고 있어요. 잠깐 기다렸다가 다시 시도해 주세요.
        </p>
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-saged px-6 text-sm font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-line bg-cream px-6 text-sm font-black text-saged transition hover:bg-mist active:scale-[0.98]"
          >
            처음으로
          </Link>
        </div>
      </section>
    </main>
  );
}
