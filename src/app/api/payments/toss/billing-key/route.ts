import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { supabase } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { encryptBillingKey } from '@/lib/billing-crypto';
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
  hasPremiumEntitlement,
  nextMonthlyPeriod,
  syncEntitlement,
} from '@/lib/subscription';
import { reportEmailFailure, sendFirstPaymentSuccessEmail } from '@/lib/mailer';

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

  // P1-15: 정기결제 동의 증적을 청구 전에 서버가 강제한다.
  // 클라이언트의 fire-and-forget 기록에 의존하면 분쟁 시 건별 증적이 빌 수 있다.
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

  // P1-3: 현재 구독/엔타이틀 상태를 먼저 본다 — 유료 기간이 남아 있으면 청구 없이
  // 카드 교체/해지 철회만 수행해 잔여 유료일 몰수·이중청구를 막는다.
  const { subscription: existingSub, entitlement: currentEntitlement } =
    await getSubscriptionState(parentId);
  const premiumNow = hasPremiumEntitlement(currentEntitlement);

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
      // 평문 금지 — AES-256-GCM 앱레벨 암호화 후 저장(복호화는 charge 시점에만).
      billing_key: encryptBillingKey(issued.billingKey),
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

  // P1-3 분기 A: 유료 기간이 살아 있으면(active 카드교체 / canceled 재시작 / past_due 만료 전)
  // 청구 없이 카드만 교체하고 구독을 active 로 되돌린다. 잔여 유료일은 그대로,
  // 다음 결제는 기존 period_end 에 갱신 cron 이 수행한다.
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

  // P1-3 분기 B: 유료 기간이 없으면 첫 달 청구.
  // orderId 는 (parent, 오늘) 결정적 — "청구 성공 후 활성화 실패 → 재시도 → 이중청구" 창을 막고,
  // 이미 paid 인 오늘자 orderId 가 있으면 청구를 건너뛰고 활성화만 복구한다.
  const todayKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let orderId = `${SUBSCRIPTION_ORDER_PREFIX}first_${parentId.replace(/-/g, '')}_${todayKey}`;

  const { data: existingPurchase } = await supabase
    .from('purchases')
    .select('status')
    .eq('order_id', orderId)
    .maybeSingle();

  let alreadyPaid = existingPurchase?.status === 'paid';
  if (existingPurchase && ['refunded', 'canceled'].includes(existingPurchase.status)) {
    // 같은 날 환불 후 재구독 — 결정적 orderId 가 이미 소진됐으니 새 orderId 로 정상 청구.
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
      payment_provider: 'toss',
      order_id: orderId,
      status: 'pending',
    });

    // 재시도(failed/pending 기존 행)면 duplicate 는 정상 — 그 외 오류만 실패 처리.
    if (insertError && !/duplicate|unique/i.test(insertError.message)) {
      return NextResponse.json(
        { error: `결제 기록 생성에 실패했어요: ${insertError.message}` },
        { status: 500 },
      );
    }

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
  }

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
