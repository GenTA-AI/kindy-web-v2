'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LibraryCard from '@/components/LibraryCard';
import LibraryFilters from '@/components/LibraryFilters';
import type { Child } from '@/types';
import type { LibraryVideo } from '@/types/library';

function LibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const childId = searchParams.get('childId');
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [childName, setChildName] = useState<string | null>(null);
  const [ageBand, setAgeBand] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId) {
      router.replace('/dashboard');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/children/${childId}`);
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as Pick<Child, 'name'>;
          setChildName(body.name ?? null);
        } else {
          setChildName(null);
        }
      } catch {
        if (!cancelled) setChildName(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [childId, router]);

  useEffect(() => {
    if (!childId) {
      router.replace('/dashboard');
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      const params = new URLSearchParams();
      if (ageBand) params.set('age_band', String(ageBand));

      try {
        const res = await fetch(`/api/library?${params.toString()}`);
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as { videos?: LibraryVideo[] };
          setVideos(body.videos ?? []);
        } else {
          setVideos([]);
        }
      } catch {
        if (!cancelled) setVideos([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [childId, ageBand, router]);

  if (!childId) return null;

  return (
    <div className="min-h-screen bg-violet-50">
      <div className="mx-auto max-w-[375px] px-6 pb-12 pt-10">
        <header className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-violet-500">Kindy 라이브러리</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-[1.3] text-gray-900">
            {childName ? `${childName}에게 맞는 영상` : '우리 아이가 좋아할 영상'}
          </h1>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-gray-600">
            한 이야기로 생각하는 힘을 키워요. 시청 데이터로 다음 영상이 더 잘 맞춰져요.
          </p>
        </header>

        <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
          <LibraryFilters currentAge={ageBand} onAgeChange={setAgeBand} />
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm font-medium text-gray-400">로딩 중...</p>
        ) : videos.length === 0 ? (
          <p className="py-12 text-center text-sm font-medium text-gray-400">조건에 맞는 영상이 아직 없어요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {videos.map((video) => (
              <LibraryCard key={video.id} video={video} childId={childId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex min-h-screen items-center justify-center bg-violet-50">
          <p className="text-sm font-medium text-gray-400">로딩 중...</p>
        </div>
      )}
    >
      <LibraryContent />
    </Suspense>
  );
}
