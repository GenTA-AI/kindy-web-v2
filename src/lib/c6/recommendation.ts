import type { SupabaseClient } from '@supabase/supabase-js';
import { C6_AXIS_BY_ID, C6_AXIS_IDS, type C6AxisId } from './axes';

export interface ChildGrowthProfileInput {
  axis_id: string | null;
  current_level?: number | string | null;
  level?: number | string | null;
  confidence: number | string | null;
  evidence_count: number | null;
  preferred_activity_type?: string | null;
  preferred_character_id?: string | null;
}

export interface StorySeedInput {
  id: string;
  title: string;
  target_axis: string | null;
  difficulty: number | string | null;
  approval_status: string | null;
  published: boolean | null;
  activity_type?: string | null;
  preferred_activity_type?: string | null;
  character_id?: string | null;
  preferred_character_id?: string | null;
  character_name?: string | null;
  world_region?: string | null;
  secondary_axis?: string | null;
  thinking_tools?: string[] | null;
  subject_domain?: string | null;
  age_band?: unknown;
  created_at?: string | null;
}

export interface RecentRecommendationInput {
  story_seed_id?: string | null;
  recommended_story_seed_id?: string | null;
  watched_story_seed_id?: string | null;
  created_at?: string | null;
  source?: string;
}

export interface BuildRecommendationInput {
  c6: ChildGrowthProfileInput[];
  recent: RecentRecommendationInput[];
  pool: StorySeedInput[];
}

export interface RecommendedStorySeed {
  id: string;
  title: string;
  target_axis: C6AxisId;
  difficulty: number;
  activity_type: string | null;
  character_id: string | null;
}

export interface C6Recommendation {
  growth_axis: C6AxisId;
  strength_axis: C6AxisId;
  story_seeds: RecommendedStorySeed[];
  parent_reason_summary: string;
  personalization_inputs: {
    c6: ChildGrowthProfileInput[];
    recent: RecentRecommendationInput[];
    pool: StorySeedInput[];
  };
}

export interface RecommendationLogRow {
  id: string;
  child_id: string;
  recommended_story_seed_id: string | null;
  reason_axis_id: string | null;
  reason_summary_parent: string;
  personalization_inputs: unknown;
  accepted: boolean | null;
  completed: boolean | null;
  created_at: string;
}

export interface TodayRecommendationResult {
  source: 'existing' | 'created';
  recommendation: C6Recommendation | null;
  logs: RecommendationLogRow[];
}

