'use client';

import { useState, useEffect, useRef } from 'react';

type Phase = 'playing' | 'ended' | 'learning' | 'next-ready';

interface Reaction {
  id: string;
  emoji: string;
  label: string;
  signal: string;
}

const REACTIONS: Reaction[] = [
  { id: 'love', emoji: '🤩', label: '또 보고 싶어', signal: '같은 톤 강화' },
  { id: 'like', emoji: '😊', label: '좋아', signal: '유사 캐릭터' },
  { id: 'unsure', emoji: '🤔', label: '잘 모르겠어', signal: '다른 톤 시도' },
];

interface Props {
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  characterName: string;
  topic: string;
  ageBand: number;
  durationSec: number;
}

export default function IpadDemoClient({
  videoUrl,
  thumbnailUrl,
  title,
  characterName,
  topic,
  ageBand,
  durationSec,
}: Props) {
  const [phase, setPhase] = useState<Phase>('playing');
  const [reactionId, setReactionId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (phase === 'learning') {
      const t = setTimeout(() => setPhase('next-ready'), 2400);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const reset = () => {
    setReactionId(null);
    setPhase('playing');
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
  };

  const skipToEnd = () => {
    const v = videoRef.current;
    if (v) {
      v.pause();
    }
    setPhase('ended');
  };

  const onReaction = (id: string) => {
    setReactionId(id);
    setPhase('learning');
  };

  const reaction = REACTIONS.find((r) => r.id === reactionId);
  const topicLabel = topic === 'science' ? '과학' : topic === 'english' ? '영어' : topic === 'hangul' ? '한글' : topic;
  const durationLabel = `${Math.floor(durationSec / 60)}m ${String(durationSec % 60).padStart(2, '0')}s`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-100 via-violet-50 to-white">
      <div className="mx-auto flex min-h-screen max-w-[820px] flex-col px-8 py-10">
        {/* Status bar mock */}
        <div className="mb-3 flex items-center justify-between text-xs font-bold text-gray-500">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <span aria-hidden>📶</span>
            <span aria-hidden>🔋 87%</span>
          </div>
        </div>

        {/* App header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500 text-sm font-extrabold text-white">K</div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-violet-500">Kindy · 서연이의 영상</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-violet-600 shadow-sm">
            <span aria-hidden>🎬</span>
            <span>12편째</span>
          </div>
        </div>

        {/* Video player */}
        <div className="relative overflow-hidden rounded-[28px] bg-black shadow-2xl shadow-violet-200">
          <video
            ref={videoRef}
            src={videoUrl}
            poster={thumbnailUrl}
            autoPlay
            muted
            playsInline
            onEnded={() => setPhase('ended')}
            className="aspect-video w-full bg-black"
          />

          {/* Just-ended overlay */}
          {phase === 'ended' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-3 rounded-3xl bg-white/95 px-12 py-8 shadow-xl">
                <div className="text-5xl" aria-hidden>✨</div>
                <p className="text-2xl font-black text-violet-600">다 봤어요!</p>
                <p className="text-sm font-medium text-gray-500">서연이는 어땠어?</p>
              </div>
            </div>
          )}

          {/* Title chip */}
          <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-pink-400" />
            <p className="text-[11px] font-bold text-gray-700">{topicLabel} · {ageBand}세 · {durationLabel}</p>
          </div>

          {/* Watched-by chip */}
          <div className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-violet-500/95 px-3 py-1.5 text-xs font-bold text-white shadow-md">
            <span aria-hidden>👀</span>
            <span>서연 시청 중</span>
          </div>

          {/* Skip-to-end helper (only while playing — useful for screenshots) */}
          {phase === 'playing' && (
            <button
              onClick={skipToEnd}
              className="absolute bottom-4 right-4 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold text-violet-600 shadow backdrop-blur-sm hover:bg-white"
            >
              퀴즈로 ↦
            </button>
          )}
        </div>

        {/* Video meta */}
        <div className="mt-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[26px] font-extrabold leading-tight text-gray-900">{title}</h2>
            <p className="mt-1 text-sm font-medium text-gray-500">
              서연이를 위한 12번째 영상 · {characterName} · 부드럽고 빛나는 스타일
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2 rounded-2xl bg-violet-50 px-4 py-3">
            <div className="text-2xl" aria-hidden>💚</div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-500">집중도</p>
              <p className="text-lg font-extrabold leading-none text-violet-600">94%</p>
            </div>
          </div>
        </div>

        {/* Quiz / Learning / Next */}
        <div className="mt-6 flex-1">
          {phase === 'playing' && (
            <div className="rounded-3xl border-2 border-dashed border-violet-200 bg-white/60 p-6 text-center">
              <p className="text-sm font-medium text-gray-500">
                영상이 끝나면 서연이가 어땠는지 물어봐요 · ▶ 자동 재생 중
              </p>
            </div>
          )}

          {phase === 'ended' && (
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <span aria-hidden className="text-2xl">🎯</span>
                <p className="text-base font-extrabold text-gray-900">이번 영상은 어땠어?</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {REACTIONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onReaction(r.id)}
                    className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-100 bg-violet-50/50 p-5 transition hover:border-violet-400 hover:bg-violet-50 active:scale-[0.97]"
                  >
                    <div className="text-5xl transition group-hover:scale-110" aria-hidden>
                      {r.emoji}
                    </div>
                    <p className="text-base font-extrabold text-gray-900">{r.label}</p>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-gray-400">
                답에 정답·오답 없어요 · 그냥 마음대로
              </p>
            </div>
          )}

          {phase === 'learning' && reaction && (
            <div className="rounded-3xl bg-violet-500 p-6 text-white shadow-lg shadow-violet-200">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-3xl" aria-hidden>{reaction.emoji}</div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-100">서연이 선택</p>
                    <p className="text-base font-extrabold">{reaction.label}</p>
                  </div>
                </div>
                <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm">
                  학습 신호 수집 중
                </div>
              </div>
              <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  <p className="text-xs font-bold uppercase tracking-wider">engine reframing…</p>
                </div>
                <p className="text-sm leading-relaxed text-violet-50">
                  <strong className="text-white">다음 영상</strong> 의 톤·캐릭터·속도를 서연이 신호에 맞춰 다시 짜고 있어요.
                  <br />
                  <span className="text-xs text-violet-100">{reaction.signal} · 약 1분 후 준비</span>
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
                  <div className="learning-bar h-full rounded-full bg-white" />
                </div>
              </div>
            </div>
          )}

          {phase === 'next-ready' && reaction && (
            <div className="overflow-hidden rounded-3xl border-2 border-violet-200 bg-white shadow-lg shadow-violet-100">
              <div className="bg-violet-50 px-6 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-500">
                    다음 영상이 준비됐어요
                  </p>
                  <div className="flex items-center gap-1 text-xs font-bold text-violet-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>13편째 · NEW</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-5">
                <div className="relative flex h-24 w-32 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl">
                  <img src={thumbnailUrl} alt="다음 영상 미리보기" className="absolute inset-0 h-full w-full object-cover blur-[1px] saturate-110" />
                  <div className="absolute inset-0 bg-violet-500/30" />
                  <span aria-hidden className="relative text-3xl">🌊</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-extrabold text-gray-900">{characterName}와 바다 아기 친구</h3>
                  <p className="mt-0.5 text-xs font-medium text-gray-500">{reaction.signal} 반영 · 부드러운 톤 + 새 친구</p>
                  <div className="mt-2 flex gap-1.5">
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-600">공주</span>
                    <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-600">잔잔</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">바다친구 NEW</span>
                  </div>
                </div>
              </div>
              <button
                onClick={reset}
                className="flex w-full items-center justify-center gap-2 bg-violet-500 py-4 text-base font-extrabold text-white transition hover:bg-violet-600"
              >
                <span>다시 보기</span>
                <span aria-hidden>↻</span>
              </button>
            </div>
          )}
        </div>

        {/* Parent assurance footer */}
        <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-lg">
              <span aria-hidden>💌</span>
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-500">부모 리포트</p>
              <p className="text-sm font-bold text-gray-900">이번 시청도 엄마 폰으로 신호가 가요</p>
            </div>
          </div>
          <button className="rounded-full bg-violet-50 px-4 py-2 text-xs font-bold text-violet-600 hover:bg-violet-100">
            엄마 보여주기
          </button>
        </div>
      </div>

      <style>{`
        .learning-bar {
          width: 0;
          animation: learn 2.4s ease-out forwards;
        }
        @keyframes learn {
          from { width: 0; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
