'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { prefersReducedMotion } from '@/lib/juice';
import { readWorld } from '@/lib/world/world-state';
import {
  FURNITURE,
  SEURAT_BOTTLE_ID,
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
import { propCatalogIconStyle } from '@/components/island/props';

/**
 * 등대섬 클라이언트 (docs/plan/11 I1) — Phaser 씬 + 팩 팔레트 기반 도트 HUD.
 * 표류병 탭 → NPC 카드 → /lesson/seurat-01. 완료(kindy:world) 감지 시 등대 점등 +
 * 이야기 조각 3개 지급 → 꾸미기 모드. 상태는 localStorage 'kindy:island'.
 * dynamic ssr:false 경계 안에서만 로드된다(IslandView).
 */

const NPC_DIALOGUE = '점으로 그린 강가로 놀러 오지 않을래? 재미있는 이야기가 기다리고 있어.';
const LIGHTHOUSE_GAUGE_STEPS = 3;
const TYPING_INTERVAL_MS = 34;
const TRANSITION_MS = 620;
const REDUCED_TRANSITION_MS = 160;
const LIGHTHOUSE_ICON_FRAME = FURNITURE.find((furniture) => furniture.id === 'lamp')?.emoji;

// t7-premium-upgrade에서 유료 팩의 검증된 실프레임 키로 채움.
const RESERVED_PACK_FRAMES: Readonly<Record<'fisherwoman' | 'boat', string | null>> = {
  fisherwoman: null,
  boat: null,
};

interface ReservedPackSpriteProps {
  frame: string | null;
  fallback: string;
}

function ReservedPackSprite({ frame, fallback }: ReservedPackSpriteProps) {
  const style = frame ? propCatalogIconStyle(frame) : undefined;

  return style ? (
    <span aria-hidden className="dot-pack-sprite" style={style} />
  ) : (
    <span aria-hidden className="dot-sprite-fallback">{fallback}</span>
  );
}

export default function IslandClient() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<IslandGameHandle | null>(null);
  const cellTapRef = useRef<(gx: number, gy: number) => void>(() => {});
  const reducedMotionRef = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const transitioningRef = useRef(false);

  const [save, setSave] = useState<IslandSave | null>(null);
  const [mode, setMode] = useState<'explore' | 'decorate'>('explore');
  const [selected, setSelected] = useState<FurnitureId | null>(null);
  const [npcOpen, setNpcOpen] = useState(false);
  const [dialogueLength, setDialogueLength] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const openNpc = useCallback(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDialogueLength(reducedMotionRef.current ? NPC_DIALOGUE.length : 0);
    setNpcOpen(true);
  }, []);

  const closeNpc = useCallback(() => {
    setNpcOpen(false);
    window.requestAnimationFrame(() => {
      const target = returnFocusRef.current;
      if (target?.isConnected && target !== document.body) {
        target.focus();
        return;
      }
      containerRef.current?.focus();
    });
  }, []);

  // 모션 선호는 ref에 반영해 런타임 토글이 Phaser 재부팅을 일으키지 않게 한다.
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => {
      reducedMotionRef.current = query.matches;
    };
    updatePreference();
    query.addEventListener('change', updatePreference);
    return () => query.removeEventListener('change', updatePreference);
  }, []);

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

    let handle: IslandGameHandle | null = null;
    handle = createIslandGame(el, {
      avatarBody: world.avatar?.body ?? null,
      initialPlaced: island.placed,
      initialLevel: lighthouseLevel(island),
      reducedMotion: prefersReducedMotion(),
      onBottleTap: openNpc,
      onCellTap: (gx, gy) => cellTapRef.current(gx, gy),
      onReady: () => {
        if (!celebrate) return;
        handle?.celebrate();
        setMode('decorate');
        setBanner('등대 불빛이 켜졌어요! 이야기 조각 3개가 왔어요.');
        const marked = withCelebrated(readIsland(), SEURAT_LESSON_ID);
        writeIsland(marked);
        setSave(marked);
      },
    });
    handleRef.current = handle;

    const initialStateTimer = window.setTimeout(() => setSave(readIsland()), 0);
    return () => {
      window.clearTimeout(initialStateTimer);
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
      handle?.destroy();
      handleRef.current = null;
    };
  }, [openNpc]);

  // 최신 상태를 참조하는 격자 탭 처리기(부팅 클로저가 항상 최신을 보도록 ref 로).
  useEffect(() => {
    cellTapRef.current = (gx, gy) => {
      if (mode !== 'decorate' || !selected || !save) return;
      const next = withPlaced(save, selected, gx, gy);
      if (next === save) return; // 조각 0 또는 이미 점유
      writeIsland(next);
      setSave(next);
      if (next.pieces === 0) setSelected(null);
    };
  });

  // React 상태 → Phaser 반영.
  useEffect(() => {
    handleRef.current?.setMode(mode);
  }, [mode]);
  useEffect(() => {
    if (!save) return;
    handleRef.current?.renderPlaced(save.placed);
    handleRef.current?.setLighthouse(lighthouseLevel(save));
  }, [save]);

  // 배너 자동 사라짐. 보상 자체는 저장되어 사라지지 않는다.
  useEffect(() => {
    if (!banner) return;
    const bannerTimer = window.setTimeout(() => setBanner(null), 3800);
    return () => window.clearTimeout(bannerTimer);
  }, [banner]);

  // 시각 타이핑만 진행하고, 스크린리더에는 완성된 대사를 한 번에 제공한다.
  useEffect(() => {
    if (!npcOpen || dialogueLength >= NPC_DIALOGUE.length) return;
    const typingTimer = window.setInterval(() => {
      setDialogueLength((length) =>
        reducedMotionRef.current ? NPC_DIALOGUE.length : Math.min(length + 1, NPC_DIALOGUE.length),
      );
    }, TYPING_INTERVAL_MS);
    return () => window.clearInterval(typingTimer);
  }, [dialogueLength, npcOpen]);

  // 모달의 Tab 순환과 Escape 닫기. 닫을 때는 표류병을 탭하기 전 포커스로 복귀한다.
  useEffect(() => {
    if (!npcOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeNpc();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeNpc, npcOpen]);

  const startStory = useCallback(() => {
    if (transitioningRef.current || !save) return;
    transitioningRef.current = true;

    const next = withBottleOpened(save, SEURAT_BOTTLE_ID);
    writeIsland(next);
    setSave(next);
    setNpcOpen(false);
    setIsTransitioning(true);

    const delay = reducedMotionRef.current ? REDUCED_TRANSITION_MS : TRANSITION_MS;
    transitionTimeoutRef.current = window.setTimeout(() => {
      router.push(`/lesson/${SEURAT_LESSON_ID}`);
    }, delay);
  }, [router, save]);

  const toggleMode = () => {
    if (!save || isTransitioning) return;
    if (mode === 'decorate') {
      setSelected(null);
      setMode('explore');
      return;
    }
    setMode('decorate');
  };

  const pieces = save?.pieces ?? 0;
  const lightLevel = save ? lighthouseLevel(save) : 0;
  const selectedFurniture = FURNITURE.find((furniture) => furniture.id === selected);
  const isBlocked = npcOpen || isTransitioning;
  const toolbarMessage = !save
    ? '섬을 불러오고 있어요'
    : pieces === 0
      ? '이야기를 만나면 꾸밀 조각이 와요'
      : selectedFurniture
        ? `${selectedFurniture.label}을 골랐어요. 반짝이는 칸을 톡 눌러요`
        : '마음에 드는 가구를 골라요';

  return (
    <main className="dot-shell relative h-[100svh] w-full overflow-hidden bg-sagebg text-ink [word-break:keep-all]">
      <div
        className="absolute inset-0"
        inert={isBlocked ? true : undefined}
        aria-hidden={isBlocked ? true : undefined}
      >
        <div ref={containerRef} tabIndex={-1} className="absolute inset-0 outline-none" />

        <header className="dot-safe-top pointer-events-none absolute inset-x-0 top-0 z-20 mx-auto w-full max-w-md px-3">
          <div className="dot-panel dot-hud pointer-events-auto flex items-center gap-2 p-2">
            <section className="flex min-w-0 flex-1 items-center gap-2" aria-label={`등대 불빛 ${lightLevel}단계`}>
              <span className="dot-icon-slot shrink-0" aria-hidden>
                {LIGHTHOUSE_ICON_FRAME ? <span style={propCatalogIconStyle(LIGHTHOUSE_ICON_FRAME)} /> : <span>불빛</span>}
              </span>
              <div className="min-w-0 flex-1">
                <p className="dot-label truncate">등대 불빛</p>
                <div className="dot-gauge mt-1" aria-hidden>
                  {Array.from({ length: LIGHTHOUSE_GAUGE_STEPS }, (_, index) => (
                    <span key={index} data-lit={index < lightLevel} />
                  ))}
                </div>
                <p className="mt-1 text-xs font-black" aria-live="polite">
                  {save ? `${lightLevel}단계` : '불러오는 중'}
                </p>
              </div>
            </section>

            <div className="dot-counter shrink-0 text-center" aria-label={`이야기 조각 ${pieces}개`}>
              <span className="dot-label block">조각</span>
              <strong className="block text-xl leading-none" aria-live="polite">
                {save ? pieces : '—'}
              </strong>
            </div>

            <button
              type="button"
              onClick={toggleMode}
              aria-pressed={mode === 'decorate'}
              disabled={!save || isTransitioning}
              className="dot-button dot-mode-button min-h-14 shrink-0 px-3 text-sm font-black"
            >
              {mode === 'decorate' ? '완료' : '꾸미기'}
            </button>
          </div>
        </header>

        {banner && (
          <div className="dot-banner-layer pointer-events-none absolute inset-x-0 z-30 flex justify-center px-6">
            <p className="dot-panel dot-toast px-4 py-3 text-center text-sm font-black" role="status" aria-live="polite">
              {banner}
            </p>
          </div>
        )}

        {mode === 'decorate' && (
          <section
            className="dot-safe-bottom absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-3"
            aria-labelledby="decorate-title"
          >
            <div className="dot-panel dot-toolbar p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="decorate-title" className="text-base font-black">
                  내 오두막 꾸미기
                </h2>
                <p className="dot-label shrink-0">조각 하나로 하나</p>
              </div>
              <p id="decorate-help" className="mb-3 text-sm font-bold text-ink2" aria-live="polite">
                {toolbarMessage}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {FURNITURE.map((furniture) => {
                  const iconStyle = propCatalogIconStyle(furniture.emoji);
                  return (
                    <button
                      type="button"
                      key={furniture.id}
                      onClick={() => setSelected((current) => (current === furniture.id ? null : furniture.id))}
                      aria-pressed={selected === furniture.id}
                      aria-label={furniture.label}
                      aria-describedby="decorate-help"
                      disabled={!save || pieces <= 0 || isTransitioning}
                      className="dot-button dot-tool-button flex min-h-14 items-center justify-center"
                    >
                      {iconStyle ? (
                        <span aria-hidden className="dot-pack-sprite" style={iconStyle} />
                      ) : (
                        <span aria-hidden className="dot-sprite-fallback">{furniture.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>

      {npcOpen && (
        <div className="dot-scrim absolute inset-0 z-40 flex items-end justify-center px-3 dot-safe-bottom">
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="npc-title"
            aria-describedby="npc-dialogue-full"
            tabIndex={-1}
            className="dot-panel dot-dialog relative w-full max-w-md p-5 outline-none"
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeNpc}
              aria-label="편지 닫기"
              className="dot-button dot-close-button absolute right-3 top-3 grid min-h-12 min-w-12 place-items-center text-xl font-black"
            >
              ×
            </button>

            <div className="flex items-start gap-4 pr-12">
              <figure className="dot-portrait flex shrink-0 items-center justify-center text-center" aria-label="낚시하는 여인 초상">
                <ReservedPackSprite frame={RESERVED_PACK_FRAMES.fisherwoman} fallback="낚시하는 여인" />
              </figure>
              <div className="min-w-0 pt-1">
                <p className="dot-label">그림 섬 · 쇠라의 강가</p>
                <h2 id="npc-title" className="mt-1 text-xl font-black leading-snug">
                  낚시하는 여인의 편지
                </h2>
              </div>
            </div>

            <div className="dot-dialogue mt-4 min-h-24 p-4 text-base font-bold leading-relaxed text-ink2" aria-hidden>
              “{NPC_DIALOGUE.slice(0, dialogueLength)}
              {dialogueLength < NPC_DIALOGUE.length && <span className="dot-caret" />}”
            </div>
            <p id="npc-dialogue-full" className="sr-only">
              {NPC_DIALOGUE}
            </p>

            <button
              type="button"
              onClick={startStory}
              disabled={!save || isTransitioning}
              className="dot-button dot-primary-button mt-4 inline-flex min-h-14 w-full items-center justify-center px-6 text-lg font-black"
            >
              이야기 보러 가기
            </button>
          </section>
        </div>
      )}

      {isTransitioning && (
        <div
          className="dot-transition absolute inset-0 z-50 grid place-items-center px-6 text-center"
          role="status"
          aria-live="polite"
          aria-label="그림 섬으로 가는 중"
        >
          <div className="dot-transition-content">
            <div className="dot-boat-slot mx-auto flex items-center justify-center" aria-hidden>
              <ReservedPackSprite frame={RESERVED_PACK_FRAMES.boat} fallback="배" />
            </div>
            <p className="mt-4 text-xl font-black">그림 섬으로 가요</p>
          </div>
        </div>
      )}
    </main>
  );
}
