// 키오스크 → 가정 전환 퍼널: QR 토큰(attribution) 공용 상수.
// /start 랜딩과 /api/attribution/claim 이 공유.

export const ATTRIBUTION_COOKIE = 'kindy_attr';
export const ATTRIBUTION_COOKIE_MAX_AGE_DAYS = 90;
export const MARKETING_SOURCE_COOKIE = 'kindy_source';
export const MARKETING_SOURCE_COOKIE_MAX_AGE_DAYS = 30;

export type MarketingSource = 'ai-diagnosis';

export function normalizeMarketingSource(value: string | null | undefined): MarketingSource | null {
  if (value === 'ai-diagnosis') return value;
  return null;
}
