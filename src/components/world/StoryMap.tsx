'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Avatar from '@/components/world/Avatar';
import { GLASS_LIGHT, GLASS_PILL } from '@/components/ui/glass';
import { useReducedMotion } from '@/lib/juice';
import {
  AVATAR_HOME,
  REGIONS,
  isRegionDone,
  isRegionUnlocked,
  type AvatarConfig,
  type RegionDef,
  type WorldSave,
} from '@/lib/world/world-state';

/**
 * 이야기 지도 — 위→아래로 이어지는 스타일라이즈드 지도 위에서 아바타가 길을 따라 걸어
 * 지역을 탐험한다. 탭 → 곡선 이동(웨이포인트 1개, 1.2s) → 지역 카드가 떠오름 → 수업 연결.
 * 랭킹·타이머·소멸 보상 없음(docs/plan/10 §5): "새 길"은 사라지지 않고 기다린다.
 */

type Point = { x: number; y: number };

const WALK_LEG_MS = 600; // 웨이포인트까지 한 구간
const WALK_TOTAL_MS = 1250; // 도착 + 카드 오픈까지

export default function StoryMap({
  avatar,
  save,
  onEditAvatar,
}: {
  avatar: AvatarConfig;
  save: WorldSave;
  onEditAvatar: () => void;
}) {
  const reduced = useReducedMotion();
  const [pos, setPos] = useState<Point>(AVATAR_HOME);
  const [walking, setWalking] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [shakingId, setShakingId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const hintTimer = useRef<number | null>(null);
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const regionState = useMemo(
    () =>
      REGIONS.map((region) => ({
        region,
        unlocked: isRegionUnlocked(region, save),
        done: isRegionDone(region, save),
      })),
    [save],
  );

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const showHint = useCallback((text: string, region: RegionDef) => {
    setShakingId(region.id);
    setHint(text);
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => {
      setHint(null);
      setShakingId(null);
    }, 2200);
  }, []);

  const goToRegion = useCallback(
    (region: RegionDef, unlocked: boolean) => {
      if (!unlocked) {
        showHint(
          region.theme === 'fog'
            ? '아직 안개에 싸여 있어요. 앞의 길을 먼저 다녀와요!'
            : '앞의 강가를 다녀오면 안개가 걷혀요!',
          region,
        );
        return;
      }
      clearTimers();
      setActiveId(null);
      nodeRefs.current[region.id]?.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'center',
      });

      if (reduced) {
        setPos(region.pos);
        setActiveId(region.id);
        return;
      }
      setWalking(true);
      setPos(region.waypoint);
      timers.current.push(window.setTimeout(() => setPos(region.pos), WALK_LEG_MS));
      timers.current.push(
        window.setTimeout(() => {
          setWalking(false);
          setActiveId(region.id);
        }, WALK_TOTAL_MS),
      );
    },
    [clearTimers, reduced, showHint],
  );

  const active = regionState.find((r) => r.region.id === activeId) ?? null;

  return (
    <main className="relative min-h-[100svh] overflow-x-hidden bg-gradient-to-b from-[#EAF3EE] via-cream to-[#F3EDE0] text-ink [word-break:keep-all]">
      {/* 고정 헤더 */}
      <header className="fixed inset-x-0 top-0 z-40 mx-auto flex w-full max-w-md items-center justify-between px-5 py-3">
        <span className={`${GLASS_PILL} px-4 py-2 text-xs font-black tracking-[0.15em] text-saged`}>
          이야기 지도
        </span>
        <button
          onClick={onEditAvatar}
          className={`${GLASS_PILL} flex items-center gap-1.5 py-1.5 pl-2 pr-3.5 text-sm font-black text-ink`}
        >
          <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-white/70">
            <Avatar config={avatar} size={30} />
          </span>
          내 캐릭터
        </button>
      </header>

      {/* 지도 캔버스 (스크롤되는 세로 지도) */}
      <div className="relative mx-auto h-[168svh] w-full max-w-md">
        <ZoneDecor />

        {/* 길 */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d="M50,12 C58,17 42,19 30,24 C16,32 34,40 70,50 C96,60 52,64 40,78"
            fill="none"
            stroke="#EAD9BE"
            strokeWidth={16}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity="0.85"
          />
          <path
            d="M50,12 C58,17 42,19 30,24 C16,32 34,40 70,50 C96,60 52,64 40,78"
            fill="none"
            stroke="#C9B48E"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="0.1 15"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* 지역 메달리온 */}
        {regionState.map(({ region, unlocked, done }) => (
          <button
            key={region.id}
            ref={(el) => {
              nodeRefs.current[region.id] = el;
            }}
            onClick={() => goToRegion(region, unlocked)}
            aria-label={`${unlocked ? region.name : '잠긴 지역'}${done ? ' (완료)' : ''}`}
            className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none ${
              shakingId === region.id ? 'juice-shake' : ''
            }`}
            style={{ left: `${region.pos.x}%`, top: `${region.pos.y}%` }}
          >
            <RegionMedallion region={region} unlocked={unlocked} done={done} />
          </button>
        ))}

        {/* 아바타 */}
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[78%]"
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            transition: reduced ? 'none' : `left ${WALK_LEG_MS}ms ease-in-out, top ${WALK_LEG_MS}ms ease-in-out`,
          }}
        >
          <div className={walking ? 'world-bob' : 'world-float'}>
            <Avatar config={avatar} size={72} title="내 아바타" />
          </div>
        </div>
      </div>

      {/* 힌트 토스트 */}
      {hint && (
        <div className="fixed inset-x-0 top-16 z-50 flex justify-center px-6" aria-live="polite">
          <p className={`${GLASS_PILL} px-4 py-2 text-center text-sm font-bold text-ink`}>{hint}</p>
        </div>
      )}

      {/* 지역 카드 (도착 후 떠오름) */}
      {active && (
        <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className={`${GLASS_LIGHT} world-rise relative px-6 py-6`}>
            <button
              onClick={() => setActiveId(null)}
              aria-label="닫기"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/70 text-lg font-black text-ink2"
            >
              ×
            </button>
            <RegionCard region={active.region} done={active.done} />
          </div>
        </div>
      )}
    </main>
  );
}

/* 지역별 도착 카드 내용 */
function RegionCard({ region, done }: { region: RegionDef; done: boolean }) {
  const label =
    region.theme === 'pointillism' ? '점묘 화가의 강가' : region.theme === 'music' ? '노래하는 마을' : '안개 지역';

  if (region.theme === 'music') {
    // 세빌리아 — 수업 준비 중(수업 2편 제작 중, docs/plan/10 §7).
    return (
      <div className="text-center">
        <p className="text-xs font-black tracking-[0.2em] text-sage">{label}</p>
        <h2 className="mt-1 text-2xl font-black">{region.name}</h2>
        <p className="mt-3 text-pretty text-base font-bold leading-relaxed text-ink2">
          노래하는 마을이 문을 열 준비를 하고 있어요. 🎵
        </p>
        <p className="mt-4 inline-flex rounded-full bg-sagebg px-4 py-2 text-sm font-black text-saged">
          새 수업 준비 중
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="text-xs font-black tracking-[0.2em] text-sage">{label}</p>
      <h2 className="mt-1 text-2xl font-black">{region.name}</h2>
      {done ? (
        <>
          <p className="mt-3 text-pretty text-base font-bold leading-relaxed text-ink2">
            여기 탐험을 마쳤어요! ⭐ 세빌리아로 가는 길이 열렸어요.
          </p>
          <Link
            href={`/lesson/${region.lessonId}`}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-line bg-white/70 text-base font-bold text-ink2"
          >
            수업 다시 보기
          </Link>
        </>
      ) : (
        <>
          <p className="mt-3 text-pretty text-base font-bold leading-relaxed text-ink2">{region.blurb}</p>
          <Link
            href={`/lesson/${region.lessonId}`}
            className="mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-ink text-lg font-black text-cream transition active:scale-[0.98]"
          >
            수업 하러 가기
          </Link>
        </>
      )}
    </div>
  );
}

/* 지역 시각 — 테마별 메달리온 + 라벨 */
function RegionMedallion({
  region,
  unlocked,
  done,
}: {
  region: RegionDef;
  unlocked: boolean;
  done: boolean;
}) {
  return (
    <span className="flex w-[124px] flex-col items-center">
      <span
        className={`relative grid h-[104px] w-[104px] place-items-center rounded-full ${
          !unlocked ? 'opacity-90' : ''
        }`}
      >
        {region.theme === 'pointillism' && <PointillismNode dimmed={!unlocked} />}
        {region.theme === 'music' && <MusicNode dimmed={!unlocked} />}
        {region.theme === 'fog' && <FogNode />}

        {/* 상태 배지 */}
        {done ? (
          <span className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full bg-sage text-base font-black text-white shadow">
            ✓
          </span>
        ) : !unlocked ? (
          <span className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full bg-white/85 text-base shadow">
            🔒
          </span>
        ) : null}
      </span>

      <span
        className={`mt-2 rounded-full px-3 py-1 text-xs font-black shadow-sm ${
          unlocked ? 'bg-white/85 text-ink' : 'bg-white/60 text-ink3'
        }`}
      >
        {unlocked ? region.name : '???'}
      </span>
      {unlocked && !done && (
        <span className="mt-1 rounded-full bg-gold/90 px-2.5 py-0.5 text-[11px] font-black text-white">
          탐험!
        </span>
      )}
    </span>
  );
}

// 점묘 강가 — 흩뿌린 색점(쇠라 팔레트).
const POINT_DOTS: ReadonlyArray<{ cx: number; cy: number; r: number; fill: string }> = [
  { cx: 30, cy: 34, r: 4, fill: '#7FB2E0' },
  { cx: 46, cy: 26, r: 3.4, fill: '#8FC58F' },
  { cx: 62, cy: 32, r: 4.2, fill: '#E7C56A' },
  { cx: 72, cy: 46, r: 3.2, fill: '#82B6E6' },
  { cx: 34, cy: 52, r: 3.6, fill: '#A9E0C8' },
  { cx: 50, cy: 46, r: 4.4, fill: '#7FB2E0' },
  { cx: 60, cy: 60, r: 3.4, fill: '#8FC58F' },
  { cx: 42, cy: 68, r: 4, fill: '#E7C56A' },
  { cx: 68, cy: 72, r: 3.2, fill: '#E389A6' },
  { cx: 28, cy: 66, r: 3, fill: '#82B6E6' },
  { cx: 52, cy: 74, r: 3.6, fill: '#A9E0C8' },
  { cx: 76, cy: 60, r: 3, fill: '#8FC58F' },
];

function PointillismNode({ dimmed }: { dimmed: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={`h-full w-full ${dimmed ? 'opacity-40 blur-[1px] grayscale' : ''}`}>
      <circle cx="50" cy="50" r="48" fill="#F3F7F0" stroke="#DDE8DE" strokeWidth="3" />
      {POINT_DOTS.map((dot, i) => (
        <circle key={i} cx={dot.cx} cy={dot.cy} r={dot.r} fill={dot.fill} />
      ))}
    </svg>
  );
}

function MusicNode({ dimmed }: { dimmed: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={`h-full w-full ${dimmed ? 'opacity-40 blur-[1px] grayscale' : ''}`}>
      <defs>
        <radialGradient id="music-node" cx="38%" cy="32%" r="80%">
          <stop offset="0%" stopColor="#F6E4C2" />
          <stop offset="100%" stopColor="#E1B673" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#music-node)" stroke="#D19A43" strokeWidth="3" />
      <text x="34" y="46" fontSize="24" fill="#8A5A25" fontWeight="bold">♪</text>
      <text x="52" y="66" fontSize="30" fill="#B87F2E" fontWeight="bold">♫</text>
    </svg>
  );
}

function FogNode() {
  return (
    <svg viewBox="0 0 100 100" className="world-fog-drift h-full w-full">
      <circle cx="50" cy="50" r="48" fill="#D9DCD7" />
      {/* 실루엣만 — 지붕/나무 그림자 */}
      <path d="M24,64 L40,44 L56,64 Z" fill="#B4BAB2" />
      <path d="M50,66 L66,40 L82,66 Z" fill="#AAB1A8" />
      <rect x="20" y="64" width="62" height="12" fill="#B4BAB2" />
      <circle cx="50" cy="50" r="48" fill="#EEF0EC" opacity="0.55" />
    </svg>
  );
}

// 테마별 존을 은은하게 물들이는 배경 블롭.
function ZoneDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-[-15%] top-[8%] h-72 w-72 rounded-full bg-[#BFE0D4] opacity-40 blur-3xl" />
      <div className="absolute right-[-20%] top-[38%] h-80 w-80 rounded-full bg-[#F1D9A6] opacity-40 blur-3xl" />
      <div className="absolute bottom-[4%] left-[-10%] h-72 w-72 rounded-full bg-[#CDD2CC] opacity-45 blur-3xl" />
    </div>
  );
}
