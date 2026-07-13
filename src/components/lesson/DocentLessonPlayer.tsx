'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { emitGameEvent } from '@/lib/game/events-client';
import { GLASS_DARK, GLASS_LIGHT } from '@/components/ui/glass';
import type { DocentLesson, LessonQuestion } from '@/content/lessons/seurat-01';
import type { GameRoundResult } from '@/types/game';

/**
 * 도슨트 수업 플레이어 (docs/plan/09 MVP-2) — 카톡 링크로 열리는 아이 모드 수업.
 * 영상이 장(章) 단위로 멈추고 질문 → 정직한 채점(정답 실재 문항만 is_correct) →
 * 기존 이벤트 파이프라인(game_sessions/rounds → 리포트 타임라인)으로 흘러간다.
 * 아이 표면이므로 유리 효과는 절제, 큰 타깃·큰 글자·따뜻한 피드백 우선 (09 §5).
 */

type Stage = 'intro' | 'video' | 'question' | 'feedback' | 'complete';

export default function DocentLessonPlayer({
  lesson,
  videoUrl,
  childId,
}: {
  lesson: DocentLesson;
  videoUrl: string;
  childId: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const questionShownAtRef = useRef(0);
  const answeredRef = useRef(false);
  const startedRef = useRef(false);
  const [stage, setStage] = useState<Stage>('intro');
  const [chapterIndex, setChapterIndex] = useState(0);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [scoredCount, setScoredCount] = useState(0);

  const chapter = lesson.chapters[chapterIndex];

  const emit = useCallback(
    async (event: Parameters<typeof emitGameEvent>[0]) => {
      const payload = {
        ...(event.payload ?? {}),
        ...(sessionIdRef.current && event.type !== 'game_started'
          ? { game_session_id: sessionIdRef.current }
          : {}),
      };
      return emitGameEvent(
        { ...event, payload: Object.keys(payload).length > 0 ? payload : undefined },
        { context: 'home', childId, topic: lesson.topic },
      );
    },
    [childId, lesson.topic],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void emit({
      type: 'game_started',
      payload: { rounds_total: lesson.chapters.length, world: 'docent_lesson' },
    }).then((res) => {
      if (res.game_session_id) sessionIdRef.current = res.game_session_id;
    });
  }, [emit, lesson.chapters.length]);

  // 장 구간 재생 — 종료 시각 도달 시 멈추고 질문으로.
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || stage !== 'video') return;
    if (video.currentTime >= chapter.endS - 0.05) {
      video.pause();
      questionShownAtRef.current = Date.now();
      answeredRef.current = false;
      setPickedIndex(null);
      setStage('question');
    }
  }, [chapter.endS, stage]);

  const startChapter = useCallback((index: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = lesson.chapters[index].startS;
    setChapterIndex(index);
    setStage('video');
    void video.play().catch(() => {});
  }, [lesson.chapters]);

  const buildResult = (question: LessonQuestion, optionIndex: number, latencyMs: number): GameRoundResult => {
    const isCorrect = question.scored ? optionIndex === question.correctIndex : null;
    return {
      game_type: question.gameType,
      difficulty: 1,
      objective_code: question.objectiveCode,
      standard_anchor: 'docent_lesson',
      // 정답이 실재하는 문항만 채점 — 관점·취향 문항에 점수를 지어내지 않는다 (로드맵 P0).
      score: question.scored ? (isCorrect ? 1 : 0) : null,
      max_score: question.scored ? 1 : null,
      is_correct: isCorrect,
      latency_ms: latencyMs,
      retried: false,
      auto_selected: false,
      reward_payload: null,
    };
  };

  const answer = useCallback(
    async (optionIndex: number) => {
      if (answeredRef.current) return;
      answeredRef.current = true;
      const question = chapter.question;
      const latency = Math.max(0, Date.now() - questionShownAtRef.current);
      setPickedIndex(optionIndex);
      if (question.scored) {
        setScoredCount((n) => n + 1);
        if (optionIndex === question.correctIndex) setCorrectCount((n) => n + 1);
      }
      setStage('feedback');
      await emit({
        type: 'game_round_completed',
        round_index: chapterIndex,
        result: buildResult(question, optionIndex, latency),
      });
    },
    [chapter.question, chapterIndex, emit],
  );

  const next = useCallback(async () => {
    if (chapterIndex + 1 < lesson.chapters.length) {
      startChapter(chapterIndex + 1);
      return;
    }
    setStage('complete');
    await emit({ type: 'game_completed', payload: { rounds_total: lesson.chapters.length } });
  }, [chapterIndex, emit, lesson.chapters.length, startChapter]);

  const question = chapter.question;
  const isCorrectPick = question.scored && pickedIndex === question.correctIndex;

  return (
    <main className="min-h-screen bg-cream text-ink [word-break:keep-all]">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-6">
        <header className="flex items-center justify-between">
          <span className="text-xs font-black tracking-[0.3em] text-ink3">KINDY 수업</span>
          <span className="rounded-full bg-sagebg px-3 py-1 text-xs font-black text-saged">
            {stage === 'complete' ? '완료!' : `${chapterIndex + 1} / ${lesson.chapters.length}`}
          </span>
        </header>

        {stage === 'intro' && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm font-bold text-ink2">{lesson.artwork}</p>
            <h1 className="mt-3 text-balance text-4xl font-black leading-snug">{lesson.title}</h1>
            <p className="mt-4 text-pretty text-base leading-relaxed text-ink2">
              그림이 살아 움직이는 이야기를 보다가,
              <br />
              중간중간 재미있는 질문에 답해 보자!
            </p>
            <button
              onClick={() => startChapter(0)}
              className="mt-10 min-h-16 w-full max-w-xs rounded-full bg-ink text-lg font-black text-cream transition active:scale-[0.97]"
            >
              수업 시작!
            </button>
          </section>
        )}

        <div className={stage === 'video' || stage === 'question' || stage === 'feedback' ? 'relative mx-auto mt-3 w-full max-w-[520px] flex-1 overflow-hidden rounded-3xl bg-[#101623]' : 'hidden'} style={{ aspectRatio: '9 / 16' }}>
          <video
            ref={videoRef}
            src={videoUrl}
            poster={lesson.posterPath}
            playsInline
            preload="auto"
            onTimeUpdate={handleTimeUpdate}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {stage === 'video' && (
            <p className="absolute inset-x-0 top-3 text-center text-sm font-bold text-white/70">
              {chapter.title}
            </p>
          )}

          {(stage === 'question' || stage === 'feedback') && (
            <section className="absolute inset-0 flex flex-col justify-center bg-black/50 px-4 backdrop-blur-sm" aria-live="polite">
              <h2 className="text-balance text-center text-2xl font-black leading-snug text-white">{question.prompt}</h2>
              <div className="mt-5 flex flex-col gap-3">
                {question.options.map((option, index) => {
                  const picked = pickedIndex === index;
                  const showCorrect = stage === 'feedback' && question.scored && index === question.correctIndex;
                  return (
                    <button
                      key={option}
                      onClick={() => answer(index)}
                      disabled={stage === 'feedback'}
                      className={`min-h-16 rounded-2xl border-2 px-5 text-lg font-black transition active:scale-[0.98] ${
                        showCorrect
                          ? 'border-sage bg-sagebg text-saged'
                          : picked
                            ? 'border-gold bg-white text-ink'
                            : 'border-white/30 bg-white/90 text-ink'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {stage === 'feedback' && (
                <div className={`${GLASS_DARK} mt-5 px-5 py-4 text-center`}>
                  <p className="text-base font-black leading-relaxed text-white">
                    {question.scored && !isCorrectPick ? '괜찮아! 정답을 같이 볼까? ' : ''}
                    {question.feedback}
                  </p>
                  {question.reasonPrompt && (
                    <p className="mt-2 text-sm font-bold leading-relaxed text-white/80">{question.reasonPrompt}</p>
                  )}
                  <button
                    onClick={next}
                    className="mt-4 min-h-14 w-full rounded-full bg-white text-base font-black text-ink transition active:scale-[0.97]"
                  >
                    {chapterIndex + 1 < lesson.chapters.length ? '다음 이야기 보기' : '수업 마치기'}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>

        {stage === 'complete' && (
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <div className={`${GLASS_LIGHT} w-full px-7 py-10`}>
              <p className="text-5xl">🎉</p>
              <h1 className="mt-4 text-3xl font-black">오늘 수업 끝!</h1>
              <p className="mt-3 text-pretty text-base font-bold leading-relaxed text-ink2">
                질문 {lesson.chapters.length}개를 모두 해냈어요
                {scoredCount > 0 ? ` · 관찰 퀴즈 ${correctCount}/${scoredCount}` : ''}.
              </p>
              <div className="mt-6 rounded-2xl bg-mist px-5 py-4 text-left">
                <p className="text-xs font-black tracking-[0.2em] text-sage">부모님께</p>
                <p className="mt-2 text-pretty text-sm font-semibold leading-relaxed text-ink2">
                  {lesson.parentPrompt}
                </p>
              </div>
              <Link
                href="/dashboard/report"
                className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-ink text-base font-bold text-cream transition active:scale-[0.98]"
              >
                부모님 리포트에서 오늘 기록 보기
              </Link>
              <button
                onClick={() => { setCorrectCount(0); setScoredCount(0); startChapter(0); }}
                className="mt-3 min-h-12 w-full rounded-full border border-line bg-white/60 text-sm font-bold text-ink2"
              >
                한 번 더 보기
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
