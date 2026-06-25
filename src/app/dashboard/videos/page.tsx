'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Child, Video, VideoPhase } from '@/types';
import ChildSwitcher from '@/components/ChildSwitcher';

const PHASE_LABEL: Record<VideoPhase, string> = {
  director: '대본 작성',
  refs: '캐릭터 디자인',
  keyframes: '장면 구성',
  video_s01: '영상 생성 (전반부)',
  video_s02: '영상 생성 (후반부)',
  concat: '편집',
  upload: '업로드',
  done: '완료',
};

type Filter = 'all' | 'ready' | 'in_progress' | 'failed';

function VideosContent() {
  const params = useSearchParams();
  const router = useRouter();
  const childId = params.get('childId');

  const [child, setChild] = useState<Child | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    async function load() {
      const [c, v] = await Promise.all([
        fetch(`/api/children?id=${childId}`).then((r) => r.json()),
        fetch(`/api/videos?childId=${childId}`).then((r) => r.json()),
      ]);
      if (cancelled) return;
      setChild(c);
      setVideos(Array.isArray(v) ? v : []);
    }
    load();
    const interval = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [childId]);

  if (!childId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-gray-500 mb-4">아이를 먼저 선택해주세요</p>
          <button
            onClick={() => router.push('/onboarding')}
            className="px-6 py-3 bg-violet-500 text-white rounded-xl font-medium"
          >
            시작하기
          </button>
        </div>
      </div>
    );
  }

  const filtered = videos.filter((v) => {
    if (filter === 'all') return true;
    if (filter === 'ready') return v.status === 'ready';
    if (filter === 'failed') return v.status === 'failed';
    return v.status === 'queued' || v.status === 'generating';
  });

  const counts = {
    all: videos.length,
    ready: videos.filter((v) => v.status === 'ready').length,
    in_progress: videos.filter((v) => v.status === 'queued' || v.status === 'generating').length,
    failed: videos.filter((v) => v.status === 'failed').length,
  };

  const fmtDuration = (s: number | null) =>
    s ? `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}` : '-';

  return (
    <div className="min-h-screen bg-violet-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-500 to-violet-400 text-white px-6 pt-12 pb-10 rounded-b-[28px]">
        <div className="flex items-start justify-between mb-4">
          <ChildSwitcher currentChildId={childId} currentChildName={child?.name} />
          <button
            onClick={() => router.push(`/dashboard/settings?childId=${childId}`)}
            className="bg-white/20 backdrop-blur rounded-full w-8 h-8 flex items-center justify-center hover:bg-white/30 transition"
            aria-label="설정"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>
        </div>
        <h1 className="text-[22px] font-extrabold leading-tight">{child?.name}이의 영상</h1>
        <p className="text-violet-100 text-sm mt-1">총 {videos.length}편 · 완성 {counts.ready}편</p>
      </div>

      {/* Filter tabs */}
      <div className="px-6 mt-4">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {(
            [
              ['all', '전체'],
              ['ready', '완성'],
              ['in_progress', '만드는 중'],
              ['failed', '실패'],
            ] as Array<[Filter, string]>
          ).map(([id, label]) => {
            const active = filter === id;
            const n = counts[id];
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition whitespace-nowrap ${
                  active
                    ? 'bg-violet-500 text-white shadow-md shadow-violet-200/60'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-violet-300'
                }`}
              >
                {label} {n > 0 && <span className={active ? 'text-violet-200' : 'text-gray-400'}>{n}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Video list */}
      <div className="px-6 mt-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center mt-4">
            <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">
              {filter === 'all' ? '아직 영상이 없어요' : '해당 상태의 영상이 없어요'}
            </p>
            {filter === 'all' && (
              <button
                onClick={() => router.push(`/dashboard?childId=${childId}`)}
                className="mt-4 px-5 py-2 bg-violet-500 text-white text-sm font-semibold rounded-xl"
              >
                영상 만들기
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((video) => {
              const isReady = video.status === 'ready';
              const inProgress = video.status === 'queued' || video.status === 'generating';
              const isFailed = video.status === 'failed';
              return (
                <button
                  key={video.id}
                  onClick={() => router.push(`/player/${video.id}?childId=${childId}`)}
                  disabled={!isReady && !isFailed}
                  className={`w-full bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3 text-left transition ${
                    isReady ? 'hover:shadow-md cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className={`w-16 h-12 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isReady ? 'bg-violet-100 text-violet-600' : isFailed ? 'bg-red-100 text-red-500' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {isReady ? `EP.${video.episode_number}` : isFailed ? '실패' : '제작중'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{video.title}</p>
                    {inProgress ? (
                      <div className="mt-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] text-violet-500">{video.phase ? PHASE_LABEL[video.phase] : '대기 중'}</span>
                          <span className="text-[11px] text-gray-400 tabular-nums">{video.progress_pct ?? 0}%</span>
                        </div>
                        <div className="w-full h-1 bg-violet-50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-violet-500 transition-all duration-500"
                            style={{ width: `${Math.max(5, video.progress_pct ?? 0)}%` }}
                          />
                        </div>
                      </div>
                    ) : isFailed ? (
                      <p className="text-[11px] text-red-400 mt-0.5 truncate">{video.error_reason ?? '알 수 없는 오류'}</p>
                    ) : (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {video.style_tags?.join(' + ')} · {fmtDuration(video.duration_sec)}
                      </p>
                    )}
                  </div>
                  {isReady && <span className="text-violet-400 text-base">▶</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function VideosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-violet-50 flex items-center justify-center"><p className="text-gray-400">로딩 중...</p></div>}>
      <VideosContent />
    </Suspense>
  );
}
