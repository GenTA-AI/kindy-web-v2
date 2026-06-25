'use client';

import { useState } from 'react';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import type { SubscriptionRow, EntitlementRow } from '@/lib/subscription-types';
import { businessInfo } from '@/lib/business-info';

interface SubscribeClientProps {
  parentId: string;
  email: string | null;
  initialSubscription: SubscriptionRow | null;
  initialEntitlement: EntitlementRow;
}

const PRICE_KRW = 25000;
const krw = (n: number) => `₩${n.toLocaleString('ko-KR')}`;

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const BENEFITS = [
  { title: '주 2회 새 에피소드', desc: '아이 취향에 맞춘 새 학습 영상이 매주 2편씩' },
  { title: '초개인화 학습', desc: '아이가 좋아하는 캐릭터·주제·속도로 맞춤 구성' },
  { title: '부모 리포트', desc: '발달·정서 데이터 기반 주간 리포트 제공' },
];

export default function SubscribeClient({
  parentId,
  email,
  initialSubscription,
  initialEntitlement,
}: SubscribeClientProps) {
  const [subscription, setSubscription] = useState(initialSubscription);
  const [entitlement, setEntitlement] = useState(initialEntitlement);
  const [pending, setPending] = useState<'card' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSubscribed =
    !!subscription &&
    (subscription.status === 'active' || subscription.status === 'past_due');
  const isCanceledButPremium =
    !!subscription && subscription.status === 'canceled' && entitlement.is_premium;

  const startCardRegistration = async () => {
    setPending('card');
    setError(null);
    try {
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) {
        throw new Error('NEXT_PUBLIC_TOSS_CLIENT_KEY 가 설정되지 않았어요.');
      }
      const tossPayments = await loadTossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: parentId });
      await payment.requestBillingAuth({
        method: 'CARD',
        successUrl: `${window.location.origin}/subscribe/success`,
        failUrl: `${window.location.origin}/subscribe/fail`,
        customerEmail: email ?? undefined,
      });
      // requestBillingAuth 는 리다이렉트되므로 여기 도달하지 않음.
    } catch (e) {
      const message = e instanceof Error ? e.message : '카드 등록창을 열지 못했어요.';
      // 사용자가 창을 닫은 경우는 조용히 복귀.
      if (!/취소|cancel/i.test(message)) setError(message);
      setPending(null);
    }
  };

  const cancelSubscription = async () => {
    if (!window.confirm('구독을 해지할까요? 현재 결제 기간이 끝나는 날까지는 계속 이용할 수 있어요.')) {
      return;
    }
    setPending('cancel');
    setError(null);
    try {
      const res = await fetch('/api/subscription/cancel', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? '해지에 실패했어요. 잠시 후 다시 시도해주세요.');
      }
      setSubscription(data.subscription ?? null);
      setEntitlement(data.entitlement);
      setNotice(
        `해지가 접수됐어요. ${formatDate(data.subscription?.current_period_end ?? null)}까지 멤버십 혜택이 유지돼요.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '해지에 실패했어요.');
    } finally {
      setPending(null);
    }
  };

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-[375px] mx-auto px-6 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          <p className="text-[11px] font-bold text-violet-500 tracking-wider uppercase mb-1">
            Kindy Membership
          </p>
          <h1 className="text-2xl font-extrabold text-gray-900 leading-snug">
            우리 아이만의 학습,
            <br />
            매주 새로 만나요
          </h1>
        </div>

        {notice && (
          <div className="mb-4 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-medium rounded-2xl px-4 py-3">
            {notice}
          </div>
        )}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-100 text-red-600 text-sm font-medium rounded-2xl px-4 py-3">
            {error}
          </div>
        )}

        {/* 플랜 카드 */}
        <section className="bg-gradient-to-br from-violet-400 to-violet-600 text-white rounded-3xl p-6 shadow-lg shadow-violet-200/60 mb-5">
          <div className="text-[11px] font-bold text-violet-200 tracking-wider uppercase mb-1">
            Kindy 멤버십
          </div>
          <div className="flex items-baseline gap-1.5 mb-4">
            <span className="text-3xl font-black">{krw(PRICE_KRW)}</span>
            <span className="text-sm text-violet-200 font-medium">/ 월</span>
          </div>
          <ul className="space-y-3">
            {BENEFITS.map((b) => (
              <li key={b.title} className="flex items-start gap-2.5">
                <svg
                  className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-100"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75 10 18.25 19.5 6" />
                </svg>
                <div>
                  <div className="text-sm font-bold">{b.title}</div>
                  <div className="text-xs text-violet-100/90 font-medium">{b.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 구독 상태 / CTA */}
        {isSubscribed ? (
          <section className="bg-white rounded-2xl p-5 shadow-sm mb-5">
            <h2 className="text-base font-bold text-gray-900 mb-3">구독 관리</h2>
            <div className="space-y-1.5 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>상태</span>
                <span className="font-bold text-violet-600">
                  {subscription?.status === 'past_due' ? '결제 확인 필요' : '이용 중'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>다음 결제일</span>
                <span className="font-semibold text-gray-900">
                  {formatDate(subscription?.current_period_end ?? null)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>월 요금</span>
                <span className="font-semibold text-gray-900">{krw(subscription?.price_krw ?? PRICE_KRW)}</span>
              </div>
            </div>
            <button
              onClick={cancelSubscription}
              disabled={pending !== null}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 font-medium disabled:opacity-60"
            >
              {pending === 'cancel' ? '해지 처리 중…' : '구독 해지하기'}
            </button>
          </section>
        ) : (
          <section className="mb-5">
            {isCanceledButPremium && (
              <div className="mb-3 bg-violet-50 border border-violet-100 text-violet-700 text-sm font-medium rounded-2xl px-4 py-3">
                해지가 접수된 구독이에요. {formatDate(entitlement.premium_until)}까지 혜택이 유지되고,
                아래에서 다시 시작할 수 있어요.
              </div>
            )}
            <button
              onClick={startCardRegistration}
              disabled={pending !== null}
              className="w-full px-6 py-4 bg-violet-500 hover:bg-violet-600 text-white font-bold text-base rounded-2xl shadow-lg shadow-violet-200/60 active:scale-[0.98] transition disabled:opacity-60"
            >
              {pending === 'card' ? '카드 등록창 여는 중…' : '카드 등록하고 시작하기'}
            </button>
            <button
              disabled
              className="w-full mt-2.5 px-6 py-4 bg-gray-100 text-gray-400 font-bold text-base rounded-2xl cursor-not-allowed"
            >
              카카오페이 <span className="text-xs font-semibold">(준비 중)</span>
            </button>
            <p className="text-[11px] text-gray-400 text-center mt-3">
              토스페이먼츠 보안 결제 · 매월 자동 결제 · 언제든 해지 가능
            </p>
          </section>
        )}

        {/* 약관/사업자 고지 (전자상거래 표시 의무) */}
        <section className="text-[11px] text-gray-400 leading-relaxed space-y-1.5">
          <p>
            구독 시 매월 {krw(PRICE_KRW)}이 등록된 카드로 자동 결제돼요. 해지하면 현재 결제 기간이
            끝나는 날까지 이용할 수 있고, 다음 결제는 일어나지 않아요.
          </p>
          <p>
            판매자: {businessInfo.brand} (대표 {businessInfo.representativeName}) · 사업자등록번호{' '}
            {businessInfo.registrationNumber} · 통신판매업 {businessInfo.mailOrderRegistrationNumber}
          </p>
          <p>
            문의: {businessInfo.email} · {businessInfo.phone}
          </p>
        </section>
      </div>
    </main>
  );
}
