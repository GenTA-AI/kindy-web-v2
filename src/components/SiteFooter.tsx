'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { businessInfo, businessInfoRows } from '@/lib/business-info';

export default function SiteFooter() {
  const pathname = usePathname();
  const hidden =
    pathname.startsWith('/play') ||
    pathname.startsWith('/demo/kiosk') ||
    pathname.startsWith('/lesson') ||
    pathname.startsWith('/world') ||
    pathname.startsWith('/island');

  if (hidden) return null;

  const rows = businessInfoRows();
  const representative = rows.find(([label]) => label === '대표')?.[1];
  const registrationNumber = rows.find(([label]) => label === '사업자등록번호')?.[1];
  const mailOrderNumber = rows.find(([label]) => label === '통신판매업 신고번호')?.[1];
  const address = rows.find(([label]) => label === '주소')?.[1];
  const phone = rows.find(([label]) => label === '전화')?.[1];

  return (
    <footer className="mt-auto border-t border-line bg-cream">
      <div className="max-w-[375px] mx-auto px-6 py-8">
        <div className="text-xs text-ink3 space-y-1">
          <p className="font-semibold text-ink2">{businessInfo.brand}</p>
          {representative && <p>대표: {representative}</p>}
          {registrationNumber && <p>사업자등록번호: {registrationNumber}</p>}
          {mailOrderNumber && <p>통신판매업 신고번호: {mailOrderNumber}</p>}
          {address && <p>주소: {address}</p>}
          <p>
            문의: {phone ? `${phone} | ` : ''}
            {businessInfo.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 mt-2 text-xs text-ink3">
          <Link href="/legal/terms" className="inline-flex min-h-[44px] items-center hover:text-ink">
            이용약관
          </Link>
          <Link href="/legal/privacy" className="inline-flex min-h-[44px] items-center hover:text-ink">
            개인정보처리방침
          </Link>
          <Link href="/legal/business" className="inline-flex min-h-[44px] items-center hover:text-ink">
            사업자정보확인
          </Link>
        </div>
        <p className="text-xs text-ink3/70 mt-4">
          &copy; {new Date().getFullYear()} {businessInfo.brand}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
