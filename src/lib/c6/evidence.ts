import type { C6AxisId } from './axes';

export interface RoundEvidenceInput {
  axis_id: C6AxisId;
  is_correct: boolean | null;
  completed: boolean;
  abandoned: boolean;
  elapsed_ms: number | null;
  hint_count: number;
  retried: boolean;
  retry_count: number;
  preferred_character_match: boolean;
  activity_type_revisit: boolean;
  transfer_success: boolean | null;
  age_band_adjustment?: number;
}

export interface AxisEvidence {
  axis_id: C6AxisId;
  performance: number;
  process: number;
  persistence: number;
  preference: number;
  transfer: number;
  quality: number;
  age_band_adjustment: number;
}

export interface AxisProfileState {
  level: number;
  confidence: number;
  evidence_count: number;
}

export interface GameRoundEvidenceRecord {
  game_type: string;
  objective_code: string | null;
  score: number | null;
  max_score: number | null;
  latency_ms: number | null;
  retried: boolean;
  axis_id?: C6AxisId | null;
  is_correct?: boolean | null;
  elapsed_ms?: number | null;
  hint_count?: number | null;
  retry_count?: number | null;
  abandoned?: boolean | null;
}

export interface RoundEvidenceContext {
  preferredCharacterMatch?: boolean;
  activityTypeRevisit?: boolean;
  transferSuccess?: boolean | null;
  age?: number | null;
}

export const DEFAULT_AXIS_PROFILE_STATE: AxisProfileState = {
  level: 50,
  confidence: 0,
  evidence_count: 0,
};

const C1_AXIS: C6AxisId = 'C1_focus_flow';
const C2_AXIS: C6AxisId = 'C2_observation_inquiry';
const C3_AXIS: C6AxisId = 'C3_pattern_problem';
const C5_AXIS: C6AxisId = 'C5_imagination_analogy';
const C6_AXIS: C6AxisId = 'C6_social_emotional';

const LEGACY_OBJECTIVE_TO_AXIS: Readonly<Partial<Record<string, C6AxisId>>> = {
  creativity_observe: C2_AXIS,
  creativity_pattern: C3_AXIS,
  creativity_imagine: C5_AXIS,
  creativity_transform: C3_AXIS,
  creativity_design: 'C4_language_expression',
  creativity_compose: 'C4_language_expression',
};

