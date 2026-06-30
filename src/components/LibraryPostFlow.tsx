'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { emitGameEvent } from '@/lib/game/events-client';
import type { GameRoundResult } from '@/types/game';

interface AttentionQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  focus: 'appearance' | 'action' | 'detail' | 'count';
}

interface Props {
  libraryVideoId: string;
  childId: string;
  childAge?: number;
}

export default function LibraryPostFlow({ libraryVideoId, childId, childAge }: Props) {
  const [questions, setQuestions] = useState<AttentionQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIssue, setSavingIssue] = useState(false);
  const [gameSessionId, setGameSessionId] = useState<string | null>(null);
  const gameSessionIdRef = useRef<string | null>(null);
  const gameSessionStartPromiseRef = useRef<Promise<string | null> | null>(null);
  const advanceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const rememberGameSession = (id: string | null | undefined) => {
    if (!id) return null;
    gameSessionIdRef.current = id;
    setGameSessionId(id);
    return id;
  };

  const startGameSession = async () => {
    if (gameSessionIdRef.current) return gameSessionIdRef.current;
    if (gameSessionStartPromiseRef.current) return gameSessionStartPromiseRef.current;

    gameSessionStartPromiseRef.current = (async () => {
      const result = await emitGameEvent(
        {
          type: 'game_started',
          payload: { source: 'library_post_flow', library_video_id: libraryVideoId },
        },
        { context: 'home', childId, topic: 'library_post_flow' },
      );

      if (!result.ok) {
        setSavingIssue(true);
        return null;
      }

      return rememberGameSession(result.game_session_id);
    })();

    const id = await gameSessionStartPromiseRef.current;
    gameSessionStartPromiseRef.current = null;

    return id;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setSelectedAnswer(null);
        const res = await fetch('/api/attention-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ library_video_id: libraryVideoId, child_age: childAge }),
        });
        if (cancelled) return;

        if (!res.ok) {
          setError('단서 질문을 준비하지 못했어요.');
          setLoading(false);
          return;
        }

        const body = (await res.json()) as { questions?: AttentionQuestion[] };
        setQuestions(body.questions ?? []);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('단서 질문을 준비하지 못했어요.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [libraryVideoId, childAge]);

  const focusLabel = (focus: AttentionQuestion['focus']) => {
    if (focus === 'appearance') return '모양 단서';
    if (focus === 'action') return '움직임 단서';
    if (focus === 'count') return '개수 단서';
    return '장면 단서';
  };

  // 단서 질문 focus → C6 생각도구. 전부 '관찰'로 쏠려 부모 리포트 C6 지도가
  // 한쪽으로 기우는 것을 막는다. 개수=규칙 찾기, 움직임=머릿속에 그려보기.
  const focusObjective = (focus: AttentionQuestion['focus']): string => {
    if (focus === 'count') return 'creativity_pattern';
    if (focus === 'action') return 'creativity_imagine';
    // appearance, detail = 자세히 관찰하기
    return 'creativity_observe';
  };

  const feedbackLine = (question: AttentionQuestion, answerIdx: number) => {
    if (answerIdx === question.correctAnswer) {
      return '찾았다! 단서를 잘 봤어요.';
    }

    return `좋아요. 모리는 "${question.options[question.correctAnswer]}" 단서도 함께 보여줄게요.`;
  };

  const saveAnswer = async (question: AttentionQuestion, answerIdx: number, index: number) => {
    const sessionId = gameSessionIdRef.current ?? await startGameSession();
    if (!sessionId) return false;

    const correct = answerIdx === question.correctAnswer;
    const result: GameRoundResult = {
      game_type: 'Q_quiz',
      difficulty: 1,
      objective_code: focusObjective(question.focus),
      standard_anchor: '예술경험',
      score: correct ? 1 : 0,
      max_score: 1,
      latency_ms: null,
      retried: !correct,
      reward_payload: {
        stars: correct ? 1 : 0,
        stickers: [`단서:${focusLabel(question.focus)}`],
        collection_unlocks: [`library:${libraryVideoId}`],
      },
    };

    const eventResult = await emitGameEvent(
      {
        type: 'game_round_completed',
        round_index: index,
        result,
        payload: {
          game_session_id: sessionId,
          source: 'library_post_flow',
          library_video_id: libraryVideoId,
          question: question.question,
          focus: question.focus,
          selected_option: question.options[answerIdx] ?? null,
        },
      },
      { context: 'home', childId, topic: 'library_post_flow' },
    );
    if (!eventResult.ok) setSavingIssue(true);
    return eventResult.ok;
  };

  const completeSession = async () => {
    const sessionId = gameSessionIdRef.current ?? gameSessionId;
    if (!sessionId) return false;

    const eventResult = await emitGameEvent(
      {
        type: 'game_completed',
        payload: {
          game_session_id: sessionId,
          source: 'library_post_flow',
          library_video_id: libraryVideoId,
          rounds_total: questions.length,
        },
      },
      { context: 'home', childId, topic: 'library_post_flow' },
    );
    if (!eventResult.ok) setSavingIssue(true);
    return eventResult.ok;
  };

  const submit = (answerIdx: number) => {
    const q = questions[currentIdx];
    if (!q || selectedAnswer !== null) return;

    const next = [...answers, answerIdx];
    setAnswers(next);
    setSelectedAnswer(answerIdx);

    const savePromise = saveAnswer(q, answerIdx, currentIdx).catch(() => false);
    if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;

      if (currentIdx + 1 < questions.length) {
        setCurrentIdx((idx) => idx + 1);
        setSelectedAnswer(null);
        return;
      }

      void (async () => {
        const saved = await savePromise;
        const completed = await completeSession();
        if (!saved || !completed) setSavingIssue(true);
        setDone(true);
      })();
    }, 1200);
  };

  if (loading) {
    return <div className="px-6 py-10 text-center text-sm font-semibold text-ink3">단서 질문을 준비하는 중...</div>;
  }

  if (error || questions.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm font-semibold text-ink2">{error ?? '이 영상은 오늘 기록으로 바로 넘어갈 수 있어요.'}</p>
        <ConversionCta childId={childId} />
      </div>
    );
  }

  if (done) {
    return (
      <div className="px-6 py-10">
        <p className="text-center text-[11px] font-black uppercase tracking-[.16em] text-sage">오늘 놀이는 여기까지</p>
        <h2 className="mt-2 text-center text-xl font-black text-ink">
          오늘 단서 놀이를 마쳤어요
        </h2>
        <div className="mx-auto mt-5 max-w-[240px] rounded-3xl bg-sagebg p-5 text-center">
          <p className="text-sm font-black text-sage">함께 본 단서</p>
          <p className="mt-1 text-4xl font-black text-saged">
            {questions.length}개
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {questions.map((question, index) => {
              const correct = answers[index] === question.correctAnswer;
              return (
                <span
                  key={`${question.question}-${index}`}
                  className={`flex h-10 items-center justify-center rounded-full text-sm font-black ${
                    correct ? 'bg-white text-saged' : 'bg-cream text-clay'
                  }`}
                  aria-label={correct ? '찾은 단서' : '다시 볼 단서'}
                >
                  ★
                </span>
              );
            })}
          </div>
        </div>
        <p className="mt-3 text-center text-sm font-semibold leading-relaxed text-ink2">
          어떤 장면을 골랐는지, 어디까지 해냈는지는 보호자에게 보여줄 수 있어요.
        </p>
        {savingIssue && (
          <div className="mt-4 rounded-2xl border border-clay/30 bg-white px-4 py-3 text-center">
            <p className="text-sm font-black text-clay">기록 연결을 한 번 더 확인해 주세요</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-ink3">
              연결이 느려 기록 반영이 늦을 수 있어요. 보호자 기록에서 새로고침하면 다시 확인할 수 있습니다.
            </p>
          </div>
        )}
        <ConversionCta childId={childId} />
      </div>
    );
  }

  const q = questions[currentIdx];
  const progressPct = Math.round((currentIdx / questions.length) * 100);

  return (
    <div className="px-6 py-8">
      <p className="text-[11px] font-black uppercase tracking-[.16em] text-sage">
        단서 질문 {currentIdx + 1} / {questions.length}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-mist" aria-hidden="true">
        <div className="h-full rounded-full bg-sage transition-all duration-300" style={{ width: `${progressPct}%` }} />
      </div>
      <h2 className="mt-2 text-lg font-black leading-snug text-ink">{q.question}</h2>
      <p className="mt-2 inline-flex rounded-full bg-sagebg px-3 py-1 text-[11px] font-black text-saged">
        {focusLabel(q.focus)}
      </p>
      <div className="mt-5 space-y-2">
        {q.options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const isAnswered = selectedAnswer !== null;
          const isCorrect = index === q.correctAnswer;
          const selectedClass = isSelected
            ? isCorrect
              ? 'border-sage bg-sagebg text-saged'
              : 'border-clay/40 bg-cream text-clay'
            : isAnswered && isCorrect
              ? 'border-sage bg-sagebg text-saged'
              : 'border-line bg-white text-ink2 hover:border-sage hover:bg-mist';

          return (
            <button
              key={option}
              type="button"
              onClick={() => submit(index)}
              disabled={isAnswered}
              className={`min-h-[52px] w-full rounded-2xl border px-4 py-3 text-left text-sm font-bold transition active:scale-[0.99] disabled:cursor-default ${selectedClass}`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {selectedAnswer !== null && (
        <div className="mt-4 rounded-2xl bg-mist px-4 py-3" aria-live="polite">
          <p className="text-sm font-black text-saged">{feedbackLine(q, selectedAnswer)}</p>
          <p className="mt-1 text-xs font-bold text-ink3">잠깐 보고 다음 단서로 갈게요.</p>
        </div>
      )}
    </div>
  );
}

function ConversionCta({ childId }: { childId: string }) {
  const router = useRouter();

  return (
    <div className="mt-5 grid gap-2">
      <button
        type="button"
        onClick={() => router.push(`/dashboard/report?childId=${encodeURIComponent(childId)}`)}
        className="block w-full rounded-2xl bg-saged px-6 py-4 text-center text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
      >
        보호자에게 보여주기
      </button>
      <button
        type="button"
        onClick={() => router.push(`/library?childId=${encodeURIComponent(childId)}`)}
        className="block w-full rounded-2xl border border-line bg-cream px-6 py-3 text-center text-sm font-black text-saged transition hover:bg-mist active:scale-[0.98]"
      >
        보호자와 이야기 고르기
      </button>
    </div>
  );
}
