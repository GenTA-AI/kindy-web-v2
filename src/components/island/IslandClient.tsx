'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { prefersReducedMotion } from '@/lib/juice';
import {
  DEFAULT_AVATAR,
  readWorld,
  saveAvatar,
  type AvatarConfig,
} from '@/lib/world/world-state';
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
import { guidanceTargetForSave, propCatalogIconStyle } from '@/components/island/props';
import { atlasFrameName, atlasFrameStyle, type IslandAtlasName } from '@/components/island/atlas-frames';
import {
  PACK_HATS,
  PACK_SHIRTS,
  packAvatarFrames,
  selectedPackHat,
  withPackHat,
  withPackShirt,
} from '@/components/island/avatar-parts';
import {
  ISLAND_AUDIO_MUTED_STORAGE_KEY,
  createIslandAudio,
  type IslandAudioController,
} from '@/components/island/island-audio';

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
const ONBOARDING_STORAGE_KEY = 'kindy:island-onboarded';
const LIGHTHOUSE_ICON_FRAME = FURNITURE.find((furniture) => furniture.id === 'lamp')?.emoji;
const PACK_TILE = 16;
const AVATAR_PARTS_IMAGE_URL = '/island/tiles/avatar-parts.png';

const PREMIUM_PACK_FRAMES = {
  fisherwoman: atlasFrameName('fisherwoman', 0, 0),
  boat: { prefix: 'boat', rows: 3, columns: 3 },
};

interface AtlasSpriteProps {
  atlas: IslandAtlasName;
  frame: string;
  scale?: number;
}

function AtlasSprite({ atlas, frame, scale = 1 }: AtlasSpriteProps) {
  const style = atlasFrameStyle(atlas, frame, scale);
  return style ? <span aria-hidden className="dot-pack-sprite" style={style} /> : null;
}

interface PackStampProps {
  prefix: string;
  startRow?: number;
  startColumn?: number;
  rows: number;
  columns: number;
  scale?: number;
}

function PackStamp({
  prefix,
  startRow = 0,
  startColumn = 0,
  rows,
  columns,
  scale = 1,
}: PackStampProps) {
  const frames = Array.from({ length: rows * columns }, (_, index) => {
    const row = startRow + Math.floor(index / columns);
    const column = startColumn + (index % columns);
    return atlasFrameName(prefix, row, column);
  });

  return (
    <span
      aria-hidden
      className="dot-pack-stamp"
      style={{
        gridTemplateColumns: `repeat(${columns}, ${PACK_TILE * scale}px)`,
        width: columns * PACK_TILE * scale,
        height: rows * PACK_TILE * scale,
      }}
    >
      {frames.map((frame) => (
        <AtlasSprite key={frame} atlas="props" frame={frame} scale={scale} />
      ))}
    </span>
  );
}

function AvatarPreview({ avatar, scale = 2 }: { avatar: AvatarConfig; scale?: number }) {
  const frames = packAvatarFrames(avatar, 'down', 0);
  const size = 64 * scale;
  return (
    <span aria-hidden className="dot-avatar-preview" style={{ width: size, height: size }}>
      {frames.map((frame) => (
        <AtlasSprite key={frame} atlas="avatar-parts" frame={frame} scale={scale} />
      ))}
    </span>
  );
}

function WardrobeStatusIcon({ status }: { status: 'error' | 'loading' }) {
  return (
    <svg aria-hidden="true" className="dot-hud-symbol" viewBox="0 0 64 64" fill="none">
      <path d="M25 17c0-5 3-8 7-8s7 3 7 7c0 4-3 6-7 8" />
      <path d="M32 24 10 42v7h44v-7L32 24Z" />
      {status === 'loading' ? (
        <>
          <rect x="18" y="53" width="5" height="5" fill="currentColor" stroke="none" />
          <rect x="30" y="53" width="5" height="5" fill="currentColor" stroke="none" />
          <rect x="42" y="53" width="5" height="5" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <path d="M43 35a12 12 0 0 1 4 9" />
          <path d="m43 43 4 4 4-4" />
        </>
      )}
    </svg>
  );
}

