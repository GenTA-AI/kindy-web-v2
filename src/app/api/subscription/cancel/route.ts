import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
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
    return NextResponse.json({ error: findError.message }, { status: 500 });
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
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await syncEntitlement(parentId);

  const state = await getSubscriptionState(parentId);
  return NextResponse.json({ ok: true, ...state });
}
