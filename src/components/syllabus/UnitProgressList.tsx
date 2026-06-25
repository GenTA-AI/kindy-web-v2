'use client';

import Link from 'next/link';
import type { LessonWithProgress, SyllabusDetail } from '@/types/syllabus';

type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed';
type LessonWithDerivedStatus = LessonWithProgress & { derived_status?: string };

interface Props {
  detail: SyllabusDetail;
  childId: string;
}

function getLessonStatus(lesson: LessonWithProgress): LessonStatus {
  const derived = (lesson as LessonWithDerivedStatus).derived_status;
  const status = lesson.progress?.status ?? derived ?? 'locked';

  if (status === 'available' || status === 'in_progress' || status === 'completed') {
    return status;
  }

  return 'locked';
}

function StatusBadge({ lesson }: { lesson: LessonWithProgress }) {
  if (lesson.library_video_id === null) {
    return (
      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-500">
        콘텐츠 준비중
      </span>
    );
  }

  const status = getLessonStatus(lesson);

  if (status === 'completed') {
    return (
      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-600">
        ✓ 완료{typeof lesson.progress?.quiz_score === 'number' ? ` · 퀴즈 ${lesson.progress.quiz_score}개 맞음` : ''}
      </span>
    );
  }

  if (status === 'in_progress') {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-600">
        학습 중
      </span>
    );
  }

  if (status === 'available') {
    return (
      <span className="rounded-full bg-violet-500 px-2.5 py-1 text-[11px] font-bold text-white">
        시작 가능
      </span>
    );
  }

  return (
    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-400">
      🔒 잠김
    </span>
  );
}

function LessonRow({ lesson, childId, syllabusId }: { lesson: LessonWithProgress; childId: string; syllabusId: string }) {
  const status = getLessonStatus(lesson);
  const canOpen = lesson.library_video_id !== null && (status === 'available' || status === 'in_progress');
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-gray-900">{lesson.title}</h3>
            <p className="mt-1 text-[11px] font-medium text-gray-400">{lesson.estimated_min}분 예상</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <StatusBadge lesson={lesson} />
          </div>
        </div>
        {lesson.objective && (
          <p className="mt-2 line-clamp-2 text-xs font-medium leading-relaxed text-gray-500">{lesson.objective}</p>
        )}
      </div>
      {canOpen && <span className="flex-shrink-0 text-violet-400">›</span>}
    </>
  );

  if (canOpen) {
    return (
      <Link
        href={`/dashboard/study/lesson/${lesson.id}?childId=${encodeURIComponent(childId)}&syllabusId=${encodeURIComponent(syllabusId)}`}
        className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm transition hover:border-violet-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-300 focus:ring-offset-2"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 opacity-60 shadow-sm">
      {content}
    </div>
  );
}

export default function UnitProgressList({ detail, childId }: Props) {
  return (
    <div className="space-y-4">
      {detail.units.map((unit) => (
        <section key={unit.id} className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">단원 {unit.sort_order}</p>
            <h2 className="mt-1 text-lg font-extrabold text-gray-900">{unit.title}</h2>
            {unit.objective && <p className="mt-2 text-sm font-medium leading-relaxed text-gray-500">{unit.objective}</p>}
          </div>
          <div className="space-y-2">
            {unit.lessons.length === 0 ? (
              <div className="rounded-2xl bg-violet-50 p-4 text-center text-sm font-medium text-gray-500">
                아직 등록된 차시가 없어요.
              </div>
            ) : (
              unit.lessons.map((lesson) => (
                <LessonRow key={lesson.id} lesson={lesson} childId={childId} syllabusId={detail.id} />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
