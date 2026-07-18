'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Child } from '@/types';
import C6ToolMark from '@/components/C6ToolMark';
import ChildSwitcher from '@/components/ChildSwitcher';
import MoriCharacter from '@/components/MoriCharacter';
import { withJosa } from '@/lib/josa';

const STORY_REGIONS = [
  { title: '동물 마을', status: '오늘 열림', active: true },
  { title: '마음 호수', status: '다음 이야기', active: false },
  { title: '무늬 언덕', status: '곧 만날 길', active: false },
  { title: '물방울 실험터', status: '새 이야기 자리', active: false },
];

const FALLBACK_C6_MAP: C6MapItem[] = [
  {
    key: 'observe',
    icon: '보기',
    codeLabel: '보기 놀이',
    parentLabel: '자세히 보기',
    childPlayLabel: '숨은 단서 찾기',
    count: 0,
    body: '짧은 영상을 보고 장면 단서 질문 1개부터 시작해요.',
    state: 'next_seed',
    nextBody: '그림에서 작은 차이 2개를 찾는 놀이로 시작하면 좋아요.',
    homePrompt: '같은 그림을 보며 “처음엔 안 보였는데 다시 보니 뭐가 보여?”라고 물어봐 주세요.',
  },
  {
    key: 'imagine',
    icon: '잇기',
    codeLabel: '잇기 놀이',
    parentLabel: '닮은 것 잇기',
    childPlayLabel: '어울리는 짝 찾기',
    count: 0,
    body: '어울리는 짝을 찾는 놀이가 기다리고 있어요.',
    state: 'empty',
    nextBody: '물건 두 개를 놓고 “뭐가 닮았을까?”를 말해보는 놀이가 잘 맞아요.',
    homePrompt: '집 안 물건 두 개를 골라 “이 둘은 어디가 비슷해?”라고 짧게 이어 주세요.',
  },
  {
    key: 'pattern',
    icon: '규칙',
    codeLabel: '규칙 놀이',
    parentLabel: '규칙 찾기',
    childPlayLabel: '다음 무늬 고르기',
    count: 0,
    body: '색과 모양의 반복을 찾는 놀이가 기다리고 있어요.',
    state: 'empty',
    nextBody: '색-모양-색-모양처럼 짧은 규칙을 직접 만들어보면 좋아요.',
    homePrompt: '블록이나 양말로 짧은 반복을 만들고 “다음엔 뭐가 올까?”라고 물어봐 주세요.',
  },
  {
    key: 'transform',
    icon: '나눔',
    codeLabel: '나눔 놀이',
    parentLabel: '모양 바꾸기',
    childPlayLabel: '무리 나누기',
    count: 0,
    body: '하늘·물·땅처럼 기준을 바꾸는 놀이가 기다리고 있어요.',
    state: 'empty',
    nextBody: '같은 물건을 색으로 한 번, 모양으로 한 번 다르게 나눠보면 좋아요.',
    homePrompt: '장난감을 “색깔로 나누면?”, “크기로 나누면?”처럼 기준을 바꿔 다시 놓아봐 주세요.',
  },
  {
    key: 'design',
    icon: '꾸밈',
    codeLabel: '꾸밈 놀이',
    parentLabel: '보기 좋게 고르기',
    childPlayLabel: '색과 자리 꾸미기',
    count: 0,
    body: '색과 자리를 고르는 꾸미기 놀이가 기다리고 있어요.',
    state: 'empty',
    nextBody: '두 가지 색만 골라 어디에 놓을지 정하는 놀이가 잘 맞아요.',
    homePrompt: '스티커나 색연필 두 가지만 골라 “어디에 놓으면 가장 마음에 들어?”라고 물어봐 주세요.',
  },
  {
    key: 'compose',
    icon: '만듦',
    codeLabel: '만들기 놀이',
    parentLabel: '모아서 만들기',
    childPlayLabel: '나만의 선물 만들기',
    count: 0,
    body: '정답 없이 만들고 완성하는 놀이가 기다리고 있어요.',
    state: 'empty',
    nextBody: '정답 없이 고르고 붙이는 놀이를 이어가면 표현이 자연스럽게 나와요.',
    homePrompt: '완성물을 보며 “이름을 붙인다면 뭐라고 할까?”라고 가볍게 물어봐 주세요.',
  },
];

