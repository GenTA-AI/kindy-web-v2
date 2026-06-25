'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameRoundResult, GameRoundSpec } from '@/types/game';

interface HiddenFriendGameProps {
  spec: GameRoundSpec;
  childName: string;
  /** 동물 마을 활동 안내문/피드백/정답 토큰(없으면 spec 에서 추론). */
  prompt?: string;
  answerToken?: string;
  feedback?: { success: string; retry: string; hint: string };
  onComplete: (result: GameRoundResult) => void;
  /** 재미 토대 연결(선택). */
  onCorrect?: () => void;
  onWrong?: () => void;
  onSpeak?: (text: string) => void;
}

type Spot = {
  id: string;
  token: string;
  label_ko: string;
  isTarget: boolean;
  left: number;
  top: number;
};

type RuntimeParams = GameRoundSpec['params'] & {
  items?: unknown;
  answer_token?: unknown;
  prompt_ko?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function seededRand(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSpots(spec: GameRoundSpec, answerToken: string | null): Spot[] {
  const params = spec.params as RuntimeParams;
  const raw = Array.isArray(params.items) ? params.items : [];
  const rand = seededRand(spec.params.seed + 31);

  const items = raw
    .map((item, index) => {
      if (!isRecord(item)) return null;
      const token = str(item.token) ?? str(item.id);
      if (!token) return null;
      const label = str(item.label_ko) ?? str(item.label) ?? token;
      const category = str(item.category) ?? '';
      const isTarget = answerToken ? token === answerToken : category === 'target';
      return { id: `spot-${index}`, token, label_ko: label, isTarget };
    })
    .filter((x): x is { id: string; token: string; label_ko: string; isTarget: boolean } => Boolean(x));

  // 정답이 없으면 첫 항목을 정답으로.
  if (items.length > 0 && !items.some((i) => i.isTarget)) {
    items[0].isTarget = true;
  }

  return items.map((item) => ({
    ...item,
    left: 8 + Math.round(rand() * 80),
    top: 12 + Math.round(rand() * 70),
  }));
}

export default function HiddenFriendGame({
  spec,
  childName,
  prompt,
  answerToken,
  feedback,
  onComplete,
  onCorrect,
  onWrong,
  onSpeak,
}: HiddenFriendGameProps) {
  const params = spec.params as RuntimeParams;
  const resolvedAnswer = answerToken ?? str(params.answer_token);
  const spots = useMemo(() => buildSpots(spec, resolvedAnswer ?? null), [spec, resolvedAnswer]);
  const title = prompt ?? str(params.prompt_ko) ?? '숨은 친구를 찾아봐요';
  const successMsg = feedback?.success ?? '친구를 찾았어!';
  const retryMsg = feedback?.retry ?? '거의 다 왔어, 다른 곳도 볼까?';

  const [found, setFound] = useState(false);
  const [wrongId, setWrongId] = useState<string | null>(null);
  const [status, setStatus] = useState(title);
  const startedAtRef = useRef<number | null>(null);
  const retriedRef = useRef(false);
  const completedRef = useRef(false);
  const spokeRef = useRef(false);

  useEffect(() => {
    startedAtRef.current = Date.now();
    if (!spokeRef.current && onSpeak) {
      spokeRef.current = true;
      onSpeak(title);
    }
  }, [onSpeak, title]);

  // 정답 시점에 경과 시간을 effect 에서 측정(렌더 중 impure 호출 회피) → 완료 콜백 전달.
  useEffect(() => {
    if (!found || completedRef.current) return undefined;
    completedRef.current = true;
    const startedAt = startedAtRef.current ?? Date.now();
    const latency = Math.max(0, Date.now() - startedAt);
    const timer = window.setTimeout(() => {
      onComplete({
        game_type: 'hidden_friend',
        difficulty: spec.params.difficulty,
        objective_code: spec.tag.objective_code,
        standard_anchor: spec.tag.standard_anchor,
        score: 1,
        max_score: 1,
        latency_ms: latency,
        retried: retriedRef.current,
        reward_payload: null,
      });
    }, 700);
    return () => window.clearTimeout(timer);
    // onComplete/spec 은 라운드 동안 안정적.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found]);

  const handleTap = (spot: Spot) => {
    if (found) return;
    if (spot.isTarget) {
      setFound(true);
      setStatus(successMsg);
      onCorrect?.();
      return;
    }
    retriedRef.current = true;
    setWrongId(spot.id);
    setStatus(retryMsg);
    onWrong?.();
    window.setTimeout(() => setWrongId(null), 500);
  };

  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-xs font-bold text-emerald-600 sm:text-sm">{spec.round_index + 1}번째 놀이 · 자세히 보기</p>
      <h2 className="mt-1 text-lg font-black text-gray-900 sm:text-2xl">{title}</h2>

      <div className="relative mt-4 h-64 overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-50 via-lime-50 to-emerald-100 sm:h-80 lg:h-[28rem]">
        {/* 풀숲 배경 장식(장식용 이모지) */}
        <div className="pointer-events-none absolute inset-0 select-none text-2xl opacity-50">
          <span className="absolute left-[6%] top-[70%]">🌿</span>
          <span className="absolute left-[40%] top-[80%]">🌱</span>
          <span className="absolute left-[74%] top-[68%]">🌿</span>
          <span className="absolute left-[20%] top-[20%]">☁️</span>
          <span className="absolute left-[68%] top-[14%]">☀️</span>
        </div>

        {spots.map((spot) => {
          const isFoundTarget = found && spot.isTarget;
          const isWrong = wrongId === spot.id;
          return (
            <button
              key={spot.id}
              type="button"
              aria-label={`${spot.label_ko} 눌러보기`}
              onClick={() => handleTap(spot)}
              disabled={found}
              className={`absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-3xl transition active:scale-90 lg:h-20 lg:w-20 lg:text-5xl ${
                isFoundTarget
                  ? 'juice-cheer scale-125 bg-white shadow-lg shadow-emerald-200'
                  : isWrong
                    ? 'juice-shake'
                    : 'juice-bounce hover:scale-110'
              }`}
              style={{ left: `${spot.left}%`, top: `${spot.top}%` }}
            >
              <span aria-hidden="true">{spot.token}</span>
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="mt-4 text-center">
        <span
          className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm font-black ${
            found ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          <span aria-hidden="true">{found ? '🎉' : '🔍'}</span>
          {found ? `${childName} 해냈어! ${status}` : status}
        </span>
      </div>
    </section>
  );
}
