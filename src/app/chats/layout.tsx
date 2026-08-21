import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '세계관 대화 — Kindy',
  description: '새로운 세계의 초대장을 받고, 캐릭터와 대화하며 이야기에 참여하는 Kindy 웹 파일럿.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#FBF7EF',
  viewportFit: 'cover',
};

export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
