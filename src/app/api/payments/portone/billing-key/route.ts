import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { supabase } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { encryptBillingKey } from '@/lib/billing-crypto';
import {
  getBillingKeyInfo,
  chargeBillingKey,
  cardSummaryOf,
  mapPortOneStatusToPurchaseStatus,
  PortOneApiError,
} from '@/lib/portone';
import {
  SUBSCRIPTION_ORDER_NAME,
  SUBSCRIPTION_ORDER_PREFIX,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_PRICE_KRW,
  getSubscriptionState,
  hasPremiumEntitlement,
  nextMonthlyPeriod,
  syncEntitlement,
} from '@/lib/subscription';
import { reportEmailFailure, sendFirstPaymentSuccessEmail } from '@/lib/mailer';

/**
 * POST /api/payments/portone/billing-key
 *
 * 포트원 V2 빌링 — 브라우저 SDK(requestIssueBillingKey)가 발급한 빌링키를 받아:
 * 1) 포트원 빌링키 조회로 검증 (실재 + customer.id 일치)
 * 2) billing_keys 저장 (provider='portone', AES-256-GCM 암호화)
 * 3) 첫 달 즉시 청구 + purchases 기록 (토스 라우트와 동일한 결정적 orderId 멱등 설계)
 * 4) subscriptions active + sync_entitlement
 *
 * body: { billingKey: string }
 * 토스 경로(/api/payments/toss/billing-key)는 계약 전환기 동안 보존 — 신규 결제는 이 라우트만 사용.
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

  const body = (await request.json().catch(() => null)) as { billingKey?: string } | null;
  const billingKey = body?.billingKey?.trim();

  if (!billingKey) {
    return NextResponse.json({ error: 'billingKey가 필요해요.' }, { status: 400 });
  }

  // P1-15: 정기결제 동의 증적을 청구 전에 서버가 강제한다.
  const { data: consentRow, error: consentError } = await supabase
    .from('parent_consents')
    .select('id')
    .eq('parent_id', parentId)
    .eq('consent_scope', 'recurring_billing')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (consentError) {
    return NextResponse.json(
      { error: `동의 기록 확인에 실패했어요: ${consentError.message}` },
      { status: 500 },
    );
  }
  if (!consentRow) {
    return NextResponse.json(
      {
        error: '매월 자동 결제 동의가 확인되지 않았어요. 구독 화면에서 동의에 체크한 뒤 다시 시도해 주세요.',
        code: 'consent_missing',
      },
      { status: 400 },
    );
  }

  const { subscription: existingSub, entitlement: currentEntitlement } =
    await getSubscriptionState(parentId);
  const premiumNow = hasPremiumEntitlement(currentEntitlement);

  // 1) 빌링키 검증 — 클라이언트가 보낸 키를 신뢰하지 않고 포트원에 재조회.
  //    requestIssueBillingKey 의 customer.customerId 를 parentId 로 발급했으므로 일치해야 한다.
  let issued;
  try {
    issued = await getBillingKeyInfo(billingKey);
  } catch (error) {
    if (error instanceof PortOneApiError) {
      return NextResponse.json(
        { error: `카드 등록 확인에 실패했어요: ${error.message}`, code: error.code },
        { status: 502 },
      );
    }
    throw error;
  }
  if (issued.customer?.id && issued.customer.id !== parentId) {
    // 다른 사용자의 빌링키를 가로채지 못하도록 차단.
    return NextResponse.json({ error: '카드 등록 정보가 로그인 사용자와 일치하지 않아요.' }, { status: 403 });
  }

  // 2) billing_keys 저장 (service-role, RLS 우회)
  const { data: billingKeyRow, error: bkError } = await supabase
    .from('billing_keys')
    .insert({
      parent_id: parentId,
      provider: 'portone',
      // 평문 금지 — AES-256-GCM 앱레벨 암호화 후 저장(복호화는 charge 시점에만).
      billing_key: encryptBillingKey(billingKey),
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

  // P1-3 분기 A: 유료 기간이 살아 있으면 청구 없이 카드만 교체하고 active 복구.
  if (existingSub && premiumNow) {
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        billing_key_id: billingKeyRow.id,
        canceled_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSub.id);
    if (updateError) {
      return NextResponse.json(
        { error: `구독 갱신에 실패했어요: ${updateError.message}` },
        { status: 500 },
      );
    }
    await syncEntitlement(parentId);
    const state = await getSubscriptionState(parentId);
    return NextResponse.json({
      ok: true,
      charged: false,
      cardSummary: billingKeyRow.card_summary,
      ...state,
    });
  }

  // P1-3 분기 B: 첫 달 청구. orderId = 포트원 paymentId (결정적 — 이중청구 창 차단).
  const todayKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let orderId = `${SUBSCRIPTION_ORDER_PREFIX}first_${parentId.replace(/-/g, '')}_${todayKey}`;

  const { data: existingPurchase } = await supabase
    .from('purchases')
    .select('status')
    .eq('order_id', orderId)
    .maybeSingle();

  let alreadyPaid = existingPurchase?.status === 'paid';
  if (existingPurchase && ['refunded', 'canceled'].includes(existingPurchase.status)) {
    orderId = `${orderId}_${randomUUID().slice(0, 8)}`;
    alreadyPaid = false;
  }

  let payment: Awaited<ReturnType<typeof chargeBillingKey>> | null = null;
  if (!alreadyPaid) {
    const { error: insertError } = await supabase.from('purchases').insert({
      parent_id: parentId,
      bundle_type: 'subscription',
      credits_added: 0,
      amount_krw: SUBSCRIPTION_PRICE_KRW,
      payment_provider: 'portone',
      order_id: orderId,
      status: 'pending',
    });

    if (insertError && !/duplicate|unique/i.test(insertError.message)) {
      return NextResponse.json(
        { error: `결제 기록 생성에 실패했어요: ${insertError.message}` },
        { status: 500 },
      );
    }

    try {
      payment = await chargeBillingKey({
        billingKey,
        customerKey: parentId,
        amount: SUBSCRIPTION_PRICE_KRW,
        orderId,
        orderName: SUBSCRIPTION_ORDER_NAME,
      });
    } catch (error) {
      const reason = error instanceof PortOneApiError ? error.message : '결제 승인 중 오류';
      await supabase
        .from('purchases')
        .update({ status: 'failed', failed_reason: reason })
        .eq('order_id', orderId);

      if (error instanceof PortOneApiError) {
        return NextResponse.json(
          { error: `첫 결제에 실패했어요: ${error.message}`, code: error.code },
          { status: 402 },
        );
      }
      throw error;
    }

    if (mapPortOneStatusToPurchaseStatus(payment.status) !== 'paid') {
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
        payment_key: payment.id,
        paid_at: payment.paidAt ?? new Date().toISOString(),
        raw_response: payment,
      })
      .eq('order_id', orderId);
  }

  // 4) 구독 활성화
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
  if (!alreadyPaid) {
    void sendFirstPaymentSuccessEmail({
      parentId,
      orderId,
      amountKrw: SUBSCRIPTION_PRICE_KRW,
      periodEnd: state.entitlement.premium_until,
    }).catch(reportEmailFailure('first-payment'));
  }

  return NextResponse.json({
    ok: true,
    charged: !alreadyPaid,
    orderId,
    cardSummary: billingKeyRow.card_summary,
    ...state,
  });
}