const FALLBACK_HOME_ASSIGNMENTS: HomeAssignment[] = [
  { day: '1일차', title: '숨은 단서 찾기', body: '같은 장면을 다시 보고 작은 차이 2개를 찾아봐요.' },
  { day: '2일차', title: '자세히 보기 한마디', body: '“처음엔 안 보였는데 다시 보니 뭐가 보여?”라고 물어봐 주세요.' },
  { day: '3일차', title: '모리와 다시 만들기', body: '아이가 고른 단서를 색이나 스티커로 작게 표현해요.' },
];

const HOME_LEARNING_PLAN = [
  ['영상', '모리와 꾸미의 짧은 이야기 보기'],
  ['단서 질문', '친구 마음과 장면 단서 확인하기'],
  ['놀이', '닮은 선물 찾기와 나만의 선물 만들기'],
];

const HOME_REST_PLAN = [
  ['기록', '오늘 해낸 놀이와 다음 활동을 보호자가 먼저 확인해요'],
  ['한마디', '모리가 남긴 질문 하나로 1분만 이야기해요'],
  ['다음 놀이', '내일 열 이야기는 보호자가 천천히 골라요'],
];

type DashboardSummary = {
  totalRounds: number;
  sessionCount: number;
  completedSessionCount: number;
  latestCompletedAt: string | null;
  retriedCount: number;
  updatedAt: string | null;
  strongest: {
    label: string;
    body: string;
    count: number;
  };
  next: {
    label: string;
    body: string;
    homePrompt: string;
  };
  c6Map?: C6MapItem[];
  homeAssignments?: HomeAssignment[];
  learningProfile?: LearningProfileView;
};

type LearningProfileView = {
  enoughData: boolean;
  conditionInsight: string | null;
  strength: { label: string; note: string } | null;
  struggle: { label: string; note: string } | null;
  tools: { toolKey: string; parentLabel: string; signal: string; note: string }[];
};

type C6MapItem = {
  key: string;
  icon: string;
  codeLabel: string;
  parentLabel: string;
  childPlayLabel: string;
  count: number;
  body: string;
  state: 'observed' | 'next_seed' | 'empty' | string;
  nextBody: string;
  homePrompt: string;
};

type HomeAssignment = {
  day: string;
  title: string;
  body: string;
};

function safeName(child: Child | null): string {
  const name = typeof child?.name === 'string' ? child.name.trim() : '';
  return name || '우리 아이';
}

function loginHref(next: string): string {
  return `/auth/login?next=${encodeURIComponent(next)}`;
}

