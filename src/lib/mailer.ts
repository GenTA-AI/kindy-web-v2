import { supabase } from '@/lib/supabase';

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Kindy <support@kindy.kr>';

type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type PaymentEmailInput = {
  parentId: string;
  orderId?: string | null;
  amountKrw: number;
  periodEnd?: string | null;
};

type RenewalFailureEmailInput = {
  parentId: string;
  reason: string;
};

function krw(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '현재 결제 기간';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '현재 결제 기간';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function absoluteUrl(path: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || 'https://kindy.kr';
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function getParentEmail(parentId: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(parentId);
  if (error) {
    console.error('[mailer:user-email]', error);
    return null;
  }
  return data.user?.email ?? null;
}

async function sendEmail(input: EmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[mailer] RESEND_API_KEY is not set; email skipped', {
      to: input.to,
      subject: input.subject,
    });
    return;
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend failed (${res.status}): ${body.slice(0, 500)}`);
  }
}

export async function sendFirstPaymentSuccessEmail(input: PaymentEmailInput): Promise<void> {
  const to = await getParentEmail(input.parentId);
  if (!to) return;

  const manageUrl = absoluteUrl('/subscribe');
  const periodEnd = formatDate(input.periodEnd);
  const orderId = input.orderId ? escapeHtml(input.orderId) : null;
  await sendEmail({
    to,
    subject: 'Kindy 멤버십 첫 결제가 완료됐어요',
    text: [
      'Kindy 멤버십 첫 결제가 완료됐어요.',
      `결제 금액: ${krw(input.amountKrw)}`,
      input.orderId ? `주문번호: ${input.orderId}` : null,
      `이용 기간: ${periodEnd}까지`,
      `구독 확인과 해지는 ${manageUrl} 에서 할 수 있어요.`,
    ].filter(Boolean).join('\n'),
    html: `
      <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#233126">
        <h1 style="font-size:20px">Kindy 멤버십 첫 결제가 완료됐어요</h1>
        <p>모리 이야기를 이어서 볼 수 있어요.</p>
        <ul>
          <li>결제 금액: <strong>${krw(input.amountKrw)}</strong></li>
          ${orderId ? `<li>주문번호: <strong>${orderId}</strong></li>` : ''}
          <li>이용 기간: <strong>${periodEnd}까지</strong></li>
        </ul>
        <p><a href="${manageUrl}">구독 확인과 해지</a>는 멤버십 화면에서 할 수 있어요.</p>
      </div>
    `,
  });
}

export async function sendRenewalSuccessEmail(input: PaymentEmailInput): Promise<void> {
  const to = await getParentEmail(input.parentId);
  if (!to) return;

  const manageUrl = absoluteUrl('/subscribe');
  const periodEnd = formatDate(input.periodEnd);
  const orderId = input.orderId ? escapeHtml(input.orderId) : null;
  await sendEmail({
    to,
    subject: 'Kindy 멤버십 갱신 결제가 완료됐어요',
    text: [
      'Kindy 멤버십 갱신 결제가 완료됐어요.',
      `결제 금액: ${krw(input.amountKrw)}`,
      input.orderId ? `주문번호: ${input.orderId}` : null,
      `다음 이용 기간: ${periodEnd}까지`,
      `구독 확인과 해지는 ${manageUrl} 에서 할 수 있어요.`,
    ].filter(Boolean).join('\n'),
    html: `
      <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#233126">
        <h1 style="font-size:20px">Kindy 멤버십 갱신 결제가 완료됐어요</h1>
        <ul>
          <li>결제 금액: <strong>${krw(input.amountKrw)}</strong></li>
          ${orderId ? `<li>주문번호: <strong>${orderId}</strong></li>` : ''}
          <li>다음 이용 기간: <strong>${periodEnd}까지</strong></li>
        </ul>
        <p><a href="${manageUrl}">구독 확인과 해지</a>는 멤버십 화면에서 할 수 있어요.</p>
      </div>
    `,
  });
}

export async function sendRenewalFailureEmail(input: RenewalFailureEmailInput): Promise<void> {
  const to = await getParentEmail(input.parentId);
  if (!to) return;

  const subscribeUrl = absoluteUrl('/subscribe');
  const reason = escapeHtml(input.reason);
  await sendEmail({
    to,
    subject: 'Kindy 멤버십 결제를 확인해 주세요',
    text: [
      'Kindy 멤버십 갱신 결제를 완료하지 못했어요.',
      `확인 내용: ${input.reason}`,
      `카드를 다시 등록하려면 ${subscribeUrl} 로 이동해 주세요.`,
    ].join('\n'),
    html: `
      <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#233126">
        <h1 style="font-size:20px">Kindy 멤버십 결제를 확인해 주세요</h1>
        <p>갱신 결제를 완료하지 못했어요.</p>
        <p style="color:#66715f">확인 내용: ${reason}</p>
        <p><a href="${subscribeUrl}">카드 다시 등록하기</a></p>
      </div>
    `,
  });
}

export function reportEmailFailure(scope: string): (error: unknown) => void {
  return (error) => {
    console.error(`[mailer:${scope}]`, error);
  };
}
