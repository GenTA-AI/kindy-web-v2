'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ReviewResult() {
  useEffect(() => {
    // Do not retain authentication codes or claim a payment based on query parameters.
    history.replaceState(null, '', location.pathname);
    sessionStorage.removeItem('kindy-review-customer');
  }, []);
  return <main className="mx-auto max-w-xl flex-1 px-6 py-16"><h1 className="text-2xl font-black">결제 경로 테스트 종료</h1><p role="status" className="my-6 leading-7">테스트 카드 등록창에서 돌아왔습니다. 청구 API를 호출하지 않았으며 실제 결제·이용권 발급은 없습니다. 이 화면은 결제 성공 증빙이 아닙니다.</p><Link href="/review/payment" className="font-bold underline">주문 화면으로 돌아가기</Link></main>;
}
