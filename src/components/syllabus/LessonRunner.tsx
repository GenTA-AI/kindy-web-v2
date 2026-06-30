'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import LibraryPlayer from '@/components/LibraryPlayer';
import type { LibraryVideo } from '@/types/library';
import type { LessonWithProgress } from '@/types/syllabus';

interface AttentionQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  focus: string;
}

interface ProgressResponse {
  unlockedLessonId?: string | null;
}

interface Props {
  lesson: LessonWithProgress & { derived_status?: string };
  childId: string;
  syllabusId: string;
  childAge?: number;
}

type Step = 'video' | 'quiz' | 'done';
type ProgressAction = 'video_watched' | 'quiz_completed' | 'complete';

function BackToProgressLink({ childId, syllabusId }: { childId: string; syllabusId: string }) {
  return (
    <Link
      href={`/dashboard/study/${encodeURIComponent(syllabusId)}?childId=${encodeURIComponent(childId)}`}
      className="inline-flex min-h-[44px] items-center rounded-full bg-white/20 px-4 text-xs font-bold text-white transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/70"
    >
      학습표로 돌아가기
    </Link>
  );
}

export default function LessonRunner({ lesson, childId, syllabusId, childAge }: Props) {
  const [step, setStep] = useState<Step>('video');
  const [video, setVideo] = useState<LibraryVideo | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AttentionQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [completionLoading, setCompletionLoading] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [completedScore, setCompletedScore] = useState<number | null>(null);
  const [quizTotal, setQuizTotal] = useState<number | null>(null);
  const [quizSkipped, setQuizSkipped] = useState(false);
  const [unlockedLessonId, setUnlockedLessonId] = useState<string | null>(null);
  const playedRef = useRef(false);
  const quizStartedRef = useRef(false);
  const completionStartedRef = useRef(false);
  const answerAdvanceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (answerAdvanceTimerRef.current !== null) window.clearTimeout(answerAdvanceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setStep('video');
    setVideo(null);
    setVideoError(null);
    setQuestions([]);
    setCurrentIdx(0);
    setAnswers([]);
    setSelectedAnswer(null);
    setQuizLoading(false);
    setCompletionLoading(false);
    setCompletionError(null);
    setCompletedScore(null);
    setQuizTotal(null);
    setQuizSkipped(false);
    setUnlockedLessonId(null);
    playedRef.current = false;
    quizStartedRef.current = false;
    completionStartedRef.current = false;
  }, [lesson.id]);

  useEffect(() => {
    if (!lesson.library_video_id) return;

    let cancelled = false;
    setVideoLoading(true);
    setVideoError(null);

    (async () => {
      try {
        const res = await fetch(`/api/library/${lesson.library_video_id}`);
        if (cancelled) return;

        if (!res.ok) {
          setVideoError('영상을 불러오지 못했어요.');
          setVideo(null);
          return;
        }

        const body = (await res.json()) as { video?: LibraryVideo };
        setVideo(body.video ?? null);
        setVideoError(body.video ? null : '영상을 찾을 수 없어요.');
      } catch {
        if (!cancelled) {
          setVideoError('영상을 불러오지 못했어요.');
          setVideo(null);
        }
      } finally {
        if (!cancelled) setVideoLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lesson.library_video_id]);

  const postProgress = useCallback(async (action: ProgressAction, quizScore?: number) => {
    const body: {
      child_id: string;
      lesson_id: string;
      action: ProgressAction;
      quiz_score?: number;
    } = {
      child_id: childId,
      lesson_id: lesson.id,
      action,
    };

    if (typeof quizScore === 'number') {
      body.quiz_score = quizScore;
    }

    const res = await fetch('/api/syllabus/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error('progress_failed');
    }

    return (await res.json()) as ProgressResponse;
  }, [childId, lesson.id]);

  const completeLesson = useCallback(async (score?: number, total?: number, skipped = false) => {
    if (completionStartedRef.current) return;

    completionStartedRef.current = true;
    setCompletionLoading(true);
    setCompletionError(null);
    setCompletedScore(typeof score === 'number' ? score : null);
    setQuizTotal(typeof total === 'number' ? total : null);
    setQuizSkipped(skipped);

    try {
      const body = await postProgress('complete', score);
      setUnlockedLessonId(body.unlockedLessonId ?? null);
    } catch {
      setCompletionError('활동 완료 저장에 실패했어요. 학습표에서 다시 확인해주세요.');
    } finally {
      setCompletionLoading(false);
      setStep('done');
    }
  }, [postProgress]);

  useEffect(() => {
    if (step !== 'quiz' || !lesson.library_video_id || quizStartedRef.current) return;

    let cancelled = false;
    quizStartedRef.current = true;
    setQuizLoading(true);

    (async () => {
      try {
        const res = await fetch('/api/attention-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ library_video_id: lesson.library_video_id, child_age: childAge }),
        });
        if (cancelled) return;

        if (!res.ok) {
          setQuizLoading(false);
          void completeLesson(undefined, undefined, true);
          return;
        }

        const body = (await res.json()) as { questions?: AttentionQuestion[] };
        const nextQuestions = body.questions ?? [];

        if (nextQuestions.length === 0) {
          setQuizLoading(false);
          void completeLesson(undefined, undefined, true);
          return;
        }

        setQuestions(nextQuestions);
        setCurrentIdx(0);
        setAnswers([]);
        setSelectedAnswer(null);
        setQuizLoading(false);
      } catch {
        if (!cancelled) {
          setQuizLoading(false);
          void completeLesson(undefined, undefined, true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step, lesson.library_video_id, childAge, completeLesson]);

  const onPlay = () => {
    if (playedRef.current) return;
    playedRef.current = true;
    void postProgress('video_watched').catch(() => undefined);
  };

  const onEnded = () => {
    setStep('quiz');
  };

  const completeQuiz = useCallback(async (nextAnswers: number[]) => {
    const correct = nextAnswers.filter((answer, index) => answer === questions[index].correctAnswer).length;
    setCompletionLoading(true);

    try {
      await postProgress('quiz_completed', correct);
    } catch {
      // Completing the lesson should not be blocked by a transient quiz-score write failure.
    }

    await completeLesson(correct, questions.length, false);
  }, [completeLesson, postProgress, questions]);

  const submitAnswer = (answerIdx: number) => {
    if (selectedAnswer !== null) return;

    const nextAnswers = [...answers, answerIdx];
    setAnswers(nextAnswers);
    setSelectedAnswer(answerIdx);

    if (answerAdvanceTimerRef.current !== null) window.clearTimeout(answerAdvanceTimerRef.current);
    answerAdvanceTimerRef.current = window.setTimeout(() => {
      answerAdvanceTimerRef.current = null;

      if (currentIdx + 1 < questions.length) {
        setCurrentIdx((idx) => idx + 1);
        setSelectedAnswer(null);
        return;
      }

      void completeQuiz(nextAnswers);
    }, 1200);
  };

  if (lesson.library_video_id === null) {
    return (
      <div className="min-h-screen bg-sagebg pb-24">
        <div className="bg-saged px-6 pb-12 pt-12 text-white">
          <BackToProgressLink childId={childId} syllabusId={syllabusId} />
          <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-white/70">오늘 학습</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight">{lesson.title}</h1>
        </div>
        <div className="px-6 pt-6">
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-mist text-xl">⌛</div>
            <h2 className="text-lg font-extrabold text-gray-900">이 활동은 콘텐츠 준비 중이에요</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-gray-500">
              영상이 연결되면 바로 학습할 수 있어요. 지금은 학습표에서 다른 활동을 확인해주세요.
            </p>
            <Link
              href={`/dashboard/study/${encodeURIComponent(syllabusId)}?childId=${encodeURIComponent(childId)}`}
              className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-saged px-6 text-sm font-bold text-white shadow-lg shadow-sagebg/60 transition hover:bg-saged focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2"
            >
              학습표로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'quiz') {
    const question = questions[currentIdx];

    return (
      <div className="min-h-screen bg-sagebg pb-24">
        <div className="bg-saged px-6 pb-12 pt-12 text-white">
          <BackToProgressLink childId={childId} syllabusId={syllabusId} />
          <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-white/70">단서 질문</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight">{lesson.title}</h1>
        </div>
        <div className="px-6 pt-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            {quizLoading || completionLoading || !question ? (
              <div className="py-10 text-center">
                <p className="text-sm font-bold text-sage">
                  {completionLoading ? '활동 완료 저장 중...' : '단서 질문 준비 중...'}
                </p>
                <p className="mt-2 text-xs font-medium text-gray-400">잠시만 기다려주세요.</p>
              </div>
            ) : (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wider text-sage">
                  단서 질문 {currentIdx + 1} / {questions.length}
                </p>
                <h2 className="mt-2 text-xl font-extrabold leading-snug text-gray-900">{question.question}</h2>
                <div className="mt-5 space-y-2">
                  {question.options.map((option, index) => (
                    (() => {
                      const isSelected = selectedAnswer === index;
                      const isAnswered = selectedAnswer !== null;
                      const selectedClass = isSelected
                        ? index === question.correctAnswer
                          ? 'border-sage bg-sagebg text-saged'
                          : 'border-clay/40 bg-cream text-clay'
                        : 'border-line bg-white text-gray-800 hover:border-sagebg hover:bg-sagebg';

                      return (
                        <button
                          key={`${question.question}-${option}`}
                          type="button"
                          onClick={() => submitAnswer(index)}
                          disabled={isAnswered}
                          className={`w-full min-h-[44px] rounded-xl border px-4 py-3 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 active:scale-[0.99] disabled:cursor-default ${selectedClass}`}
                        >
                          {option}
                        </button>
                      );
                    })()
                  ))}
                </div>
                {selectedAnswer !== null && (
                  <p className="mt-4 rounded-2xl bg-mist px-4 py-3 text-sm font-extrabold text-saged" aria-live="polite">
                    {selectedAnswer === question.correctAnswer ? '단서를 찾았어요. 다음으로 가요.' : '좋아요. 고른 단서도 기록했어요.'}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-sagebg pb-24">
        <div className="bg-saged px-6 pb-12 pt-12 text-white">
          <BackToProgressLink childId={childId} syllabusId={syllabusId} />
          <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-white/70">활동 완료</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight">{lesson.title}</h1>
        </div>
        <div className="px-6 pt-6">
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mist text-2xl">✓</div>
            <h2 className="text-2xl font-extrabold text-gray-900">오늘 활동 완료!</h2>
            {quizSkipped ? (
              <p className="mt-3 text-sm font-medium leading-relaxed text-gray-500">
                이 영상은 아직 단서 질문이 없어 바로 완료했어요.
              </p>
            ) : (
              <p className="mt-3 text-sm font-medium leading-relaxed text-gray-500">
                단서 질문 {completedScore ?? 0}{quizTotal ? ` / ${quizTotal}` : ''}개를 끝까지 골랐어요.
              </p>
            )}
            {completionError && (
              <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                {completionError}
              </p>
            )}
            <div className="mt-6 space-y-2">
              {unlockedLessonId ? (
                <Link
                  href={`/dashboard/study/lesson/${encodeURIComponent(unlockedLessonId)}?childId=${encodeURIComponent(childId)}&syllabusId=${encodeURIComponent(syllabusId)}`}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-saged px-6 text-sm font-bold text-white shadow-lg shadow-sagebg/60 transition hover:bg-saged focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2"
                >
                  다음 활동 시작하기
                </Link>
              ) : (
                <Link
                  href={`/dashboard/study?childId=${encodeURIComponent(childId)}`}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-saged px-6 text-sm font-bold text-white shadow-lg shadow-sagebg/60 transition hover:bg-saged focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2"
                >
                  모든 활동을 마쳤어요!
                </Link>
              )}
              <Link
                href={`/dashboard/study/${encodeURIComponent(syllabusId)}?childId=${encodeURIComponent(childId)}`}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-line bg-sagebg px-6 text-sm font-bold text-saged transition hover:bg-mist focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2"
              >
                학습표로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sagebg pb-24">
      <div className="bg-saged px-6 pb-14 pt-12 text-white">
        <BackToProgressLink childId={childId} syllabusId={syllabusId} />
        <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-white/70">오늘 학습</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">{lesson.title}</h1>
        {lesson.objective && <p className="mt-2 text-sm font-medium leading-relaxed text-white/70">{lesson.objective}</p>}
      </div>

      <div className="px-6 pt-6">
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          {videoLoading && (
            <div className="flex aspect-video items-center justify-center bg-white text-sm font-medium text-gray-400">
              영상 로딩 중...
            </div>
          )}
          {!videoLoading && videoError && (
            <div className="flex aspect-video items-center justify-center bg-white px-6 text-center text-sm font-medium text-gray-500">
              {videoError}
            </div>
          )}
          {!videoLoading && video && (
            <LibraryPlayer
              videoUrl={video.video_url}
              posterUrl={video.thumbnail_url}
              subtitlesUrl={video.subtitles_url ?? null}
              onPlay={onPlay}
              onEnded={onEnded}
            />
          )}
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-sage">영상 시청</p>
            <h2 className="mt-1 text-lg font-extrabold text-gray-900">{video?.title ?? lesson.title}</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-gray-500">
              영상을 끝까지 보면 단서 질문이 열려요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
