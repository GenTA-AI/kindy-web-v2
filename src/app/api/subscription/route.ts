import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { getSubscriptionState } from '@/lib/subscription';
import { isSupabaseServiceConfigured } from '@/lib/supabase';

/**
 * GET /api/subscription — 로그인한 parent 의 구독 + entitlement.
 *
 * 인증: 세션 쿠키(웹) 또는 `Authorization: Bearer <supabase access token>`.
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
      return NextResponse.json({ error: '보호자 로그인이 필요해요.' }, { status: 401 });
    }
    console.error('[subscription:auth]', error);
    return NextResponse.json({ error: '구독 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }

  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json({
      subscription: null,
      entitlement: {
        parent_id: parentId,
        is_premium: false,
        premium_until: null,
        source: 'local_preview',
        updated_at: new Date().toISOString(),
      },
    });
  }

  try {
    const state = await getSubscriptionState(parentId);
    return NextResponse.json(state);
  } catch (error) {
    console.error('[subscription:get]', error);
    return NextResponse.json({ error: '구독 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
