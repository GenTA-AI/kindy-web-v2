// TossPayments v2 빌링(정기결제) 서버 헬퍼.
// server-only — TOSS_SECRET_KEY 를 사용하므로 API route 에서만 import 할 것.
// 문서: https://docs.tosspayments.com/guides/v2/billing/integration
// 테스트 모드: test_sk_* 키 사용 시 실제 청구 없음.

const TOSS_API_BASE = 'https://api.tosspayments.com';

export interface TossCard {
  issuerCode?: string;
  acquirerCode?: string;
  number?: string; // 마스킹된 카드번호 (예: 433012******1234)
  cardType?: string;
  ownerType?: string;
}

export interface TossBillingKeyResponse {
  mId: string;
  customerKey: string;
  billingKey: string;
  authenticatedAt: string;
  method: string;
  cardCompany?: string;
  cardNumber?: string;
  card?: TossCard;
}

export interface TossPayment {
  paymentKey: string;
  orderId: string;
  orderName?: string;
  currency?: string;
  status:
    | 'READY'
    | 'IN_PROGRESS'
    | 'WAITING_FOR_DEPOSIT'
    | 'DONE'
    | 'CANCELED'
    | 'PARTIAL_CANCELED'
    | 'ABORTED'
    | 'EXPIRED';
  totalAmount?: number;
  approvedAt?: string | null;
  requestedAt?: string;
  [key: string]: unknown;
}

export class TossApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'TossApiError';
    this.status = status;
    this.code = code;
  }
}

export class TossPaymentLookupError extends Error {
  constructor(options?: ErrorOptions) {
    super('Toss payment lookup failed', options);
    this.name = 'TossPaymentLookupError';
  }
}

export class TossPaymentVerificationError extends Error {
  readonly reason: 'payment_mismatch' | 'payment_not_paid';

  constructor(reason: TossPaymentVerificationError['reason']) {
    super(
      reason === 'payment_mismatch'
        ? 'Toss payment amount or currency mismatch'
        : 'Toss payment is not paid',
    );
    this.name = 'TossPaymentVerificationError';
    this.reason = reason;
  }
}

function getSecretKey(): string {
  const key = process.env.TOSS_SECRET_KEY;
  if (!key) {
    throw new Error('TOSS_SECRET_KEY is not set. Add it to .env.local (test_sk_* for TEST mode).');
  }
  if (process.env.NODE_ENV === 'production' && key.startsWith('test_')) {
    throw new Error('TOSS_SECRET_KEY uses a test key in production. Set a live_* Toss secret key.');
  }
  return key;
}

function basicAuthHeader(): string {
  // 토스 API 인증: secretKey + ':' 을 base64 (password 없음).
  return `Basic ${Buffer.from(`${getSecretKey()}:`).toString('base64')}`;
}

async function tossFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${TOSS_API_BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });

  const json = (await res.json().catch(() => null)) as
    | (T & { code?: string; message?: string })
    | null;

  if (!res.ok) {
    throw new TossApiError(
      res.status,
      json?.code ?? 'UNKNOWN',
      json?.message ?? `Toss API error (HTTP ${res.status})`,
    );
  }

  return json as T;
}

/** authKey(카드 등록 successUrl 파라미터) → 빌링키 발급. */
export async function issueBillingKey(params: {
  authKey: string;
  customerKey: string;
}): Promise<TossBillingKeyResponse> {
  return tossFetch<TossBillingKeyResponse>('/v1/billing/authorizations/issue', {
    method: 'POST',
    body: { authKey: params.authKey, customerKey: params.customerKey },
  });
}

/** 빌링키로 자동결제 승인 (월 구독 청구). */
export async function chargeBillingKey(params: {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
  customerEmail?: string;
}): Promise<TossPayment> {
  return tossFetch<TossPayment>(`/v1/billing/${encodeURIComponent(params.billingKey)}`, {
    method: 'POST',
    body: {
      customerKey: params.customerKey,
      amount: params.amount,
      orderId: params.orderId,
      orderName: params.orderName,
      ...(params.customerEmail ? { customerEmail: params.customerEmail } : {}),
    },
  });
}

/**
 * 결제 단건 조회. 토스 webhook 은 서명이 없으므로
 * webhook payload 를 신뢰하지 않고 이 API 로 재조회해 검증한다.
 */
