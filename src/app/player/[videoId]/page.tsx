'use client';

import { useEffect, useState, useRef, useCallback, useMemo, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import FocusBar from '@/components/FocusBar';
import PostVideoFlow from '@/components/PostVideoFlow';
import PaymentDrawer, { BUNDLES, type BundleType } from '@/components/PaymentDrawer';
import { buildBriefFromChild, titleFromBrief } from '@/lib/brief-builder';
import type { Video, Child, ViewEvent } from '@/types';
import { getSegmentReplays } from '@/lib/gacs3';
import { buildSubtitleCues, findActiveCue } from '@/lib/subtitles';
import { phaseLabel } from '@/lib/phase-labels';

function PlayerContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const videoId = params.videoId as string;
  const childId = searchParams.get('childId');

  const [video, setVideo] = useState<Video | null>(null);
  const [child, setChild] = useState<Child | null>(null);
  const [events, setEvents] = useState<ViewEvent[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoEnded, setVideoEnded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [subtitlesOn, setSubtitlesOn] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const eventBuffer = useRef<Array<Omit<ViewEvent, 'id' | 'created_at'>>>([]);

  const flushEvents = useCallback(async () => {
    if (eventBuffer.current.length === 0) return;
    const toSend = [...eventBuffer.current];
    eventBuffer.current = [];
    try {
      await fetch('/api/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: toSend }),
      });
    } catch {
      eventBuffer.current.push(...toSend);
    }
  }, []);

  useEffect(() => {
    if (!videoId || !childId) return;

    let cancelled = false;

    async function loadChild() {
      const res = await fetch(`/api/children?id=${childId}`);
      if (!cancelled) setChild(await res.json());
    }

    async function loadVideo() {
      const res = await fetch(`/api/videos?childId=${childId}`);
      const list: Video[] = await res.json();
      const found = Array.isArray(list) ? list.find((v) => v.id === videoId) : null;
      if (!cancelled && found) setVideo(found);
      return found;
    }

    loadChild();
    loadVideo();

    const interval = setInterval(async () => {
      const v = await loadVideo();
      if (v && v.status === 'ready') clearInterval(interval);
    }, 10000);

    const flushInterval = setInterval(flushEvents, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(flushInterval);
      flushEvents();
    };
  }, [videoId, childId, flushEvents]);

  const trackEvent = (eventType: ViewEvent['event_type'], extra?: { segment_start?: number; segment_end?: number }) => {
    if (!videoId || !childId) return;
    const event = {
      video_id: videoId,
      child_id: childId,
      event_type: eventType,
      timestamp_sec: currentTime,
      ...extra,
    };
    eventBuffer.current.push(event);
    setEvents((prev) => [...prev, { ...event, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
  };

  const handleReact = async (reaction: 'happy' | 'neutral' | 'sad') => {
    try {
      await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId, child_id: childId, reaction }),
      });
    } catch {}
  };

  const handleQuizComplete = async (
    scope: 'current' | 'attention' | 'preview',
    results: Array<{ question: string; options: string[]; correctAnswer: number; selectedAnswer: number; isCorrect: boolean }>
  ) => {
    for (const r of results) {
      try {
        await fetch('/api/quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_id: videoId,
            child_id: childId,
            question: `[${scope}] ${r.question}`,
            options: r.options,
            correct_answer: r.correctAnswer,
            selected_answer: r.selectedAnswer,
          }),
        });
      } catch {}
    }
  };

  const triggerNextVideo = async () => {
    if (!child || !video) return;
    setTriggering(true);
    try {
      const nextIndex = video.episode_number; // 1-based episode_number → next index is same value (0-based)
      const brief = buildBriefFromChild({
        childName: child.name,
        age: child.age,
        styles: child.styles,
        topic: child.topics[0],
        episodeIndex: nextIndex,
        targetDurationSec: 30,
      });
      const title = titleFromBrief(child.name, brief.topic);
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child_id: child.id,
          title,
          topic: brief.topic,
          style_tags: child.styles,
          brief,
          target_duration_sec: brief.targetDurationSec,
        }),
      });
      if (res.status === 402) {
        setDrawerOpen(true);
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? '영상 생성 실패');
        return;
      }
      // 성공 — 대시보드로 돌아가서 진행 상황 확인
      router.push(`/dashboard?childId=${childId}`);
    } finally {
      setTriggering(false);
    }
  };

  const handleBundleSelect = (type: BundleType) => {
    const b = BUNDLES[type];
    alert(`결제 연결 예정: ${b.label} (${b.priceKrw.toLocaleString()}원, ${b.credits} 크레딧)`);
    setDrawerOpen(false);
  };

  const hotspots = getSegmentReplays(events);
  const subtitleCues = useMemo(() => buildSubtitleCues(video?.script ?? null), [video?.script]);
  const activeCue = subtitlesOn ? findActiveCue(subtitleCues, currentTime) : null;

  if (!video || !child) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Video area */}
      <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
        {video.status === 'ready' && video.video_url ? (
          <video
            ref={videoRef}
            src={video.video_url}
            className="w-full h-full object-cover"
            onPlay={() => trackEvent('play')}
            onPause={() => trackEvent('pause')}
            onEnded={() => {
              trackEvent('complete');
              setVideoEnded(true);
            }}
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
            controls
            playsInline
          />
        ) : video.status === 'failed' ? (
          <div className="text-center px-6">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-3 mx-auto">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-white/80 text-sm">영상 생성에 실패했어요</p>
            <p className="text-red-400/80 text-xs mt-1 max-w-xs mx-auto">{video.error_reason ?? '잠시 후 다시 시도해주세요'}</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-3 mx-auto animate-pulse">
              <svg className="w-8 h-8 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
              </svg>
            </div>
            <p className="text-white/80 text-sm">{phaseLabel(video.phase ?? '')}</p>
            <div className="mt-3 w-48 mx-auto">
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-400 transition-all duration-500"
                  style={{ width: `${Math.max(5, video.progress_pct ?? 0)}%` }}
                />
              </div>
              <p className="text-white/50 text-xs mt-2">{video.progress_pct ?? 0}% 완료</p>
            </div>
          </div>
        )}
        {/* 뒤로가기 */}
        <button
          onClick={() => router.push(`/dashboard?childId=${childId}`)}
          className="absolute top-3 left-3 w-11 h-11 bg-black/40 backdrop-blur text-white rounded-full flex items-center justify-center hover:bg-black/60 transition z-10"
          aria-label="뒤로"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="absolute top-3 left-16 bg-violet-500/90 text-white text-xs px-3 py-1 rounded-full pointer-events-none">
          {child.name}이를 위한 영상
        </div>
        {subtitleCues.length > 0 && (
          <button
            onClick={() => setSubtitlesOn((v) => !v)}
            className={`absolute top-3 right-3 inline-flex min-h-[44px] items-center px-3 rounded-full text-[11px] font-bold transition ${
              subtitlesOn
                ? 'bg-white text-violet-600 shadow'
                : 'bg-black/40 text-white/80 backdrop-blur'
            }`}
            aria-label="자막 토글"
            aria-pressed={subtitlesOn}
          >
            자막 {subtitlesOn ? 'ON' : 'OFF'}
          </button>
        )}

        {/* 자막 오버레이 — 하단 중앙, 큰 글씨, 고대비 */}
        {activeCue && (
          <div className="absolute inset-x-0 bottom-12 flex justify-center pointer-events-none px-4">
            <div className="bg-black/70 backdrop-blur text-white px-4 py-2 rounded-xl text-base md:text-lg font-bold text-center leading-snug max-w-[90%] shadow-lg">
              {activeCue.text}
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 pb-8">
        <h1 className="text-lg font-bold text-gray-900">{video.title}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {child.name} 맞춤 | {video.style_tags?.join(' + ')} | EP.{video.episode_number}
        </p>

        <div className="mt-4">
          <FocusBar
            durationSec={video.duration_sec || 84}
            watchedSec={currentTime}
            hotspots={hotspots}
            childName={child.name}
          />
        </div>

      </div>

      {/* 퀴즈 모달 — 영상 종료 시 전체화면 오버레이 */}
      {videoEnded && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/80 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="min-h-screen flex items-start justify-center px-4 py-6">
            <div className="w-full max-w-md">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="text-white/80 text-xs font-semibold">
                  {child.name}이의 퀴즈 시간
                </div>
                <button
                  onClick={() => {
                    setVideoEnded(false);
                    router.push(`/dashboard?childId=${childId}`);
                  }}
                  className="w-11 h-11 bg-white/10 backdrop-blur text-white rounded-full flex items-center justify-center hover:bg-white/20 transition"
                  aria-label="닫기"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <PostVideoFlow
                child={child}
                videoId={video.id}
                episodeIndex={video.episode_number - 1}
                onReact={handleReact}
                onQuizComplete={handleQuizComplete}
                onUpsellAccept={() => {
                  if (triggering) return;
                  triggerNextVideo();
                }}
                onUpsellDismiss={() => {
                  /* noop — PostVideoFlow internally moves to done */
                }}
                onRewatch={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    videoRef.current.play().catch(() => {});
                  }
                  setVideoEnded(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <PaymentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSelect={handleBundleSelect}
        childName={child.name}
      />
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center"><p className="text-gray-400">로딩 중...</p></div>}>
      <PlayerContent />
    </Suspense>
  );
}
