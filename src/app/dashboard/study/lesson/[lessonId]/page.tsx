'use client';

import Link from 'next/link';
import { Suspense as Boundary, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import LessonRunner from '@/components/syllabus/LessonRunner';
import type { LessonWithProgress, SyllabusDetail } from '@/types/syllabus';

type LessonWithDerivedStatus = LessonWithProgress & { derived_status?: string };

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-violet-50">
      <p className="text-sm font-medium text-gray-400">로딩 중...</p>
    </div>
  );
}

function LessonPageContent() {
  const params = useParams<{ lessonId: string | string[] }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const lessonId = typeof params.lessonId === 'string' ? params.lessonId : params.lessonId[0] ?? '';
  const childId = searchParams.get('childId');
  const syllabusId = searchParams.get('syllabusId');

  const [lesson, setLesson] = useState<LessonWithDerivedStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) {
      router.replace('/dashboard');
      return;
    }

    if (!syllabusId || !lessonId) {
      router.replace(`/dashboard/study?childId=${encodeURIComponent(childId)}`);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/syllabus/${syllabusId}?childId=${encodeURIComponent(childId)}`);
        if (cancelled) return;

        if (!res.ok) {
          setError('차시 정보를 불러오지 못했어요.');
          setLesson(null);
          return;
        }

        const body = (await res.json()) as { syllabus?: SyllabusDetail };
        const found = body.syllabus?.units
          .flatMap((unit) => unit.lessons)
          .find((item) => item.id === lessonId) as LessonWithDerivedStatus | undefined;

        setLesson(found ?? null);
        setError(found ? null : '차시를 찾을 수 없어요.');
      } catch {
        if (!cancelled) {
          setError('차시 정보를 불러오지 못했어요.');
          setLesson(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [childId, lessonId, syllabusId, router]);

  if (!childId || !syllabusId || loading) {
    return <LoadingScreen />;
  }

  if (error || !lesson) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-violet-50 px-6">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-500">{error ?? '차시를 찾을 수 없어요.'}</p>
          <Link
            href={`/dashboard/study/${encodeURIComponent(syllabusId)}?childId=${encodeURIComponent(childId)}`}
            className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-violet-500 px-6 text-sm font-bold text-white transition hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:ring-offset-2"
          >
            진도표로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return <LessonRunner lesson={lesson} childId={childId} syllabusId={syllabusId} />;
}

export default function LessonPage() {
  return (
    <Boundary fallback={<LoadingScreen />}>
      <LessonPageContent />
    </Boundary>
  );
}