type NormalizedProfile = {
  axisId: C6AxisId;
  level: number;
  confidence: number;
  evidenceCount: number;
  preferredActivityType: string | null;
  preferredCharacterId: string | null;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toNumber(value: number | string | null | undefined, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanString(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned || null;
}

function axisOrder(axisId: C6AxisId): number {
  return C6_AXIS_IDS.indexOf(axisId);
}

function toAxisId(value: string | null | undefined): C6AxisId | null {
  return value && C6_AXIS_BY_ID.has(value as C6AxisId) ? (value as C6AxisId) : null;
}

function normalizeProfile(profile: ChildGrowthProfileInput): NormalizedProfile | null {
  const axisId = toAxisId(profile.axis_id);
  if (!axisId) return null;

  const level = toNumber(profile.current_level ?? profile.level, Number.NaN);
  if (!Number.isFinite(level)) return null;

  return {
    axisId,
    level,
    confidence: toNumber(profile.confidence, 0),
    evidenceCount: Math.max(0, Math.trunc(toNumber(profile.evidence_count, 0))),
    preferredActivityType: cleanString(profile.preferred_activity_type),
    preferredCharacterId: cleanString(profile.preferred_character_id),
  };
}

function pickGrowthAxis(profiles: NormalizedProfile[]): NormalizedProfile | null {
  const strongEvidence = profiles.filter((profile) => profile.evidenceCount >= 3);
  const candidates = strongEvidence.length > 0
    ? strongEvidence
    : profiles.filter((profile) => profile.evidenceCount >= 1);

  return [...candidates].sort((a, b) => a.level - b.level || axisOrder(a.axisId) - axisOrder(b.axisId))[0] ?? null;
}

function pickStrengthAxis(profiles: NormalizedProfile[]): NormalizedProfile | null {
  return [...profiles]
    .filter((profile) => profile.confidence >= 0.3)
    .sort((a, b) => b.level - a.level || axisOrder(a.axisId) - axisOrder(b.axisId))[0] ?? null;
}

function seedActivityType(seed: StorySeedInput): string | null {
  return cleanString(seed.activity_type) ?? cleanString(seed.preferred_activity_type);
}

function seedCharacterId(seed: StorySeedInput): string | null {
  return (
    cleanString(seed.character_id) ??
    cleanString(seed.preferred_character_id) ??
    cleanString(seed.character_name)
  );
}

function seedDifficulty(seed: StorySeedInput): number {
  return Math.max(0, Math.trunc(toNumber(seed.difficulty, 1)));
}

function recentSeedIds(recent: RecentRecommendationInput[]): Set<string> {
  const ids = new Set<string>();

  for (const item of recent) {
    for (const id of [item.story_seed_id, item.recommended_story_seed_id, item.watched_story_seed_id]) {
      const cleaned = cleanString(id);
      if (cleaned) ids.add(cleaned);
    }
  }

  return ids;
}

function parentLabel(axisId: C6AxisId): string {
  return C6_AXIS_BY_ID.get(axisId)?.parent_label ?? axisId;
}

function parentReasonSummary(growthAxis: C6AxisId, strengthAxis: C6AxisId): string {
  return `${parentLabel(strengthAxis)} 활동에서 오래 머문 강점을 활용해, 다음에는 ${parentLabel(growthAxis)} 이야기를 짧은 놀이로 이어가요.`;
}

export function buildRecommendation(input: BuildRecommendationInput): C6Recommendation | null {
  const profiles = input.c6.map(normalizeProfile).filter((profile): profile is NormalizedProfile => Boolean(profile));
  if (profiles.length === 0) return null;

  const growth = pickGrowthAxis(profiles);
  const strength = pickStrengthAxis(profiles);
  if (!growth || !strength) return null;

  const bridgeAxes = new Set<C6AxisId>([growth.axisId, strength.axisId]);
  const preferredActivityTypes = new Set(profiles.map((profile) => profile.preferredActivityType).filter(Boolean));
  const preferredCharacterIds = new Set(profiles.map((profile) => profile.preferredCharacterId).filter(Boolean));
  const recentIds = recentSeedIds(input.recent);

  const candidates = input.pool
    .map((seed, index) => {
      const targetAxis = toAxisId(seed.target_axis);
      return {
        seed,
        index,
        targetAxis,
        activityType: seedActivityType(seed),
        characterId: seedCharacterId(seed),
        difficulty: seedDifficulty(seed),
      };
    })
    .filter((item) => (
      item.targetAxis !== null &&
      bridgeAxes.has(item.targetAxis) &&
      item.seed.published === true &&
      item.seed.approval_status === 'approved'
    ));

  if (candidates.length === 0) return null;

  const ranked = candidates
    .sort((a, b) => {
      const aActivityMatch = a.activityType !== null && preferredActivityTypes.has(a.activityType);
      const bActivityMatch = b.activityType !== null && preferredActivityTypes.has(b.activityType);
      if (aActivityMatch !== bActivityMatch) return aActivityMatch ? -1 : 1;

      const aCharacterMatch = a.characterId !== null && preferredCharacterIds.has(a.characterId);
      const bCharacterMatch = b.characterId !== null && preferredCharacterIds.has(b.characterId);
      if (aCharacterMatch !== bCharacterMatch) return aCharacterMatch ? -1 : 1;

      const aRecent = recentIds.has(a.seed.id);
      const bRecent = recentIds.has(b.seed.id);
      if (aRecent !== bRecent) return aRecent ? 1 : -1;

      return a.difficulty - b.difficulty || a.index - b.index;
    })
    .slice(0, 2)
    .map((item): RecommendedStorySeed => ({
      id: item.seed.id,
      title: item.seed.title,
      target_axis: item.targetAxis as C6AxisId,
      difficulty: item.difficulty,
      activity_type: item.activityType,
      character_id: item.characterId,
    }));

  return {
    growth_axis: growth.axisId,
    strength_axis: strength.axisId,
    story_seeds: ranked,
    parent_reason_summary: parentReasonSummary(growth.axisId, strength.axisId),
    personalization_inputs: {
      c6: input.c6,
      recent: input.recent,
      pool: input.pool,
    },
  };
}

function kstDateKey(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function kstDayUtcRange(date: Date): { dateKey: string; start: string; end: string } {
  const dateKey = kstDateKey(date);
  const start = new Date(`${dateKey}T00:00:00.000+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    dateKey,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function normalizeLogRows(rows: unknown[] | null): RecommendationLogRow[] {
  return (rows ?? []) as RecommendationLogRow[];
}

export async function getTodayRecommendation(
  client: SupabaseClient,
  childId: string,
  age: number,
): Promise<TodayRecommendationResult | null> {
  const today = kstDayUtcRange(new Date());

  const { data: existingRows, error: existingError } = await client
    .from('recommendation_logs')
    .select('id, child_id, recommended_story_seed_id, reason_axis_id, reason_summary_parent, personalization_inputs, accepted, completed, created_at')
    .eq('child_id', childId)
    .gte('created_at', today.start)
    .lt('created_at', today.end)
    .order('created_at', { ascending: true });

  if (existingError) throw existingError;
  const existingLogs = normalizeLogRows(existingRows);
  if (existingLogs.length > 0) {
    return {
      source: 'existing',
      recommendation: null,
      logs: existingLogs,
    };
  }

  const { data: profileRows, error: profileError } = await client
    .from('child_growth_profiles')
    .select('axis_id, current_level, confidence, evidence_count, preferred_activity_type, preferred_character_id')
    .eq('child_id', childId);

  if (profileError) throw profileError;
  if (!profileRows?.length) return null;

  const { data: recentRecommendationRows, error: recentRecommendationError } = await client
    .from('recommendation_logs')
    .select('recommended_story_seed_id, created_at')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(3);

  if (recentRecommendationError) throw recentRecommendationError;

  const { data: recentRoundRows, error: recentRoundError } = await client
    .from('game_rounds')
    .select('story_seed_id, created_at')
    .eq('child_id', childId)
    .not('story_seed_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(3);

  if (recentRoundError) throw recentRoundError;

  const recent = [
    ...((recentRecommendationRows ?? []) as Array<{ recommended_story_seed_id: string | null; created_at: string | null }>).map((row) => ({
      recommended_story_seed_id: row.recommended_story_seed_id,
      created_at: row.created_at,
      source: 'recommendation_log',
    })),
    ...((recentRoundRows ?? []) as Array<{ story_seed_id: string | null; created_at: string | null }>).map((row) => ({
      story_seed_id: row.story_seed_id,
      created_at: row.created_at,
      source: 'game_round',
    })),
  ]
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 3);

  const { data: seedRows, error: seedError } = await client
    .from('story_seeds')
    .select('id, title, world_region, target_axis, secondary_axis, thinking_tools, subject_domain, age_band, difficulty, approval_status, published, created_at')
    .eq('published', true)
    .eq('approval_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(100);

  if (seedError) throw seedError;
  if (!seedRows?.length) return null;

  const recommendation = buildRecommendation({
    c6: profileRows as ChildGrowthProfileInput[],
    recent,
    pool: seedRows as StorySeedInput[],
  });

  if (!recommendation) return null;

  const personalizationInputs = {
    ...recommendation.personalization_inputs,
    child_id: childId,
    age,
    kst_date: today.dateKey,
  };
  const insertRows = recommendation.story_seeds.map((seed) => ({
    child_id: childId,
    recommended_story_seed_id: seed.id,
    reason_axis_id: recommendation.growth_axis,
    reason_summary_parent: recommendation.parent_reason_summary,
    personalization_inputs: personalizationInputs,
  }));

  const { data: insertedRows, error: insertError } = await client
    .from('recommendation_logs')
    .insert(insertRows)
    .select('id, child_id, recommended_story_seed_id, reason_axis_id, reason_summary_parent, personalization_inputs, accepted, completed, created_at');

  if (insertError) throw insertError;

  return {
    source: 'created',
    recommendation,
    logs: normalizeLogRows(insertedRows),
  };
}