export async function getPayment(paymentKey: string): Promise<TossPayment> {
  return tossFetch<TossPayment>(`/v1/payments/${encodeURIComponent(paymentKey)}`);
}

/** 결정적 orderId 로 승인된 결제를 조회한다. */
export async function getPaymentByOrderId(orderId: string): Promise<TossPayment> {
  return tossFetch<TossPayment>(`/v1/payments/orders/${encodeURIComponent(orderId)}`);
}

/**
 * 404만 결제 없음으로 취급한다. 네트워크 오류나 5xx 등은 검증 실패로 보존해
 * 호출자가 구독 활성화를 fail-closed 할 수 있게 한다.
 */
export async function findPaymentByOrderId(
  orderId: string,
  lookupPayment: (orderId: string) => Promise<TossPayment> = getPaymentByOrderId,
): Promise<TossPayment | null> {
  try {
    const payment = await lookupPayment(orderId);
    if (!payment || typeof payment !== 'object') {
      throw new Error('Toss payment lookup returned an empty response');
    }
    return payment;
  } catch (error) {
    if (error instanceof TossApiError && error.status === 404) {
      return null;
    }
    throw new TossPaymentLookupError({ cause: error });
  }
}

/** 결제 완료 상태와 주문 ID·금액·통화를 모두 대조한다. */
export function verifyPayment(params: {
  payment: TossPayment;
  orderId: string;
  expectedAmount: number;
  expectedCurrency: string;
}): void {
  if (!params.payment || typeof params.payment !== 'object' || params.payment.status !== 'DONE') {
    throw new TossPaymentVerificationError('payment_not_paid');
  }
  if (
    params.payment.orderId !== params.orderId ||
    params.payment.totalAmount !== params.expectedAmount ||
    params.payment.currency !== params.expectedCurrency
  ) {
    throw new TossPaymentVerificationError('payment_mismatch');
  }
}

/**
 * 로컬 paid 행은 프로바이더가 같은 주문의 정상 결제를 확인한 경우에만 재사용한다.
 * 결제가 실제로 없으면 동일 orderId 로 청구하고, 조회 실패·모호한 응답은 예외로 닫는다.
 */
export async function resolveFirstPayment(params: {
  purchaseStatus: string | null | undefined;
  orderId: string;
  expectedAmount: number;
  expectedCurrency: string;
  lookupPayment?: (orderId: string) => Promise<TossPayment>;
  beforeCharge: () => Promise<void>;
  chargePayment: () => Promise<TossPayment>;
}): Promise<{ alreadyPaid: boolean; payment: TossPayment }> {
  if (params.purchaseStatus === 'paid') {
    const existingPayment = await findPaymentByOrderId(params.orderId, params.lookupPayment);
    if (existingPayment) {
      verifyPayment({
        payment: existingPayment,
        orderId: params.orderId,
        expectedAmount: params.expectedAmount,
        expectedCurrency: params.expectedCurrency,
      });
      return { alreadyPaid: true, payment: existingPayment };
    }
  }

  await params.beforeCharge();
  const payment = await params.chargePayment();
  verifyPayment({
    payment,
    orderId: params.orderId,
    expectedAmount: params.expectedAmount,
    expectedCurrency: params.expectedCurrency,
  });
  return { alreadyPaid: false, payment };
}

/** 토스 결제 status → purchases.status 매핑. */
export function mapTossStatusToPurchaseStatus(
  status: TossPayment['status'],
): 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled' {
  switch (status) {
    case 'DONE':
      return 'paid';
    case 'CANCELED':
    case 'PARTIAL_CANCELED':
      return 'refunded';
    case 'ABORTED':
    case 'EXPIRED':
      return 'failed';
    default:
      return 'pending';
  }
}

/** 카드 표시용 요약 문자열 (민감정보 아님). */
export function cardSummaryOf(res: TossBillingKeyResponse): string | null {
  const company = res.cardCompany ?? null;
  const number = res.cardNumber ?? res.card?.number ?? null;
  const last4 = number ? number.replace(/\D/g, '').slice(-4) : null;
  if (company && last4) return `${company} **** ${last4}`;
  if (company) return company;
  if (last4) return `**** ${last4}`;
  return null;
}
