'use client';

import Link from 'next/link';
import { Suspense as Boundary, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LessonWithProgress, Syllabus, SyllabusDetail } from '@/types/syllabus';

type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed';
type LessonWithDerivedStatus = LessonWithProgress & { derived_status?: string };
type ChildSummary = { name?: string; age?: number };

function getLessonStatus(lesson: LessonWithProgress): LessonStatus {
  const status = lesson.progress?.status ?? (lesson as LessonWithDerivedStatus).derived_status ?? 'locked';
  if (status === 'available' || status === 'in_progress' || status === 'completed') return status;
  return 'locked';
}

function flattenLessons(detail: SyllabusDetail | null) {
  return detail?.units.flatMap((unit) => unit.lessons) ?? [];
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-sagebg">
      <div
        className="h-full rounded-full bg-saged transition-[width] duration-700"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sagebg">
      <p className="text-sm font-medium text-gray-400">로딩 중...</p>
    </div>
  );
}

function StudyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const childId = searchParams.get('childId');

  const [child, setChild] = useState<ChildSummary | null>(null);
  const [syllabuses, setSyllabuses] = useState<Syllabus[]>([]);
  const [detail, setDetail] = useState<SyllabusDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!childId) return;

    setLoading(true);
    setError(null);

    try {
      const [childRes, syllabusRes] = await Promise.all([
        fetch(`/api/children/${childId}`),
        fetch('/api/syllabus'),
      ]);

      if (!childRes.ok || !syllabusRes.ok) {
        throw new Error('load_failed');
      }

      const childBody = (await childRes.json()) as ChildSummary;
      const syllabusBody = (await syllabusRes.json()) as { syllabuses?: Syllabus[] };
      const list = syllabusBody.syllabuses ?? [];

      setChild(childBody);
      setSyllabuses(list);

      const first = list[0];
      if (!first) {
        setDetail(null);
        return;
      }

      const detailRes = await fetch(`/api/syllabus/${first.id}?childId=${encodeURIComponent(childId)}`);
      if (!detailRes.ok) {
        throw new Error('detail_failed');
      }

      const detailBody = (await detailRes.json()) as { syllabus?: SyllabusDetail };
      setDetail(detailBody.syllabus ?? null);
    } catch {
      setError('학습 계획을 불러오지 못했어요.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    if (!childId) {
      router.replace('/dashboard');
      return;
    }

    void load();
  }, [childId, load, router]);

  const firstSyllabus = syllabuses[0] ?? null;
  const lessons = useMemo(() => flattenLessons(detail), [detail]);
  const completedLessons = lessons.filter((lesson) => getLessonStatus(lesson) === 'completed');
  const nextLesson = lessons.find((lesson) => {
    const status = getLessonStatus(lesson);
    return status === 'available' || status === 'in_progress';
  });
  const allDone = lessons.length > 0 && completedLessons.length === lessons.length;
  const weeklyGoal = detail?.enrollment?.cadence.lessons_per_week ?? 5;
  const recentCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const weekCompleted = completedLessons.filter((lesson) => {
    const completedAt = lesson.progress?.completed_at;
    if (!completedAt) return false;
    const time = new Date(completedAt).getTime();
    return Number.isFinite(time) && time >= recentCutoff;
  }).length;
  const weeklyPct = weeklyGoal > 0 ? (weekCompleted / weeklyGoal) * 100 : 0;
  const totalPct = lessons.length > 0 ? (completedLessons.length / lessons.length) * 100 : 0;

  const enroll = async () => {
    if (!childId || !firstSyllabus) return;

    setEnrolling(true);
    setError(null);

    try {
      const res = await fetch('/api/syllabus/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: childId, syllabus_id: firstSyllabus.id }),
      });

      if (!res.ok) {
        throw new Error('enroll_failed');
      }

      await load();
    } catch {
      setError('수강 등록에 실패했어요.');
    } finally {
      setEnrolling(false);
    }
  };

  if (!childId || loading) {
    return <LoadingScreen />;
  }

  if (error && syllabuses.length === 0 && !detail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sagebg px-6">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-500">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-saged px-6 text-sm font-bold text-white transition hover:bg-saged focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!firstSyllabus) {
    return (
      <div className="min-h-screen bg-sagebg pb-24">
        <div className="bg-saged px-6 pb-14 pt-12 text-white">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">학습 계획</p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight">학습 과정 준비 중이에요</h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-white/70">
            시작할 수 있는 학습 과정이 준비되면 여기에서 바로 열 수 있어요.
          </p>
        </div>
      </div>
    );
  }

  if (!detail?.enrollment) {
    return (
      <div className="min-h-screen bg-sagebg pb-24">
        <div className="bg-saged px-6 pb-14 pt-12 text-white">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">학습 계획</p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight">{child?.name ?? '아이'}의 학습 과정을 시작해요</h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-white/70">
            오늘 할 활동과 이번 주 흐름을 한 화면에서 확인할 수 있어요.
          </p>
        </div>

        <div className="px-6 pt-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-sage">등록 가능</p>
            <h2 className="mt-2 text-xl font-extrabold text-gray-900">{firstSyllabus.title}</h2>
            {firstSyllabus.description && (
              <p className="mt-2 text-sm font-medium leading-relaxed text-gray-500">{firstSyllabus.description}</p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-sagebg p-3">
                <p className="text-[11px] font-medium text-gray-400">과목</p>
                <p className="mt-1 text-sm font-bold text-saged">{firstSyllabus.subject}</p>
              </div>
              <div className="rounded-2xl bg-sagebg p-3">
                <p className="text-[11px] font-medium text-gray-400">연령</p>
                <p className="mt-1 text-sm font-bold text-saged">{firstSyllabus.age_band}세</p>
              </div>
            </div>
            {error && <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">{error}</p>}
            <button
              type="button"
              onClick={enroll}
              disabled={enrolling}
              className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-saged px-6 text-sm font-bold text-white shadow-lg shadow-sagebg/60 transition hover:bg-saged focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enrolling ? '등록 중...' : '학습 시작하기'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sagebg pb-24">
      <div className="bg-saged px-6 pb-14 pt-12 text-white">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">학습 계획</p>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight">{child?.name ?? '아이'}의 학습 계획</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-white/70">{detail.title}</p>
      </div>

      <div className="space-y-5 px-6 pt-6">
        {allDone ? (
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mist text-2xl">✓</div>
            <h2 className="text-xl font-extrabold text-gray-900">모든 활동을 마쳤어요!</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-gray-500">전체 학습 과정을 완료했어요.</p>
          </div>
        ) : (
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-sage">오늘 할 활동</p>
                <h2 className="mt-2 text-xl font-extrabold leading-tight text-gray-900">
                  {nextLesson?.title ?? '다음 활동 준비 중'}
                </h2>
                {nextLesson?.objective && (
                  <p className="mt-2 text-sm font-medium leading-relaxed text-gray-500">{nextLesson.objective}</p>
                )}
              </div>
              {nextLesson && (
                <span className="rounded-full bg-mist px-2.5 py-1 text-[11px] font-bold text-saged">
                  {nextLesson.estimated_min}분
                </span>
              )}
            </div>
            {nextLesson ? (
              <Link
                href={`/dashboard/study/lesson/${encodeURIComponent(nextLesson.id)}?childId=${encodeURIComponent(childId)}&syllabusId=${encodeURIComponent(detail.id)}`}
                className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-saged px-6 text-sm font-bold text-white shadow-lg shadow-sagebg/60 transition hover:bg-saged focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2"
              >
                시작하기
              </Link>
            ) : (
              <p className="mt-4 rounded-2xl bg-sagebg p-4 text-sm font-medium text-gray-500">
                아직 시작 가능한 활동이 없어요.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-base font-bold text-gray-900">이번 주 진도</h2>
              <span className="text-sm font-extrabold text-saged">
                {weekCompleted} / {weeklyGoal}개
              </span>
            </div>
            <ProgressBar value={weeklyPct} />
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-base font-bold text-gray-900">전체 진도</h2>
              <span className="text-sm font-extrabold text-saged">
                {completedLessons.length} / {lessons.length}개
              </span>
            </div>
            <ProgressBar value={totalPct} />
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-sage">등록된 학습 과정</p>
          <h2 className="mt-2 text-lg font-extrabold text-gray-900">{detail.title}</h2>
          {detail.description && <p className="mt-2 text-sm font-medium leading-relaxed text-gray-500">{detail.description}</p>}
          <Link
            href={`/dashboard/study/${encodeURIComponent(detail.id)}?childId=${encodeURIComponent(childId)}`}
            className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-line bg-sagebg px-6 text-sm font-bold text-saged transition hover:bg-mist focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2"
          >
            단원 학습표 보기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function StudyPage() {
  return (
    <Boundary fallback={<LoadingScreen />}>
      <StudyContent />
    </Boundary>
  );
}
