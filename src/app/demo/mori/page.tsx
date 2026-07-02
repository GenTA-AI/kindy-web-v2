import type { Metadata } from 'next';
import MoriDemoJourney from './MoriDemoJourney';

export const metadata: Metadata = {
  title: 'Kindy Mori 모리 별빛 미리보기',
  description: '모리 이야기를 보고 아이가 고른 작은 씨앗을 따뜻하게 이어 봅니다.',
};

export default function MoriDemoPage() {
  return <MoriDemoJourney />;
}
