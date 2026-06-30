/**
 * Inngest cron — 월 정기결제 갱신.
 *
 * 문제: 카드 등록 시 첫 달만 청구되고 2개월차 자동결제가 구현돼 있지 않아, 구독이
 * 다음 결제일에 조용히 끊겼다(접근만 막히고 과금/안내 없음). 이 함수가 매일 돌며
 * 결제일이 지난 active 구독을 청구해 기간을 연장한다.
 *
 * 안전장치(머니코드):
 *   - orderId 는 (구독id + 결제주기) 결정적 → 재실행/중복 트리거에도 토스가 중복
 *     orderId 를 거부해 이중청구 불가. purchases.order_id unique 로 한 번 더 방어.
 *   - 이미 paid 인 orderId 가 있으면 청구를 건너뛰고 기간만 연장(부분실패 복구 멱등).
 *   - 구독 1건 = step.run 1개 → Inngest 가 성공 step 을 캐시해 함수 재시도 시 재청구 안 함.
 *   - 청구 실패 → status='past_due' + purchase failed. (만료/유예 정책은 후속.)
 *
 * 운영: 프로덕션에서 INNGEST_EVENT_KEY/SIGNING_KEY(Inngest Cloud) 설정 + 배포 시
 *   PUT /api/inngest 로 함수가 등록돼야 cron 이 실제로 돈다.
 */
import { inngest } from '../client';
import { supabase } from '@/lib/supabase';
import { chargeBillingKey, TossApiError } from '@/lib/toss';
import { decryptBillingKey } from '@/lib/billing-crypto';
import {
  SUBSCRIPTION_ORDER_NAME,
  SUBSCRIPTION_ORDER_PREFIX,
  nextMonthlyPeriod,
  syncEntitlement,
} from '@/lib/subscription';

interface DueSubscription {
  id: string;
  parent_id: string;
  billing_key_id: string | null;
  current_period_end: string | null;
  price_krw: number;
}

/** 결제주기 식별자 — 결정적 orderId 용 (current_period_end 날짜). */
function periodKey(currentPeriodEnd: string | null): string {
  const d = currentPeriodEnd ? new Date(currentPeriodEnd) : new Date();
  // YYYYMMDD (UTC 기준 안정값)
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

type RenewOutcome =
  | { subscriptionId: string; result: 'charged' | 'already_paid' | 'extended' }
  | { subscriptionId: string; result: 'failed'; reason: string };

async function renewOne(sub: DueSubscription): Promise<RenewOutcome> {
  // 0) 빌링키 확보 (복호화)
  if (!sub.billing_key_id) {
    await markPastDue(sub.id);
    return { subscriptionId: sub.id, result: 'failed', reason: 'no_billing_key' };
  }
  const { data: bk } = await supabase
    .from('billing_keys')
    .select('billing_key')
    .eq('id', sub.billing_key_id)
    .maybeSingle();
  if (!bk?.billing_key) {
    await markPastDue(sub.id);
    return { subscriptionId: sub.id, result: 'failed', reason: 'billing_key_missing' };
  }

  const orderId = `${SUBSCRIPTION_ORDER_PREFIX}${sub.id}_${periodKey(sub.current_period_end)}`;

  // 1) 멱등: 이 orderId 가 이미 paid 면 기간만 연장(부분실패 복구).
  const { data: existing } = await supabase
    .from('purchases')
    .select('status')
    .eq('order_id', orderId)
    .maybeSingle();
  if (existing?.status === 'paid') {
    await extendPeriod(sub);
    return { subscriptionId: sub.id, result: 'extended' };
  }

  // 2) pending purchase 선기록 (order_id unique → 동시/중복 실행 방어)
  if (!existing) {
    const { error: insErr } = await supabase.from('purchases').insert({
      parent_id: sub.parent_id,
      bundle_type: 'subscription',
      credits_added: 0,
      amount_krw: sub.price_krw,
      payment_provider: 'toss',
      order_id: orderId,
      status: 'pending',
    });
    // unique 위반(동시 실행)이면 다른 실행이 처리 중 — 이번엔 스킵.
    if (insErr && !/duplicate|unique/i.test(insErr.message)) {
      return { subscriptionId: sub.id, result: 'failed', reason: `purchase insert: ${insErr.message}` };
    }
    if (insErr) {
      return { subscriptionId: sub.id, result: 'already_paid', reason: 'concurrent' } as RenewOutcome;
    }
  }

  // 3) 청구
  let payment;
  try {
    payment = await chargeBillingKey({
      billingKey: decryptBillingKey(bk.billing_key),
      customerKey: sub.parent_id,
      amount: sub.price_krw,
      orderId,
      orderName: SUBSCRIPTION_ORDER_NAME,
    });
  } catch (error) {
    const reason = error instanceof TossApiError ? `${error.code}: ${error.message}` : '결제 승인 오류';
    await supabase.from('purchases').update({ status: 'failed', failed_reason: reason }).eq('order_id', orderId);
    await markPastDue(sub.id);
    return { subscriptionId: sub.id, result: 'failed', reason };
  }

  if (payment.status !== 'DONE') {
    await supabase
      .from('purchases')
      .update({ status: 'failed', failed_reason: `status ${payment.status}`, raw_response: payment })
      .eq('order_id', orderId);
    await markPastDue(sub.id);
    return { subscriptionId: sub.id, result: 'failed', reason: `status ${payment.status}` };
  }

  // 4) paid 기록 + 기간 연장 + entitlement 동기화
  await supabase
    .from('purchases')
    .update({
      status: 'paid',
      payment_key: payment.paymentKey,
      paid_at: payment.approvedAt ?? new Date().toISOString(),
      raw_response: payment,
    })
    .eq('order_id', orderId);

  await extendPeriod(sub);
  return { subscriptionId: sub.id, result: 'charged' };
}

/** 결제주기를 직전 종료일 기준으로 1개월 연장(공백 없이 연속). */
async function extendPeriod(sub: DueSubscription): Promise<void> {
  const from = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
  const { start, end } = nextMonthlyPeriod(from);
  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id);
  await syncEntitlement(sub.parent_id);
}

async function markPastDue(subscriptionId: string): Promise<void> {
  await supabase
    .from('subscriptions')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })
    .eq('id', subscriptionId);
}

export const subscriptionRenewal = inngest.createFunction(
  {
    id: 'subscription-renewal',
    retries: 1,
    concurrency: { limit: 3 },
    triggers: [{ cron: 'TZ=Asia/Seoul 0 4 * * *' }], // 매일 04:00 KST
  },
  async ({ step, logger }) => {
    const due = await step.run('select-due', async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id, parent_id, billing_key_id, current_period_end, price_krw')
        .eq('status', 'active')
        .lte('current_period_end', new Date().toISOString())
        .limit(200);
      if (error) throw new Error(`select due subscriptions: ${error.message}`);
      return (data ?? []) as DueSubscription[];
    });

    logger.info('subscription-renewal: due', { count: due.length });

    const outcomes: RenewOutcome[] = [];
    for (const sub of due) {
      // 구독별 step → Inngest 가 성공 step 을 캐시(함수 재시도 시 재청구 방지).
      const outcome = await step.run(`renew-${sub.id}`, () => renewOne(sub));
      outcomes.push(outcome);
    }

    const summary = {
      processed: due.length,
      charged: outcomes.filter((o) => o.result === 'charged').length,
      extended: outcomes.filter((o) => o.result === 'extended').length,
      failed: outcomes.filter((o) => o.result === 'failed').length,
    };
    logger.info('subscription-renewal: done', summary);
    return summary;
  },
);
