import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { supabase } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import {
  issueBillingKey,
  chargeBillingKey,
  cardSummaryOf,
  TossApiError,
} from '@/lib/toss';
import {
  SUBSCRIPTION_ORDER_NAME,
  SUBSCRIPTION_ORDER_PREFIX,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_PRICE_KRW,
  getSubscriptionState,
  nextMonthlyPeriod,
  syncEntitlement,
} from '@/lib/subscription';

/**
 * POST /api/payments/toss/billing-key
 *
 * 토스 v2 빌링 카드 등록 successUrl 콜백(/subscribe/success)에서 호출.
 * 1) authKey → 빌링키 발급 (토스 API)
 * 2) billing_keys 저장
 * 3) 첫 달 즉시 청구 (25,000원) + purchases 기록
 * 4) subscriptions active (now → +1개월) + sync_entitlement
 *
 * body: { authKey: string, customerKey: string }
 * customerKey 는 requestBillingAuth 때 parent_id 로 설정했으므로 로그인 사용자와 일치해야 함.
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

  const body = (await request.json().catch(() => null)) as
    | { authKey?: string; customerKey?: string }
    | null;
  const authKey = body?.authKey?.trim();
  const customerKey = body?.customerKey?.trim();

  if (!authKey || !customerKey) {
    return NextResponse.json({ error: 'authKey와 customerKey가 필요해요.' }, { status: 400 });
  }
  if (customerKey !== parentId) {
    // 다른 사용자의 카드 등록 결과를 가로채지 못하도록 차단.
    return NextResponse.json({ error: 'customerKey가 로그인 사용자와 일치하지 않아요.' }, { status: 403 });
  }

  // 1) authKey → 빌링키 발급
  let issued;
  try {
    issued = await issueBillingKey({ authKey, customerKey });
  } catch (error) {
    if (error instanceof TossApiError) {
      return NextResponse.json(
        { error: `카드 등록에 실패했어요: ${error.message}`, code: error.code },
        { status: 502 },
      );
    }
    throw error;
  }

  // 2) billing_keys 저장 (service-role, RLS 우회)
  const { data: billingKeyRow, error: bkError } = await supabase
    .from('billing_keys')
    .insert({
      parent_id: parentId,
      provider: 'toss',
      billing_key: issued.billingKey,
      card_summary: cardSummaryOf(issued),
    })
    .select('id, card_summary')
    .single();

  if (bkError || !billingKeyRow) {
    return NextResponse.json(
      { error: `빌링키 저장에 실패했어요: ${bkError?.message ?? 'unknown'}` },
      { status: 500 },
    );
  }

  // 3) 첫 달 즉시 청구 — purchases pending 선기록 후 승인 (idempotency: order_id unique)
  const orderId = `${SUBSCRIPTION_ORDER_PREFIX}${randomUUID()}`;

  const { error: insertError } = await supabase.from('purchases').insert({
    parent_id: parentId,
    bundle_type: 'subscription',
    credits_added: 0,
    amount_krw: SUBSCRIPTION_PRICE_KRW,
    payment_provider: 'toss',
    order_id: orderId,
    status: 'pending',
  });

  if (insertError) {
    return NextResponse.json(
      { error: `결제 기록 생성에 실패했어요: ${insertError.message}` },
      { status: 500 },
    );
  }

  let payment;
  try {
    payment = await chargeBillingKey({
      billingKey: issued.billingKey,
      customerKey,
      amount: SUBSCRIPTION_PRICE_KRW,
      orderId,
      orderName: SUBSCRIPTION_ORDER_NAME,
    });
  } catch (error) {
    const reason = error instanceof TossApiError ? error.message : '결제 승인 중 오류';
    await supabase
      .from('purchases')
      .update({ status: 'failed', failed_reason: reason })
      .eq('order_id', orderId);

    if (error instanceof TossApiError) {
      return NextResponse.json(
        { error: `첫 결제에 실패했어요: ${error.message}`, code: error.code },
        { status: 402 },
      );
    }
    throw error;
  }

  if (payment.status !== 'DONE') {
    await supabase
      .from('purchases')
      .update({ status: 'failed', failed_reason: `unexpected status ${payment.status}`, raw_response: payment })
      .eq('order_id', orderId);
    return NextResponse.json(
      { error: `결제가 완료되지 않았어요 (status: ${payment.status}).` },
      { status: 402 },
    );
  }

  await supabase
    .from('purchases')
    .update({
      status: 'paid',
      payment_key: payment.paymentKey,
      paid_at: payment.approvedAt ?? new Date().toISOString(),
      raw_response: payment,
    })
    .eq('order_id', orderId);

  // 4) 구독 활성화 (기존 row 있으면 재활성화, 없으면 생성)
  const { start, end } = nextMonthlyPeriod();
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('parent_id', parentId)
    .eq('plan', SUBSCRIPTION_PLAN)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const subscriptionValues = {
    status: 'active',
    plan: SUBSCRIPTION_PLAN,
    price_krw: SUBSCRIPTION_PRICE_KRW,
    billing_key_id: billingKeyRow.id,
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
    canceled_at: null,
    updated_at: new Date().toISOString(),
  };

  const subError = existing
    ? (await supabase.from('subscriptions').update(subscriptionValues).eq('id', existing.id)).error
    : (await supabase.from('subscriptions').insert({ parent_id: parentId, ...subscriptionValues })).error;

  if (subError) {
    return NextResponse.json(
      { error: `구독 활성화에 실패했어요: ${subError.message}` },
      { status: 500 },
    );
  }

  await syncEntitlement(parentId);

  const state = await getSubscriptionState(parentId);
  return NextResponse.json({
    ok: true,
    orderId,
    cardSummary: billingKeyRow.card_summary,
    ...state,
  });
}
