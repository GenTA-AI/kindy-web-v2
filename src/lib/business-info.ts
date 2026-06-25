export interface BusinessInfo {
  brand: string;
  representativeName: string;
  registrationNumber: string;
  mailOrderRegistrationNumber: string;
  address: string;
  phone: string;
  email: string;
}

export const businessInfo: BusinessInfo = {
  brand: 'Kindy',
  representativeName: process.env.NEXT_PUBLIC_BIZ_REPRESENTATIVE_NAME ?? '[대표자 성명 미설정]',
  registrationNumber: process.env.NEXT_PUBLIC_BIZ_REGISTRATION_NUMBER ?? '[사업자등록번호 미설정]',
  mailOrderRegistrationNumber:
    process.env.NEXT_PUBLIC_BIZ_MAIL_ORDER_NUMBER ?? '[통신판매업 신고번호 미설정]',
  address: process.env.NEXT_PUBLIC_BIZ_ADDRESS ?? '[사업장 주소 미설정]',
  phone: process.env.NEXT_PUBLIC_BIZ_PHONE ?? '[전화번호 미설정]',
  email: process.env.NEXT_PUBLIC_BIZ_EMAIL ?? 'support@kindy.kr',
};
