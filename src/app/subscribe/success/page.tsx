'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type Phase = 'processing' | 'done' | 'error';

/**
 * /subscribe/success — 토스 카드 등록(requestBillingAuth) successUrl.
 * 쿼리의 authKey/customerKey 를 서버로 보내 빌링키 발급 + 첫 달 결제를 수행.
 */
function SuccessContent() {
  const searchParams = useSearchParams();
  const authKey = searchParams.get('authKey');
  const customerKey = searchParams.get('customerKey');

  const [phase, setPhase] = useState<Phase>('processing');
  const [error, setError] = useState<string | null>(null);
  const [cardSummary, setCardSummary] = useState<string | null>(null);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return; // StrictMode 중복 호출 방지
    startedRef.current = true;

    if (!authKey || !customerKey) {
      setPhase('error');
      setError('카드 등록 정보가 없어요. 처음부터 다시 시도해주세요.');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/payments/toss/billing-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authKey, customerKey }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error ?? '결제 처리에 실패했어요.');
        }
        setCardSummary(data.cardSummary ?? null);
        setPeriodEnd(data.subscription?.current_period_end ?? null);
        setPhase('done');
      } catch (e) {
        setError(e instanceof Error ? e.message : '결제 처리에 실패했어요.');
        setPhase('error');
      }
    })();
  }, [authKey, customerKey]);

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-[375px] mx-auto px-6 py-16 text-center">
        {phase === 'processing' && (
          <>
            <div className="w-12 h-12 mx-auto mb-5 rounded-full border-4 border-violet-100 border-t-violet-500 animate-spin" />
            <h1 className="text-xl font-extrabold text-gray-900 mb-2">결제를 진행하고 있어요</h1>
            <p className="text-sm text-gray-500">
              카드 등록과 첫 달 결제를 처리 중이에요.
              <br />
              잠시만 기다려주세요.
            </p>
          </>
        )}

        {phase === 'done' && (
          <>
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-violet-500 flex items-center justify-center shadow-lg shadow-violet-200/60">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75 10 18.25 19.5 6" />
              </svg>
            </div>
            <h1 className="text-xl font-extrabold text-gray-900 mb-2">Kindy 멤버십 시작!</h1>
            <p className="text-sm text-gray-500 mb-6">
              {cardSummary ? `${cardSummary} 카드로 ` : ''}첫 달 결제가 완료됐어요.
              {periodEnd && (
                <>
                  <br />
                  다음 결제일: {new Date(periodEnd).toLocaleDateString('ko-KR')}
                </>
              )}
            </p>
            <Link
              href="/dashboard"
              className="inline-block w-full px-6 py-4 bg-violet-500 hover:bg-violet-600 text-white font-bold text-base rounded-2xl shadow-lg shadow-violet-200/60 active:scale-[0.98] transition"
            >
              대시보드로 가기
            </Link>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-extrabold text-gray-900 mb-2">결제에 실패했어요</h1>
            <p className="text-sm text-gray-500 mb-6">{error}</p>
            <Link
              href="/subscribe"
              className="inline-block w-full px-6 py-4 bg-violet-500 hover:bg-violet-600 text-white font-bold text-base rounded-2xl shadow-lg shadow-violet-200/60 active:scale-[0.98] transition"
            >
              다시 시도하기
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default function SubscribeSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}
