export interface BusinessInfo {
  brand: string;
  representativeName: string | null;
  registrationNumber: string | null;
  mailOrderRegistrationNumber: string | null;
  address: string | null;
  phone: string | null;
  email: string;
}

// 반드시 `process.env.NEXT_PUBLIC_*` 리터럴 접근이어야 한다. Next.js 는 빌드 타임에
// 리터럴 멤버 접근만 클라이언트 번들에 인라인하고, `process.env[key]` 같은 동적 조회는
// 인라인하지 않는다 → 브라우저에서 항상 undefined가 되어 결제 CTA가 영구 비활성된다.
// (Dockerfile/cloudbuild.yaml 의 빌드 ARG 와 세트로 동작 — 값은 빌드 시점에 있어야 한다.)
function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

export const businessInfo: BusinessInfo = {
  brand: 'Kindy',
  representativeName: clean(process.env.NEXT_PUBLIC_BIZ_REPRESENTATIVE_NAME),
  registrationNumber: clean(process.env.NEXT_PUBLIC_BIZ_REGISTRATION_NUMBER),
  mailOrderRegistrationNumber: clean(process.env.NEXT_PUBLIC_BIZ_MAIL_ORDER_NUMBER),
  address: clean(process.env.NEXT_PUBLIC_BIZ_ADDRESS),
  phone: clean(process.env.NEXT_PUBLIC_BIZ_PHONE),
  email: clean(process.env.NEXT_PUBLIC_BIZ_EMAIL) ?? 'support@kindy.kr',
};

export function businessInfoRows(info: BusinessInfo = businessInfo): Array<[string, string]> {
  return [
    ['상호', info.brand],
    ['대표', info.representativeName],
    ['사업자등록번호', info.registrationNumber],
    ['통신판매업 신고번호', info.mailOrderRegistrationNumber],
    ['주소', info.address],
    ['전화', info.phone],
    ['이메일', info.email],
  ].filter((row): row is [string, string] => Boolean(row[1]));
}

export function isBusinessInfoComplete(info: BusinessInfo = businessInfo): boolean {
  return Boolean(
    info.representativeName &&
      info.registrationNumber &&
      info.mailOrderRegistrationNumber &&
      info.address &&
      info.phone &&
      info.email,
  );
}
