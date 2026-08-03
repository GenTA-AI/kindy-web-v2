import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import WorldClient from '@/components/world/WorldClient';
import { isLaunchSurfaceClosed } from '@/lib/launch-surface';

/**
 * /world — 이야기 지도 RPG 데모 (docs/plan/10 W1 MVP).
 * 공개 페이지: 로그인·멤버십 게이트 없이 접근 가능하되 개인 데이터는 쓰지 않는다.
 * 모든 상태는 브라우저 localStorage('kindy:world') 한 벌 — 프로덕션 노출 대비 안전.
 */
export const metadata: Metadata = {
  title: '이야기 지도 — Kindy',
  description: '아바타를 만들고 지도를 탐험하며 다음 이야기를 발견하는 RPG 데모.',
  robots: { index: false, follow: false },
};

export default function WorldPage() {
  if (isLaunchSurfaceClosed('/world', process.env)) {
    notFound();
  }

  return <WorldClient />;
}
