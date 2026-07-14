'use client';

import dynamic from 'next/dynamic';

/**
 * /island 클라이언트 경계 — Phaser 는 SSR 불가라 next/dynamic(ssr:false)로 로드한다.
 * (ssr:false 는 클라이언트 컴포넌트에서만 허용되므로 이 얇은 래퍼가 경계 역할.)
 */
const IslandClient = dynamic(() => import('@/components/island/IslandClient'), {
  ssr: false,
  loading: () => (
    <main className="grid h-[100svh] place-items-center bg-[#5aa9cc] text-white">
      <p className="text-sm font-black tracking-[0.3em]">등대섬으로 가는 중…</p>
    </main>
  ),
});

export default function IslandView() {
  return <IslandClient />;
}
