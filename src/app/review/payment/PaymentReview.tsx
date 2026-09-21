'use client';

import { useState } from 'react';
import Link from 'next/link';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
import { SUBSCRIPTION_PRICE_LABEL } from '@/lib/subscription-pricing';

// Public documentation sandbox key, never a merchant live credential.
const DEMO_CLIENT_KEY = 'test_ck_docs_Ovk5rk1EwkEbP0W43n07xlzm';

export default function PaymentReview() {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function openCardWindow() {
    if (!consent || busy) return;
    setBusy(true);
    setError('');
    try {
      const customerKey = `kindy_review_${crypto.randomUUID()}`;
      sessionStorage.setItem('kindy-review-customer', customerKey);
      const toss = await loadTossPayments(DEMO_CLIENT_KEY);
      await toss.payment({ customerKey }).requestBillingAuth({
        method: 'CARD',
        successUrl: `${location.origin}/review/payment/result`,
        failUrl: `${location.origin}/review/payment/result`,
      });
    } catch (error) {
      console.error('Toss review window:', error);
      setError('카드 등록창이 닫혔거나 연결되지 않았어요. 다시 시도할 수 있어요.');
    } finally { setBusy(false); }
  }
  return <main className="flex-1 bg-cream px-5 py-10 text-ink">
    <div className="mx-auto max-w-xl space-y-6">
      <Link href="/" className="font-black text-saged">Kindy · 킨디</Link>
      <div className="rounded-xl border border-line bg-mist p-4 text-sm font-bold">결제 경로 데모 · 실제 청구와 이용권 발급 없음<br /><span className="font-normal">토스 공식 공용 테스트 상점입니다. 젠타 상점 계약·심사 완료를 의미하지 않습니다.</span></div>
      <header><p className="text-sm text-ink3">주문 확인</p><h1 className="mt-2 text-3xl font-black">Kindy 월 구독</h1><p className="mt-3 text-ink2">모리 이야기 영상, 이어지는 질문과 놀이, 보호자 놀이 기록을 웹에서 이용하는 디지털 콘텐츠 구독입니다.</p></header>
      <section className="rounded-2xl border border-line bg-white p-6">
        <p className="text-sm text-ink2">매월 결제 금액 · 부가세 포함</p><p className="mt-2 text-4xl font-black">{SUBSCRIPTION_PRICE_LABEL}원</p>
        <dl className="mt-6 space-y-3 text-sm"><div><dt className="font-bold">이용기간</dt><dd>결제일부터 1개월 · 매월 자동 갱신</dd></div><div><dt className="font-bold">첫 결제 및 다음 결제</dt><dd>정식 서비스에서는 카드 등록 직후 첫 결제, 이후 매월 같은 날짜에 결제됩니다. 해당 날짜가 없는 달은 말일입니다.</dd></div><div><dt className="font-bold">해지와 환불</dt><dd>구독 관리에서 다음 결제를 중단할 수 있습니다. 첫 결제 후 14일 이내에는 이용 여부와 관계없이 전액 환불하며, 이후 미이용 기간은 일할 환불합니다.</dd></div></dl>
        <Link href="/legal/refund" className="mt-4 inline-block text-sm font-bold text-saged underline">취소·환불 정책 자세히 보기</Link>
      </section>
      <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-4 text-sm leading-6"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" /><span>월 {SUBSCRIPTION_PRICE_LABEL}원, 이용기간 1개월, 매월 자동결제 및 취소·환불 안내를 확인했습니다. 이 화면에서는 테스트 카드 등록창만 열립니다.</span></label>
      {error && <p role="alert" className="text-sm text-clay">{error}</p>}
      <button disabled={!consent || busy} onClick={openCardWindow} className="min-h-14 w-full rounded-2xl bg-saged px-6 py-4 font-black text-white disabled:opacity-40">{busy ? '연결 중…' : '토스 테스트 카드 등록창 열기'}</button>
      <p className="text-xs leading-5 text-ink3">실제 카드번호·주민등록번호·전화번호를 입력하지 마세요. 데모는 운영 회원·구독·결제 DB에 기록하지 않습니다. 정식 구매는 <Link href="/subscribe" className="underline">로그인 후 구독 화면</Link>에서 제공됩니다.</p>
    </div>
  </main>;
}
