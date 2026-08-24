import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import IslandView from '@/components/island/IslandView';
import { isLaunchSurfaceClosed } from '@/lib/launch-surface';

/**
 * /island — 이야기 등대섬 RPG 데모 (docs/plan/11 I1).
 * 공개 페이지: 로그인·멤버십 게이트 없이 접근 가능하되 개인 데이터는 쓰지 않는다.
 * 모든 상태는 브라우저 localStorage('kindy:island' + 아바타는 'kindy:world').
 */
export const metadata: Metadata = {
  title: '이야기 등대섬 — Kindy',
  description: '아바타로 등대섬을 거닐고 표류병 편지로 이야기를 시작하는 RPG 데모.',
  robots: { index: false, follow: false },
};

export default function IslandPage() {
  if (isLaunchSurfaceClosed('/island', process.env)) {
    notFound();
  }

  return <IslandView />;
}
