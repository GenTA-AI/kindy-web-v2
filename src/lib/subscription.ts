// Kindy 멤버십 구독 도메인 헬퍼.
// server-only — service-role supabase 를 사용하므로 API route / 서버 컴포넌트 전용.

import { supabase } from '@/lib/supabase';
import type { SubscriptionRow, EntitlementRow } from '@/lib/subscription-types';

export type { SubscriptionRow, EntitlementRow, SubscriptionStatus } from '@/lib/subscription-types';

export const SUBSCRIPTION_PLAN = 'kindy_monthly';
export const SUBSCRIPTION_PRICE_KRW = 25000;
export const SUBSCRIPTION_ORDER_NAME = 'Kindy 멤버십 월 구독';
/** 구독 orderId 접두사 — webhook 에서 구독 결제 식별에 사용. */
export const SUBSCRIPTION_ORDER_PREFIX = 'sub_';
export const FREE_TRIAL_SESSION_LIMIT = 3;

const SUBSCRIPTION_COLUMNS =
  'id, parent_id, status, plan, price_krw, billing_key_id, current_period_start, current_period_end, canceled_at, created_at, updated_at';

/** entitlements 재계산 (DB security definer 함수 호출). 구독 상태 변경 후 반드시 호출. */
export async function syncEntitlement(parentId: string): Promise<void> {
  const { error } = await supabase.rpc('sync_entitlement', { p_parent_id: parentId });
  if (error) throw new Error(`sync_entitlement failed: ${error.message}`);
}

/** parent 의 최신 구독 row (없으면 null). */
export async function getLatestSubscription(parentId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(SUBSCRIPTION_COLUMNS)
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`subscriptions query failed: ${error.message}`);
  return (data as SubscriptionRow | null) ?? null;
}

/** parent 의 entitlement (없으면 is_premium=false 기본값). */
export async function getEntitlement(parentId: string): Promise<EntitlementRow> {
  const { data, error } = await supabase
    .from('entitlements')
    .select('parent_id, is_premium, premium_until, source, updated_at')
    .eq('parent_id', parentId)
    .maybeSingle();

  if (error) throw new Error(`entitlements query failed: ${error.message}`);

  return (
    (data as EntitlementRow | null) ?? {
      parent_id: parentId,
      is_premium: false,
      premium_until: null,
      source: null,
      updated_at: new Date().toISOString(),
    }
  );
}

export async function getSubscriptionState(parentId: string): Promise<{
  subscription: SubscriptionRow | null;
  entitlement: EntitlementRow;
}> {
  const [subscription, entitlement] = await Promise.all([
    getLatestSubscription(parentId),
    getEntitlement(parentId),
  ]);
  return { subscription, entitlement };
}

export function hasPremiumEntitlement(entitlement: EntitlementRow): boolean {
  if (!entitlement.is_premium) return false;
  if (!entitlement.premium_until) return true;

  const premiumUntil = new Date(entitlement.premium_until).getTime();
  return Number.isFinite(premiumUntil) && premiumUntil > Date.now();
}

export async function getCompletedTrialSessionCount(parentId: string): Promise<number> {
  const { data: children, error: childrenError } = await supabase
    .from('children')
    .select('id')
    .eq('parent_id', parentId);

  if (childrenError) throw new Error(`children query failed: ${childrenError.message}`);

  const childIds = (children ?? [])
    .map((child) => (typeof child.id === 'string' ? child.id : null))
    .filter((childId): childId is string => Boolean(childId));

  if (childIds.length === 0) return 0;

  const { count, error } = await supabase
    .from('game_sessions')
    .select('id', { count: 'exact', head: true })
    .in('child_id', childIds)
    .eq('context', 'home')
    .not('completed_at', 'is', null);

  if (error) throw new Error(`game_sessions trial count failed: ${error.message}`);
  return count ?? 0;
}

export async function getMembershipGateState(parentId: string): Promise<{
  subscription: SubscriptionRow | null;
  entitlement: EntitlementRow;
  isPremium: boolean;
  completedTrialSessions: number;
  remainingTrialSessions: number;
  canUseMemberContent: boolean;
}> {
  const [{ subscription, entitlement }, completedTrialSessions] = await Promise.all([
    getSubscriptionState(parentId),
    getCompletedTrialSessionCount(parentId),
  ]);
  const isPremium = hasPremiumEntitlement(entitlement);
  const remainingTrialSessions = Math.max(0, FREE_TRIAL_SESSION_LIMIT - completedTrialSessions);

  return {
    subscription,
    entitlement,
    isPremium,
    completedTrialSessions,
    remainingTrialSessions,
    canUseMemberContent: isPremium || remainingTrialSessions > 0,
  };
}

/** now → +1개월 결제 주기. (월말 overflow 는 Date.setMonth 규칙을 따름) */
export function nextMonthlyPeriod(from: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(from);
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}
