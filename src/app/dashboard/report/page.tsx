import Link from 'next/link';
import { cookies } from 'next/headers';
import C6ToolMark from '@/components/C6ToolMark';
import MoriCharacter from '@/components/MoriCharacter';
import { getCurrentParentId } from '@/lib/auth';
import { getSupabase, isSupabaseServiceConfigured } from '@/lib/supabase';
import {
  aggregateSelActivities,
  dialogueStarters,
  growthHighlight,
  tasteProfile,
  weeklySummaryLine,
} from '@/lib/game/sel-report';
import {
  aggregateC6Profile,
  c6HomeAssignments,
  c6NextStep,
  type C6ToolProgress,
} from '@/lib/game/c6-profile';
import {
  DEFAULT_LOCAL_PREVIEW_CHILD,
  LOCAL_PREVIEW_CHILD_COOKIE,
  parseLocalPreviewChildCookie,
} from '@/lib/local-preview-child';
import { LOCAL_PREVIEW_GAME_COOKIE, parseLocalPreviewGameCookie } from '@/lib/local-preview-game';
import { withJosa } from '@/lib/josa';
import type { GameRoundResult, GameType, SelActivityCount } from '@/types/game';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
type ReportPageProps = {
  searchParams: Promise<SearchParams>;
};

type ChildSummary = {
  id: string;
  name: string | null;
  age: number | null;
};

type RoundRow = {
  game_type: string;
  difficulty: number | null;
  objective_code: string | null;
  standard_anchor: string | null;
  score: number | null;
  max_score: number | null;
  latency_ms: number | null;
  retried: boolean | null;
  reward_payload: unknown;
};

type DiagnosisSummaryItem = readonly [label: string, title: string, body: string];

const REPORT_FLOW = [
  ['영상', '짧은 이야기를 봐요'],
  ['질문·놀이', '고르고 만들며 확인해요'],
  ['기록', '보호자가 오늘 흐름을 봐요'],
];

const VALID_GAME_TYPES = new Set<GameType>([
  'G1_match',
  'G2_sort',
  'G3_sequence',
  'G4_listen',
  'G5_find',
  'Q_quiz',
  'emotion_expression',
  'hidden_friend',
  'decorate',
]);

function previewRound(
  gameType: GameType,
  objectiveCode: string,
  standardAnchor: string,
  retried = false,
): GameRoundResult {
  return {
    game_type: gameType,
    difficulty: 1,
    objective_code: objectiveCode,
    standard_anchor: standardAnchor,
    score: 1,
    max_score: 1,
    latency_ms: 1200,
    retried,
    reward_payload: {
      stars: 1,
      stickers: [`preview:${objectiveCode}`],
      collection_unlocks: [`preview:${standardAnchor}`],
    },
  };
}

const LOCAL_PREVIEW_ROUNDS: GameRoundResult[] = [
  previewRound('emotion_expression', 'sel_self_awareness', '사회관계'),
  previewRound('hidden_friend', 'creativity_observe', '예술경험'),
  previewRound('G1_match', 'creativity_imagine', '예술경험'),
  previewRound('G2_sort', 'creativity_pattern', '예술경험', true),
  previewRound('decorate', 'creativity_compose', '예술경험'),
];

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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

function displayName(child: ChildSummary | null): string {
  return child?.name?.trim() || '우리 아이';
}

