'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import MoriCharacter from '@/components/MoriCharacter';
import { businessInfo } from '@/lib/business-info';

type Phase = 'processing' | 'done' | 'error';

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function CheckIcon() {
  return (
    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-saged shadow-lg shadow-sagebg">
      <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75 10 18.25 19.5 6" />
      </svg>
    </div>
  );
}

function ErrorIcon() {
  return (
    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-clay/30 bg-white">
      <svg className="h-7 w-7 text-clay" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </div>
  );
}

/**
 * /subscribe/success — 포트원 카드 등록 완료 화면. 두 진입 경로:
 * 1) 모바일 리다이렉트: 포트원이 ?billingKey=... 를 붙여 돌아옴 → 서버 등록+첫 결제 수행
 * 2) 데스크톱 인라인: SubscribeClient 가 서버 처리를 마친 뒤 ?registered=1&charged=… 로 이동
 */
function SuccessContent() {
  const searchParams = useSearchParams();
  const billingKey = searchParams.get('billingKey');
  const registered = searchParams.get('registered');
  const chargedParam = searchParams.get('charged');
  const redirectError = searchParams.get('message');

  const [phase, setPhase] = useState<Phase>('processing');
  const [error, setError] = useState<string | null>(null);
  const [cardSummary, setCardSummary] = useState<string | null>(null);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  // 유료 기간이 남아 있으면 서버가 청구 없이 카드 교체/재시작만 한다(charged=false).
  const [charged, setCharged] = useState(true);
  const startedRef = useRef(false);
  const periodEndLabel = formatDate(periodEnd);

  useEffect(() => {
    if (startedRef.current) return; // StrictMode 중복 호출 방지
    startedRef.current = true;

    // 경로 2: 인라인 처리 완료 후 도착 — 상태만 조회해 표시.
    if (registered === '1') {
      setCharged(chargedParam !== '0');
      (async () => {
        try {
          const res = await fetch('/api/subscription');
          const data = await res.json().catch(() => null);
          setCardSummary(data?.cardSummary ?? null);
          setPeriodEnd(data?.subscription?.current_period_end ?? data?.entitlement?.premium_until ?? null);
        } finally {
          setPhase('done');
        }
      })();
      return;
    }

    // 경로 1: 포트원 리다이렉트 — billingKey 로 서버 등록+첫 결제.
    if (!billingKey) {
      setPhase('error');
      setError(redirectError ?? '카드 등록 정보가 없어요. 처음부터 다시 시도해주세요.');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/payments/portone/billing-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ billingKey }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error ?? '결제 처리에 실패했어요.');
        }
        setCardSummary(data.cardSummary ?? null);
        setPeriodEnd(data.subscription?.current_period_end ?? null);
        setCharged(data.charged !== false);
        setPhase('done');
      } catch (e) {
        setError(e instanceof Error ? e.message : '결제 처리에 실패했어요.');
        setPhase('error');
      }
    })();
  }, [billingKey, registered, chargedParam, redirectError]);

  return (
    <main className="flex-1 bg-cream text-ink [word-break:keep-all]">
      <div className="mx-auto max-w-[420px] px-5 py-12 text-center">
        <MoriCharacter
          className="mx-auto mb-6 h-24 w-24 overflow-hidden rounded-[28px] border border-line bg-white shadow-sm"
          imageClassName="scale-125"
          label="Kindy Mori"
          withGlow={false}
        />

        {phase === 'processing' && (
          <section aria-live="polite" role="status">
            <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-sagebg border-t-sage" />
            <h1 className="mb-2 text-2xl font-black leading-snug text-ink">멤버십을 준비하고 있어요</h1>
            <p className="text-sm font-semibold leading-relaxed text-ink2">
              카드 등록과 첫 달 결제를 안전하게 확인 중이에요.
              <br />
              이 화면을 닫지 말고 잠시만 기다려주세요.
            </p>
          </section>
        )}

        {phase === 'done' && (
          <section aria-live="polite">
            <CheckIcon />
            <h1 className="mb-2 text-2xl font-black leading-snug text-ink">
              {charged ? '모리 멤버십이 시작됐어요' : '카드가 새로 등록됐어요'}
            </h1>
            <p className="mb-5 text-sm font-semibold leading-relaxed text-ink2">
              {charged
                ? cardSummary
                  ? `${cardSummary} 카드로 첫 달 결제가 완료됐어요.`
                  : '첫 달 결제가 완료됐어요.'
                : '남은 이용 기간에는 결제되지 않고, 다음 결제일부터 새 카드로 자동 결제돼요.'}
              {periodEndLabel ? (
                <>
                  <br />
                  다음 결제 예정일은 {periodEndLabel}이에요.
                </>
              ) : null}
            </p>
            <div className="mb-6 rounded-2xl border border-line bg-white p-4 text-left shadow-sm">
              <p className="text-sm font-black text-ink">바로 이어서 할 수 있어요</p>
              <div className="mt-3 grid gap-2 text-xs font-bold leading-relaxed text-ink2">
                <div className="rounded-xl bg-mist px-3 py-2">아이 이름표를 확인하고 오늘의 이야기를 열어요.</div>
                <div className="rounded-xl bg-mist px-3 py-2">보호자 기록장에서 완료한 놀이와 대화 힌트를 볼 수 있어요.</div>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-saged px-6 py-4 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
            >
              보호자 기록장으로 가기
            </Link>
            <Link
              href="/library"
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-line bg-white px-6 py-3.5 text-sm font-black text-saged transition hover:bg-mist active:scale-[0.98]"
            >
              이야기 숲 둘러보기
            </Link>
          </section>
        )}

        {phase === 'error' && (
          <section aria-live="polite">
            <ErrorIcon />
            <h1 className="mb-2 text-2xl font-black leading-snug text-ink">마지막 확인이 필요해요</h1>
            <p className="mb-5 text-sm font-semibold leading-relaxed text-ink2">
              {error}
              <br />
              카드가 청구되지 않았거나 처리되지 않은 상태일 수 있어요.
            </p>
            <div className="mb-6 rounded-2xl border border-line bg-white p-4 text-left text-xs font-bold leading-relaxed text-ink2 shadow-sm">
              같은 문제가 반복되면 {businessInfo.email}로 알려주세요. 확인 후 멤버십 상태를 도와드릴게요.
            </div>
            <Link
              href="/subscribe"
              className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-saged px-6 py-4 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
            >
              다시 시도하기
            </Link>
            <Link
              href="/dashboard/settings"
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-line bg-white px-6 py-3.5 text-sm font-black text-saged transition hover:bg-mist active:scale-[0.98]"
            >
              설정으로 돌아가기
            </Link>
          </section>
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
