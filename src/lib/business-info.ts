export interface BusinessInfo {
  brand: string;
  representativeName: string | null;
  registrationNumber: string | null;
  mailOrderRegistrationNumber: string | null;
  address: string | null;
  phone: string | null;
  email: string;
}

function optionalPublicEnv(key: string): string | null {
  const value = process.env[key]?.trim();
  return value || null;
}

export const businessInfo: BusinessInfo = {
  brand: 'Kindy',
  representativeName: optionalPublicEnv('NEXT_PUBLIC_BIZ_REPRESENTATIVE_NAME'),
  registrationNumber: optionalPublicEnv('NEXT_PUBLIC_BIZ_REGISTRATION_NUMBER'),
  mailOrderRegistrationNumber: optionalPublicEnv('NEXT_PUBLIC_BIZ_MAIL_ORDER_NUMBER'),
  address: optionalPublicEnv('NEXT_PUBLIC_BIZ_ADDRESS'),
  phone: optionalPublicEnv('NEXT_PUBLIC_BIZ_PHONE'),
  email: optionalPublicEnv('NEXT_PUBLIC_BIZ_EMAIL') ?? 'support@kindy.kr',
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