function diagnosisSummary(
  rounds: GameRoundResult[],
  c6Profile: C6ToolProgress[],
  nextTool: C6ToolProgress,
  retriedCount: number,
  dialogueStarterCount: number,
): DiagnosisSummaryItem[] {
  if (rounds.length === 0) {
    return [
      ['이미 잘 들어온 부분', '첫 놀이를 기다려요', '놀이를 한 번 마치면 아이가 어떤 활동을 끝냈는지 여기에 남아요.'],
      ['다음에 더 해볼 부분', '모리 짧은 영상 보기', '짧은 영상을 보고 장면 단서 질문 1~2개부터 시작해요.'],
      ['보호자가 확인할 부분', '완료 여부 · 다시 살펴봄 · 대화 흐름', '아이가 무엇을 끝냈고 어디에서 다시 봤는지 확인합니다.'],
    ];
  }

  const strongest = c6Profile.reduce(
    (best, tool) => (tool.count > best.count ? tool : best),
    c6Profile[0],
  );
  const safeStarterCount = Math.max(0, dialogueStarterCount);

  return [
    [
      '이미 잘 들어온 부분',
      strongest.parentLabel,
      strongest.count > 0
        ? strongest.doneBody(strongest.count)
        : '첫 활동을 끝내면 아이가 자연스럽게 들어온 놀이가 여기에 보여요.',
    ],
    ['다음에 더 해볼 부분', nextTool.parentLabel, nextTool.nextBody],
    [
      '보호자가 확인할 부분',
      `완료 ${rounds.length}번 · 다시 살펴봄 ${retriedCount}번`,
      `끝낸 놀이, 다시 살펴본 순간, 오늘 이어볼 대화 힌트 ${safeStarterCount}개를 봅니다.`,
    ],
  ];
}

function toRoundResult(row: RoundRow): GameRoundResult | null {
  if (!VALID_GAME_TYPES.has(row.game_type as GameType)) return null;

  return {
    game_type: row.game_type as GameType,
    difficulty: typeof row.difficulty === 'number' ? row.difficulty : 1,
    objective_code: row.objective_code,
    standard_anchor: row.standard_anchor,
    score: row.score,
    max_score: row.max_score,
    latency_ms: row.latency_ms,
    retried: Boolean(row.retried),
    reward_payload: row.reward_payload && typeof row.reward_payload === 'object' && !Array.isArray(row.reward_payload)
      ? row.reward_payload as GameRoundResult['reward_payload']
      : null,
  };
}

async function loadReport(parentId: string | null, requestedChildId: string | null, sampleMode = false) {
  if (sampleMode) {
    return {
      child: {
        id: requestedChildId ?? DEFAULT_LOCAL_PREVIEW_CHILD.id,
        name: DEFAULT_LOCAL_PREVIEW_CHILD.name,
        age: DEFAULT_LOCAL_PREVIEW_CHILD.age,
      },
      rounds: LOCAL_PREVIEW_ROUNDS,
      sessionCount: 1,
      completedSessionCount: 1,
      latestCompletedAt: null,
    };
  }

  if (!isSupabaseServiceConfigured()) {
    const cookieStore = await cookies();
    const previewChild = parseLocalPreviewChildCookie(cookieStore.get(LOCAL_PREVIEW_CHILD_COOKIE)?.value);
    const previewGame = parseLocalPreviewGameCookie(cookieStore.get(LOCAL_PREVIEW_GAME_COOKIE)?.value);
    const previewRounds = previewGame?.rounds.map((round) => round.result) ?? [];
    const hasPlayedPreview = previewGame && previewRounds.length > 0;
    return {
      child: {
        id: requestedChildId ?? previewChild.id,
        name: previewChild.name,
        age: previewChild.age,
      },
      rounds: hasPlayedPreview ? previewRounds : [],
      sessionCount: previewGame ? 1 : 0,
      completedSessionCount: previewGame?.completed_at ? 1 : 0,
      latestCompletedAt: previewGame?.completed_at ?? null,
    };
  }

  if (!parentId) throw new Error('parent id required');

  const supabase = getSupabase();
  const { data: children, error: childError } = await supabase
    .from('children')
    .select('id, name, age')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false });

  if (childError) throw childError;

  const childList = (children ?? []) as ChildSummary[];
  const child = requestedChildId
    ? childList.find((item) => item.id === requestedChildId) ?? childList[0] ?? null
    : childList[0] ?? null;

  if (!child) {
    return {
      child: null,
      rounds: [] as GameRoundResult[],
      sessionCount: 0,
      completedSessionCount: 0,
      latestCompletedAt: null,
    };
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: rounds, error: roundsError }, { data: sessions, error: sessionsError }] = await Promise.all([
    supabase
      .from('game_rounds')
      .select('game_type, difficulty, objective_code, standard_anchor, score, max_score, latency_ms, retried, reward_payload')
      .eq('child_id', child.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(120),
    supabase
      .from('game_sessions')
      .select('id, completed_at')
      .eq('child_id', child.id)
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(30),
  ]);

  if (roundsError) throw roundsError;
  if (sessionsError) throw sessionsError;

  return {
    child,
    rounds: ((rounds ?? []) as RoundRow[]).map(toRoundResult).filter((item): item is GameRoundResult => Boolean(item)),
    sessionCount: sessions?.length ?? 0,
    completedSessionCount: (sessions ?? []).filter((session) => Boolean(session.completed_at)).length,
    latestCompletedAt: (sessions ?? [])
      .map((session) => session.completed_at)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null,
  };
}

