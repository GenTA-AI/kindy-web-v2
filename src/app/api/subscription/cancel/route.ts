import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseServiceConfigured, supabase } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { getSubscriptionState, syncEntitlement } from '@/lib/subscription';

/**
 * POST /api/subscription/cancel — 기간말 해지.
 *
 * status → 'canceled', canceled_at = now. current_period_end 는 그대로 유지 —
 * sync_entitlement 가 canceled 도 기간 끝까지 premium 으로 계산하므로
 * premium_until = current_period_end 가 보존된다 (즉시 차단 아님).
 */
export async function POST(request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId(request);
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: '보호자 로그인이 필요해요.' }, { status: 401 });
    }
    console.error('[subscription-cancel:auth]', error);
    return NextResponse.json({ error: '구독 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }

  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json(
      { error: '지금은 구독 해지 기능을 확인하는 중이에요. 잠시 후 다시 시도해 주세요.' },
      { status: 503 },
    );
  }

  const { data: subscription, error: findError } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('parent_id', parentId)
    .in('status', ['active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) {
    console.error('[subscription-cancel:find]', findError);
    return NextResponse.json({ error: '구독 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
  if (!subscription) {
    return NextResponse.json({ error: '해지할 활성 구독이 없어요.' }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id);

  if (updateError) {
    console.error('[subscription-cancel:update]', updateError);
    return NextResponse.json({ error: '구독 해지를 접수하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }

  try {
    await syncEntitlement(parentId);
  } catch (error) {
    console.error('[subscription-cancel:sync-entitlement]', error);
    return NextResponse.json({ error: '해지 상태를 정리하지 못했어요. 잠시 후 새로고침해 주세요.' }, { status: 500 });
  }

  try {
    const state = await getSubscriptionState(parentId);
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    console.error('[subscription-cancel:get-state]', error);
    return NextResponse.json({ error: '해지 결과를 불러오지 못했어요. 잠시 후 새로고침해 주세요.' }, { status: 500 });
  }
}
