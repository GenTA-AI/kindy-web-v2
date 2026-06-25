import Link from 'next/link';
import { businessInfo } from '@/lib/business-info';

export default function SiteFooter() {
  return (
    <footer className="border-t border-gray-100 mt-auto">
      <div className="max-w-[375px] mx-auto px-6 py-8">
        <div className="text-xs text-gray-400 space-y-1">
          <p className="font-semibold text-gray-500">{businessInfo.brand}</p>
          <p>대표: {businessInfo.representativeName}</p>
          <p>사업자등록번호: {businessInfo.registrationNumber}</p>
          <p>통신판매업 신고번호: {businessInfo.mailOrderRegistrationNumber}</p>
          <p>주소: {businessInfo.address}</p>
          <p>연락처: {businessInfo.phone} | 이메일: {businessInfo.email}</p>
        </div>
        <div className="flex flex-wrap gap-x-4 mt-2 text-xs text-gray-400">
          <Link href="/legal/terms" className="inline-flex min-h-[44px] items-center hover:text-gray-600">
            이용약관
          </Link>
          <Link href="/legal/privacy" className="inline-flex min-h-[44px] items-center hover:text-gray-600">
            개인정보처리방침
          </Link>
          <Link href="/legal/business" className="inline-flex min-h-[44px] items-center hover:text-gray-600">
            사업자정보확인
          </Link>
        </div>
        <p className="text-xs text-gray-300 mt-4">
          &copy; {new Date().getFullYear()} {businessInfo.brand}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
