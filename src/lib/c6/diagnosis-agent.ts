import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameRoundResult } from '@/types/game';
import {
  C6_AXIS_BY_ID,
  inferAxisFromLegacyRound,
  type C6AxisId,
} from './axes';
import {
  DEFAULT_AXIS_PROFILE_STATE,
  buildEvidence,
  evidenceFromRound,
  isAssessableRound,
  trendFrom,
  updateAxis,
  type AxisProfileState,
  type GameRoundEvidenceRecord,
} from './evidence';

type ProcessRoundGrowthInput = {
  roundId: string;
  childId: string;
  round: GameRoundResult;
  age: number | null;
};

type RoundHistoryRow = {
  id: string;
  game_type: string;
  objective_code: string | null;
  score: number | null;
  max_score: number | null;
  axis_id: string | null;
};

type GrowthProfileRow = {
  current_level: number | string | null;
  confidence: number | string | null;
  evidence_count: number | null;
};

function numberValue(value: number | string | null | undefined, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toAxisId(value: string | null | undefined): C6AxisId | null {
  return value && C6_AXIS_BY_ID.has(value as C6AxisId) ? (value as C6AxisId) : null;
}

function axisForRound(round: { axis_id?: string | null; game_type: string; objective_code: string | null }): C6AxisId | null {
  return toAxisId(round.axis_id) ?? inferAxisFromLegacyRound(round);
}

function successFromRound(round: {
  is_correct?: boolean | null;
  score: number | null;
  max_score: number | null;
}): boolean | null {
  if (typeof round.is_correct === 'boolean') return round.is_correct;
  if (round.score !== null && round.max_score !== null) return round.score >= round.max_score;
  return null;
}

async function claimRound(client: SupabaseClient, roundId: string, now: string): Promise<boolean> {
  const { data, error } = await client
    .from('game_rounds')
    .update({ growth_processed_at: now })
    .eq('id', roundId)
    .is('growth_processed_at', null)
    .select('id');

  if (error) throw error;
  return Boolean(data?.length);
}

async function loadRecentRounds(input: {
  client: SupabaseClient;
  childId: string;
  roundId: string;
}): Promise<RoundHistoryRow[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await input.client
    .from('game_rounds')
    .select('id, game_type, objective_code, score, max_score, axis_id')
    .eq('child_id', input.childId)
    .neq('id', input.roundId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(120);

  if (error) throw error;
  return (data ?? []) as RoundHistoryRow[];
}

async function loadProfileState(input: {
  client: SupabaseClient;
  childId: string;
  axisId: C6AxisId;
}): Promise<AxisProfileState> {
  const { data, error } = await input.client
    .from('child_growth_profiles')
    .select('current_level, confidence, evidence_count')
    .eq('child_id', input.childId)
    .eq('axis_id', input.axisId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return DEFAULT_AXIS_PROFILE_STATE;

  const row = data as GrowthProfileRow;
  return {
    level: numberValue(row.current_level, DEFAULT_AXIS_PROFILE_STATE.level),
    confidence: numberValue(row.confidence, DEFAULT_AXIS_PROFILE_STATE.confidence),
    evidence_count: typeof row.evidence_count === 'number'
      ? row.evidence_count
      : DEFAULT_AXIS_PROFILE_STATE.evidence_count,
  };
}

function evidenceRecord(round: GameRoundResult, axisId: C6AxisId): GameRoundEvidenceRecord {
  const record: GameRoundEvidenceRecord = {
    game_type: round.game_type,
    objective_code: round.objective_code,
    score: round.score,
    max_score: round.max_score,
    latency_ms: round.latency_ms,
    retried: round.retried,
    axis_id: axisId,
    elapsed_ms: round.elapsed_ms ?? null,
    hint_count: round.hint_count ?? null,
    retry_count: round.retry_count ?? null,
    auto_selected: round.auto_selected ?? null,
  };

  if (typeof round.is_correct === 'boolean') {
    record.is_correct = round.is_correct;
  }

  return record;
}

export async function processRoundGrowth(
  client: SupabaseClient,
  input: ProcessRoundGrowthInput,
): Promise<void> {
  const now = new Date().toISOString();
  const claimed = await claimRound(client, input.roundId, now);
  if (!claimed) return;

  const axisId = axisForRound(input.round);
  if (!axisId) return;

  // 노출·사용성 신호(자동선택, 정오답 없는 완료)는 역량 갱신에서 제외 (로드맵 P0).
  // claimRound가 이미 처리 마킹을 했으므로 재처리되지 않는다.
  if (!isAssessableRound(evidenceRecord(input.round, axisId))) return;

  const recentRounds = await loadRecentRounds({
    client,
    childId: input.childId,
    roundId: input.roundId,
  });
  const currentSuccess = successFromRound(input.round);
  const hadRecentFailureOnAxis = currentSuccess === true
    && recentRounds.some((round) => axisForRound(round) === axisId && successFromRound(round) === false);
  const activityTypeRevisit = recentRounds.some((round) => round.game_type === input.round.game_type);

  const normalized = evidenceFromRound(evidenceRecord(input.round, axisId), {
    activityTypeRevisit,
    transferSuccess: hadRecentFailureOnAxis ? true : null,
    age: input.age,
  });
  const evidence = buildEvidence(normalized);
  const previous = await loadProfileState({
    client,
    childId: input.childId,
    axisId,
  });
  const next = updateAxis(previous, evidence);

  const profileUpdate: Record<string, unknown> = {
    child_id: input.childId,
    axis_id: axisId,
    current_level: next.level,
    confidence: next.confidence,
    evidence_count: next.evidence_count,
    trend: trendFrom(previous.level, next.level),
    last_evidence_at: now,
    updated_at: now,
  };

  if (evidence.performance >= 0.7) {
    profileUpdate.preferred_activity_type = input.round.game_type;
  }

  const { error } = await client
    .from('child_growth_profiles')
    .upsert(profileUpdate, { onConflict: 'child_id,axis_id' });

  if (error) throw error;
}
