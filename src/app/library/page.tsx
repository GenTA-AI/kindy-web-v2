'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import LibraryCard from '@/components/LibraryCard';
import LibraryFilters from '@/components/LibraryFilters';
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

function LibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const childId = searchParams.get('childId');
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [childName, setChildName] = useState<string | null>(null);
  const [ageBand, setAgeBand] = useState<number | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [trialGate, setTrialGate] = useState<TrialGateState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!childId) {
      router.replace('/dashboard');
      return;
    }

    let cancelled = false;
    setChildName(null);
    setAgeBand(null);
    (async () => {
      try {
        const res = await fetch(`/api/children/${childId}`);
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as Pick<Child, 'name' | 'age'>;
          setChildName(body.name ?? null);
          if (typeof body.age === 'number' && Number.isFinite(body.age)) {
            setAgeBand(body.age);
          }
        } else {
          setChildName(null);
          setAgeBand(null);
        }
      } catch {
        if (!cancelled) {
          setChildName(null);
          setAgeBand(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [childId, router]);

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

  useEffect(() => {
    if (!childId) {
      router.replace('/dashboard');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setTrialGate(null);
    (async () => {
      const params = new URLSearchParams();
      if (ageBand) params.set('age_band', String(ageBand));

      try {
        const res = await fetch(`/api/library?${params.toString()}`);
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok) {
          const libraryBody = body as { videos?: LibraryVideo[] } | null;
          setTrialGate(null);
          setVideos(libraryBody?.videos ?? []);
        } else if (res.status === 402) {
          setVideos([]);
          setTrialGate(trialGateFromBody(body));
        } else {
          setVideos([]);
          setLoadError(true);
        }
      } catch {
        if (!cancelled) {
          setVideos([]);
          setLoadError(true);
          setTrialGate(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [childId, ageBand, reloadToken, router]);

  if (!childId) return null;

  const completedToday = !loadingSummary && isSameLocalDay(summary?.latestCompletedAt);
  const reportHref = `/dashboard/report?childId=${encodeURIComponent(childId)}`;
  const dashboardHref = `/dashboard?childId=${encodeURIComponent(childId)}`;
  const playHref = `/play?childId=${encodeURIComponent(childId)}`;
  const title = childName
    ? completedToday
      ? `${childName}의 다음 이야기 고르기`
      : `${childName}의 다음 이야기`
    : completedToday
      ? '우리 아이의 다음 이야기 고르기'
      : '우리 아이가 좋아할 이야기';
  const lead = completedToday
    ? '오늘 놀이는 마쳤어요. 여기서는 보호자가 다음에 볼 이야기를 천천히 골라둘 수 있어요.'
    : '짧은 영상을 보고 단서 질문과 놀이로 이어가요. 오늘 기록은 보호자 화면에 남습니다.';
  const featureKicker = completedToday ? '다음에 볼 이야기' : '오늘 한 편';
  const featureTitle = completedToday ? '오늘은 기록만 보고, 다음 이야기는 골라두기' : '보고, 찾고, 기록으로 남겨요';
  const featureBody = completedToday
    ? '아이에게 바로 이어 보여주기보다, 보호자가 기록을 보고 다음 이야기를 골라두는 공간이에요.'
    : '영상만 보는 곳이 아니라 단서 질문까지 끝내는 이야기 놀이터예요.';

  return (
    <div className="min-h-screen bg-cream text-ink">
      <div className="mx-auto max-w-[420px] px-5 pb-32 pt-10">
        <header className="mb-6">
          <p className="text-[11px] font-black uppercase tracking-[.16em] text-sage">이야기 숲</p>
          <h1 className="mt-1 text-2xl font-black leading-[1.3] text-ink">
            {title}
          </h1>
          <p className="mt-1.5 text-sm font-semibold leading-relaxed text-ink2">
            {lead}
          </p>
        </header>

        <section className="mb-5 rounded-[28px] bg-saged p-5 text-white shadow-[0_20px_55px_-34px_rgba(35,49,38,.6)]">
          <p className="text-[11px] font-black uppercase tracking-[.16em] text-white/70">{featureKicker}</p>
          <h2 className="mt-2 text-2xl font-black leading-tight">{featureTitle}</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-white/82">
            {featureBody}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => router.push(completedToday ? reportHref : playHref)}
              className="min-h-12 rounded-2xl bg-white px-4 text-sm font-black text-saged transition hover:bg-cream active:scale-[0.98]"
            >
              {completedToday ? '오늘 기록' : '오늘 놀이'}
            </button>
            <button
              type="button"
              onClick={() => router.push(completedToday ? dashboardHref : reportHref)}
              className="min-h-12 rounded-2xl border border-white/30 px-4 text-sm font-black text-white transition hover:bg-white/10 active:scale-[0.98]"
            >
              {completedToday ? '홈으로' : '기록 보기'}
            </button>
          </div>
        </section>

        <div className="mb-5 rounded-2xl border border-line bg-white p-4 shadow-sm">
          <LibraryFilters currentAge={ageBand} onAgeChange={setAgeBand} />
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm font-semibold text-ink3">모리가 이야기를 고르는 중...</p>
        ) : trialGate ? (
          <div className="rounded-3xl border border-line bg-white p-6 text-center shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[.16em] text-sage">모리 체험 완료</p>
            <p className="mt-2 text-xl font-black leading-snug text-ink">
              {childName ? `${childName}의 기록을 먼저 확인해요` : '우리 아이 기록을 먼저 확인해요'}
            </p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">
              무료 모험 {Math.max(trialGate.completedTrialSessions, trialGate.trialLimit)}편이 끝났어요. 보호자 기록에서
              잘 맞았던 놀이와 다음에 해볼 활동을 보고 이어갈 이야기를 고를 수 있어요.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => router.push(reportHref)}
                className="min-h-12 rounded-2xl bg-saged px-4 text-sm font-black text-white transition hover:bg-ink active:scale-[0.98]"
              >
                기록 보기
              </button>
              <button
                type="button"
                onClick={() => router.push('/subscribe')}
                className="min-h-12 rounded-2xl border border-line bg-cream px-4 text-sm font-black text-saged transition hover:bg-mist active:scale-[0.98]"
              >
                이어가기
              </button>
            </div>
          </div>
        ) : loadError ? (
          <div className="rounded-3xl border border-line bg-white p-6 text-center shadow-sm">
            <p className="text-base font-black text-ink">이야기 숲을 잠시 불러오지 못했어요</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">
              연결을 확인한 뒤 다시 시도해 주세요. 아이 기록은 그대로 남아 있어요.
            </p>
            <button
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
              className="mt-5 min-h-12 rounded-2xl bg-saged px-6 text-sm font-black text-white transition hover:bg-ink active:scale-[0.98]"
            >
              다시 불러오기
            </button>
          </div>
        ) : videos.length === 0 ? (
          <p className="py-12 text-center text-sm font-semibold text-ink3">조건에 맞는 이야기가 아직 없어요.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {videos.map((video) => (
              <LibraryCard key={video.id} video={video} childId={childId} completedToday={completedToday} />
            ))}
          </div>
        )}
      </div>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex min-h-screen items-center justify-center bg-cream">
          <p className="text-sm font-semibold text-ink3">모리가 이야기를 고르는 중...</p>
        </div>
      )}
    >
      <LibraryContent />
    </Suspense>
  );
}
