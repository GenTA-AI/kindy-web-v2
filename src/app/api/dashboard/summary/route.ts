import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { aggregateC6Profile, c6HomeAssignments, c6NextStep } from '@/lib/game/c6-profile';
import { parseLocalPreviewGameCookie, LOCAL_PREVIEW_GAME_COOKIE } from '@/lib/local-preview-game';
import { isSupabaseServiceConfigured, supabase } from '@/lib/supabase';
import type { GameRoundResult, GameType } from '@/types/game';

export const runtime = 'nodejs';

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

function unauthorized() {
  return NextResponse.json({ error: '보호자 로그인이 필요해요.' }, { status: 401 });
}

function badRequest() {
  return NextResponse.json({ error: '아이 정보를 다시 확인해 주세요.' }, { status: 400 });
}

function childNotFound() {
  return NextResponse.json({ error: '아이 정보를 찾지 못했어요.' }, { status: 404 });
}

function summaryReadError() {
  return NextResponse.json({ error: '놀이 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
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

function buildSummary(input: {
  rounds: GameRoundResult[];
  sessionCount: number;
  completedSessionCount: number;
  latestCompletedAt: string | null;
  updatedAt: string | null;
}) {
  const c6Profile = aggregateC6Profile(input.rounds);
  const strongest = c6Profile.reduce(
    (best, tool) => (tool.count > best.count ? tool : best),
    c6Profile[0],
  );
  const hasRounds = input.rounds.length > 0;
  const nextTool = c6NextStep(c6Profile);
  const retriedCount = input.rounds.filter((round) => round.retried).length;
  const c6Map = c6Profile.map((tool) => ({
    key: tool.key,
    icon: tool.icon,
    codeLabel: tool.codeLabel,
    parentLabel: tool.parentLabel,
    childPlayLabel: tool.childPlayLabel,
    count: tool.count,
    body: tool.count > 0 ? tool.doneBody(tool.count) : tool.nextBody,
    state: tool.key === nextTool.key ? 'next_seed' : tool.count > 0 ? 'observed' : 'empty',
    nextBody: tool.nextBody,
    homePrompt: tool.homePrompt,
  }));
  const homeAssignments = c6HomeAssignments(c6Profile).map(([day, title, body]) => ({
    day,
    title,
    body,
  }));

  return {
    totalRounds: input.rounds.length,
    sessionCount: input.sessionCount,
    completedSessionCount: input.completedSessionCount,
    latestCompletedAt: input.latestCompletedAt,
    retriedCount,
    updatedAt: input.updatedAt,
    strongest: hasRounds && strongest?.count > 0
      ? {
          label: strongest.parentLabel,
          body: strongest.doneBody(strongest.count),
          count: strongest.count,
        }
      : {
          label: '첫 놀이를 기다려요',
          body: '영상 1편과 단서 놀이를 마치면 오늘 잘 들어온 놀이가 여기에 보여요.',
          count: 0,
        },
    next: {
      label: nextTool.parentLabel,
      body: nextTool.nextBody,
      homePrompt: nextTool.homePrompt,
    },
    c6Map,
    homeAssignments,
  };
}

async function loadSupabaseSummary(childId: string, parentId: string) {
  const { data: child, error: childError } = await supabase
    .from('children')
    .select('id')
    .eq('id', childId)
    .eq('parent_id', parentId)
    .maybeSingle();

  if (childError) throw childError;
  if (!child) return null;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: rounds, error: roundsError }, { data: sessions, error: sessionsError }] = await Promise.all([
    supabase
      .from('game_rounds')
      .select('game_type, difficulty, objective_code, standard_anchor, score, max_score, latency_ms, retried, reward_payload')
      .eq('child_id', childId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('game_sessions')
      .select('id, completed_at, updated_at, started_at')
      .eq('child_id', childId)
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(20),
  ]);

  if (roundsError) throw roundsError;
  if (sessionsError) throw sessionsError;

  const sessionRows = (sessions ?? []) as Array<{ completed_at?: string | null; updated_at?: string | null; started_at?: string | null }>;
  const completedTimes = sessionRows
    .map((session) => session.completed_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return buildSummary({
    rounds: ((rounds ?? []) as RoundRow[]).map(toRoundResult).filter((round): round is GameRoundResult => Boolean(round)),
    sessionCount: sessionRows.length,
    completedSessionCount: sessionRows.filter((session) => Boolean(session.completed_at)).length,
    latestCompletedAt: completedTimes[0] ?? null,
    updatedAt: sessionRows[0]?.updated_at ?? sessionRows[0]?.started_at ?? null,
  });
}

export async function GET(request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId(request);
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    console.error('[dashboard-summary:auth]', error);
    return summaryReadError();
  }

  const { searchParams } = new URL(request.url);
  const childId = searchParams.get('childId');
  if (!childId) return badRequest();

  if (!isSupabaseServiceConfigured()) {
    const previewGame = parseLocalPreviewGameCookie(request.cookies.get(LOCAL_PREVIEW_GAME_COOKIE)?.value);
    const usePreviewGame = previewGame?.child_id === childId;
    const rounds = usePreviewGame ? previewGame.rounds.map((round) => round.result) : [];

    return NextResponse.json(buildSummary({
      rounds,
      sessionCount: usePreviewGame ? 1 : 0,
      completedSessionCount: usePreviewGame && previewGame.completed_at ? 1 : 0,
      latestCompletedAt: usePreviewGame ? previewGame.completed_at : null,
      updatedAt: usePreviewGame ? previewGame.updated_at : null,
    }));
  }

  let summary: ReturnType<typeof buildSummary> | null;
  try {
    summary = await loadSupabaseSummary(childId, parentId);
  } catch (error) {
    console.error('[dashboard-summary:load]', error);
    return summaryReadError();
  }

  if (!summary) return childNotFound();
  return NextResponse.json(summary);
}
