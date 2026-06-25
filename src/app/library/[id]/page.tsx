'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import LibraryPlayer from '@/components/LibraryPlayer';
import LibraryPostFlow from '@/components/LibraryPostFlow';
import type { Child } from '@/types';
import type { LibraryVideo } from '@/types/library';

function LibraryVideoContent() {
  const params = useParams<{ id: string | string[] }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : params.id[0] ?? '';
  const childId = searchParams.get('childId');

  const [video, setVideo] = useState<LibraryVideo | null>(null);
  const [childName, setChildName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [postFlowVisible, setPostFlowVisible] = useState(false);
  const playedRef = useRef(false);

  useEffect(() => {
    if (!id || !childId) {
      router.replace('/dashboard');
      return;
    }

    let cancelled = false;
    playedRef.current = false;
    setPostFlowVisible(false);

    (async () => {
      const [videoRes, childRes] = await Promise.all([
        fetch(`/api/library/${id}`),
        fetch(`/api/children/${childId}`),
      ]);
      if (cancelled) return;

      if (!videoRes.ok) {
        setError('영상을 찾을 수 없어요.');
        return;
      }

      const videoBody = (await videoRes.json()) as { video?: LibraryVideo };
      setError(null);
      setVideo(videoBody.video ?? null);

      if (childRes.ok) {
        const childBody = (await childRes.json()) as Pick<Child, 'name'>;
        setChildName(childBody.name ?? null);
      } else {
        setChildName(null);
      }
    })().catch(() => {
      if (!cancelled) setError('영상을 불러오지 못했어요.');
    });

    return () => {
      cancelled = true;
    };
  }, [id, childId, router]);

  const recordEvent = async (event_type: 'play' | 'complete') => {
    if (!childId) return;
    try {
      await fetch(`/api/library/${id}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: childId, event_type }),
      });
    } catch {
      // best-effort
    }
  };

  const onPlay = () => {
    if (playedRef.current) return;
    playedRef.current = true;
    void recordEvent('play');
  };

  const onEnded = () => {
    void recordEvent('complete');
    setPostFlowVisible(true);
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-violet-50 px-6">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-600">{error}</p>
          <Link
            href={`/library?childId=${childId ?? ''}`}
            className="mt-3 inline-block text-sm font-bold text-violet-600 underline underline-offset-2"
          >
            라이브러리로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-violet-50">
        <p className="text-sm font-medium text-gray-400">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-violet-50">
      <div className="mx-auto max-w-[375px] bg-white">
        <LibraryPlayer
          videoUrl={video.video_url}
          posterUrl={video.thumbnail_url}
          subtitlesUrl={video.subtitles_url ?? null}
          onPlay={onPlay}
          onEnded={onEnded}
        />
        {!postFlowVisible && (
          <div className="px-6 pb-10 pt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">
              {childName ? `${childName}의 라이브러리` : 'Kindy 라이브러리'}
            </p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-violet-500">
              {video.topic} · {video.age_band}세
            </p>
            <h1 className="mt-1 text-xl font-extrabold leading-[1.35] text-gray-900">{video.title}</h1>
            {video.description && <p className="mt-2 text-sm font-medium leading-relaxed text-gray-600">{video.description}</p>}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {video.style_tags.map((tag) => (
                <span key={tag} className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                  {tag}
                </span>
              ))}
            </div>
            <Link
              href={`/library?childId=${childId ?? ''}`}
              className="mt-6 block w-full rounded-xl border border-violet-100 bg-violet-50 px-6 py-3 text-center text-sm font-bold text-violet-600 transition hover:bg-violet-100"
            >
              라이브러리에서 더 보기
            </Link>
          </div>
        )}
        {postFlowVisible && (
          <div className="bg-white">
            <LibraryPostFlow libraryVideoId={video.id} childId={childId!} childAge={undefined} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function LibraryVideoPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex min-h-screen items-center justify-center bg-violet-50">
          <p className="text-sm font-medium text-gray-400">로딩 중...</p>
        </div>
      )}
    >
      <LibraryVideoContent />
    </Suspense>
  );
}
