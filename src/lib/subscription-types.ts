// 구독/권한 row 타입 — 클라이언트·서버 공용 (service-role import 없음).

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'expired';

export interface SubscriptionRow {
  id: string;
  parent_id: string;
  status: SubscriptionStatus;
  plan: string;
  price_krw: number;
  billing_key_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntitlementRow {
  parent_id: string;
  is_premium: boolean;
  premium_until: string | null;
  source: string | null;
  updated_at: string;
}
