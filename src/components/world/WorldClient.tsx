'use client';

import { useEffect, useState } from 'react';
import AvatarCreator from '@/components/world/AvatarCreator';
import StoryMap from '@/components/world/StoryMap';
import {
  DEFAULT_AVATAR,
  readWorld,
  saveAvatar,
  type AvatarConfig,
  type WorldSave,
} from '@/lib/world/world-state';

/**
 * /world 진입 오케스트레이터 — 마운트 후 localStorage('kindy:world')를 읽어
 * 아바타가 없으면 만들기 화면, 있으면 지도. 공개 페이지(회원 게이트 없음),
 * 개인 데이터는 저장하지 않는다(docs/plan/10 §5, 데모용 브라우저 상태만).
 * localStorage 는 마운트 effect 에서만 읽어 SSR 하이드레이션 불일치를 피한다.
 */
type Mode = 'loading' | 'create' | 'map';

export default function WorldClient() {
  const [save, setSave] = useState<WorldSave | null>(null);
  const [mode, setMode] = useState<Mode>('loading');

  // SSR 하이드레이션 안전: 서버·첫 클라이언트 렌더 모두 'loading' 으로 시작하고,
  // 마운트 후 setTimeout(0) 으로 localStorage 를 반영한다(effect 본문 동기 setState 회피).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = readWorld();
      setSave(current);
      setMode(current.avatar ? 'map' : 'create');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (mode === 'loading' || !save) {
    return (
      <main className="grid min-h-[100svh] place-items-center bg-cream text-ink">
        <p className="text-sm font-black tracking-[0.3em] text-ink3">이야기 지도 여는 중…</p>
      </main>
    );
  }

  const handleDone = (avatar: AvatarConfig) => {
    setSave(saveAvatar(avatar));
    setMode('map');
  };

  if (mode === 'create') {
    return (
      <AvatarCreator
        initial={save.avatar ?? DEFAULT_AVATAR}
        isFirst={!save.avatar}
        onDone={handleDone}
        onBack={save.avatar ? () => setMode('map') : undefined}
      />
    );
  }

  return (
    <StoryMap
      avatar={save.avatar ?? DEFAULT_AVATAR}
      save={save}
      onEditAvatar={() => setMode('create')}
    />
  );
}
