'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import LibraryPlayer from '@/components/LibraryPlayer';
import { LOCAL_PREVIEW_ATTENTION_QUESTIONS } from '@/lib/library-preview';
import { topicLabel } from '@/lib/topic-label';
import type { LibraryVideo } from '@/types/library';

const START_HREF = '/auth/login?next=/onboarding';

type SampleLibraryVideoClientProps = {
  video: LibraryVideo;
};

type SampleFocus = 'appearance' | 'action' | 'detail' | 'count';

function focusLabel(focus: SampleFocus) {
  if (focus === 'appearance') return '모양 단서';
  if (focus === 'action') return '움직임 단서';
  if (focus === 'count') return '개수 단서';
  return '장면 단서';
}

export default function SampleLibraryVideoClient({ video }: SampleLibraryVideoClientProps) {
  const questions = LOCAL_PREVIEW_ATTENTION_QUESTIONS;
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const currentQuestion = questions[currentIndex];
  const foundLabels = useMemo(
    () => answers.map((answer, index): string | null => {
      const question = questions[index];
      if (!question) return null;
      return answer === question.correctAnswer ? focusLabel(question.focus as SampleFocus) : '다시 본 단서';
    }).filter((label): label is string => Boolean(label)),
    [answers, questions],
  );

  const submit = (answerIndex: number) => {
    if (selectedAnswer !== null || !currentQuestion) return;

    setSelectedAnswer(answerIndex);
    window.setTimeout(() => {
      const nextAnswers = [...answers, answerIndex];
      setAnswers(nextAnswers);

      if (currentIndex + 1 >= questions.length) {
        setDone(true);
        return;
      }

      setCurrentIndex((index) => index + 1);
      setSelectedAnswer(null);
    }, 900);
  };

  if (done) {
    return (
      <main className="min-h-screen bg-cream text-ink [word-break:keep-all]">
        <div className="mx-auto w-full max-w-[430px] px-5 py-8">
          <section className="rounded-[34px] bg-saged p-6 text-center text-white shadow-[0_24px_70px_-44px_rgba(35,49,38,.65)]">
            <p className="text-[11px] font-black uppercase tracking-[.16em] text-white/70">오늘 놀이는 여기까지</p>
            <h1 className="mt-3 text-3xl font-black leading-tight">오늘 단서 놀이를 마쳤어요</h1>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-white/82">
              아이가 고른 단서와 다시 본 순간은 보호자에게 보여줄 기록으로 정리됩니다.
            </p>
          </section>

          <section className="mt-5 rounded-[30px] border border-line bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[.16em] text-sage">오늘 남는 기록 예시</p>
            <div className="mt-4 grid gap-2">
              {[
                ['이미 잘 들어온 부분', foundLabels[0] ?? '자세히 보기'],
                ['다음에 더 해볼 놀이', '닮은 것 잇기'],
                ['보호자 한마디', '처음엔 안 보였는데 다시 보니 뭐가 보였어?'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-mist p-4">
                  <p className="text-xs font-black text-sage">{label}</p>
                  <p className="mt-1 text-base font-black leading-snug text-ink">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-5 grid gap-2">
            <Link
              href="/sample/report"
              className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-saged px-6 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
            >
              기록 예시 보기
            </Link>
            <Link
              href={START_HREF}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-white px-6 text-sm font-black text-saged transition hover:bg-mist active:scale-[0.98]"
            >
              무료로 시작하기
            </Link>
            <Link
              href="/sample/library"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-cream px-6 text-sm font-black text-ink3 transition hover:bg-mist active:scale-[0.98]"
            >
              보호자와 이야기 고르기
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream text-ink [word-break:keep-all]">
      <div className="mx-auto w-full max-w-[430px] bg-white pb-10 shadow-sm">
        <LibraryPlayer
          videoUrl={video.video_url}
          posterUrl={video.thumbnail_url}
          subtitlesUrl={video.subtitles_url}
          onEnded={() => setShowQuiz(true)}
        />

        <section className="px-5 py-5">
          <Link href="/sample/library" className="text-sm font-black text-saged underline underline-offset-4">
            이야기 숲으로
          </Link>
          <p className="mt-5 text-[11px] font-black uppercase tracking-[.16em] text-sage">
            {topicLabel(video.topic)} · {video.age_band}세
          </p>
          <h1 className="mt-2 text-2xl font-black leading-tight">{video.title}</h1>
          {video.description && <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">{video.description}</p>}

          {!showQuiz && (
            <div className="mt-6 grid gap-2">
              <button
                type="button"
                onClick={() => setShowQuiz(true)}
                className="min-h-14 rounded-2xl bg-saged px-6 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
              >
                영상을 봤다면 단서 놀이 시작
              </button>
              <p className="text-center text-xs font-bold leading-relaxed text-ink3">
                아이 화면에는 광고와 결제 버튼이 나오지 않아요.
              </p>
            </div>
          )}
        </section>

        {showQuiz && currentQuestion && (
          <section className="border-t border-line px-5 py-6">
            <p className="text-[11px] font-black uppercase tracking-[.16em] text-sage">
              단서 질문 {currentIndex + 1} / {questions.length}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-mist" aria-hidden="true">
              <div
                className="h-full rounded-full bg-sage transition-all duration-300"
                style={{ width: `${Math.round((currentIndex / questions.length) * 100)}%` }}
              />
            </div>
            <h2 className="mt-4 text-xl font-black leading-snug">{currentQuestion.question}</h2>
            <p className="mt-2 inline-flex rounded-full bg-sagebg px-3 py-1 text-xs font-black text-saged">
              {focusLabel(currentQuestion.focus)}
            </p>

            <div className="mt-5 grid gap-2">
              {currentQuestion.options.map((option, index) => {
                const answered = selectedAnswer !== null;
                const correct = index === currentQuestion.correctAnswer;
                const selected = selectedAnswer === index;
                const stateClass = selected
                  ? correct
                    ? 'border-sage bg-sagebg text-saged'
                    : 'border-clay/40 bg-cream text-clay'
                  : answered && correct
                    ? 'border-sage bg-sagebg text-saged'
                    : 'border-line bg-white text-ink2 hover:border-sage hover:bg-mist';

                return (
                  <button
                    key={option}
                    type="button"
                    disabled={answered}
                    onClick={() => submit(index)}
                    className={`min-h-14 rounded-2xl border px-4 py-3 text-left text-base font-black transition active:scale-[0.99] disabled:cursor-default ${stateClass}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {selectedAnswer !== null && (
              <div className="mt-4 rounded-2xl bg-mist px-4 py-3" aria-live="polite">
                <p className="text-sm font-black text-saged">
                  {selectedAnswer === currentQuestion.correctAnswer
                    ? '찾았어요. 모리 빛이 반짝였어요.'
                    : `좋아요. 모리는 "${currentQuestion.options[currentQuestion.correctAnswer]}" 단서도 함께 보여줄게요.`}
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
