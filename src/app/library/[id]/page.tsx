'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import LibraryPlayer from '@/components/LibraryPlayer';
import LibraryPostFlow from '@/components/LibraryPostFlow';
import { topicLabel } from '@/lib/topic-label';
import type { Child } from '@/types';
import type { LibraryVideo } from '@/types/library';

type DashboardSummary = {
  latestCompletedAt: string | null;
};
type TrialGateState = {
  completedTrialSessions: number;
  remainingTrialSessions: number;
  trialLimit: number;
};
type LibraryVideoBody = {
  video?: LibraryVideo;
};

function trialGateFromBody(body: unknown): TrialGateState | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (record.code !== 'trial_complete') return null;

  const completedTrialSessions = typeof record.completedTrialSessions === 'number'
    ? record.completedTrialSessions
    : 3;
  const remainingTrialSessions = typeof record.remainingTrialSessions === 'number'
    ? record.remainingTrialSessions
    : 0;
  const trialLimit = typeof record.trialLimit === 'number' ? record.trialLimit : 3;

  return { completedTrialSessions, remainingTrialSessions, trialLimit };
}

function isSameLocalDay(value: string | null | undefined): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
  );
}

function LibraryVideoContent() {
  const params = useParams<{ id: string | string[] }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : params.id[0] ?? '';
  const childId = searchParams.get('childId');

  const [video, setVideo] = useState<LibraryVideo | null>(null);
  const [childName, setChildName] = useState<string | null>(null);
  const [childAge, setChildAge] = useState<number | undefined>(undefined);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialGate, setTrialGate] = useState<TrialGateState | null>(null);
  const [postFlowState, setPostFlowState] = useState({ videoId: '', visible: false });
  const playedRef = useRef(false);
  const postFlowVisible = postFlowState.videoId === id ? postFlowState.visible : false;

  useEffect(() => {
    if (!id || !childId) {
      router.replace('/dashboard');
      return;
    }

    let cancelled = false;
    playedRef.current = false;
    setVideo(null);
    setError(null);
    setTrialGate(null);
    setChildName(null);
    setChildAge(undefined);

    (async () => {
      const [videoRes, childRes] = await Promise.all([
        fetch(`/api/library/${id}`),
        fetch(`/api/children/${childId}`),
      ]);
      if (cancelled) return;

      const videoBody = await videoRes.json().catch(() => null);

      if (videoRes.status === 402) {
        setVideo(null);
        setError(null);
        setTrialGate(trialGateFromBody(videoBody));
        if (childRes.ok) {
          const childBody = (await childRes.json()) as Pick<Child, 'name' | 'age'>;
          setChildName(childBody.name ?? null);
          setChildAge(typeof childBody.age === 'number' && Number.isFinite(childBody.age) ? childBody.age : undefined);
        }
        return;
      }

      if (!videoRes.ok) {
        setError('영상을 찾을 수 없어요.');
        setTrialGate(null);
        return;
      }

      setError(null);
      setTrialGate(null);
      setVideo((videoBody as LibraryVideoBody | null)?.video ?? null);

      if (childRes.ok) {
        const childBody = (await childRes.json()) as Pick<Child, 'name' | 'age'>;
        setChildName(childBody.name ?? null);
        setChildAge(typeof childBody.age === 'number' && Number.isFinite(childBody.age) ? childBody.age : undefined);
      } else {
        setChildName(null);
        setChildAge(undefined);
      }
    })().catch(() => {
      if (!cancelled) {
        setTrialGate(null);
        setError('영상을 불러오지 못했어요.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id, childId, router]);

  useEffect(() => {
    if (!childId) return;

    let cancelled = false;
    setLoadingSummary(true);
    (async () => {
      try {
        const res = await fetch(`/api/dashboard/summary?childId=${encodeURIComponent(childId)}`);
        const body: unknown = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.ok && body && typeof body === 'object' && !Array.isArray(body) && 'latestCompletedAt' in body) {
          setSummary({ latestCompletedAt: typeof body.latestCompletedAt === 'string' ? body.latestCompletedAt : null });
        } else {
          setSummary(null);
        }
      } catch {
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [childId]);

  const completedToday = !loadingSummary && isSameLocalDay(summary?.latestCompletedAt);
  const canOpenPostFlow = !loadingSummary && !completedToday;
  const reportHref = `/dashboard/report?childId=${encodeURIComponent(childId ?? '')}`;
  const dashboardHref = `/dashboard?childId=${encodeURIComponent(childId ?? '')}`;
  const libraryHref = `/library?childId=${encodeURIComponent(childId ?? '')}`;

  useEffect(() => {
    if (!completedToday) return;

    setPostFlowState((current) => (
      current.visible ? { videoId: id, visible: false } : current
    ));
  }, [completedToday, id]);

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
    if (canOpenPostFlow) setPostFlowState({ videoId: id, visible: true });
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-6 text-ink">
        <div className="text-center">
          <p className="text-sm font-semibold text-ink2">{error}</p>
          <Link
            href={libraryHref}
            className="mt-3 inline-block text-sm font-black text-saged underline underline-offset-2"
          >
            이야기 숲으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  if (trialGate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-6 text-ink">
        <section className="w-full max-w-sm rounded-[28px] border border-line bg-white p-6 text-center shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[.16em] text-sage">모리 체험 완료</p>
          <h1 className="mt-2 text-2xl font-black leading-snug text-ink">
            {childName ? `${childName}의 기록을 먼저 확인해요` : '우리 아이 기록을 먼저 확인해요'}
          </h1>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-ink2">
            무료 모험 {Math.max(trialGate.completedTrialSessions, trialGate.trialLimit)}편이 끝났어요. 다음 이야기는
            보호자 기록을 본 뒤 이어갈 수 있어요.
          </p>
          <div className="mt-5 grid gap-2">
            <Link
              href={reportHref}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-saged px-5 text-sm font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
            >
              기록 보기
            </Link>
            <Link
              href="/subscribe"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-cream px-5 text-sm font-black text-saged transition hover:bg-mist active:scale-[0.98]"
            >
              모리 더 이어가기
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-sm font-semibold text-ink3">모리가 이야기를 여는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream text-ink">
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
            <p className="text-[10px] font-black uppercase tracking-wider text-sage">
              {childName ? `${childName}의 이야기` : '모리 이야기'}
            </p>
            <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-sage">
              {topicLabel(video.topic)} · {video.age_band}세
            </p>
            <h1 className="mt-1 text-xl font-black leading-[1.35] text-ink">{video.title}</h1>
            {video.description && <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">{video.description}</p>}
            {completedToday ? (
              <div className="mt-5">
                <div className="rounded-3xl bg-sagebg px-4 py-4">
                  <p className="text-[11px] font-black uppercase tracking-[.16em] text-sage">오늘은 여기까지</p>
                  <p className="mt-1 text-sm font-black leading-relaxed text-ink">
                    이 이야기는 다음에 볼 이야기로 골라둘 수 있어요.
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-ink3">
                    오늘 남은 기록을 보고, 다음에 볼 이야기는 보호자가 천천히 고르면 됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push(reportHref)}
                  className="mt-4 block w-full rounded-2xl bg-saged px-6 py-4 text-center text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
                >
                  오늘 기록 보기
                </button>
                <Link
                  href={dashboardHref}
                  className="mt-3 block w-full rounded-2xl border border-line bg-cream px-6 py-3 text-center text-sm font-black text-saged transition hover:bg-mist"
                >
                  홈으로
                </Link>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  disabled={loadingSummary}
                  onClick={() => {
                    if (!canOpenPostFlow) return;
                    void recordEvent('complete');
                    setPostFlowState({ videoId: id, visible: true });
                  }}
                  className="mt-6 block w-full rounded-2xl bg-saged px-6 py-4 text-center text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98] disabled:cursor-wait disabled:bg-sage"
                >
                  {loadingSummary ? '오늘 기록 확인 중...' : '영상을 봤다면 단서 놀이 시작'}
                </button>
                <Link
                  href={libraryHref}
                  className="mt-3 block w-full rounded-2xl border border-line bg-cream px-6 py-3 text-center text-sm font-black text-saged transition hover:bg-mist"
                >
                  이야기 숲에서 더 보기
                </Link>
              </>
            )}
          </div>
        )}
        {postFlowVisible && (
          <div className="bg-white">
            <LibraryPostFlow libraryVideoId={video.id} childId={childId!} childAge={childAge} />
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
        <div className="flex min-h-screen items-center justify-center bg-cream">
          <p className="text-sm font-semibold text-ink3">모리가 이야기를 여는 중...</p>
        </div>
      )}
    >
      <LibraryVideoContent />
    </Suspense>
  );
}
