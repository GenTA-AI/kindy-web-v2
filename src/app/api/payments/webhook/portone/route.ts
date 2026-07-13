import { NextRequest, NextResponse } from 'next/server';
import * as PortOneServer from '@portone/server-sdk';
import { supabase } from '@/lib/supabase';
import { getPayment, mapPortOneStatusToPurchaseStatus, PortOneApiError } from '@/lib/portone';
import { SUBSCRIPTION_ORDER_PREFIX, syncEntitlement } from '@/lib/subscription';

/**
 * POST /api/payments/webhook/portone
 *
 * 포트원 V2 결제 상태 변경 webhook. 이중 방어:
 * 1) HMAC 서명 검증 (@portone/server-sdk, PORTONE_WEBHOOK_SECRET — 콘솔 웹훅 등록 시 발급)
 * 2) payload 를 신뢰하지 않고 paymentId 로 포트원 결제 조회 API 를 재호출해 확정
 *
 * 멱등성: order_id(=paymentId) 기준 — 이미 같은 status 면 no-op.
 * 구독 결제(order_id 'sub_' 접두사)는 subscriptions + entitlements 도 갱신.
 * 토스 웹훅(/api/payments/webhook/toss)은 무서명 전제였음 — 포트원은 서명 필수.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // 1) 서명 검증 — 시크릿 미설정 시 fail-closed (검증 없이 결제 상태를 바꾸지 않는다).
  const webhookSecret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'webhook secret not configured' }, { status: 503 });
  }
  try {
    await PortOneServer.Webhook.verify(webhookSecret, rawBody, {
      'webhook-id': request.headers.get('webhook-id') ?? '',
      'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
      'webhook-signature': request.headers.get('webhook-signature') ?? '',
    });
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  const body = (() => {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }
  })();
  if (!body) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const data = (typeof body.data === 'object' && body.data !== null ? body.data : body) as Record<
    string,
    unknown
  >;
  const paymentId =
    typeof data.paymentId === 'string'
      ? data.paymentId
      : typeof data.payment_id === 'string'
        ? data.payment_id
        : null;

  if (!paymentId) {
    // 결제 외 이벤트(빌링키 발급/삭제 등)는 처리 대상 아님 — 재시도 방지 위해 200.
    return NextResponse.json({ ok: true, skipped: 'not a payment event' });
  }

  // 2) 검증: 포트원 API 재조회 (payload 위변조 방지, paymentId = 우리 order_id)
  let payment;
  try {
    payment = await getPayment(paymentId);
  } catch (error) {
    if (error instanceof PortOneApiError && error.status === 404) {
      return NextResponse.json({ error: 'unknown paymentId' }, { status: 400 });
    }
    // 포트원 API 일시 장애 — 5xx 로 응답해 포트원이 재시도하게 함.
    return NextResponse.json({ error: 'verification failed' }, { status: 502 });
  }

  // 3) purchases 조회 (멱등 처리 기준)
  const { data: purchase, error: findError } = await supabase
    .from('purchases')
    .select('id, parent_id, status, order_id')
    .eq('order_id', paymentId)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }
  if (!purchase) {
    return NextResponse.json({ ok: true, skipped: 'unknown orderId' });
  }

  const nextStatus = mapPortOneStatusToPurchaseStatus(payment.status);
  if (nextStatus === 'pending') {
    return NextResponse.json({ ok: true, skipped: 'payment pending', status: nextStatus });
  }

  if (purchase.status === nextStatus) {
    return NextResponse.json({ ok: true, idempotent: true, status: nextStatus });
  }

  // 4) purchases 갱신
  const { error: updateError } = await supabase
    .from('purchases')
    .update({
      status: nextStatus,
      payment_key: payment.id,
      paid_at: nextStatus === 'paid' ? payment.paidAt ?? new Date().toISOString() : undefined,
      failed_reason: nextStatus === 'failed' ? `portone status ${payment.status}` : undefined,
      raw_response: payment,
    })
    .eq('id', purchase.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 5) 구독 결제면 subscriptions + entitlements 동기화
  if (paymentId.startsWith(SUBSCRIPTION_ORDER_PREFIX)) {
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
