'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GLASS_LIGHT, GLASS_PILL } from '@/components/ui/glass';
import { prefersReducedMotion } from '@/lib/juice';
import { BODY_COLORS, readWorld } from '@/lib/world/world-state';
import {
  FURNITURE,
  SEURAT_LESSON_ID,
  lighthouseLevel,
  needsCelebration,
  readIsland,
  withBottleOpened,
  withCelebrated,
  withPlaced,
  withReward,
  writeIsland,
  type FurnitureId,
  type IslandSave,
} from '@/lib/island/island-state';
import { createIslandGame, type IslandGameHandle } from '@/components/island/island-game';

/**
 * 등대섬 클라이언트 (docs/plan/11 I1) — Phaser 씬 부팅 + 글라스 오버레이 UI.
 * 표류병 탭 → NPC 카드 → /lesson/seurat-01. 완료(kindy:world) 감지 시 등대 점등 +
 * 이야기 조각 3개 지급 → 꾸미기 모드. 상태는 localStorage 'kindy:island'.
 * dynamic ssr:false 경계 안에서만 로드된다(IslandView).
 */

function avatarTintFromWorld(bodyId: string | undefined): number | null {
  if (!bodyId) return null;
  const color = BODY_COLORS.find((c) => c.id === bodyId);
  if (!color) return null;
  return parseInt(color.light.slice(1), 16);
}

export default function IslandClient() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<IslandGameHandle | null>(null);
  const cellTapRef = useRef<(gx: number, gy: number) => void>(() => {});

  const [save, setSave] = useState<IslandSave | null>(null);
  const [mode, setMode] = useState<'explore' | 'decorate'>('explore');
  const [selected, setSelected] = useState<FurnitureId | null>(null);
  const [npcOpen, setNpcOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // Phaser 부팅(1회). localStorage 읽기·보상 지급은 여기서, React state 반영은 setTimeout(0)
  // 으로 미뤄 effect 본문 동기 setState 를 피한다(하이드레이션·lint 안전).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const world = readWorld();
    let island = readIsland();
    // 보상 지급(멱등, claimed 로 가드). 축하 연출은 celebrated 마커로 별도 판단해
    // React Strict Mode 이중 마운트에도 정확히 1회만 연출된다.
    if (world.completed.includes(SEURAT_LESSON_ID) && !island.claimed.includes(SEURAT_LESSON_ID)) {
      island = withReward(island, SEURAT_LESSON_ID);
      writeIsland(island);
    }
    const celebrate = needsCelebration(island, SEURAT_LESSON_ID);

    const handle = createIslandGame(el, {
      avatarTint: avatarTintFromWorld(world.avatar?.body),
      initialPlaced: island.placed,
      initialLevel: lighthouseLevel(island),
      reducedMotion: prefersReducedMotion(),
      onBottleTap: () => setNpcOpen(true),
      onCellTap: (gx, gy) => cellTapRef.current(gx, gy),
      onReady: () => {
        if (!celebrate) return;
        handle.celebrate();
        setMode('decorate');
        setBanner('등대에 불이 켜졌어요! 이야기 조각 3개를 받았어요 ✨');
        const marked = withCelebrated(readIsland(), SEURAT_LESSON_ID);
        writeIsland(marked);
        setSave(marked);
      },
    });
    handleRef.current = handle;

    const t = window.setTimeout(() => setSave(island), 0);
    return () => {
      window.clearTimeout(t);
      handle.destroy();
      handleRef.current = null;
    };
  }, []);

  // 최신 상태를 참조하는 격자 탭 처리기(부팅 클로저가 항상 최신을 보도록 ref 로).
  useEffect(() => {
    cellTapRef.current = (gx, gy) => {
      if (mode !== 'decorate' || !selected || !save) return;
      const next = withPlaced(save, selected, gx, gy);
      if (next === save) return; // 조각 0 또는 이미 점유
      writeIsland(next);
      setSave(next);
    };
  });

  // React 상태 → Phaser 반영.
  useEffect(() => {
    handleRef.current?.setMode(mode);
  }, [mode]);
  useEffect(() => {
    if (save) handleRef.current?.renderPlaced(save.placed);
  }, [save]);

  // 배너 자동 사라짐.
  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 3800);
    return () => window.clearTimeout(t);
  }, [banner]);

  const startStory = useCallback(() => {
    if (save) {
      const next = withBottleOpened(save, 'seurat-bottle');
      writeIsland(next);
      setSave(next);
    }
    router.push(`/lesson/${SEURAT_LESSON_ID}`);
  }, [router, save]);

  const pieces = save?.pieces ?? 0;

  return (
    <main className="relative h-[100svh] w-full overflow-hidden bg-[#5aa9cc] text-ink [word-break:keep-all]">
      <div ref={containerRef} className="absolute inset-0" />

      {/* HUD */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
        <span className={`${GLASS_PILL} pointer-events-auto px-4 py-2 text-sm font-black text-saged`}>
          🧩 이야기 조각 {pieces}
        </span>
        <button
          onClick={() => setMode((m) => (m === 'decorate' ? 'explore' : 'decorate'))}
          className={`${GLASS_PILL} pointer-events-auto px-4 py-2 text-sm font-black text-ink`}
        >
          {mode === 'decorate' ? '완료' : '꾸미기'}
        </button>
      </header>

      {/* 점등·보상 배너 */}
      {banner && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center px-6" aria-live="polite">
          <p className={`${GLASS_PILL} px-4 py-2 text-center text-sm font-black text-ink`}>{banner}</p>
        </div>
      )}

      {/* 꾸미기 툴바 */}
      {mode === 'decorate' && (
        <div className="absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className={`${GLASS_LIGHT} px-4 py-4`}>
            <p className="mb-2 text-center text-sm font-black text-ink2">
              {pieces > 0 ? '가구를 고르고 오두막 옆 칸을 톡 눌러요' : '이야기를 더 모으면 더 꾸밀 수 있어요'}
            </p>
            <div className="flex justify-center gap-2">
              {FURNITURE.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelected((s) => (s === f.id ? null : f.id))}
                  aria-pressed={selected === f.id}
                  aria-label={f.label}
                  disabled={pieces <= 0}
                  className={`flex h-14 w-14 flex-col items-center justify-center rounded-2xl border-2 text-2xl transition active:scale-95 disabled:opacity-40 ${
                    selected === f.id ? 'border-gold bg-white shadow-sm' : 'border-line bg-white/60'
                  }`}
                >
                  <span>{f.emoji}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* NPC 표류병 카드 */}
      {npcOpen && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className={`${GLASS_LIGHT} world-rise relative w-full max-w-md px-6 py-6`}>
            <button
              onClick={() => setNpcOpen(false)}
              aria-label="닫기"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/70 text-lg font-black text-ink2"
            >
              ×
            </button>
            <p className="text-xs font-black tracking-[0.2em] text-sage">그림 섬 · 쇠라의 강가</p>
            <h2 className="mt-1 text-2xl font-black">낚시하는 여인이 편지를 보냈어!</h2>
            <p className="mt-3 text-pretty text-base font-bold leading-relaxed text-ink2">
              “점으로 그린 강가로 놀러 오지 않을래? 재미있는 이야기가 기다리고 있어.”
            </p>
            <button
              onClick={startStory}
              className="mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-ink text-lg font-black text-cream transition active:scale-[0.98]"
            >
              이야기 보러 가기
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
