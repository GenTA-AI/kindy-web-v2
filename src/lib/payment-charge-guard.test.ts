import assert from 'node:assert/strict';
import test from 'node:test';

import {
  billingKeyBelongsToCustomer,
  PortOneApiError,
  PortOnePaymentLookupError,
  PortOnePaymentVerificationError,
  resolveFirstPayment as resolvePortOneFirstPayment,
} from './portone';
import type { PortOnePayment } from './portone';
import { SUBSCRIPTION_PRICE_KRW } from './subscription';
import {
  TossApiError,
  TossPaymentLookupError,
  TossPaymentVerificationError,
  resolveFirstPayment as resolveTossFirstPayment,
} from './toss';
import type { TossPayment } from './toss';

const ORDER_ID = 'sub_first_parent_20260803';
const CURRENCY = 'KRW';

function portOnePayment(overrides: Partial<PortOnePayment> = {}): PortOnePayment {
  return {
    id: ORDER_ID,
    status: 'PAID',
    amount: { total: SUBSCRIPTION_PRICE_KRW },
    currency: CURRENCY,
    ...overrides,
  };
}

function tossPayment(overrides: Partial<TossPayment> = {}): TossPayment {
  return {
    paymentKey: 'payment-key',
    orderId: ORDER_ID,
    status: 'DONE',
    totalAmount: SUBSCRIPTION_PRICE_KRW,
    currency: CURRENCY,
    ...overrides,
  };
}

test('위조된 paid 행에서 프로바이더 결제가 없으면 두 경로 모두 실제 청구한다', async (t) => {
  await t.test('PortOne 404', async () => {
    let charged = 0;
    let prepared = 0;
    const result = await resolvePortOneFirstPayment({
      purchaseStatus: 'paid',
      orderId: ORDER_ID,
      expectedAmount: SUBSCRIPTION_PRICE_KRW,
      expectedCurrency: CURRENCY,
      lookupPayment: async () => {
        throw new PortOneApiError(404, 'PaymentNotFound', 'not found');
      },
      beforeCharge: async () => {
        prepared += 1;
      },
      chargePayment: async () => {
        charged += 1;
        return portOnePayment();
      },
    });

    assert.equal(result.alreadyPaid, false);
    assert.equal(prepared, 1);
    assert.equal(charged, 1);
  });

  await t.test('Toss 404', async () => {
    let charged = 0;
    let prepared = 0;
    const result = await resolveTossFirstPayment({
      purchaseStatus: 'paid',
      orderId: ORDER_ID,
      expectedAmount: SUBSCRIPTION_PRICE_KRW,
      expectedCurrency: CURRENCY,
      lookupPayment: async () => {
        throw new TossApiError(404, 'NOT_FOUND_PAYMENT', 'not found');
      },
      beforeCharge: async () => {
        prepared += 1;
      },
      chargePayment: async () => {
        charged += 1;
        return tossPayment();
      },
    });

    assert.equal(result.alreadyPaid, false);
    assert.equal(prepared, 1);
    assert.equal(charged, 1);
  });
});

test('프로바이더가 실제 paid 결제를 확인하면 두 경로 모두 청구를 건너뛴다', async (t) => {
  await t.test('PortOne', async () => {
    let charged = 0;
    const result = await resolvePortOneFirstPayment({
      purchaseStatus: 'paid',
      orderId: ORDER_ID,
      expectedAmount: SUBSCRIPTION_PRICE_KRW,
      expectedCurrency: CURRENCY,
      lookupPayment: async () => portOnePayment(),
      beforeCharge: async () => assert.fail('결제 준비가 실행되면 안 된다'),
      chargePayment: async () => {
        charged += 1;
        return portOnePayment();
      },
    });

    assert.equal(result.alreadyPaid, true);
    assert.equal(charged, 0);
  });

  await t.test('Toss', async () => {
    let charged = 0;
    const result = await resolveTossFirstPayment({
      purchaseStatus: 'paid',
      orderId: ORDER_ID,
      expectedAmount: SUBSCRIPTION_PRICE_KRW,
      expectedCurrency: CURRENCY,
      lookupPayment: async () => tossPayment(),
      beforeCharge: async () => assert.fail('결제 준비가 실행되면 안 된다'),
      chargePayment: async () => {
        charged += 1;
        return tossPayment();
      },
    });

    assert.equal(result.alreadyPaid, true);
    assert.equal(charged, 0);
  });
});