function ModeIcon({ mode }: { mode: 'decorate' | 'explore' }) {
  return (
    <svg aria-hidden="true" className="dot-hud-symbol dot-mode-symbol" viewBox="0 0 64 64" fill="none">
      {mode === 'decorate' ? (
        <>
          <path d="M10 34 25 49 55 16" />
          <path d="M13 14h12M13 22h7" />
        </>
      ) : (
        <>
          <path d="m14 43 7 7 28-28-7-7-28 28Z" />
          <path d="m37 20 7 7M11 53l10-3-7-7-3 10Z" />
          <path d="M15 14v10M10 19h10M48 39v12M42 45h12" />
        </>
      )}
    </svg>
  );
}

function ToolbarGuideIcon({ state }: { state: 'choose' | 'empty' | 'loading' | 'place' }) {
  return (
    <svg aria-hidden="true" className="dot-guide-symbol" viewBox="0 0 96 48" fill="none">
      {state === 'loading' && (
        <>
          <path d="M20 34V18l12-9 12 9v16H20Z" />
          <rect x="54" y="21" width="6" height="6" fill="currentColor" stroke="none" />
          <rect x="66" y="21" width="6" height="6" fill="currentColor" stroke="none" />
          <rect x="78" y="21" width="6" height="6" fill="currentColor" stroke="none" />
        </>
      )}
      {state === 'empty' && (
        <>
          <path d="m35 8 8 7-5 6 8 14-7 7H21l-7-7 8-14-5-6 8-7h10Z" />
          <path d="M56 12v12M50 18h12M74 26v12M68 32h12" />
        </>
      )}
      {state === 'choose' && (
        <>
          <path d="M12 35V20h20v15M18 20v-8h8v8M40 35V14h20v21M48 14V8h5v6M68 35V22h16v13" />
          <path d="M8 40h80" />
          <path d="M76 8v8M72 12h8" />
        </>
      )}
      {state === 'place' && (
        <>
          <path d="M12 11h34v26H12zM29 11v26M12 24h34" />
          <path d="M69 14v18M60 23h18" />
          <path d="M58 38c0-7 5-12 12-12s12 5 12 12" />
        </>
      )}
    </svg>
  );
}

