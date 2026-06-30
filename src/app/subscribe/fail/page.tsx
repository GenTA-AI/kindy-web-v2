'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import MoriCharacter from '@/components/MoriCharacter';
import { businessInfo } from '@/lib/business-info';

function AlertIcon() {
  return (
    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-clay/30 bg-white">
      <svg className="h-7 w-7 text-clay" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
    </div>
  );
}

/** /subscribe/fail — 토스 카드 등록(requestBillingAuth) failUrl. ?code=&message= */
function FailContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const message = searchParams.get('message');
  const isCanceled = code === 'PAY_PROCESS_CANCELED';

  const friendly = isCanceled
    ? '카드 등록을 취소했어요. 준비되면 언제든 다시 시작할 수 있어요.'
    : message ?? '카드 등록 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.';

  return (
    <main className="flex-1 bg-cream text-ink [word-break:keep-all]">
      <div className="mx-auto max-w-[420px] px-5 py-12 text-center">
        <MoriCharacter
          className="mx-auto mb-6 h-24 w-24 overflow-hidden rounded-[28px] border border-line bg-white shadow-sm"
          imageClassName="scale-125"
          label="Kindy Mori"
          withGlow={false}
        />
        <AlertIcon />
        <h1 className="mb-2 text-2xl font-black leading-snug text-ink">
          {isCanceled ? '카드 등록을 멈췄어요' : '카드 등록이 완료되지 않았어요'}
        </h1>
        <p className="mb-5 text-sm font-semibold leading-relaxed text-ink2">{friendly}</p>
        <div className="mb-5 rounded-2xl border border-line bg-white p-4 text-left shadow-sm">
          <p className="text-sm font-black text-ink">다시 시도하기 전에</p>
          <div className="mt-3 grid gap-2 text-xs font-bold leading-relaxed text-ink2">
            <div className="rounded-xl bg-mist px-3 py-2">아이 플레이 기록과 무료 체험은 그대로 남아 있어요.</div>
            <div className="rounded-xl bg-mist px-3 py-2">결제는 보호자 화면에서만 다시 시작할 수 있어요.</div>
            {!isCanceled && (
              <div className="rounded-xl bg-mist px-3 py-2">
                같은 문제가 반복되면 {businessInfo.email}로 문의해주세요.
              </div>
            )}
          </div>
        </div>
        {code && (
          <details className="mb-5 rounded-2xl border border-line bg-white px-4 py-3 text-left text-xs font-semibold text-ink3">
            <summary className="cursor-pointer font-bold text-ink2">오류 정보 보기</summary>
            <p className="mt-2 break-all">코드: {code}</p>
          </details>
        )}
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
