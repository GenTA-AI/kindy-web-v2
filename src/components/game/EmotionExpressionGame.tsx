'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameRoundResult, GameRoundSpec } from '@/types/game';

type EmotionOption = {
  id: 'joy' | 'calm' | 'curious' | 'worried' | 'sad' | 'angry';
  emoji: string;
  label: string;
  helper: string;
  valence: -2 | -1 | 0 | 1 | 2;
  arousal: -2 | -1 | 0 | 1 | 2;
  className: string;
};

type EmotionExpressionPayload = {
  sel_activity: 'emotion_awareness';
  activity: 'emotion_awareness';
  objective_code: 'sel_emotion_awareness';
  interaction_format: 'emotion_expression';
  participation_score: number;
  response_recorded: true;
  reason_added: boolean;
  standard_anchor: string;
};

type EmotionExpressionRewardPayload = NonNullable<GameRoundResult['reward_payload']> & {
  sel_activity: 'emotion_awareness';
  activity: 'emotion_awareness';
  participation_score: number;
};

type EmotionExpressionRoundResult = GameRoundResult & {
  payload: EmotionExpressionPayload;
  reward_payload: EmotionExpressionRewardPayload;
};

interface EmotionExpressionGameProps {
  spec: GameRoundSpec;
  childName: string;
  clipPosterUrl?: string | null;
  onComplete: (result: GameRoundResult) => void;
}