test('프로바이더 조회 실패는 청구와 구독 활성화 전에 fail-closed 한다', async (t) => {
  await t.test('PortOne 5xx', async () => {
    let charged = false;
    let activated = false;

    await assert.rejects(
      async () => {
        await resolvePortOneFirstPayment({
          purchaseStatus: 'paid',
          orderId: ORDER_ID,
          expectedAmount: SUBSCRIPTION_PRICE_KRW,
          expectedCurrency: CURRENCY,
          lookupPayment: async () => {
            throw new PortOneApiError(503, 'Unavailable', 'unavailable');
          },
          beforeCharge: async () => assert.fail('결제 준비가 실행되면 안 된다'),
          chargePayment: async () => {
            charged = true;
            return portOnePayment();
          },
        });
        activated = true;
      },
      PortOnePaymentLookupError,
    );

    assert.equal(charged, false);
    assert.equal(activated, false);
  });

  await t.test('Toss network error', async () => {
    let charged = false;
    let activated = false;

    await assert.rejects(
      async () => {
        await resolveTossFirstPayment({
          purchaseStatus: 'paid',
          orderId: ORDER_ID,
          expectedAmount: SUBSCRIPTION_PRICE_KRW,
          expectedCurrency: CURRENCY,
          lookupPayment: async () => {
            throw new TypeError('network unavailable');
          },
          beforeCharge: async () => assert.fail('결제 준비가 실행되면 안 된다'),
          chargePayment: async () => {
            charged = true;
            return tossPayment();
          },
        });
        activated = true;
      },
      TossPaymentLookupError,
    );

    assert.equal(charged, false);
    assert.equal(activated, false);
  });
});

test('확인된 결제의 금액 또는 통화가 다르면 성공 처리하지 않는다', async (t) => {
  await t.test('PortOne 기존 결제 금액 불일치', async () => {
    await assert.rejects(
      resolvePortOneFirstPayment({
        purchaseStatus: 'paid',
        orderId: ORDER_ID,
        expectedAmount: SUBSCRIPTION_PRICE_KRW,
        expectedCurrency: CURRENCY,
        lookupPayment: async () =>
          portOnePayment({ amount: { total: SUBSCRIPTION_PRICE_KRW - 1 } }),
        beforeCharge: async () => assert.fail('결제 준비가 실행되면 안 된다'),
        chargePayment: async () => portOnePayment(),
      }),
      (error: unknown) =>
        error instanceof PortOnePaymentVerificationError &&
        error.reason === 'payment_mismatch',
    );
  });

  await t.test('Toss 기존 결제 통화 불일치', async () => {
    await assert.rejects(
      resolveTossFirstPayment({
        purchaseStatus: 'paid',
        orderId: ORDER_ID,
        expectedAmount: SUBSCRIPTION_PRICE_KRW,
        expectedCurrency: CURRENCY,
        lookupPayment: async () => tossPayment({ currency: 'USD' }),
        beforeCharge: async () => assert.fail('결제 준비가 실행되면 안 된다'),
        chargePayment: async () => tossPayment(),
      }),
      (error: unknown) =>
        error instanceof TossPaymentVerificationError && error.reason === 'payment_mismatch',
    );
  });

  await t.test('동기 청구 응답도 같은 검증을 통과해야 한다', async () => {
    let activated = false;
    await assert.rejects(
      async () => {
        await resolveTossFirstPayment({
          purchaseStatus: null,
          orderId: ORDER_ID,
          expectedAmount: SUBSCRIPTION_PRICE_KRW,
          expectedCurrency: CURRENCY,
          beforeCharge: async () => undefined,
          chargePayment: async () =>
            tossPayment({ totalAmount: SUBSCRIPTION_PRICE_KRW - 1 }),
        });
        activated = true;
      },
      TossPaymentVerificationError,
    );
    assert.equal(activated, false);
  });
});

