'use client';

import { useState } from 'react';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import MoriCharacter from '@/components/MoriCharacter';
import type { SubscriptionRow, EntitlementRow } from '@/lib/subscription-types';
import { businessInfo, isBusinessInfoComplete } from '@/lib/business-info';

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
  { title: '계속 늘어나는 모리 이야기', desc: '짧은 영상 뒤에 단서 찾기와 만들기 놀이가 이어져요.' },
  { title: '아이 선택에 맞춘 추천', desc: '고른 단서와 놀이 기록을 바탕으로 다음 이야기를 골라요.' },
  { title: '보호자 기록과 대화 힌트', desc: '오늘 해낸 놀이와 집에서 나눌 질문을 보여줘요.' },
];

const PAYMENT_NOTES = [
  '카드를 등록하면 첫 달 25,000원이 바로 결제돼요.',
  '다음 달부터 같은 날 자동 결제돼요.',
  '해지는 이 화면에서 바로 접수되고, 현재 기간 끝까지 이용할 수 있어요.',
  '아이 플레이 화면에는 광고와 결제 버튼이 없어요.',
];

const UNLOCKS = [
  ['계속 보기', '무료 3편 다음 모리 이야기 열기'],
  ['기록으로', '잘 맞았던 놀이와 대화 힌트 확인'],
  ['다음에는', '아이 선택에 맞춰 새 이야기 추천'],
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
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // 정기결제 사전 명시 동의(전자상거래법·여신전문금융업법). 카드 등록 전 필수.
  const [billingConsent, setBillingConsent] = useState(false);

  const hasTossClientKey = Boolean(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY);
  const isSubscribed =
    !!subscription &&
    (subscription.status === 'active' || subscription.status === 'past_due');
  const isCanceledButPremium =
    !!subscription && subscription.status === 'canceled' && entitlement.is_premium;
  const businessComplete = isBusinessInfoComplete();
  const checkoutReady = hasTossClientKey && businessComplete;
  const currentPeriodEndLabel = formatDate(
    subscription?.current_period_end ?? entitlement.premium_until ?? null,
  );
  const currentPeriodEndPhrase =
    currentPeriodEndLabel === '-' ? '현재 결제 기간 끝까지' : `${currentPeriodEndLabel}까지`;

  const startCardRegistration = async () => {
    setPending('card');
    setError(null);
    try {
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) {
        throw new Error('지금은 결제창을 열 수 없어요. 잠시 후 다시 시도해주세요.');
      }
      if (!businessComplete) {
        throw new Error('결제 준비가 끝나면 바로 시작할 수 있어요.');
      }
      // 이미 구독 중(past_due 카드 재등록 포함)이면 동의 증적이 이미 있으므로 체크박스를 다시 요구하지 않는다.
      if (!billingConsent && !isSubscribed) {
        throw new Error('매월 자동 결제 동의에 체크해 주세요.');
      }
      // 정기결제 동의를 서버에 기록(법적 증적). 서버(billing-key)가 증적 존재를 강제하므로
      // 기록에 실패하면 여기서 멈춘다 (P1-15).
      if (!isSubscribed) {
        const consentRes = await fetch('/api/subscription/consent', { method: 'POST' });
        if (!consentRes.ok) {
          throw new Error('동의 저장이 잠시 어려워요. 잠시 후 다시 시도해 주세요.');
        }
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

  const requestCancel = () => {
    setError(null);
    setNotice(null);
    setCancelConfirmOpen(true);
  };

  const cancelSubscription = async () => {
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
      setCancelConfirmOpen(false);
      const periodEndLabel = formatDate(data.subscription?.current_period_end ?? data.entitlement?.premium_until ?? null);
      const periodEndPhrase = periodEndLabel === '-' ? '현재 결제 기간 끝까지' : `${periodEndLabel}까지`;
      setNotice(
        `해지가 접수됐어요. ${periodEndPhrase} 멤버십 혜택이 유지돼요.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '해지에 실패했어요.');
    } finally {
      setPending(null);
    }
  };

  return (
    <main className="flex-1 bg-cream text-ink">
      <div className="mx-auto max-w-[420px] px-5 py-8">
        {/* 헤더 */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-black uppercase tracking-[.16em] text-sage">
              Kindy Membership
            </p>
            <h1 className="text-2xl font-black leading-snug text-ink">
              모리 이야기를
              <br />
              계속 이어가요
            </h1>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">
              아이는 한 편씩 놀고, 보호자는 기록으로 다음 대화를 이어가요.
            </p>
          </div>
          <MoriCharacter
            className="h-20 w-20 shrink-0 overflow-hidden rounded-[26px] border border-line bg-white shadow-sm"
            imageClassName="scale-125"
            label="Kindy Mori"
            withGlow={false}
          />
        </div>

        {notice && (
          <div className="mb-4 rounded-2xl border border-sages bg-sagebg px-4 py-3 text-sm font-bold text-saged">
            {notice}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-2xl border border-clay/30 bg-white px-4 py-3 text-sm font-bold text-clay">
            {error}
          </div>
        )}
        {!checkoutReady && !isSubscribed && (
          <div className="mb-4 rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-bold leading-relaxed text-saged">
            지금은 결제를 준비하는 중이에요. 모리 체험 3편과 보호자 기록은 먼저 둘러볼 수 있어요.
          </div>
        )}

        {/* 플랜 카드 */}
        <section className="mb-5 rounded-3xl bg-saged p-6 text-white shadow-lg shadow-sagebg">
          <div className="mb-1 text-[11px] font-black uppercase tracking-[.16em] text-white/70">
            Kindy 멤버십
          </div>
          <div className="mb-4 flex items-baseline gap-1.5">
            <span className="text-3xl font-black">{krw(PRICE_KRW)}</span>
            <span className="text-sm font-bold text-white/70">/ 월</span>
          </div>
          <ul className="space-y-3">
            {BENEFITS.map((b) => (
              <li key={b.title} className="flex items-start gap-2.5">
                <svg
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-white/80"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75 10 18.25 19.5 6" />
                </svg>
                <div>
                  <div className="text-sm font-bold">{b.title}</div>
                  <div className="text-xs font-semibold text-white/78">{b.desc}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-white/15 pt-4">
            <p className="text-xs font-black text-white/78">멤버십을 시작하면</p>
            <div className="mt-3 grid gap-2">
              {UNLOCKS.map(([label, body]) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <span className="w-14 shrink-0 rounded-full bg-white/13 px-2 py-1 text-center text-[11px] font-black text-white">
                    {label}
                  </span>
                  <span className="font-bold text-white/88">{body}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-2xl border border-line bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black text-ink">결제 전에 확인해요</h2>
          <div className="mt-3 grid gap-2">
            {PAYMENT_NOTES.map((note) => (
              <div key={note} className="rounded-xl bg-mist px-3 py-2 text-xs font-bold leading-relaxed text-ink2">
                {note}
              </div>
            ))}
          </div>
        </section>

        {/* 구독 상태 / CTA */}
        {isSubscribed ? (
          <section className="mb-5 rounded-2xl border border-line bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-black text-ink">멤버십 관리</h2>
            <div className="space-y-1.5 text-sm font-semibold text-ink2">
              <div className="flex justify-between">
                <span>상태</span>
                <span className="font-black text-saged">
                  {subscription?.status === 'past_due' ? '결제 확인 필요' : '이용 중'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>다음 결제일</span>
                <span className="font-bold text-ink">
                  {formatDate(subscription?.current_period_end ?? null)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>월 요금</span>
                <span className="font-bold text-ink">{krw(subscription?.price_krw ?? PRICE_KRW)}</span>
              </div>
            </div>
            {subscription?.status === 'past_due' && (
              <>
                <div className="mt-4 rounded-xl bg-cream px-3 py-2 text-xs font-bold leading-relaxed text-clay">
                  결제가 확인되지 않았어요. 아이 기록은 사라지지 않으니, 카드를 다시 등록하면 바로 이어져요.
                </div>
                <button
                  onClick={startCardRegistration}
                  disabled={pending !== null || !hasTossClientKey}
                  className="mt-3 w-full rounded-2xl bg-saged px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98] disabled:opacity-60"
                >
                  {pending === 'card' ? '카드 등록창 여는 중…' : '카드 다시 등록하기'}
                </button>
                <p className="mt-2 text-center text-[11px] font-semibold text-ink3">
                  새 카드로 바꾸면 다음 결제부터 새 카드로 자동 결제돼요.
                </p>
              </>
            )}
            {!cancelConfirmOpen ? (
              <button
                onClick={requestCancel}
                disabled={pending !== null}
                className="mt-4 text-sm font-bold text-ink3 underline underline-offset-2 hover:text-ink disabled:opacity-60"
              >
                구독 해지하기
              </button>
            ) : (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-sm font-black text-ink">다음 결제를 멈출까요?</p>
                <p className="mt-2 text-xs font-semibold leading-relaxed text-ink2">
                  해지하면 다음 결제는 일어나지 않고, {currentPeriodEndPhrase} 모리 이야기와
                  보호자 기록을 그대로 이용할 수 있어요. 아이 프로필과 놀이 기록, 결제 내역은 삭제되지 않아요.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCancelConfirmOpen(false)}
                    disabled={pending === 'cancel'}
                    className="min-h-11 rounded-xl bg-mist px-3 text-xs font-black text-ink2 transition hover:bg-sagebg disabled:opacity-50"
                  >
                    계속 이용
                  </button>
                  <button
                    type="button"
                    onClick={() => void cancelSubscription()}
                    disabled={pending === 'cancel'}
                    className="min-h-11 rounded-xl bg-clay px-3 text-xs font-black text-white transition hover:bg-ink disabled:opacity-60"
                  >
                    {pending === 'cancel' ? '처리 중...' : '다음 결제 막기'}
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="mb-5">
            {isCanceledButPremium && (
              <div className="mb-3 rounded-2xl border border-line bg-mist px-4 py-3 text-sm font-bold text-saged">
                해지가 접수된 구독이에요. {formatDate(entitlement.premium_until)}까지 혜택이 유지되고,
                아래에서 다시 시작할 수 있어요.
              </div>
            )}
            {checkoutReady && (
              <label className="mb-3 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-line bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={billingConsent}
                  onChange={(e) => setBillingConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-saged"
                />
                <span className="text-xs font-semibold leading-relaxed text-ink2">
                  매월 {krw(PRICE_KRW)}이 등록한 카드로 <strong className="font-black text-ink">자동 결제</strong>되는
                  정기결제에 동의합니다.{' '}
                  {isCanceledButPremium
                    ? `남은 이용 기간에는 결제되지 않고, ${formatDate(entitlement.premium_until)}부터 자동 결제가 이어져요.`
                    : '첫 달은 카드 등록 즉시 결제되고, 이후 매월 같은 날 자동 결제돼요.'}{' '}
                  언제든 해지할 수 있고, 환불·청약철회는 아래 안내를 따릅니다.
                </span>
              </label>
            )}
            <button
              onClick={startCardRegistration}
              disabled={pending !== null || !checkoutReady || !billingConsent}
              className="w-full rounded-2xl bg-saged px-6 py-4 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98] disabled:opacity-60"
            >
              {pending === 'card'
                ? '카드 등록창 여는 중…'
                : checkoutReady
                  ? isCanceledButPremium
                    ? '구독 다시 시작하기'
                    : '카드 등록하고 월 구독 시작'
                  : '결제 준비 중'}
            </button>
            <p className="mt-3 text-center text-[11px] font-semibold text-ink3">
              토스페이먼츠 보안 결제 · 매월 자동 결제 · 언제든 해지 가능
            </p>
          </section>
        )}

        {/* 약관/사업자 고지 (전자상거래 표시 의무) */}
        <section className="space-y-1.5 text-[11px] font-semibold leading-relaxed text-ink3">
          <p>
            구독 시 매월 {krw(PRICE_KRW)}이 등록된 카드로 자동 결제돼요. 해지하면 현재 결제 기간이
            끝나는 날까지 이용할 수 있고, 다음 결제는 일어나지 않아요.
          </p>
          <p>
            <strong className="font-black text-ink2">청약철회·환불 안내</strong> · 결제일로부터 7일 이내,
            콘텐츠를 이용하지 않았다면 청약철회(전액 환불)를 요청할 수 있어요. 이미 이용을 시작한
            디지털 콘텐츠는 「전자상거래법」 제17조에 따라 청약철회가 제한될 수 있어요. 환불은 고객센터
            ({businessInfo.email})로 요청하면 영업일 기준 3일 이내 처리돼요. 정기결제는 다음 결제일
            전에 해지하면 추가 청구가 없어요.
          </p>
          {businessComplete ? (
            <p>
              판매자: {businessInfo.brand} (대표 {businessInfo.representativeName}) · 사업자등록번호{' '}
              {businessInfo.registrationNumber} · 통신판매업 {businessInfo.mailOrderRegistrationNumber}
            </p>
          ) : (
            <p>판매자 정보는 결제 전 확인 화면에서 안내돼요.</p>
          )}
          <p>
            문의: {businessInfo.email}
            {businessInfo.phone ? ` · ${businessInfo.phone}` : ''}
          </p>
        </section>
      </div>
    </main>
  );
}
