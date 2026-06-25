import Link from 'next/link';
import {
  aggregateSelActivities,
  dialogueStarters,
  growthHighlight,
  tasteProfile,
  weeklySummaryLine,
} from '@/lib/game/sel-report';
import type { GameRoundResult, SelActivityCount } from '@/types/game';

function placeholderRound(
  gameType: GameRoundResult['game_type'],
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
    latency_ms: 1000,
    retried,
    reward_payload: null,
  };
}

function repeatRound(count: number, result: GameRoundResult): GameRoundResult[] {
  return Array.from({ length: count }, () => result);
}

// 예시(placeholder) 라운드 기록 — 라이브 read 경로 연결 전까지 화면 검증용.
const PLACEHOLDER_RESULTS: GameRoundResult[] = [
  ...repeatRound(3, placeholderRound('G2_sort', 'sel_social_awareness', '사회관계')),
  ...repeatRound(2, placeholderRound('G1_match', 'creativity_pattern', '예술경험')),
  ...repeatRound(2, placeholderRound('G2_sort', 'sel_self_management', '사회관계', true)),
  ...repeatRound(5, placeholderRound('emotion_expression', 'sel_self_awareness', '사회관계')),
  ...repeatRound(2, placeholderRound('G5_find', 'creativity_observe', '예술경험')),
];

// 취향 프로파일 — V1 에서 game_rounds 선호 빈도로 채움. 현재는 예시 데이터.
const PLACEHOLDER_TASTE = {
  favoriteStory: '공룡 마을',
  frequentQuestion: '"○○라면 어떨까?"',
  favoriteColors: ['파랑', '초록'],
};

const CHILD_NAME = '서연';

function ActivityBar({ activity, maxCount }: { activity: SelActivityCount; maxCount: number }) {
  const pct = maxCount > 0 ? (activity.count / maxCount) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-bold text-gray-900">
          <span className="mr-1.5" aria-hidden>
            {activity.icon}
          </span>
          {activity.label_ko}
        </span>
        <span className="text-sm font-extrabold text-violet-600">
          {activity.count}
          {activity.unit_ko}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-violet-50">
        <div
          className="h-full rounded-full bg-violet-500"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

export default function ParentSelReportPage() {
  const counts = aggregateSelActivities(PLACEHOLDER_RESULTS);
  const starters = dialogueStarters(counts);
  const summaryLine = weeklySummaryLine(counts);
  const highlight = growthHighlight(counts, CHILD_NAME);
  const taste = tasteProfile(PLACEHOLDER_TASTE);
  const selfDirected = counts.find((item) => item.skill_key === 'self_directed')?.count ?? 0;
  const maxCount = Math.max(1, ...counts.map((item) => item.count));

  return (
    <div className="min-h-screen bg-violet-50 pb-24">
      <div className="bg-gradient-to-br from-violet-500 to-violet-400 px-6 pb-14 pt-12 text-white">
        <Link
          href="/dashboard"
          className="inline-flex min-h-[44px] items-center rounded-full bg-white/20 px-4 text-xs font-bold text-white transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/70"
        >
          대시보드로
        </Link>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-violet-100">이번 주 미래역량 리포트</p>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight">이번 주 {CHILD_NAME}이</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-violet-100">
          {CHILD_NAME}이가 키우고 있는 힘을 활동 횟수로 정리했어요.
        </p>
      </div>

      <div className="space-y-5 px-6 pt-6">
        {/* 7. 성장 하이라이트 */}
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">🌱 이번 주 성장 하이라이트</p>
          <h2 className="mt-2 text-xl font-extrabold leading-snug text-gray-900">{highlight}</h2>
        </section>

        {/* 1. HERO — 자기주도/꾸준함 (자기 대비만) */}
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">이번 주 함께한 활동</p>
          <h2 className="mt-2 text-xl font-extrabold leading-snug text-gray-900">{summaryLine}</h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-gray-500">
            완료한 활동 횟수만 보여드려요. 아이의 능력을 점수로 단정하지 않아요.
          </p>
          <div className="mt-5 rounded-2xl bg-violet-50 px-4 py-3">
            <p className="text-sm font-bold text-violet-700">스스로 {selfDirected}번 놀이했어요</p>
            <p className="mt-1 text-xs font-medium leading-relaxed text-violet-500">
              지난주 기록이 쌓이면 &apos;지난주 대비&apos;로 보여드려요. (또래 비교는 하지 않아요.)
            </p>
          </div>
        </section>

        {/* 2~5. 우리 아이가 키우고 있는 힘 — 활동량 막대 (미래역량 라벨) */}
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">우리 아이가 키우고 있는 힘</p>
              <h2 className="mt-2 text-lg font-extrabold text-gray-900">관찰 가능한 활동량</h2>
            </div>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-bold text-violet-600">주간</span>
          </div>
          <div className="space-y-5">
            {counts.map((activity) => (
              <ActivityBar key={activity.skill_key} activity={activity} maxCount={maxCount} />
            ))}
          </div>
        </section>

        {/* 6. 우리 아이 취향 프로파일 */}
        {taste.length > 0 && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">🎨 우리 아이가 빠져든 것</p>
            <h2 className="mt-2 text-lg font-extrabold text-gray-900">자주 고른 것들</h2>
            <dl className="mt-5 space-y-3">
              {taste.map((item) => (
                <div key={item.label_ko} className="flex items-baseline justify-between gap-3">
                  <dt className="text-sm font-medium text-gray-500">{item.label_ko}</dt>
                  <dd className="text-sm font-bold text-gray-900">{item.value_ko}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs font-medium leading-relaxed text-gray-400">
              자주 고른 빈도 패턴이에요. 아이의 성향이나 능력을 단정하지 않아요.
            </p>
          </section>
        )}

        {/* 대화 스타터 */}
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">💬 오늘 이렇게 물어보세요</p>
          <h2 className="mt-2 text-lg font-extrabold text-gray-900">영상 확인 없이 1분 대화</h2>
          <ol className="mt-5 space-y-3">
            {starters.map((starter, index) => (
              <li key={starter} className="flex gap-3 rounded-2xl bg-violet-50 p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-extrabold text-violet-600">
                  {index + 1}
                </span>
                <p className="text-sm font-semibold leading-relaxed text-gray-700">{starter}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs font-medium leading-relaxed text-gray-400">
            추가 화면 시간 없이 부모와 아이가 짧게 이야기할 수 있는 정적 문장입니다.
          </p>
        </section>

        {/* 정직성 고지 (= 차별화) */}
        <section className="rounded-3xl border border-violet-100 bg-white/70 p-5">
          <p className="text-sm font-semibold leading-relaxed text-violet-700">
            ⓘ 완료한 활동만 보여드려요 · 능력을 점수로 단정하지 않아요.
          </p>
        </section>

        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Human handoff</p>
          <h2 className="mt-2 text-base font-extrabold text-amber-900">라이브 게임 활동 읽기 연결 대기</h2>
          <p className="mt-2 text-sm font-medium leading-relaxed text-amber-800">
            현재 화면은 예시 라운드 기록으로 렌더링됩니다. 실제 주간 기록(game_rounds)과 취향 프로파일은
            인증된 읽기 경로가 정해지면 연결합니다.
          </p>
        </section>
      </div>
    </div>
  );
}
