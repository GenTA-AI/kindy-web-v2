'use client';

import Link from 'next/link';
import { Suspense as Boundary, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import UnitProgressList from '@/components/syllabus/UnitProgressList';
import type { SyllabusDetail } from '@/types/syllabus';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-violet-50">
      <p className="text-sm font-medium text-gray-400">로딩 중...</p>
    </div>
  );
}

function SyllabusProgressContent() {
  const params = useParams<{ syllabusId: string | string[] }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const syllabusId = typeof params.syllabusId === 'string' ? params.syllabusId : params.syllabusId[0] ?? '';
  const childId = searchParams.get('childId');

  const [detail, setDetail] = useState<SyllabusDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!childId || !syllabusId) {
      router.replace('/dashboard');
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
          setError('진도표를 불러오지 못했어요.');
          setDetail(null);
          return;
        }

        const body = (await res.json()) as { syllabus?: SyllabusDetail };
        setDetail(body.syllabus ?? null);
        setError(body.syllabus ? null : '진도표를 찾을 수 없어요.');
      } catch {
        if (!cancelled) {
          setError('진도표를 불러오지 못했어요.');
          setDetail(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [childId, syllabusId, router]);

  if (!childId || loading) {
    return <LoadingScreen />;
  }

  if (error || !detail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-violet-50 px-6">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-500">{error ?? '진도표를 찾을 수 없어요.'}</p>
          <Link
            href={`/dashboard/study?childId=${encodeURIComponent(childId)}`}
            className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-violet-500 px-6 text-sm font-bold text-white transition hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:ring-offset-2"
          >
            학습 계획으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-violet-50 pb-24">
      <div className="bg-gradient-to-br from-violet-500 to-violet-400 px-6 pb-14 pt-12 text-white">
        <Link
          href={`/dashboard/study?childId=${encodeURIComponent(childId)}`}
          className="inline-flex min-h-[44px] items-center rounded-full bg-white/20 px-4 text-xs font-bold text-white transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/70"
        >
          학습 계획으로
        </Link>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-violet-100">단원 진도표</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">{detail.title}</h1>
        {detail.description && <p className="mt-2 text-sm font-medium leading-relaxed text-violet-100">{detail.description}</p>}
      </div>

      <div className="px-6 pt-6">
        <UnitProgressList detail={detail} childId={childId} />
      </div>
    </div>
  );
}

export default function SyllabusProgressPage() {
  return (
    <Boundary fallback={<LoadingScreen />}>
      <SyllabusProgressContent />
    </Boundary>
  );
}
