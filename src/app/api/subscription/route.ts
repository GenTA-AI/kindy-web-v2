import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { getSubscriptionState } from '@/lib/subscription';

/**
 * GET /api/subscription — 로그인한 parent 의 구독 + entitlement.
 *
 * 인증: 세션 쿠키(웹) 또는 `Authorization: Bearer <supabase access token>` (iPad 앱).
 *
 * 응답:
 * {
 *   "subscription": { id, status, plan, price_krw, current_period_start,
 *                     current_period_end, canceled_at, ... } | null,
 *   "entitlement": { parent_id, is_premium, premium_until, source, updated_at }
 * }
 */
export async function GET(request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId(request);
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }

  try {
    const state = await getSubscriptionState(parentId);
    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
