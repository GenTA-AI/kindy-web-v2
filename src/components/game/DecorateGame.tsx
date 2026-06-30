'use client';

import { type CSSProperties, useEffect, useRef, useState } from 'react';
import type { DecoratePalette } from '@/data/worlds/animal-village';
import type { GameRoundResult, GameRoundSpec } from '@/types/game';

interface DecorateGameProps {
  spec: GameRoundSpec;
  childName: string;
  prompt?: string;
  palette: DecoratePalette;
  feedback?: { success: string; retry: string; hint: string };
  onComplete: (result: GameRoundResult) => void;
  /** 재미 토대 연결(선택). */
  onChoose?: () => void;
  onFinish?: () => void;
  onSpeak?: (text: string) => void;
}

type Placed = {
  id: string;
  glyph: string;
  left: number;
  top: number;
};

/**
 * 선물 꾸미기(창작 / 통합·콜라주) — 정답 없음 = 참여도.
 * 색(배경) 고르고 모양·스티커를 선물 위에 톡톡 놓아 "내 작품"을 만든다.
 */
export default function DecorateGame({
  spec,
  childName,
  prompt,
  palette,
  feedback,
  onComplete,
  onChoose,
  onFinish,
  onSpeak,
}: DecorateGameProps) {
  const title = prompt ?? '나만의 선물을 꾸며요';
  const successMsg = feedback?.success ?? '나만의 선물이 완성됐어!';

  const [bg, setBg] = useState<string>(palette.colors[0]?.token ?? '🟪');
  const [activeGlyph, setActiveGlyph] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [done, setDone] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const idRef = useRef(0);
  const spokeRef = useRef(false);
  const canFinish = placed.length > 0;

  useEffect(() => {
    startedAtRef.current = Date.now();
    if (!spokeRef.current && onSpeak) {
      spokeRef.current = true;
      onSpeak(title);
    }
  }, [onSpeak, title]);

  // 색 토큰(🟥) → 부드러운 배경색.
  const BG_MAP: Record<string, string> = {
    '🟥': 'linear-gradient(135deg,#fee2e2,#fecaca)',
    '🟦': 'linear-gradient(135deg,#dbeafe,#bfdbfe)',
    '🟨': 'linear-gradient(135deg,#fef9c3,#fde68a)',
    '🟩': 'linear-gradient(135deg,#dcfce7,#bbf7d0)',
  };

  function placeAt(e: React.MouseEvent<HTMLButtonElement>) {
    if (done || !activeGlyph) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const left = ((e.clientX - rect.left) / rect.width) * 100;
    const top = ((e.clientY - rect.top) / rect.height) * 100;
    idRef.current += 1;
    setPlaced((prev) => [
      ...prev,
      { id: `p-${idRef.current}`, glyph: activeGlyph, left: Math.round(left), top: Math.round(top) },
    ]);
    onChoose?.();
  }

  const finish = () => {
    if (completedRef.current || !canFinish) return;
    completedRef.current = true;
    setDone(true);
    onFinish?.();
    // 참여도: 색 1 + 놓은 장식 수(최대 3). 정답/오답 개념 없음.
    const participation = 1 + Math.min(3, placed.length);
    const startedAt = startedAtRef.current ?? Date.now();
    onComplete({
      game_type: 'decorate',
      difficulty: spec.params.difficulty,
      objective_code: spec.tag.objective_code,
      standard_anchor: spec.tag.standard_anchor,
      score: participation,
      max_score: 4,
      latency_ms: Math.max(0, Date.now() - startedAt),
      retried: false,
      reward_payload: {
        stars: participation,
        stickers: ['creative_activity:decorate'],
        collection_unlocks: ['collection:creativity_compose'],
      },
    });
  };

  return (
    <section className="rounded-3xl border border-rose-100 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-xs font-bold text-rose-500 sm:text-sm">{spec.round_index + 1}번째 놀이 · 나만의 방법</p>
      <h2 className="mt-1 text-lg font-black text-gray-900 sm:text-2xl">{title}</h2>

      {/* 가로: 캔버스(왼쪽 큰 영역) + 팔레트(오른쪽). 세로: 위아래로 쌓임. */}
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* 선물 캔버스 */}
        <button
          type="button"
          aria-label="선물 위에 장식 놓기"
          onClick={placeAt}
          disabled={done || !activeGlyph}
          className="relative block h-56 w-full overflow-hidden rounded-2xl border-2 border-rose-100 sm:h-72 lg:h-[26rem] lg:flex-1"
          style={{ background: BG_MAP[bg] ?? 'linear-gradient(135deg,#DCE7D4,#EAF1E0)' }}
        >
          <GiftIllustration />
          {placed.map((p) => (
            <DecorMark
              key={p.id}
              token={p.glyph}
              className="juice-pop absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${p.left}%`, top: `${p.top}%` }}
            />
          ))}
          {!activeGlyph && !done && (
            <span className="absolute inset-x-0 bottom-3 text-center text-xs font-bold text-rose-500 sm:text-sm">
              모양·스티커를 고르고 선물을 톡 눌러봐!
            </span>
          )}
          {activeGlyph && placed.length === 0 && !done && (
            <span className="absolute inset-x-0 bottom-3 text-center text-xs font-bold text-rose-500 sm:text-sm">
              선물 위 원하는 곳을 톡 눌러 장식을 놓아봐!
            </span>
          )}
        </button>

        {/* 팔레트 (가로에서는 오른쪽 사이드) */}
        <div className="lg:w-64 lg:shrink-0">
          {/* 색 팔레트 */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400 sm:text-xs">색 고르기</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {palette.colors.map((c) => (
                <button
                  key={c.token}
                  type="button"
                  aria-label={`${c.label_ko} 배경`}
                  aria-pressed={bg === c.token}
                  disabled={done}
                  onClick={() => {
                    setBg(c.token);
                    onChoose?.();
                  }}
                  className={`juice-bounce h-12 w-12 rounded-xl transition active:scale-90 lg:h-14 lg:w-14 ${
                    bg === c.token ? 'ring-4 ring-rose-200' : 'ring-1 ring-rose-100'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="block h-full w-full rounded-xl"
                    style={{ background: BG_MAP[c.token] ?? 'linear-gradient(135deg,#DCE7D4,#EAF1E0)' }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* 모양 + 스티커 팔레트 */}
          <div className="mt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400 sm:text-xs">모양·스티커 고르기</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[...palette.shapes, ...palette.stickers].map((s) => (
                <button
                  key={s.token}
                  type="button"
                  aria-label={`${s.label_ko} 고르기`}
                  aria-pressed={activeGlyph === s.token}
                  disabled={done}
                  onClick={() => setActiveGlyph(s.token)}
                  className={`juice-bounce flex h-12 w-12 items-center justify-center rounded-xl transition active:scale-90 lg:h-14 lg:w-14 ${
                    activeGlyph === s.token ? 'bg-rose-100 ring-4 ring-rose-200' : 'bg-rose-50 ring-1 ring-rose-100'
                  }`}
                >
                  <DecorMark token={s.token} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {done ? (
        <p className="mt-4 text-center text-sm font-black text-rose-600 sm:text-lg">
          {childName}의 작품! {successMsg}
        </p>
      ) : (
        <div className="mt-5">
          {!canFinish && (
            <p className="mb-2 text-center text-sm font-bold text-rose-500">
              장식을 하나 놓으면 모리가 작품으로 기록해줄게.
            </p>
          )}
          <button
            type="button"
            disabled={!canFinish}
            onClick={finish}
            className="min-h-[52px] w-full rounded-2xl bg-rose-500 px-5 py-3 text-base font-black text-white shadow-lg shadow-rose-200 transition hover:bg-rose-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-rose-100 disabled:text-rose-400 disabled:shadow-none lg:min-h-[60px] lg:text-lg"
          >
            {canFinish ? '내 선물 완성하기' : '장식을 하나 놓아봐'}
          </button>
        </div>
      )}
    </section>
  );
}

function GiftIllustration() {
  return (
    <span
      aria-hidden="true"
      className="absolute left-1/2 top-1/2 flex h-28 w-32 -translate-x-1/2 -translate-y-1/2 items-end justify-center lg:h-40 lg:w-44"
    >
      <span className="absolute bottom-0 h-[72%] w-full rounded-2xl bg-white/75 shadow-lg ring-2 ring-white/80" />
      <span className="absolute bottom-0 h-[72%] w-[20%] bg-rose-300/75" />
      <span className="absolute bottom-[46%] h-[18%] w-full bg-rose-300/75" />
      <span className="absolute bottom-[66%] left-[24%] h-[28%] w-[24%] -rotate-12 rounded-full border-[10px] border-rose-300/75 bg-transparent lg:border-[14px]" />
      <span className="absolute bottom-[66%] right-[24%] h-[28%] w-[24%] rotate-12 rounded-full border-[10px] border-rose-300/75 bg-transparent lg:border-[14px]" />
    </span>
  );
}

function DecorMark({
  token,
  className = '',
  style,
}: {
  token: string;
  className?: string;
  style?: CSSProperties;
}) {
  const mark = decorMark(token);
  return (
    <span
      aria-hidden="true"
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-2xl font-black text-rose-500 shadow-sm ring-1 ring-rose-100 lg:h-12 lg:w-12 lg:text-3xl ${className}`}
      style={style}
    >
      {mark}
    </span>
  );
}

function decorMark(token: string): string {
  const normalized = token.replace(/\ufe0f/g, '');
  const marks: Record<string, string> = {
    '⭐': '★',
    '❤️': '♥',
    '🌸': '✿',
    '🔶': '◆',
    '🎀': '∞',
    '✨': '✦',
    '🌟': '✶',
    '🍓': '●',
  };
  return marks[token] ?? marks[normalized] ?? '•';
}