const EMOTION_OPTIONS = [
  {
    id: 'joy',
    emoji: '😄',
    label: '신나요',
    helper: '밝고 통통 튀는 마음',
    valence: 2,
    arousal: 2,
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  {
    id: 'calm',
    emoji: '🙂',
    label: '편안해요',
    helper: '조용하고 부드러운 마음',
    valence: 2,
    arousal: -2,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  {
    id: 'curious',
    emoji: '🤔',
    label: '궁금해요',
    helper: '더 알고 싶은 마음',
    valence: 1,
    arousal: 1,
    className: 'border-sky-200 bg-sky-50 text-sky-800',
  },
  {
    id: 'worried',
    emoji: '😟',
    label: '걱정돼요',
    helper: '조심스럽게 살피는 마음',
    valence: -1,
    arousal: 1,
    className: 'border-violet-200 bg-violet-50 text-violet-800',
  },
  {
    id: 'sad',
    emoji: '😢',
    label: '속상해요',
    helper: '마음이 내려앉는 느낌',
    valence: -2,
    arousal: -1,
    className: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  {
    id: 'angry',
    emoji: '😠',
    label: '화나요',
    helper: '힘이 크게 올라오는 마음',
    valence: -2,
    arousal: 2,
    className: 'border-rose-200 bg-rose-50 text-rose-800',
  },
] as const satisfies readonly EmotionOption[];

function normalizedDifficulty(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(10, Math.max(1, Math.round(value)));
}

function manikinPosition(option: EmotionOption) {
  return {
    left: `${12 + ((option.valence + 2) / 4) * 76}%`,
    top: `${12 + ((2 - option.arousal) / 4) * 76}%`,
    transform: 'translate(-50%, -50%)',
  };
}

export default function EmotionExpressionGame({
  spec,
  childName,
  clipPosterUrl = null,
  onComplete,
}: EmotionExpressionGameProps) {
  const startedAtRef = useRef<number | null>(null);
  const [selectedEmotionId, setSelectedEmotionId] = useState<EmotionOption['id'] | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const selectedEmotion = EMOTION_OPTIONS.find((option) => option.id === selectedEmotionId) ?? null;
  const hasReason = reason.trim().length > 0;
  const participationScore = selectedEmotion ? (hasReason ? 2 : 1) : 0;
  const roundNumber = spec.round_index + 1;

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  const handleComplete = () => {
    if (!selectedEmotion || isSubmitted) return;

    const startedAt = startedAtRef.current ?? Date.now();
    const result: EmotionExpressionRoundResult = {
      game_type: 'emotion_expression',
      difficulty: normalizedDifficulty(spec.params.difficulty),
      objective_code: 'sel_emotion_awareness',
      standard_anchor: spec.tag.standard_anchor,
      score: participationScore,
      max_score: 2,
      latency_ms: Math.max(0, Date.now() - startedAt),
      retried: false,
      reward_payload: {
        stars: participationScore,
        stickers: ['sel_activity:emotion_awareness'],
        collection_unlocks: ['collection:sel_emotion_awareness'],
        sel_activity: 'emotion_awareness',
        activity: 'emotion_awareness',
        participation_score: participationScore,
      },
      payload: {
        sel_activity: 'emotion_awareness',
        activity: 'emotion_awareness',
        objective_code: 'sel_emotion_awareness',
        interaction_format: 'emotion_expression',
        participation_score: participationScore,
        response_recorded: true,
        reason_added: hasReason,
        standard_anchor: spec.tag.standard_anchor,
      },
    };

    setIsSubmitted(true);
    onComplete(result);
  };

  return (
    <section
      aria-labelledby="emotion-expression-title"
      className="w-full rounded-3xl border border-violet-100 bg-white p-4 shadow-sm shadow-violet-100/70 sm:p-5"
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-violet-500">
              {roundNumber}라운드 · 마음 표현
            </p>
            <h2 id="emotion-expression-title" className="mt-1 text-2xl font-black text-gray-900">
              기분을 표현해봐
            </h2>
          </div>
          <span className="inline-flex min-h-[44px] items-center rounded-full bg-violet-50 px-4 text-sm font-bold text-violet-700">
            {spec.topic}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <div className="overflow-hidden rounded-2xl border border-violet-100 bg-violet-50">
            <div className="relative min-h-[220px]">
              {clipPosterUrl ? (
                <div
                  role="img"
                  aria-label={`${spec.topic} 장면`}
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${clipPosterUrl})` }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#fef3c7,transparent_30%),linear-gradient(135deg,#DCE7D4,#fdf2f8_55%,#ecfeff)]">
                  <svg aria-hidden="true" className="h-44 w-44" viewBox="0 0 160 160">
                    <circle cx="80" cy="56" r="34" fill="#fff" stroke="#46763F" strokeWidth="4" />
                    <circle cx="66" cy="50" r="5" fill="#264420" />
                    <circle cx="94" cy="50" r="5" fill="#264420" />
                    <path
                      d="M64 72 Q80 86 96 72"
                      fill="none"
                      stroke="#264420"
                      strokeLinecap="round"
                      strokeWidth="5"
                    />
                    <path
                      d="M46 122 Q80 96 114 122"
                      fill="#C2D5B9"
                      stroke="#46763F"
                      strokeWidth="4"
                    />
                    <path
                      d="M47 119 L31 139"
                      stroke="#46763F"
                      strokeLinecap="round"
                      strokeWidth="8"
                    />
                    <path
                      d="M113 119 L129 139"
                      stroke="#46763F"
                      strokeLinecap="round"
                      strokeWidth="8"
                    />
                  </svg>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-violet-950/70 to-transparent p-4 text-white">
                <p className="text-sm font-semibold">장면을 보고 떠오른 마음</p>
                <p className="mt-1 text-lg font-black">어떤 마음이 들었어?</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-violet-900">마음 지도</p>
                <p className="mt-1 text-xs font-medium text-violet-600">
                  고른 얼굴이 지도 위에 보여요
                </p>
              </div>
              <span className="text-3xl" aria-hidden="true">
                {selectedEmotion?.emoji ?? '🙂'}
              </span>
            </div>

            <div className="mt-4 rounded-2xl bg-white p-4">
              <div className="relative h-48 rounded-xl border border-violet-100 bg-gradient-to-br from-blue-50 via-white to-amber-50">
                <span className="absolute left-1/2 top-3 -translate-x-1/2 text-xs font-bold text-gray-500">
                  움직이는 쪽
                </span>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-500">
                  조용한 쪽
                </span>
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                  힘든 쪽
                </span>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                  편안한 쪽
                </span>
                <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-violet-100" />
                <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-violet-100" />
                {selectedEmotion && (
                  <span
                    aria-label={`${selectedEmotion.label} 위치`}
                    className="absolute flex h-12 w-12 items-center justify-center rounded-full border-2 border-violet-400 bg-white text-2xl shadow-lg shadow-violet-200"
                    style={manikinPosition(selectedEmotion)}
                  >
                    {selectedEmotion.emoji}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-base font-bold text-gray-900">
            {childName}, 이 장면에서 떠오른 얼굴을 골라볼래?
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {EMOTION_OPTIONS.map((option) => {
              const isSelected = option.id === selectedEmotionId;

              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={isSubmitted}
                  onClick={() => setSelectedEmotionId(option.id)}
                  className={`min-h-[88px] rounded-2xl border-2 p-3 text-left transition-all active:scale-[0.98] disabled:cursor-default ${
                    isSelected
                      ? `${option.className} ring-4 ring-violet-200`
                      : 'border-gray-100 bg-white text-gray-700 hover:border-violet-200 hover:bg-violet-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-3xl" aria-hidden="true">
                      {option.emoji}
                    </span>
                    <span className="text-base font-black">{option.label}</span>
                  </span>
                  <span className="mt-2 block text-xs font-semibold opacity-80">{option.helper}</span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedEmotion && (
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
            <p className="text-base font-bold text-violet-900">
              {selectedEmotion.label}라고 느꼈구나.
            </p>
            <label htmlFor="emotion-expression-reason" className="mt-3 block text-sm font-bold text-gray-800">
              왜 그런 마음이 들었는지 한마디로 말해도 돼
            </label>
            <textarea
              id="emotion-expression-reason"
              value={reason}
              disabled={isSubmitted}
              onChange={(event) => setReason(event.target.value)}
              maxLength={80}
              rows={2}
              placeholder="예: 친구 얼굴을 보고 그렇게 느꼈어"
              className="mt-2 min-h-[72px] w-full resize-none rounded-2xl border border-violet-100 bg-white px-4 py-3 text-base font-medium text-gray-900 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:text-gray-500"
            />
            <p className="mt-2 text-xs font-medium text-violet-600">
              말하지 않아도 괜찮아. 고른 마음만으로도 표현했어요.
            </p>
          </div>
        )}

        <button
          type="button"
          disabled={!selectedEmotion || isSubmitted}
          onClick={handleComplete}
          className="min-h-[52px] rounded-2xl bg-violet-600 px-5 py-3 text-base font-black text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none"
        >
          {isSubmitted ? '표현을 기록했어요' : '표현 마치기'}
        </button>
      </div>
    </section>
  );
}
