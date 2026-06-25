'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

/** /subscribe/fail — 토스 카드 등록(requestBillingAuth) failUrl. ?code=&message= */
function FailContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const message = searchParams.get('message');

  const friendly =
    code === 'PAY_PROCESS_CANCELED'
      ? '카드 등록을 취소했어요. 준비되면 언제든 다시 시작할 수 있어요.'
      : message ?? '카드 등록 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.';

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-[375px] mx-auto px-6 py-16 text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <h1 className="text-xl font-extrabold text-gray-900 mb-2">카드 등록이 완료되지 않았어요</h1>
        <p className="text-sm text-gray-500 mb-1">{friendly}</p>
        {code && <p className="text-[11px] text-gray-400 mb-6">오류 코드: {code}</p>}
        <Link
          href="/subscribe"
          className="inline-block w-full mt-4 px-6 py-4 bg-violet-500 hover:bg-violet-600 text-white font-bold text-base rounded-2xl shadow-lg shadow-violet-200/60 active:scale-[0.98] transition"
        >
          다시 시도하기
        </Link>
      </div>
    </main>
  );
}

export default function SubscribeFailPage() {
  return (
    <Suspense fallback={null}>
      <FailContent />
    </Suspense>
  );
}