function summaryMetric(summary: DashboardSummary | null, kind: 'sessions' | 'rounds' | 'retry'): string {
  if (!summary) return '확인 중';
  if (kind === 'sessions') {
    return summary.sessionCount > 0
      ? `${summary.completedSessionCount}/${summary.sessionCount}`
      : '첫 시작';
  }
  if (kind === 'retry') return `${summary.retriedCount}번`;
  return summary.totalRounds > 0 ? `${summary.totalRounds}개` : '첫 놀이 전';
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

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const childId = searchParams.get('childId');

  const [child, setChild] = useState<Child | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loadingChild, setLoadingChild] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [childError, setChildError] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  const [summaryReloadToken, setSummaryReloadToken] = useState(0);
  const [childrenRedirectChecked, setChildrenRedirectChecked] = useState(false);

  const load = useCallback(async () => {
    if (!childId) return;
    setLoadingChild(true);
    setChildError(false);
    try {
      const res = await fetch(`/api/children?id=${childId}`);
      const data: unknown = await res.json().catch(() => null);

      if (res.status === 401) {
        router.replace(loginHref(`/dashboard?childId=${encodeURIComponent(childId)}`));
        return;
      }

      if (!res.ok || !data || typeof data !== 'object' || Array.isArray(data) || !('id' in data)) {
        setChild(null);
        setChildError(true);
        return;
      }
      setChild(data as Child);
    } catch {
      setChild(null);
      setChildError(true);
    } finally {
      setLoadingChild(false);
    }
  }, [childId, router]);

  useEffect(() => {
    if (childId) return;
    let cancelled = false;
    setChildrenRedirectChecked(false);

    (async () => {
      try {
        const res = await fetch('/api/children');
        const list: unknown = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.status === 401) {
          router.replace(loginHref('/dashboard'));
          return;
        }
        if (Array.isArray(list) && list.length === 0) {
          router.replace('/onboarding');
          return;
        }
        if (Array.isArray(list) && list.length > 0 && list[0]?.id) {
          router.replace(`/dashboard?childId=${list[0].id}`);
          return;
        }
      } catch {
        // 자녀 목록 로드 실패 시 폴백 UI 유지.
      }
      if (!cancelled) setChildrenRedirectChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [childId, router]);

  useEffect(() => {
    if (!childId) return;
    void load();
  }, [childId, load]);

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    setLoadingSummary(true);
    setSummaryError(false);

    (async () => {
      try {
        const res = await fetch(`/api/dashboard/summary?childId=${encodeURIComponent(childId)}`);
        const data: unknown = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.status === 401) {
          router.replace(loginHref(`/dashboard?childId=${encodeURIComponent(childId)}`));
          return;
        }

        if (!res.ok || !data || typeof data !== 'object' || Array.isArray(data)) {
          setSummary(null);
          setSummaryError(true);
          return;
        }

        setSummary(data as DashboardSummary);
      } catch {
        if (!cancelled) {
          setSummary(null);
          setSummaryError(true);
        }
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [childId, router, summaryReloadToken]);

  if (!childId) {
    if (!childrenRedirectChecked) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-cream">
          <p className="text-sm font-bold text-ink3">모리가 아이 기록을 찾는 중...</p>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-6">
        <div className="max-w-sm text-center">
          <MoriCharacter className="mx-auto h-28 w-28 overflow-hidden rounded-full border border-white/60 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_32px_rgba(35,49,38,0.10)] backdrop-blur-2xl backdrop-saturate-150" imageClassName="scale-125" label="모리" withGlow={false} />
          <h1 className="mt-5 text-2xl font-black text-ink">첫 아이 이름표가 필요해요</h1>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">아이 프로필을 만들면 바로 모리의 이야기 숲으로 들어갈 수 있어요.</p>
          <button
            onClick={() => router.push('/onboarding')}
            className="mt-6 min-h-12 rounded-full bg-saged px-7 text-sm font-black text-white"
          >
            시작하기
          </button>
        </div>
      </div>
    );
  }

  const name = safeName(child);
  const ageLabel = typeof child?.age === 'number' && Number.isFinite(child.age) ? `${child.age}세` : null;
  const reportHref = `/dashboard/report?childId=${encodeURIComponent(childId)}`;
  const playHref = `/play?childId=${encodeURIComponent(childId)}`;
  const libraryHref = `/library?childId=${encodeURIComponent(childId)}`;
  const strongestLabel = summaryError
    ? '기록을 다시 확인해 주세요'
    : loadingSummary
      ? '기록 확인 중'
      : summary?.strongest.label ?? '첫 놀이를 기다려요';
  const strongestBody = loadingSummary
    ? '방금 한 놀이가 있는지 확인하고 있어요.'
    : summaryError
      ? '연결을 확인한 뒤 다시 불러오면 오늘 기록을 이어서 볼 수 있어요. 아이 기록은 그대로 남아 있어요.'
      : summary?.strongest.body ?? '영상 1편과 단서 놀이를 마치면 오늘 잘 들어온 놀이가 여기에 보여요.';
  const nextLabel = summaryError ? '잠시 후 다시 보기' : summary?.next.label ?? '자세히 보기';
  const nextBody = summaryError
    ? '기록이 돌아오면 다음 놀이 추천도 함께 보여드릴게요.'
    : summary?.next.body ?? '짧은 영상을 보고 장면 단서 질문 1개부터 시작해요.';
  const homePrompt = summaryError
    ? '오늘은 아이가 기억하는 장면 하나만 편하게 물어봐 주세요.'
    : summary?.next.homePrompt ?? '오늘 본 장면에서 “처음엔 안 보였는데 다시 보니 뭐가 보여?”라고 물어봐 주세요.';
  const hasCompletedToday = !loadingSummary && isSameLocalDay(summary?.latestCompletedAt);
  const heroKicker = hasCompletedToday ? '오늘의 기록' : '오늘의 이야기';
  const heroTitle = loadingChild
    ? '기록을 불러오는 중...'
    : hasCompletedToday
      ? `${withJosa(name, '이/가')} 오늘 놀이를 마쳤어요`
      : `${withJosa(name, '이/가')} 열 이야기 문`;
  const heroBody = hasCompletedToday
    ? '오늘 놀이는 여기까지예요. 이제 보호자가 기록을 보고 짧은 한마디만 이어가면 충분합니다.'
    : '모리가 동물 마을에서 작은 마음 소리를 들었어요. 영상과 단서 놀이를 지나 마지막에는 아이만의 선물이 완성됩니다.';
  const todayPlan = hasCompletedToday ? HOME_REST_PLAN : HOME_LEARNING_PLAN;
  const storyRegions = STORY_REGIONS.map((region, index) => (
    index === 0 && hasCompletedToday ? { ...region, status: '오늘 완료' } : region
  ));
  const c6Map = summaryError
    ? FALLBACK_C6_MAP
    : summary?.c6Map && summary.c6Map.length > 0
      ? summary.c6Map
      : FALLBACK_C6_MAP;
  const homeAssignments = summaryError
    ? FALLBACK_HOME_ASSIGNMENTS
    : summary?.homeAssignments && summary.homeAssignments.length > 0
      ? summary.homeAssignments
      : FALLBACK_HOME_ASSIGNMENTS;
  const nextC6Seed = c6Map.find((tool) => tool.state === 'next_seed') ?? c6Map[0];
  const learningProfile = summaryError ? undefined : summary?.learningProfile;

  return (
    <main className="min-h-screen bg-cream pb-28 text-ink [word-break:keep-all]">
      <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <MoriCharacter className="h-12 w-12 overflow-hidden rounded-full border border-white/60 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_32px_rgba(35,49,38,0.10)] backdrop-blur-2xl backdrop-saturate-150" imageClassName="scale-125" label="모리" withGlow={false} />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.16em] text-sage">보호자 기록장</p>
              <h1 className="text-xl font-black">모리의 이야기 숲</h1>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <ChildSwitcher currentChildId={childId} currentChildName={child?.name} />
            <button
              onClick={() => router.push(`/dashboard/settings?childId=${childId}`)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_32px_rgba(35,49,38,0.10)] backdrop-blur-2xl backdrop-saturate-150 text-sm font-black text-sage transition hover:bg-mist"
              aria-label="설정"
            >
              설정
            </button>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.12fr_.88fr]">
          <div className="rounded-[34px] bg-saged p-6 text-white shadow-[0_24px_70px_-40px_rgba(35,49,38,.55)] sm:p-8">
            <p className="text-xs font-black uppercase tracking-[.16em] text-white/70">{heroKicker}</p>
            <h2 className="mt-3 text-[32px] font-black leading-tight tracking-[-.03em] sm:text-5xl">
              {heroTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-relaxed text-white/82">
              {heroBody}
            </p>
            {ageLabel && <p className="mt-2 text-sm font-bold text-white/70">{ageLabel}에 맞춘 오늘의 길</p>}
            {childError && <p className="mt-2 text-sm font-bold text-white/80">아이 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => router.push(hasCompletedToday ? reportHref : playHref)}
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-white px-7 text-base font-black text-saged transition hover:bg-cream active:scale-[0.98]"
              >
                {hasCompletedToday ? '오늘 기록 보기' : '아이 플레이 시작'}
              </button>
              <button
                onClick={() => router.push(hasCompletedToday ? libraryHref : reportHref)}
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/30 px-7 text-base font-black text-white transition hover:bg-white/10 active:scale-[0.98]"
              >
                {hasCompletedToday ? '보호자와 이야기 고르기' : '이번 주 기록 보기'}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[34px] border border-white/60 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_32px_rgba(35,49,38,0.10)] backdrop-blur-2xl backdrop-saturate-150">
            <MoriCharacter className="aspect-[1.2/1] w-full" imageClassName="scale-110" label="모리" />
            <div className="border-t border-line p-5">
              <p className="text-xs font-black uppercase tracking-[.16em] text-sage">모리 한마디</p>
              <p className="mt-2 text-lg font-black leading-snug">“그렇게 본 이유가 궁금해.”</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">
                아이 화면에는 어려운 말을 숨기고, 보호자 화면에는 관찰 가능한 기록만 정리합니다.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[.95fr_1.05fr]">
          <div className="rounded-[30px] border border-white/60 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_32px_rgba(35,49,38,0.10)] backdrop-blur-2xl backdrop-saturate-150 p-5">
            <p className="text-xs font-black uppercase tracking-[.16em] text-sage">오늘 놀이 기록</p>
            <h2 className="mt-2 text-2xl font-black">잘 들어온 놀이와 다음 추천</h2>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-mist p-4">
                <p className="text-xs font-black text-sage">오늘 잘 들어온 놀이</p>
                <p className="mt-1 text-lg font-black text-ink">{strongestLabel}</p>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-ink2">{strongestBody}</p>
              </div>
              <div className="rounded-2xl bg-mist p-4">
                <p className="text-xs font-black text-sage">다음에 더 해볼 놀이</p>
                <p className="mt-1 text-lg font-black text-ink">{nextLabel}</p>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-ink2">{nextBody}</p>
              </div>
            </div>
            {summaryError && (
              <div className="mt-3 rounded-2xl border border-clay/20 bg-cream p-4">
                <p className="text-sm font-black text-clay">기록을 잠시 불러오지 못했어요</p>
                <p className="mt-1 text-xs font-bold leading-relaxed text-ink2">
                  연결을 확인한 뒤 다시 시도해 주세요. 아이 기록은 그대로 남아 있어요.
                </p>
                <button
                  type="button"
                  onClick={() => setSummaryReloadToken((value) => value + 1)}
                  className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-saged px-4 text-xs font-black text-white transition hover:bg-ink active:scale-[0.98]"
                >
                  기록 다시 불러오기
                </button>
              </div>
            )}
            <button
              onClick={() => router.push(reportHref)}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-line bg-cream px-5 text-sm font-black text-saged transition hover:bg-mist"
            >
              놀이 기록 자세히 보기
            </button>
          </div>

          <div className="rounded-[30px] border border-white/60 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_32px_rgba(35,49,38,0.10)] backdrop-blur-2xl backdrop-saturate-150 p-5">
            <p className="text-xs font-black uppercase tracking-[.16em] text-clay">
              {hasCompletedToday ? '오늘은 여기까지' : '오늘 이어 할 놀이'}
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {hasCompletedToday ? '기록 보고 1분 대화' : '영상+단서 질문+놀이 12분'}
            </h2>
            <div className="mt-5 grid gap-3">
              {todayPlan.map(([label, body], index) => (
                <div key={label} className="grid grid-cols-[44px_1fr] gap-3 rounded-2xl bg-cream p-4 ring-1 ring-line">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sagebg text-xs font-black text-saged">{index + 1}</span>
                  <div>
                    <p className="font-black text-ink">{label}</p>
                    <p className="mt-1 text-sm font-semibold leading-relaxed text-ink2">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => router.push(hasCompletedToday ? reportHref : playHref)}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-saged px-5 text-sm font-black text-white transition hover:bg-ink"
            >
              {hasCompletedToday ? '오늘 기록 보기' : '오늘 놀이 시작'}
            </button>
            <button
              onClick={() => router.push(libraryHref)}
              className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-line bg-cream px-5 text-sm font-black text-saged transition hover:bg-mist"
            >
              {hasCompletedToday ? '보호자와 이야기 고르기' : '이야기 숲에서 고르기'}
            </button>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <InfoCard
            label="이번 주 이야기"
            value={summaryError ? '확인 필요' : summaryMetric(summary, 'sessions')}
            body={summaryError ? '기록을 다시 불러오면 완료한 이야기 흐름을 보여드려요.' : '완료한 이야기 세션만 차곡차곡 기록합니다.'}
          />
          <InfoCard
            label="오늘 추천"
            value={summaryError ? '잠시 후' : hasCompletedToday ? '쉬는 문' : '3단계'}
            body={summaryError ? '기록이 돌아오면 오늘 이어갈 흐름을 다시 맞춰드려요.' : hasCompletedToday ? '오늘은 기록 확인과 1분 대화만 이어가요.' : '영상, 단서 질문, 놀이로 다음 활동을 다시 만납니다.'}
          />
          <InfoCard
            label="보호자 체크"
            value={summaryError ? '재시도' : summaryMetric(summary, 'rounds')}
            body={summaryError ? '아이 기록은 삭제되지 않았어요. 잠시 뒤 다시 확인해 주세요.' : '완료한 활동 수와 대화 힌트를 바로 확인해요.'}
          />
        </section>

        <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <div className="rounded-[30px] border border-white/60 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_32px_rgba(35,49,38,0.10)] backdrop-blur-2xl backdrop-saturate-150 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-sage">Story Map</p>
                <h2 className="mt-2 text-2xl font-black">이야기 지도</h2>
              </div>
              <span className="rounded-full bg-sagebg px-3 py-1 text-xs font-black text-saged">시즌 1</span>
            </div>
            <div className="mt-5 grid gap-3">
              {storyRegions.map((region, index) => (
                <div key={region.title} className={`flex items-center gap-3 rounded-2xl border p-4 ${region.active ? 'border-sage bg-sagebg' : 'border-line bg-cream'}`}>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black ${region.active ? 'bg-white text-saged' : 'bg-white text-ink3'}`}>
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{region.title}</p>
                    <p className="text-xs font-bold text-ink3">{region.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/60 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_32px_rgba(35,49,38,0.10)] backdrop-blur-2xl backdrop-saturate-150 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-clay">놀이 관찰 지도</p>
                <h2 className="mt-2 text-2xl font-black">오늘 잘 맞은 놀이</h2>
              </div>
              <button onClick={() => router.push(reportHref)} className="rounded-full border border-line px-4 py-2 text-xs font-black text-sage transition hover:bg-mist">
                기록
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-ink2">
              아이가 오늘 어떤 방식으로 보고, 잇고, 만들었는지 남기는 지도예요.
            </p>
            {learningProfile?.enoughData && learningProfile.conditionInsight && (
              <div className="mt-5 rounded-2xl border border-saged/20 bg-mist p-4">
                <p className="text-xs font-black uppercase tracking-[.14em] text-saged">우리 아이는 이렇게 배워요</p>
                <p className="mt-2 text-lg font-black leading-snug text-ink">{learningProfile.conditionInsight}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {learningProfile.strength && (
                    <div className="rounded-xl bg-sagebg px-3 py-2">
                      <p className="text-[11px] font-black text-saged">잘 해내는 놀이</p>
                      <p className="mt-0.5 text-sm font-bold leading-relaxed text-ink2">{learningProfile.strength.note}</p>
                    </div>
                  )}
                  {learningProfile.struggle && learningProfile.struggle.label !== learningProfile.strength?.label && (
                    <div className="rounded-xl bg-cream px-3 py-2 ring-1 ring-line">
                      <p className="text-[11px] font-black text-clay">함께 더 해보면 좋은 놀이</p>
                      <p className="mt-0.5 text-sm font-bold leading-relaxed text-ink2">{learningProfile.struggle.note}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <p className="mt-3 text-xs leading-relaxed text-ink3">
              활동 중 관찰을 요약한 참고 자료예요. 검사나 진단이 아니며, 아이의 능력을 점수로 판정하지 않습니다.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {c6Map.map((tool) => (
                <C6MapCard key={tool.key} tool={tool} />
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-sage/20 bg-sagebg p-4">
              <p className="text-xs font-black uppercase tracking-[.14em] text-sage">다음에 해볼 놀이</p>
              <p className="mt-1 text-lg font-black text-ink">{nextC6Seed.parentLabel}</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-ink2">{nextC6Seed.nextBody}</p>
            </div>
            <div className="mt-4 grid gap-2">
              {homeAssignments.map((assignment) => (
                <div key={`${assignment.day}-${assignment.title}`} className="grid grid-cols-[52px_1fr] gap-3 rounded-2xl bg-cream p-3 ring-1 ring-line">
                  <span className="flex min-h-11 items-center justify-center rounded-xl bg-white text-xs font-black text-saged">{assignment.day}</span>
                  <div>
                    <p className="text-sm font-black text-ink">{assignment.title}</p>
                    <p className="mt-0.5 text-xs font-bold leading-relaxed text-ink2">{assignment.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-line bg-cream p-4">
              <p className="text-sm font-black text-ink">오늘 이렇게 물어보세요</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">
                “{homePrompt}”
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value, body }: { label: string; value: string; body: string }) {
  return (
    <article className="rounded-[26px] border border-white/60 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_32px_rgba(35,49,38,0.10)] backdrop-blur-2xl backdrop-saturate-150 p-5">
      <p className="text-[11px] font-black uppercase tracking-[.14em] text-sage">{label}</p>
      <p className="mt-3 text-3xl font-black text-ink">{value}</p>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">{body}</p>
    </article>
  );
}

function c6StatusLabel(state: C6MapItem['state'], count: number): string {
  if (state === 'next_seed') return '다음 놀이';
  if (count > 0 || state === 'observed') return '잘 보였어요';
  return '기다리는 놀이';
}

function C6MapCard({ tool }: { tool: C6MapItem }) {
  const isNext = tool.state === 'next_seed';
  const isObserved = tool.count > 0 || tool.state === 'observed';

  return (
    <article
      className={`rounded-2xl border p-4 ${
        isNext
          ? 'border-sage bg-sagebg'
          : isObserved
            ? 'border-line bg-mist'
            : 'border-line bg-cream'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <C6ToolMark toolKey={tool.key} className="h-10 w-10 rounded-xl" />
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${isNext ? 'bg-white text-saged' : 'bg-white text-ink3'}`}>
          {c6StatusLabel(tool.state, tool.count)}
        </span>
      </div>
      <p className="mt-3 text-[11px] font-black uppercase tracking-[.12em] text-sage">{tool.codeLabel}</p>
      <h3 className="mt-1 text-base font-black leading-snug text-ink">{tool.parentLabel}</h3>
      <p className="mt-1 text-xs font-bold text-ink3">{tool.childPlayLabel}</p>
      <p className="mt-3 text-sm font-semibold leading-relaxed text-ink2">{tool.body}</p>
      <p className="mt-3 text-xs font-black text-sage">{tool.count > 0 ? `${tool.count}번 관찰` : '첫 기록 전'}</p>
    </article>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-cream"><p className="text-ink3">모리가 기록을 불러오는 중...</p></div>}>
      <DashboardContent />
    </Suspense>
  );
}