function ActivityBar({ activity, maxCount }: { activity: SelActivityCount; maxCount: number }) {
  const pct = maxCount > 0 ? (activity.count / maxCount) * 100 : 0;

  return (
    <div className="rounded-2xl bg-mist p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-black text-ink">
          {activity.label_ko}
        </span>
        <span className="text-sm font-black text-saged">
          {activity.count}
          {activity.unit_ko}
        </span>
      </div>
      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-sage"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

function C6ToolCard({ tool, maxCount }: { tool: C6ToolProgress; maxCount: number }) {
  const pct = maxCount > 0 ? (tool.count / maxCount) * 100 : 0;
  const hasActivity = tool.count > 0;

  return (
    <article className="rounded-2xl bg-mist p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-sage">{tool.codeLabel}</p>
          <h3 className="mt-1 text-lg font-black text-ink">{tool.parentLabel}</h3>
        </div>
        <C6ToolMark toolKey={tool.key} />
      </div>
      <p className="mt-3 text-sm font-semibold leading-relaxed text-ink2">
        {hasActivity ? tool.doneBody(tool.count) : tool.nextBody}
      </p>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-sage"
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
        <span className="min-w-10 text-right text-sm font-black text-saged">{tool.count}번</span>
      </div>
    </article>
  );
}

function EmptyReport({ childName }: { childName: string }) {
  return (
    <section className="rounded-[30px] border border-line bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[.16em] text-sage">아직 피는 중</p>
      <h2 className="mt-2 text-2xl font-black leading-snug">{childName}의 첫 기록이 곧 자라나요.</h2>
      <p className="mt-3 text-sm font-semibold leading-relaxed text-ink2">
        플레이를 한 번 마치면 완료한 활동, 다시 살펴본 순간, 다음 대화 힌트가 여기에 쌓입니다.
      </p>
    </section>
  );
}

function HomeUseGuide({
  childName,
  nextTool,
  playHref,
  libraryHref,
  playLabel = '오늘 놀이 시작',
  libraryLabel = '이야기 숲 보기',
}: {
  childName: string;
  nextTool: C6ToolProgress;
  playHref: string;
  libraryHref: string;
  playLabel?: string;
  libraryLabel?: string;
}) {
  const guideItems = [
    ['한 번에 짧게', '영상 1편과 단서 놀이 1개만 해도 충분해요. 끝나면 기록 화면에서 멈춥니다.'],
    ['오늘 한마디', nextTool.homePrompt],
    ['아이 화면 안심', '아이 화면에는 광고, 결제 버튼, 계속 보게 만드는 자동재생을 넣지 않습니다.'],
  ];

  return (
    <section className="mt-5 rounded-[30px] border border-line bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-clay">가정 사용 가이드</p>
          <h2 className="mt-2 text-2xl font-black">{withJosa(childName, '와/과')} 오늘은 여기까지</h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-ink2">
            길게 붙잡기보다 한 편을 끝내고, 보호자가 짧게 이어 묻는 방식으로 설계합니다.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:w-[360px]">
          <Link
            href={playHref}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-saged px-5 text-sm font-black text-white transition hover:bg-ink"
          >
            {playLabel}
          </Link>
          <Link
            href={libraryHref}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-cream px-5 text-sm font-black text-saged transition hover:bg-mist"
          >
            {libraryLabel}
          </Link>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {guideItems.map(([title, body]) => (
          <article key={title} className="rounded-2xl bg-mist p-4">
            <h3 className="text-base font-black text-ink">{title}</h3>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default async function ParentSelReportPage({ searchParams }: ReportPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedChildId = firstParam(resolvedSearchParams.childId);
  const sampleMode = firstParam(resolvedSearchParams.sample) === '1';
  const parentId = sampleMode ? null : await getCurrentParentId();

  let report: Awaited<ReturnType<typeof loadReport>>;
  let loadFailed = false;

  try {
    report = await loadReport(parentId, requestedChildId, sampleMode);
  } catch {
    loadFailed = true;
    report = { child: null, rounds: [], sessionCount: 0, completedSessionCount: 0, latestCompletedAt: null };
  }

  const childName = displayName(report.child);
  const counts = aggregateSelActivities(report.rounds);
  const c6Profile = aggregateC6Profile(report.rounds);
  const c6Next = c6NextStep(c6Profile);
  const homeAssignments = c6HomeAssignments(c6Profile);
  const starters = dialogueStarters(counts).slice(0, 3);
  const summaryLine = weeklySummaryLine(counts);
  const highlight = growthHighlight(counts, childName);
  const maxCount = Math.max(1, ...counts.map((item) => item.count));
  const maxC6Count = Math.max(1, ...c6Profile.map((item) => item.count));
  const totalRounds = report.rounds.length;
  const retriedCount = report.rounds.filter((round) => round.retried).length;
  const diagnosisItems = diagnosisSummary(report.rounds, c6Profile, c6Next, retriedCount, starters.length);
  const taste = tasteProfile({
    favoriteStory: report.sessionCount > 0 ? '동물 마을 이야기' : null,
    frequentQuestion: totalRounds > 0 ? '"그렇게 본 이유가 궁금해."' : null,
    favoriteColors: totalRounds > 0 ? ['세이지', '크림'] : [],
  });
  const childQuery = report.child ? `?childId=${encodeURIComponent(report.child.id)}` : '';
  const dashboardHref = sampleMode ? '/' : `/dashboard${childQuery}`;
  const dashboardLabel = sampleMode ? '서비스 소개로' : '기록장으로';
  const libraryHref = sampleMode ? '/' : `/library${childQuery}`;
  const hasCompletedToday = !sampleMode && isSameLocalDay(report.latestCompletedAt);
  const playHref = sampleMode ? '/auth/login?next=/onboarding' : `/play${childQuery}`;
  const recommendationHref = hasCompletedToday ? libraryHref : playHref;
  const recommendationLabel = sampleMode
    ? '무료로 시작하기'
    : hasCompletedToday
      ? '다음 이야기 고르기'
      : '오늘 놀이 시작';
  const guidePrimaryHref = hasCompletedToday ? dashboardHref : playHref;
  const guidePrimaryLabel = sampleMode
    ? '무료로 시작하기'
    : hasCompletedToday
      ? '홈으로'
      : '오늘 놀이 시작';
  const libraryLabel = sampleMode
    ? '서비스 소개 보기'
    : hasCompletedToday
      ? '보호자와 이야기 고르기'
      : '이야기 숲 보기';

  return (
    <main className="min-h-screen bg-cream pb-28 text-ink [word-break:keep-all]">
      <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 lg:py-8">
        <header className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          <section className="rounded-[34px] bg-saged p-6 text-white sm:p-8">
            <Link
              href={dashboardHref}
              className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-4 text-xs font-black text-white transition hover:bg-white/10"
            >
              {dashboardLabel}
            </Link>
            <p className="mt-7 text-xs font-black uppercase tracking-[.16em] text-white/70">
              {sampleMode ? '기록 예시' : '이번 주 모리 기록'}
            </p>
            <h1 className="mt-3 text-[32px] font-black leading-tight tracking-[-.03em] sm:text-5xl">
              {childName}의 이야기 숲이{' '}
              <br />
              이렇게 자랐어요.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-relaxed text-white/82">
              {sampleMode
                ? '실제 가입 전 확인할 수 있는 예시 화면입니다. 오늘 한 놀이가 어떻게 기록되는지 먼저 보여줍니다.'
                : '아이가 실제로 한 활동과 모리가 발견한 작은 단서를 정리합니다.'}
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {REPORT_FLOW.map(([label, body]) => (
                <div key={label} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <p className="text-xs font-black text-white">{label}</p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-white/72">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-[34px] border border-line bg-white shadow-sm">
            <MoriCharacter className="aspect-square w-full" imageClassName="scale-110" label="모리" />
          </section>
        </header>

        {loadFailed && (
          <section className="mt-5 rounded-3xl border border-clay/30 bg-white p-5">
            <p className="text-sm font-bold leading-relaxed text-clay">
              지금은 기록을 불러오지 못했어요. 연결이 복구되면 이 화면은 자동으로 실제 활동 기록을 보여줍니다.
            </p>
          </section>
        )}

        <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_.95fr]">
          <section className="rounded-[30px] border border-line bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[.16em] text-sage">기록 요약</p>
            <h2 className="mt-2 text-2xl font-black">다음에 해볼 놀이를 추천해요</h2>
            <div className="mt-5 grid gap-3">
              {diagnosisItems.map(([label, title, body]) => (
                <div key={label} className="rounded-2xl bg-mist p-4">
                  <p className="text-xs font-black text-sage">{label}</p>
                  <p className="mt-1 text-lg font-black text-ink">{title}</p>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-ink2">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-line bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[.16em] text-clay">이번 주 추천</p>
            <h2 className="mt-2 text-2xl font-black">영상과 단서 놀이 3일 흐름</h2>
            <div className="mt-5 grid gap-3">
              {homeAssignments.map(([day, title, body]) => (
                <div key={day} className="rounded-2xl bg-cream p-4 ring-1 ring-line">
                  <p className="text-xs font-black text-sage">{day}</p>
                  <p className="mt-1 font-black text-ink">{title}</p>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-ink2">{body}</p>
                </div>
              ))}
            </div>
            <Link
              href={recommendationHref}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-saged px-5 text-sm font-black text-white transition hover:bg-ink"
            >
              {recommendationLabel}
            </Link>
          </section>
        </section>

        <section className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Metric label="완료한 놀이" value={`${totalRounds}번`} />
          <Metric label="이야기 세션" value={`${report.completedSessionCount}/${report.sessionCount}`} />
          <Metric label="다시 본 순간" value={`${retriedCount}번`} />
          <Metric label="대화 힌트" value={`${starters.length}개`} />
        </section>

        <HomeUseGuide
          childName={childName}
          nextTool={c6Next}
          playHref={guidePrimaryHref}
          libraryHref={libraryHref}
          playLabel={guidePrimaryLabel}
          libraryLabel={libraryLabel}
        />

        {totalRounds === 0 ? (
          <div className="mt-5">
            <EmptyReport childName={childName} />
          </div>
        ) : (
          <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[.94fr_1.06fr]">
            <div className="space-y-5">
              <section className="rounded-[30px] border border-line bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[.16em] text-sage">성장 하이라이트</p>
                <h2 className="mt-2 text-2xl font-black leading-snug">{highlight}</h2>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-ink2">
                  관찰 가능한 활동 횟수만 사용합니다. 아이의 성향이나 능력을 단정하지 않아요.
                </p>
              </section>

              <section className="rounded-[30px] border border-line bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[.16em] text-clay">이번 주 함께한 활동</p>
                <h2 className="mt-2 text-2xl font-black leading-snug">{summaryLine}</h2>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-ink2">
                  모리가 본 것은 결과가 아니라 과정입니다. 시작하고, 고르고, 다시 살펴본 흔적을 모읍니다.
                </p>
              </section>
            </div>

            <section className="rounded-[30px] border border-line bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.16em] text-sage">놀이 관찰 기록</p>
                  <h2 className="mt-2 text-2xl font-black">관찰 가능한 활동량</h2>
                </div>
                <span className="rounded-full bg-sagebg px-3 py-1 text-xs font-black text-saged">주간</span>
              </div>
              <div className="mt-5 space-y-3">
                {counts.map((activity) => (
                  <ActivityBar key={activity.skill_key} activity={activity} maxCount={maxCount} />
                ))}
              </div>
            </section>
          </section>
        )}

        <section className="mt-5 rounded-[30px] border border-line bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-sage">놀이 관찰 지도</p>
              <h2 className="mt-2 text-2xl font-black">해본 놀이와 다음 추천</h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-ink2">
                아이가 실제로 끝낸 놀이를 여섯 가지 활동 방식으로 정리합니다. 한 놀이가 두 방식에 함께 남을 수 있고, 빈칸은 부족 판정이 아니라 다음에 해볼 놀이 후보예요.
              </p>
            </div>
            <div className="rounded-2xl bg-sagebg p-4 lg:w-72">
              <p className="text-xs font-black text-sage">다음에 해볼 놀이</p>
              <p className="mt-1 text-lg font-black text-saged">{c6Next.parentLabel}</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">{c6Next.nextBody}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {c6Profile.map((tool) => (
              <C6ToolCard key={tool.key} tool={tool} maxCount={maxC6Count} />
            ))}
          </div>
        </section>

        <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_.95fr]">
          <section className="rounded-[30px] border border-line bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[.16em] text-sage">오늘 이렇게 물어보세요</p>
            <h2 className="mt-2 text-2xl font-black">영상 확인 없이 1분 대화</h2>
            <ol className="mt-5 space-y-3">
              {starters.map((starter, index) => (
                <li key={starter} className="flex gap-3 rounded-2xl bg-mist p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-sage">
                    {index + 1}
                  </span>
                  <p className="text-sm font-bold leading-relaxed text-ink2">{starter}</p>
                </li>
              ))}
              {starters.length === 0 && (
                <li className="rounded-2xl bg-mist p-4 text-sm font-bold leading-relaxed text-ink2">
                  오늘 아이가 가장 해보고 싶은 놀이를 하나 같이 골라볼까요?
                </li>
              )}
            </ol>
          </section>

          <section className="rounded-[30px] border border-line bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[.16em] text-clay">자주 고른 단서</p>
            <h2 className="mt-2 text-2xl font-black">취향은 빈도 패턴으로만 봅니다</h2>
            <dl className="mt-5 space-y-3">
              {taste.map((item) => (
                <div key={item.label_ko} className="rounded-2xl bg-cream p-4">
                  <dt className="text-xs font-black uppercase tracking-[.12em] text-ink3">{item.label_ko}</dt>
                  <dd className="mt-1 text-base font-black text-ink">{item.value_ko}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs font-semibold leading-relaxed text-ink3">
              이 항목은 아이를 규정하지 않고, 다음 이야기를 고르는 참고로만 사용합니다.
            </p>
          </section>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[26px] border border-line bg-white p-5 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[.14em] text-sage">{label}</p>
      <p className="mt-3 text-3xl font-black text-ink">{value}</p>
    </article>
  );
}
