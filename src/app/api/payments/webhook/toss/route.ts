import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getPayment, mapTossStatusToPurchaseStatus, TossApiError } from '@/lib/toss';
import { SUBSCRIPTION_ORDER_PREFIX, syncEntitlement } from '@/lib/subscription';

/**
 * POST /api/payments/webhook/toss
 *
 * 토스페이먼츠 결제 상태 변경 webhook.
 * 토스 webhook 은 서명(HMAC)이 없으므로 payload 를 신뢰하지 않고
 * paymentKey 로 토스 결제 조회 API 를 재호출해 검증한다 (토스 권장 방식).
 *
 * 멱등성: order_id 기준 — 이미 같은 status 면 no-op.
 * 구독 결제(order_id 가 'sub_' 접두사)는 subscriptions + entitlements 도 갱신.
 *
 * payload 형태 (둘 다 지원):
 * - v2: { eventType: 'PAYMENT_STATUS_CHANGED', createdAt, data: { paymentKey, orderId, status, ... } }
 * - v1: { paymentKey, orderId, status, ... } (Payment 객체 그대로)
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const data = (typeof body.data === 'object' && body.data !== null ? body.data : body) as Record<
    string,
    unknown
  >;
  const paymentKey = typeof data.paymentKey === 'string' ? data.paymentKey : null;
  const orderId = typeof data.orderId === 'string' ? data.orderId : null;

  if (!paymentKey || !orderId) {
    // 결제 외 이벤트(빌링키 삭제 등)는 처리 대상 아님 — 재시도 방지 위해 200.
    return NextResponse.json({ ok: true, skipped: 'not a payment event' });
  }

  // 1) 검증: 토스 API 재조회 (payload 위변조 방지)
  let payment;
  try {
    payment = await getPayment(paymentKey);
  } catch (error) {
    if (error instanceof TossApiError && error.status === 404) {
      // 우리 상점 결제가 아니거나 위조된 paymentKey.
      return NextResponse.json({ error: 'unknown paymentKey' }, { status: 400 });
    }
    // 토스 API 일시 장애 — 5xx 로 응답해 토스가 재시도하게 함.
    return NextResponse.json({ error: 'verification failed' }, { status: 502 });
  }

  if (payment.orderId !== orderId) {
    return NextResponse.json({ error: 'orderId mismatch' }, { status: 400 });
  }

  // 2) purchases 조회 (멱등 처리 기준)
  const { data: purchase, error: findError } = await supabase
    .from('purchases')
    .select('id, parent_id, status, order_id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }
  if (!purchase) {
    // 우리 DB 에 없는 주문 — 무시 (재시도 불필요).
    return NextResponse.json({ ok: true, skipped: 'unknown orderId' });
  }

  const nextStatus = mapTossStatusToPurchaseStatus(payment.status);
  if (purchase.status === nextStatus) {
    return NextResponse.json({ ok: true, idempotent: true, status: nextStatus });
  }

  // 3) purchases 갱신
  const { error: updateError } = await supabase
    .from('purchases')
    .update({
      status: nextStatus,
      payment_key: payment.paymentKey,
      paid_at: nextStatus === 'paid' ? payment.approvedAt ?? new Date().toISOString() : undefined,
      failed_reason: nextStatus === 'failed' ? `toss status ${payment.status}` : undefined,
      raw_response: payment,
    })
    .eq('id', purchase.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 4) 구독 결제면 subscriptions + entitlements 동기화
  if (orderId.startsWith(SUBSCRIPTION_ORDER_PREFIX)) {
    const subscriptionStatus =
      nextStatus === 'paid'
        ? 'active'
        : nextStatus === 'failed'
          ? 'past_due'
          : 'canceled'; // refunded / canceled

    const updates: Record<string, unknown> = {
      status: subscriptionStatus,
      updated_at: new Date().toISOString(),
    };
    if (subscriptionStatus === 'canceled') {
      updates.canceled_at = new Date().toISOString();
      // 환불이면 즉시 혜택 종료.
      if (nextStatus === 'refunded') updates.current_period_end = new Date().toISOString();
    }

    const { error: subError } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('parent_id', purchase.parent_id)
      .neq('status', 'expired');

    if (subError) {
      return NextResponse.json({ error: subError.message }, { status: 500 });
    }

    await syncEntitlement(purchase.parent_id);
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
