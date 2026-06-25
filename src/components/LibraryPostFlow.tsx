'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AttentionQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  focus: string;
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
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/attention-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ library_video_id: libraryVideoId, child_age: childAge }),
        });
        if (cancelled) return;

        if (!res.ok) {
          setError('퀴즈를 준비하지 못했어요.');
          setLoading(false);
          return;
        }

        const body = (await res.json()) as { questions?: AttentionQuestion[] };
        setQuestions(body.questions ?? []);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('퀴즈를 준비하지 못했어요.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [libraryVideoId, childAge]);

  const submit = (answerIdx: number) => {
    const next = [...answers, answerIdx];
    setAnswers(next);

    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setDone(true);
    }
  };

  if (loading) {
    return <div className="px-6 py-10 text-center text-sm text-gray-400">퀴즈 준비 중...</div>;
  }

  if (error || questions.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm text-gray-500">{error ?? '이 영상엔 아직 퀴즈가 없어요.'}</p>
        <ConversionCta childId={childId} />
      </div>
    );
  }

  if (done) {
    const correct = answers.filter((answer, index) => answer === questions[index].correctAnswer).length;

    return (
      <div className="px-6 py-10">
        <p className="text-center text-[11px] font-bold uppercase tracking-wider text-violet-500">퀴즈 완료</p>
        <h2 className="mt-2 text-center text-xl font-extrabold text-gray-900">
          {correct} / {questions.length} 맞췄어요!
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-gray-600">
          이 스타일이 우리 아이에게 잘 맞나요?<br />이름을 부르며 가르치는 맞춤 영상도 만들어보세요.
        </p>
        <ConversionCta childId={childId} />
      </div>
    );
  }

  const q = questions[currentIdx];

  return (
    <div className="px-6 py-8">
      <p className="text-[11px] font-bold uppercase tracking-wider text-violet-500">
        퀴즈 {currentIdx + 1} / {questions.length}
      </p>
      <h2 className="mt-2 text-lg font-extrabold leading-snug text-gray-900">{q.question}</h2>
      <div className="mt-5 space-y-2">
        {q.options.map((option, index) => (
          <button
            key={option}
            type="button"
            onClick={() => submit(index)}
            className="w-full rounded-xl border border-violet-100 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-800 transition hover:border-violet-200 hover:bg-violet-50 active:scale-[0.99]"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConversionCta({ childId }: { childId: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(`/dashboard?childId=${encodeURIComponent(childId)}`)}
      className="mt-5 block w-full rounded-2xl bg-violet-500 px-6 py-4 text-center text-base font-bold text-white shadow-lg shadow-violet-200/60 transition hover:bg-violet-600 active:scale-[0.98]"
    >
      우리 아이만의 영상 만들어보기
    </button>
  );
}