export default function IslandClient() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<IslandGameHandle | null>(null);
  const cellTapRef = useRef<(gx: number, gy: number) => void>(() => {});
  const reducedMotionRef = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);
  const avatarDialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const avatarCloseButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const transitioningRef = useRef(false);
  const audioRef = useRef<IslandAudioController | null>(null);

  const [save, setSave] = useState<IslandSave | null>(null);
  const [mode, setMode] = useState<'explore' | 'decorate'>('explore');
  const [selected, setSelected] = useState<FurnitureId | null>(null);
  const [npcOpen, setNpcOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatar, setAvatar] = useState<AvatarConfig | null>(null);
  const [avatarAtlasStatus, setAvatarAtlasStatus] = useState<'error' | 'loading' | 'ready'>('loading');
  const [avatarAtlasAttempt, setAvatarAtlasAttempt] = useState(0);
  const [dialogueLength, setDialogueLength] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [muted, setMuted] = useState(true);

  const dismissOnboarding = useCallback(() => {
    if (!showOnboarding) return;
    setShowOnboarding(false);
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    } catch {
      // 저장소가 막혀도 현재 방문의 힌트는 첫 탭에 사라진다.
    }
  }, [showOnboarding]);

  const openNpc = useCallback(() => {
    audioRef.current?.play('island-letter-sfx-island-audio');
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

  const openAvatar = useCallback(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAvatarOpen(true);
  }, []);

  const closeAvatar = useCallback(() => {
    setAvatarOpen(false);
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
      audioRef.current?.setReducedMotion(query.matches);
    };
    updatePreference();
    query.addEventListener('change', updatePreference);
    return () => query.removeEventListener('change', updatePreference);
  }, []);

  // 오디오는 island-state와 분리된 사용자 선호만 읽으며, 실제 AudioContext는 첫 제스처까지 만들지 않는다.
  useEffect(() => {
    let initialMuted = true;
    try {
      initialMuted = window.localStorage.getItem(ISLAND_AUDIO_MUTED_STORAGE_KEY) !== '0';
    } catch {
      // 저장소가 막히면 안전한 기본값(음소거)을 유지한다.
    }
    const audio = createIslandAudio({ muted: initialMuted, reducedMotion: reducedMotionRef.current });
    audioRef.current = audio;
    const preferenceTimer = window.setTimeout(() => setMuted(initialMuted), 0);
    const onVisibilityChange = () => audio.setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearTimeout(preferenceTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      audio.destroy();
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, []);

  // 별도 키만 읽어 island-state 정규화·스키마와 온보딩 연출을 분리한다.
  useEffect(() => {
    const onboardingTimer = window.setTimeout(() => {
      try {
        setShowOnboarding(window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== '1');
      } catch {
        setShowOnboarding(true);
      }
    }, 0);
    return () => window.clearTimeout(onboardingTimer);
  }, []);

  useEffect(() => {
    let active = true;
    const image = new window.Image();
    image.onload = () => {
      if (active) setAvatarAtlasStatus('ready');
    };
    image.onerror = () => {
      if (active) setAvatarAtlasStatus('error');
    };
    image.src = avatarAtlasAttempt === 0
      ? AVATAR_PARTS_IMAGE_URL
      : `${AVATAR_PARTS_IMAGE_URL}?retry=${avatarAtlasAttempt}`;
    return () => {
      active = false;
    };
  }, [avatarAtlasAttempt]);

  // Phaser 부팅(1회). localStorage 읽기·보상 지급은 여기서, React state 반영은 setTimeout(0)
  // 으로 미뤄 effect 본문 동기 setState 를 피한다(하이드레이션·lint 안전).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const world = readWorld();
    const worldAvatar = world.avatar ?? DEFAULT_AVATAR;
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
      avatar: worldAvatar,
      initialPlaced: island.placed,
      initialLevel: lighthouseLevel(island),
      initialGuidanceTarget: guidanceTargetForSave(island),
      reducedMotion: prefersReducedMotion(),
      onBottleTap: openNpc,
      onCellTap: (gx, gy) => cellTapRef.current(gx, gy),
      onReady: () => {
        if (!celebrate) return;
        handle?.celebrate();
        audioRef.current?.play('island-lighthouse-sfx-island-audio');
        setMode('decorate');
        setBanner('등대 불빛이 켜졌어요! 이야기 조각 3개가 왔어요.');
        const marked = withCelebrated(readIsland(), SEURAT_LESSON_ID);
        writeIsland(marked);
        setSave(marked);
      },
    });
    handleRef.current = handle;

    const initialStateTimer = window.setTimeout(() => {
      setSave(readIsland());
      setAvatar(worldAvatar);
    }, 0);
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
      audioRef.current?.play('island-place-sfx-island-audio');
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
    handleRef.current?.setGuidanceTarget(guidanceTargetForSave(save));
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

  useEffect(() => {
    if (!avatarOpen) return;
    const dialog = avatarDialogRef.current;
    if (!dialog) return;

    avatarCloseButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAvatar();
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
  }, [avatarOpen, closeAvatar]);

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

  const applyAvatar = useCallback((next: AvatarConfig) => {
    saveAvatar(next);
    setAvatar(next);
    handleRef.current?.setAvatar(next);
  }, []);

  const retryAvatarAtlas = () => {
    setAvatarAtlasStatus('loading');
    setAvatarAtlasAttempt((attempt) => attempt + 1);
  };

  const toggleMode = () => {
    if (!save || isTransitioning) return;
    if (mode === 'decorate') {
      setSelected(null);
      setMode('explore');
      return;
    }
    setMode('decorate');
  };

  const handleFirstGesture = () => {
    dismissOnboarding();
    audioRef.current?.unlock();
  };

  const toggleSound = () => {
    const nextMuted = !muted;
    audioRef.current?.unlock();
    audioRef.current?.setMuted(nextMuted);
    setMuted(nextMuted);
    try {
      window.localStorage.setItem(ISLAND_AUDIO_MUTED_STORAGE_KEY, nextMuted ? '1' : '0');
    } catch {
      // 저장소가 막혀도 현재 방문의 토글은 그대로 동작한다.
    }
  };

  const pieces = save?.pieces ?? 0;
  const lightLevel = save ? lighthouseLevel(save) : 0;
  const selectedFurniture = FURNITURE.find((furniture) => furniture.id === selected);
  const isBlocked = npcOpen || avatarOpen || isTransitioning;
  const toolbarMessage = !save
    ? '섬을 불러오고 있어요'
    : pieces === 0
      ? '이야기를 만나면 꾸밀 조각이 와요'
      : selectedFurniture
        ? `${selectedFurniture.label}을 골랐어요. 반짝이는 칸을 톡 눌러요`
        : '마음에 드는 가구를 골라요';
  const toolbarState = !save ? 'loading' : pieces === 0 ? 'empty' : selectedFurniture ? 'place' : 'choose';
  const avatarButtonLabel = !avatar || avatarAtlasStatus === 'loading'
    ? '옷 그림 준비 중'
    : avatarAtlasStatus === 'error'
      ? '옷 그림 다시 준비하기'
      : '내 캐릭터 꾸미기';
  const modeButtonLabel = mode === 'decorate' ? '꾸미기 마치기' : '내 오두막 꾸미기';

  return (
    <main
      className="dot-shell relative h-[100svh] w-full overflow-hidden bg-sagebg text-ink [word-break:keep-all]"
      onPointerDownCapture={handleFirstGesture}
    >
      <style>{`
        .dot-hud-status {
          min-width: 0;
        }

        .dot-hud-action {
          width: calc(var(--spacing) * 30);
          height: calc(var(--spacing) * 30);
          padding: calc(var(--spacing) * 2);
        }

        .dot-hud-symbol {
          width: calc(var(--spacing) * 16);
          height: calc(var(--spacing) * 16);
          stroke: currentColor;
          stroke-width: 4;
          stroke-linecap: square;
          stroke-linejoin: miter;
        }

        .dot-mode-symbol {
          stroke-width: 5;
        }

        .dot-toolbar-guide {
          display: grid;
          min-height: calc(var(--spacing) * 14);
          place-items: center;
          border: calc(var(--spacing) * 0.5) solid var(--color-line);
          background: color-mix(in srgb, var(--color-surface) 82%, var(--color-sagebg));
        }

        .dot-guide-symbol {
          width: calc(var(--spacing) * 24);
          height: calc(var(--spacing) * 12);
          color: var(--dot-muted);
          stroke: currentColor;
          stroke-width: 3;
          stroke-linecap: square;
          stroke-linejoin: miter;
        }

        .dot-tool-button {
          min-height: calc(var(--spacing) * 30);
        }

        .dot-banner-layer {
          top: max(calc(var(--spacing) * 38), calc(env(safe-area-inset-top) + var(--spacing) * 34));
        }

        .dot-onboarding-hint {
          display: flex;
          align-items: center;
          gap: calc(var(--spacing) * 2);
          transform: translate(-50%, -50%);
          animation: dot-onboarding-tap 2800ms var(--default-transition-timing-function) both;
        }

        .dot-onboarding-hand {
          font-size: calc(var(--spacing) * 12);
          line-height: 1;
          filter: drop-shadow(var(--spacing) var(--spacing) 0 var(--dot-shadow));
        }

        .dot-onboarding-pop {
          padding: calc(var(--spacing) * 2) calc(var(--spacing) * 3);
          border: calc(var(--spacing) * 0.5) solid var(--dot-edge);
          background: var(--dot-panel);
          box-shadow: var(--spacing) var(--spacing) 0 var(--dot-shadow);
          color: var(--dot-edge);
          font-size: var(--text-lg);
          line-height: var(--text-lg--line-height);
          font-weight: var(--font-weight-black);
        }

        @keyframes dot-onboarding-tap {
          0%, 18% {
            transform: translate(-50%, -50%) translateY(0) scale(1);
          }
          72% {
            transform: translate(-50%, -50%) translateY(min(28svh, calc(var(--spacing) * 64))) scale(1);
          }
          80% {
            transform: translate(-50%, -50%) translateY(min(28svh, calc(var(--spacing) * 64))) scale(0.88);
          }
          90%, 100% {
            transform: translate(-50%, -50%) translateY(min(28svh, calc(var(--spacing) * 64))) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dot-onboarding-hint {
            animation: none;
            transform: translate(-50%, -50%) translateY(min(20svh, calc(var(--spacing) * 44)));
          }
        }

        @media (max-width: 439px) {
          .dot-hud {
            flex-wrap: wrap;
          }

          .dot-hud-status {
            flex-basis: 100%;
          }

          .dot-hud-action {
            width: calc(50% - var(--spacing));
          }

          .dot-tool-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .dot-banner-layer {
            top: max(calc(var(--spacing) * 54), calc(env(safe-area-inset-top) + var(--spacing) * 50));
          }
        }
      `}</style>
      <div
        className="absolute inset-0"
        inert={isBlocked ? true : undefined}
        aria-hidden={isBlocked ? true : undefined}
      >
        <div
          ref={containerRef}
          tabIndex={-1}
          className="absolute inset-0 outline-none"
          onPointerDown={() => audioRef.current?.play('island-move-sfx-island-audio')}
        />

        <header className="dot-safe-top pointer-events-none absolute inset-x-0 top-0 z-20 mx-auto w-full max-w-md px-3">
          <div className="dot-panel dot-hud pointer-events-auto flex items-center gap-2 p-2">
            <div className="dot-hud-status flex flex-1 items-center gap-2">
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
            </div>

            <button
              type="button"
              onClick={openAvatar}
              disabled={!avatar || avatarAtlasStatus === 'loading' || isTransitioning}
              className="dot-button dot-avatar-button dot-hud-action grid shrink-0 place-items-center"
              aria-label={avatarButtonLabel}
            >
              {avatar && avatarAtlasStatus === 'ready' ? (
                <AvatarPreview avatar={avatar} scale={1} />
              ) : (
                <WardrobeStatusIcon status={avatarAtlasStatus === 'error' ? 'error' : 'loading'} />
              )}
            </button>

            <button
              type="button"
              onClick={toggleMode}
              aria-label={modeButtonLabel}
              aria-pressed={mode === 'decorate'}
              disabled={!save || isTransitioning}
              className="dot-button dot-mode-button dot-hud-action grid shrink-0 place-items-center"
            >
              <ModeIcon mode={mode} />
            </button>
          </div>
          <button
            type="button"
            onClick={toggleSound}
            aria-label={muted ? '섬 소리 켜기' : '섬 소리 끄기'}
            aria-pressed={!muted}
            className="dot-button pointer-events-auto ml-auto mt-3 grid size-30 place-items-center text-4xl font-black"
          >
            <span aria-hidden>{muted ? '🔇' : '🔊'}</span>
          </button>
        </header>

        {banner && (
          <div className="dot-banner-layer pointer-events-none absolute inset-x-0 z-30 flex justify-center px-6">
            <p className="dot-panel dot-toast px-4 py-3 text-center text-sm font-black" role="status" aria-live="polite">
              {banner}
            </p>
          </div>
        )}

        {showOnboarding && !isBlocked && mode === 'explore' && (
          <div
            className="dot-onboarding-hint pointer-events-none absolute left-1/2 top-1/2 z-30"
            aria-hidden="true"
          >
            <span className="dot-onboarding-hand" aria-hidden="true">☝️</span>
            <span className="dot-onboarding-pop" aria-hidden="true">톡!</span>
          </div>
        )}

        {mode === 'decorate' && (
          <section
            className="dot-safe-bottom absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-3"
            aria-labelledby="decorate-title"
          >
            <div className="dot-panel dot-toolbar p-3">
              <h2 id="decorate-title" className="sr-only">내 오두막 꾸미기</h2>
              <div
                id="decorate-help"
                className="dot-toolbar-guide mb-3"
                role="status"
                aria-label={toolbarMessage}
                aria-live="polite"
              >
                <ToolbarGuideIcon state={toolbarState} />
                <span className="sr-only">{toolbarMessage}</span>
              </div>
              <div className="dot-tool-grid grid grid-cols-3 gap-2">
                {FURNITURE.map((furniture) => {
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
                      <PackStamp {...furniture.stamp} />
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
                <AtlasSprite atlas="character" frame={PREMIUM_PACK_FRAMES.fisherwoman} />
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

      {avatarOpen && avatar && (
        <div className="dot-scrim absolute inset-0 z-40 flex items-end justify-center px-3 dot-safe-bottom">
          <section
            ref={avatarDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-title"
            aria-describedby="avatar-help"
            tabIndex={-1}
            className="dot-panel dot-dialog dot-avatar-dialog relative w-full max-w-md p-5 outline-none"
          >
            <button
              ref={avatarCloseButtonRef}
              type="button"
              onClick={closeAvatar}
              aria-label="내 캐릭터 꾸미기 닫기"
              className="dot-button dot-close-button absolute right-3 top-3 grid min-h-12 min-w-12 place-items-center text-xl font-black"
            >
              ×
            </button>

            <div className="flex items-center gap-4 pr-12">
              <div className="dot-avatar-stage flex shrink-0 items-center justify-center">
                {avatarAtlasStatus === 'ready' ? <AvatarPreview avatar={avatar} /> : null}
              </div>
              <div>
                <p className="dot-label">팩 파츠로 골라요</p>
                <h2 id="avatar-title" className="mt-1 text-xl font-black">내 캐릭터</h2>
                <p id="avatar-help" className="mt-1 text-sm font-bold text-ink2">셔츠와 모자를 톡 눌러요.</p>
              </div>
            </div>

            {avatarAtlasStatus === 'loading' && (
              <p className="dot-avatar-status mt-4 p-4 text-center text-sm font-black" role="status">
                옷 그림을 불러오고 있어요…
              </p>
            )}
            {avatarAtlasStatus === 'error' && (
              <div className="dot-avatar-status mt-4 p-4 text-center" role="alert">
                <p className="text-sm font-black">옷 그림을 불러오지 못했어요.</p>
                <button
                  type="button"
                  onClick={retryAvatarAtlas}
                  className="dot-button mt-3 min-h-12 px-5 text-sm font-black"
                >
                  다시 불러오기
                </button>
              </div>
            )}

            <fieldset className="mt-4" disabled={avatarAtlasStatus !== 'ready'}>
              <legend className="text-base font-black">셔츠 색</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {PACK_SHIRTS.map((shirt) => {
                  const optionAvatar = withPackShirt(avatar, shirt.body);
                  return (
                    <button
                      type="button"
                      key={shirt.body}
                      onClick={() => applyAvatar(optionAvatar)}
                      aria-pressed={avatar.body === shirt.body}
                      aria-label={shirt.label}
                      className="dot-button dot-avatar-option flex min-h-24 items-center justify-center"
                    >
                      <AvatarPreview avatar={optionAvatar} scale={1} />
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="mt-4" disabled={avatarAtlasStatus !== 'ready'}>
              <legend className="text-base font-black">모자</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {PACK_HATS.map((hat) => {
                  const optionAvatar = withPackHat(avatar, hat.id);
                  return (
                    <button
                      type="button"
                      key={hat.id}
                      onClick={() => applyAvatar(optionAvatar)}
                      aria-pressed={selectedPackHat(avatar) === hat.id}
                      className="dot-button dot-avatar-hat-option flex min-h-20 items-center justify-center gap-2 px-3 text-sm font-black"
                    >
                      <AvatarPreview avatar={optionAvatar} scale={1} />
                      <span>{hat.label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <button
              type="button"
              onClick={closeAvatar}
              className="dot-button dot-primary-button mt-4 inline-flex min-h-14 w-full items-center justify-center px-6 text-lg font-black"
            >
              다 골랐어요
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
              <PackStamp {...PREMIUM_PACK_FRAMES.boat} />
            </div>
            <p className="mt-4 text-xl font-black">그림 섬으로 가요</p>
          </div>
        </div>
      )}
    </main>
  );
}