const LEGACY_GAME_TYPE_TO_AXIS: Readonly<Partial<Record<string, C6AxisId>>> = {
  hidden_friend: C2_AXIS,
  G5_find: C2_AXIS,
  G4_listen: C2_AXIS,
  G3_sequence: C3_AXIS,
  G2_sort: C3_AXIS,
  G1_match: C5_AXIS,
  Q_quiz: C5_AXIS,
  emotion_expression: C6_AXIS,
  decorate: 'C4_language_expression',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function ageBandAdjustment(age: number | null): number {
  return age !== null && age <= 5 ? 0.05 : 0;
}

function performanceScore(input: RoundEvidenceInput): number {
  const completed = input.completed && !input.abandoned;

  if (input.is_correct === true) return 1;
  if (input.is_correct === false) return 0.25;
  if (completed) return 0.6;
  return 0;
}

function processScore(input: RoundEvidenceInput): number {
  let score = 1 - 0.2 * Math.min(input.hint_count, 3);

  if (input.elapsed_ms === null) {
    score -= 0.1;
  } else if (input.elapsed_ms < 800) {
    score -= 0.3;
  } else if (input.elapsed_ms > 45_000) {
    score -= 0.2;
  }

  return score;
}

function persistenceScore(input: RoundEvidenceInput): number {
  const retried = input.retried || input.retry_count > 0;

  if (input.abandoned) return 0;
  if (retried && input.is_correct === true) return 1;
  if (retried) return 0.6;
  if (input.is_correct === true) return 0.7;
  return 0.4;
}

function preferenceScore(input: RoundEvidenceInput): number {
  return (
    0.5 +
    (input.preferred_character_match ? 0.25 : 0) +
    (input.activity_type_revisit ? 0.25 : 0)
  );
}

function transferScore(input: RoundEvidenceInput): number {
  if (input.transfer_success === true) return 1;
  if (input.transfer_success === false) return 0.3;
  return 0.5;
}

function qualityScore(input: RoundEvidenceInput): number {
  const realSignalCount = [
    input.is_correct !== null || input.completed,
    input.elapsed_ms !== null || input.hint_count > 0,
    input.retried || input.retry_count > 0 || input.abandoned,
    input.preferred_character_match || input.activity_type_revisit,
    input.transfer_success !== null,
  ].filter(Boolean).length;

  return realSignalCount / 5;
}

function evidenceBase(evidence: AxisEvidence): number {
  return (
    0.3 * evidence.performance +
    0.25 * evidence.process +
    0.2 * evidence.persistence +
    0.1 * evidence.preference +
    0.15 * evidence.transfer
  );
}

function resolveIsCorrect(round: GameRoundEvidenceRecord): boolean | null {
  if (Object.prototype.hasOwnProperty.call(round, 'is_correct') && round.is_correct !== undefined) {
    return round.is_correct;
  }

  if (round.score !== null && round.max_score !== null) {
    return round.score >= round.max_score;
  }

  return null;
}

function inferAxisId(round: GameRoundEvidenceRecord): C6AxisId | null {
  if (round.axis_id) return round.axis_id;

  if (round.objective_code?.startsWith('sel_')) {
    return C6_AXIS;
  }

  if (round.objective_code) {
    return LEGACY_OBJECTIVE_TO_AXIS[round.objective_code] ?? LEGACY_GAME_TYPE_TO_AXIS[round.game_type] ?? null;
  }

  return LEGACY_GAME_TYPE_TO_AXIS[round.game_type] ?? null;
}

function resolveAxisId(round: GameRoundEvidenceRecord): C6AxisId {
  const axisId = inferAxisId(round);

  if (!axisId) {
    throw new Error(`Unable to infer C6 axis for round ${round.game_type}:${round.objective_code ?? ''}`);
  }

  return axisId;
}

export function buildEvidence(input: RoundEvidenceInput): AxisEvidence {
  return {
    axis_id: input.axis_id,
    performance: clamp01(performanceScore(input)),
    process: clamp01(processScore(input)),
    persistence: clamp01(persistenceScore(input)),
    preference: clamp01(preferenceScore(input)),
    transfer: clamp01(transferScore(input)),
    quality: clamp01(qualityScore(input)),
    age_band_adjustment: input.age_band_adjustment ?? 0,
  };
}

export function updateAxis(previous: AxisProfileState, evidence: AxisEvidence): AxisProfileState {
  const base = evidenceBase(evidence);
  const ageAdjusted = clamp01(base + evidence.age_band_adjustment);
  const confidenceGain = Math.min(0.08, 0.02 + evidence.quality * 0.06);

  return {
    level: Math.round(100 * (0.85 * (previous.level / 100) + 0.15 * ageAdjusted)),
    confidence: clamp01(previous.confidence + confidenceGain),
    evidence_count: previous.evidence_count + 1,
  };
}

export function evidenceFromRound(
  round: GameRoundEvidenceRecord,
  ctx: RoundEvidenceContext,
): RoundEvidenceInput {
  const abandoned = round.abandoned ?? false;

  return {
    axis_id: resolveAxisId(round),
    is_correct: resolveIsCorrect(round),
    completed: !abandoned,
    abandoned,
    elapsed_ms: round.elapsed_ms ?? round.latency_ms ?? null,
    hint_count: round.hint_count ?? 0,
    retried: round.retried,
    retry_count: round.retry_count ?? 0,
    preferred_character_match: ctx.preferredCharacterMatch ?? false,
    activity_type_revisit: ctx.activityTypeRevisit ?? false,
    transfer_success: ctx.transferSuccess ?? null,
    age_band_adjustment: ageBandAdjustment(ctx.age ?? null),
  };
}

export function planSessionAxes(growthAxis: C6AxisId): [C6AxisId, C6AxisId, C6AxisId] {
  if (growthAxis === C1_AXIS || growthAxis === C2_AXIS || growthAxis === C3_AXIS) {
    return [C1_AXIS, C2_AXIS, C3_AXIS];
  }

  return [C1_AXIS, C5_AXIS, C6_AXIS];
}

export function trendFrom(previousLevel: number, nextLevel: number): 'up' | 'steady' | 'down' {
  const delta = nextLevel - previousLevel;

  if (delta > 1) return 'up';
  if (delta < -1) return 'down';
  return 'steady';
}
