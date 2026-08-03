// 의존성 없는 가격 leaf 모듈 — 서버와 클라이언트에서 함께 사용한다.

/** 실제 월 청구액. */
export const SUBSCRIPTION_PRICE_KRW = 24_900;

/** 얼리버드 할인 전 정가 앵커. */
export const SUBSCRIPTION_LIST_PRICE_KRW = 34_900;

/** 정가를 30일로 나눈 일 환산가. */
export const SUBSCRIPTION_LIST_DAILY_PRICE_KRW = Math.floor(
  SUBSCRIPTION_LIST_PRICE_KRW / 30,
);

export function formatKrw(amountKrw: number): string {
  return `${amountKrw.toLocaleString('ko-KR')}원`;
}

export function formatKrwWithSymbol(amountKrw: number): string {
  return `₩${amountKrw.toLocaleString('ko-KR')}`;
}