test('조회 응답이 결제 완료 상태가 아니면 모호한 응답으로 닫고 재청구하지 않는다', async (t) => {
  await t.test('PortOne READY', async () => {
    let charged = false;
    await assert.rejects(
      resolvePortOneFirstPayment({
        purchaseStatus: 'paid',
        orderId: ORDER_ID,
        expectedAmount: SUBSCRIPTION_PRICE_KRW,
        expectedCurrency: CURRENCY,
        lookupPayment: async () => portOnePayment({ status: 'READY' }),
        beforeCharge: async () => assert.fail('결제 준비가 실행되면 안 된다'),
        chargePayment: async () => {
          charged = true;
          return portOnePayment();
        },
      }),
      (error: unknown) =>
        error instanceof PortOnePaymentVerificationError &&
        error.reason === 'payment_not_paid',
    );
    assert.equal(charged, false);
  });

  await t.test('Toss IN_PROGRESS', async () => {
    let charged = false;
    await assert.rejects(
      resolveTossFirstPayment({
        purchaseStatus: 'paid',
        orderId: ORDER_ID,
        expectedAmount: SUBSCRIPTION_PRICE_KRW,
        expectedCurrency: CURRENCY,
        lookupPayment: async () => tossPayment({ status: 'IN_PROGRESS' }),
        beforeCharge: async () => assert.fail('결제 준비가 실행되면 안 된다'),
        chargePayment: async () => {
          charged = true;
          return tossPayment();
        },
      }),
      (error: unknown) =>
        error instanceof TossPaymentVerificationError && error.reason === 'payment_not_paid',
    );
    assert.equal(charged, false);
  });

  await t.test('PortOne 2xx empty body', async () => {
    let charged = false;
    await assert.rejects(
      resolvePortOneFirstPayment({
        purchaseStatus: 'paid',
        orderId: ORDER_ID,
        expectedAmount: SUBSCRIPTION_PRICE_KRW,
        expectedCurrency: CURRENCY,
        lookupPayment: async () => null as unknown as PortOnePayment,
        beforeCharge: async () => assert.fail('결제 준비가 실행되면 안 된다'),
        chargePayment: async () => {
          charged = true;
          return portOnePayment();
        },
      }),
      PortOnePaymentLookupError,
    );
    assert.equal(charged, false);
  });

  await t.test('Toss 2xx empty body', async () => {
    let charged = false;
    await assert.rejects(
      resolveTossFirstPayment({
        purchaseStatus: 'paid',
        orderId: ORDER_ID,
        expectedAmount: SUBSCRIPTION_PRICE_KRW,
        expectedCurrency: CURRENCY,
        lookupPayment: async () => null as unknown as TossPayment,
        beforeCharge: async () => assert.fail('결제 준비가 실행되면 안 된다'),
        chargePayment: async () => {
          charged = true;
          return tossPayment();
        },
      }),
      TossPaymentLookupError,
    );
    assert.equal(charged, false);
  });
});

test('PortOne 빌링키는 customer.id 누락과 불일치를 모두 거부한다', () => {
  assert.equal(billingKeyBelongsToCustomer({ billingKey: 'billing-key' }, 'parent-id'), false);
  assert.equal(
    billingKeyBelongsToCustomer(
      { billingKey: 'billing-key', customer: { id: 'other-parent' } },
      'parent-id',
    ),
    false,
  );
  assert.equal(
    billingKeyBelongsToCustomer(
      { billingKey: 'billing-key', customer: { id: 'parent-id' } },
      'parent-id',
    ),
    true,
  );
});
