// PortOne V2 빌링(정기결제) 서버 헬퍼 — src/lib/toss.ts 와 동일한 역할·유사 시그니처.
// server-only — PORTONE_API_SECRET 을 사용하므로 API route/Inngest 에서만 import 할 것.
// 문서: https://developers.portone.io/opi/ko/integration/start/v2/billing/readme
// 빌링키 발급은 브라우저 SDK(requestIssueBillingKey)가 수행하고, 서버는 검증·청구·조회만 한다.

const PORTONE_API_BASE = 'https://api.portone.io';

export interface PortOneBillingKeyInfo {
  billingKey: string;
  status?: string;
  channels?: Array<{ type?: string; name?: string }>;
  methods?: Array<{
    type?: string;
    card?: { publisher?: string; issuer?: string; brand?: string; number?: string; bin?: string; name?: string };
  }>;
  customer?: { id?: string };
  issuedAt?: string;
  [key: string]: unknown;
}

export interface PortOnePayment {
  id: string;
  status:
    | 'READY'
    | 'PENDING'
    | 'VIRTUAL_ACCOUNT_ISSUED'
    | 'PAID'
    | 'FAILED'
    | 'PARTIAL_CANCELLED'
    | 'CANCELLED';
  orderName?: string;
  amount?: { total?: number };
  paidAt?: string | null;
  requestedAt?: string;
  [key: string]: unknown;
}

export class PortOneApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'PortOneApiError';
    this.status = status;
    this.code = code;
  }
}

function getApiSecret(): string {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) {
    throw new Error('PORTONE_API_SECRET is not set. 포트원 콘솔 → 결제연동 → API Keys 에서 V2 API Secret 을 발급해 .env.local 에 추가하라.');
  }
  return secret;
}

async function portoneFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${PORTONE_API_BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `PortOne ${getApiSecret()}`,
      'Content-Type': 'application/json',
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });

  const json = (await res.json().catch(() => null)) as
    | (T & { type?: string; message?: string })
    | null;

  if (!res.ok) {
    throw new PortOneApiError(
      res.status,
      json?.type ?? 'UNKNOWN',
      json?.message ?? `PortOne API error (HTTP ${res.status})`,
    );
  }

  return json as T;
}

/**
 * 빌링키 단건 조회 — 브라우저 SDK가 발급한 빌링키를 서버가 신뢰하기 전 검증용.
 * (빌링키 실재 여부 + customer.id 가 요청자와 일치하는지 확인)
 */
export async function getBillingKeyInfo(billingKey: string): Promise<PortOneBillingKeyInfo> {
  return portoneFetch<PortOneBillingKeyInfo>(`/billing-keys/${encodeURIComponent(billingKey)}`);
}

/** 빌링키로 결제 승인 (첫 결제·월 구독 청구). paymentId = 우리 쪽 결정적 orderId (멱등). */
export async function chargeBillingKey(params: {
  billingKey: string;
  customerKey: string; // = parentId. PortOne customer.id 로 전달.
  amount: number;
  orderId: string;
  orderName: string;
  customerEmail?: string;
}): Promise<PortOnePayment> {
  await portoneFetch<{ payment?: PortOnePayment } & PortOnePayment>(
    `/payments/${encodeURIComponent(params.orderId)}/billing-key`,
    {
      method: 'POST',
      body: {
        billingKey: params.billingKey,
        orderName: params.orderName,
        customer: {
          id: params.customerKey,
          ...(params.customerEmail ? { email: params.customerEmail } : {}),
        },
        amount: { total: params.amount },
        currency: 'KRW',
      },
    },
  );
  // 청구 API 응답은 요약이므로, 상태·금액의 단일 진실은 결제 조회로 확정한다.
  return getPayment(params.orderId);
}

/**
 * 결제 단건 조회. 포트원 웹훅 payload 를 신뢰하지 않고
 * payment_id 로 이 API 를 재조회해 검증한다 (서명 검증과 이중 방어).
 */
export async function getPayment(paymentId: string): Promise<PortOnePayment> {
  return portoneFetch<PortOnePayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

/** 포트원 결제 status → purchases.status 매핑. */
export function mapPortOneStatusToPurchaseStatus(
  status: PortOnePayment['status'],
): 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled' {
  switch (status) {
    case 'PAID':
      return 'paid';
    case 'CANCELLED':
    case 'PARTIAL_CANCELLED':
      return 'refunded';
    case 'FAILED':
      return 'failed';
    default:
      return 'pending';
  }
}

/** 카드 표시용 요약 문자열 (민감정보 아님). */
export function cardSummaryOf(info: PortOneBillingKeyInfo): string | null {
  const card = info.methods?.find((method) => method.card)?.card;
  if (!card) return null;
  const company = card.publisher ?? card.issuer ?? card.name ?? null;
  const last4 = card.number ? card.number.replace(/\D/g, '').slice(-4) : null;
  if (company && last4) return `${company} **** ${last4}`;
  if (company) return company;
  if (last4) return `**** ${last4}`;
  return null;
}
