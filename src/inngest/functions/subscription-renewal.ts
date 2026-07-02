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
 *   - 청구 실패 → status='past_due' + purchase failed.
 *
 * dunning (docs/07 P1-1/P1-2):
 *   - active 는 만료 24시간 전부터 선청구 → 매월 전 구독자가 최대 24시간 접근을 잃던
 *     결정론적 암전 제거 (기간 연장은 직전 period_end 기준이라 과금 손실 없음).
 *   - past_due 는 만료 후 7일까지 매일 재시도 (orderId 는 periodKey 로 동일 → 토스가
 *     승인된 orderId 재사용만 거부하므로 실패 건 재청구 가능).
 *   - 7일 재시도 소진 → status='expired' 로 종결. 실패가 1건이라도 있으면 런을 throw 로
 *     끝내 Inngest 대시보드에서 빨간불이 보이게 한다 (P1-12).
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
import { reportEmailFailure, sendRenewalFailureEmail, sendRenewalSuccessEmail } from '@/lib/mailer';

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
    notifyRenewalFailure(sub.parent_id, '등록된 카드 정보를 찾지 못했어요.');
    return { subscriptionId: sub.id, result: 'failed', reason: 'no_billing_key' };
  }
  const { data: bk, error: bkError } = await supabase
    .from('billing_keys')
    .select('billing_key')
    .eq('id', sub.billing_key_id)
    .maybeSingle();
  if (bkError) {
    // 일시적 DB 오류 — 상태를 건드리지 않고 실패 보고만 (다음 런에서 재시도).
    return { subscriptionId: sub.id, result: 'failed', reason: `billing_keys query: ${bkError.message}` };
  }
  if (!bk?.billing_key) {
    await markPastDue(sub.id);
    notifyRenewalFailure(sub.parent_id, '등록된 카드 정보를 찾지 못했어요.');
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
    notifyRenewalFailure(sub.parent_id, reason);
    return { subscriptionId: sub.id, result: 'failed', reason };
  }

  if (payment.status !== 'DONE') {
    await supabase
      .from('purchases')
      .update({ status: 'failed', failed_reason: `status ${payment.status}`, raw_response: payment })
      .eq('order_id', orderId);
    await markPastDue(sub.id);
    notifyRenewalFailure(sub.parent_id, `결제가 완료되지 않았어요. 상태: ${payment.status}`);
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

  const nextPeriodEnd = await extendPeriod(sub);
  void sendRenewalSuccessEmail({
    parentId: sub.parent_id,
    orderId,
    amountKrw: sub.price_krw,
    periodEnd: nextPeriodEnd,
  }).catch(reportEmailFailure('renewal-success'));
  return { subscriptionId: sub.id, result: 'charged' };
}

/** 결제주기를 직전 종료일 기준으로 1개월 연장(공백 없이 연속). */
async function extendPeriod(sub: DueSubscription): Promise<string> {
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
  return end.toISOString();
}

async function markPastDue(subscriptionId: string): Promise<void> {
  await supabase
    .from('subscriptions')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })
    .eq('id', subscriptionId);
}

function notifyRenewalFailure(parentId: string, reason: string): void {
  void sendRenewalFailureEmail({ parentId, reason }).catch(reportEmailFailure('renewal-failure'));
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
      const nowIso = new Date().toISOString();
      // P1-2: 만료 24시간 전부터 선청구 — 04:00 cron 과 만료 시각 사이의 접근 공백 제거.
      const chargeWindowEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      // P1-1: past_due 는 만료 후 7일까지 매일 재시도.
      const retryWindowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: active, error: activeError } = await supabase
        .from('subscriptions')
        .select('id, parent_id, billing_key_id, current_period_end, price_krw')
        .eq('status', 'active')
        .lte('current_period_end', chargeWindowEnd)
        .limit(200);
      if (activeError) throw new Error(`select due active: ${activeError.message}`);

      const { data: pastDue, error: pastDueError } = await supabase
        .from('subscriptions')
        .select('id, parent_id, billing_key_id, current_period_end, price_krw')
        .eq('status', 'past_due')
        .lte('current_period_end', nowIso)
        .gte('current_period_end', retryWindowStart)
        .limit(200);
      if (pastDueError) throw new Error(`select due past_due: ${pastDueError.message}`);

      return [...(active ?? []), ...(pastDue ?? [])] as DueSubscription[];
    });

    // P1-1: 재시도 윈도(7일)를 소진한 past_due 는 expired 로 종결 — 영원한 좀비 방지.
    const expired = await step.run('expire-stale-past-due', async () => {
      const retryWindowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('subscriptions')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('status', 'past_due')
        .lt('current_period_end', retryWindowStart)
        .select('id, parent_id');
      if (error) throw new Error(`expire stale past_due: ${error.message}`);
      for (const row of data ?? []) {
        await supabase.rpc('sync_entitlement', { p_parent_id: row.parent_id });
      }
      return (data ?? []).length;
    });

    logger.info('subscription-renewal: due', { count: due.length, expired });

    const outcomes: RenewOutcome[] = [];
    for (const sub of due) {
      // 구독별 step → Inngest 가 성공 step 을 캐시(함수 재시도 시 재청구 방지).
      const outcome = await step.run(`renew-${sub.id}`, () => renewOne(sub));
      outcomes.push(outcome);
    }

    const failures = outcomes.filter((o) => o.result === 'failed');
    const summary = {
      processed: due.length,
      charged: outcomes.filter((o) => o.result === 'charged').length,
      extended: outcomes.filter((o) => o.result === 'extended').length,
      failed: failures.length,
      expired,
    };
    logger.info('subscription-renewal: done', summary);

    // P1-12: 실패를 삼키지 않는다 — 런을 실패로 끝내 Inngest 대시보드/알림에 노출.
    // (renew-* step 은 이미 성공 캐시돼 재시도에도 재청구 없음.)
    if (failures.length > 0) {
      console.error('[subscription-renewal] failures', JSON.stringify(failures));
      throw new Error(
        `subscription-renewal: ${failures.length}/${due.length} renewals failed — ${failures
          .map((f) => `${f.subscriptionId}:${'reason' in f ? f.reason : ''}`)
          .join(' | ')}`,
      );
    }
    return summary;
  },
);
