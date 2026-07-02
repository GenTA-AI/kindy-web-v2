import type { SupabaseClient } from '@supabase/supabase-js';
import { withJosa } from '@/lib/josa';
import { inferC6Tools } from '@/lib/game/c6-profile';
import type { GameRoundResult, GameType } from '@/types/game';
import {
  C6_AXES,
  C6_AXIS_BY_ID,
  LEGACY_TOOL_TO_THINKING,
  THINKING_TOOLS,
  type C6AxisId,
  type ThinkingTool,
} from './axes';
import {
  pickGrowthAxis,
  pickStrengthAxis,
  toSeedState,
  type GrowthProfileSnapshot,
  type GrowthStage,
} from './growth-view';
import { getTodayRecommendation, type RecommendationLogRow } from './recommendation';
import { getSupabase, isSupabaseServiceConfigured } from '../supabase';

export type ReportSeedCard = {
  childLabel: string;
  parentLabel: string;
  worldRegion: string;
  stage: GrowthStage;
  stageLabel: string;
  parentLine: string;
};

export type ReportRecommendation = {
  storyTitles: string[];
  reason: string;
};

export type ParentReportGrowthData = {
  seeds: ReportSeedCard[];
  strengthLine: string;
  growthLine: string;
  thinkingToolLines: string[];
  recommendation: ReportRecommendation | null;
};

type GrowthProfileRow = {
  axis_id: string | null;
  current_level: number | string | null;
  confidence: number | string | null;
  evidence_count: number | string | null;
};

type ThinkingRoundRow = {
  game_type: string | null;
  objective_code: string | null;
  thinking_tool: string | null;
  reward_payload: unknown;
};

type StoryTitleRow = {
  id: string;
  title: string | null;
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

const THINKING_TOOL_SET = new Set<ThinkingTool>(THINKING_TOOLS);

const THINKING_TOOL_LABELS: Record<ThinkingTool, string> = {
  observation: '작은 단서 살피기',
  visualization: '그림으로 떠올리기',
  abstraction: '중요한 것만 골라보기',
  pattern_recognition: '반복과 규칙 알아차리기',
  pattern_forming: '새 규칙 만들기',
  analogy: '닮은 점으로 잇기',
  body_thinking: '몸으로 생각하기',
  empathy: '마음 살피기',
  dimensional_thinking: '다른 방향에서 보기',
  modeling: '모형으로 생각하기',
  play: '놀이로 실험하기',
  transformation: '바꿔 보기',
  synthesis: '모아서 만들기',
};

const STAGE_LABELS: Record<GrowthStage, string> = {
  first_look: '처음 만나요',
  sprouting: '선명해지는 중',
  growing: '자라는 중',
  shining: '환하게 빛나요',
};

const FORBIDDEN_SURFACE_PATTERN = /진단|평가|점수|등급|또래|부족|발달 지연|\bC[1-6](?:\b|_)|커리큘럼|(?:^|[^A-Za-z])AI(?:[^A-Za-z]|$)/i;

function numberValue(value: number | string | null | undefined, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toAxisId(value: string | null | undefined): C6AxisId | null {
  return value && C6_AXIS_BY_ID.has(value as C6AxisId) ? (value as C6AxisId) : null;
}

function toProfileSnapshot(row: GrowthProfileRow): GrowthProfileSnapshot | null {
  const axisId = toAxisId(row.axis_id);
  if (!axisId) return null;

  return {
    axis_id: axisId,
    current_level: numberValue(row.current_level, 50),
    confidence: numberValue(row.confidence, 0),
    evidence_count: Math.max(0, Math.trunc(numberValue(row.evidence_count, 0))),
  };
}

function safeText(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  if (!cleaned || FORBIDDEN_SURFACE_PATTERN.test(cleaned)) return null;
  return cleaned;
}

function subjectName(childName: string): string {
  const trimmed = childName.trim();
  if (!trimmed || trimmed === '우리 아이') return '아이는';
  return `${trimmed}이는`;
}

function lineWithClarityPrefix(profile: GrowthProfileSnapshot | null, stage: GrowthStage, line: string): string {
  const needsClarityLine = stage === 'sprouting' || (profile !== null && profile.evidence_count < 3);
  if (!needsClarityLine || line.includes('성장지도가 더 선명해지는 중이에요')) return line;
  return `성장지도가 더 선명해지는 중이에요. ${line}`;
}

function buildSeedCards(profiles: readonly GrowthProfileSnapshot[]): ReportSeedCard[] {
  const profileByAxis = new Map(profiles.map((profile) => [profile.axis_id, profile] as const));

  return C6_AXES.map((axis) => {
    const profile = profileByAxis.get(axis.id) ?? null;
    const seed = toSeedState(profile, axis);

    return {
      childLabel: seed.child_label,
      parentLabel: seed.parent_label,
      worldRegion: seed.world_region,
      stage: seed.stage,
      stageLabel: STAGE_LABELS[seed.stage],
      parentLine: lineWithClarityPrefix(profile, seed.stage, seed.parent_line),
    };
  });
}

function buildStrengthLine(childName: string, profiles: readonly GrowthProfileSnapshot[]): string {
  const strengthAxisId = pickStrengthAxis(profiles);
  const growthAxisId = pickGrowthAxis(profiles);
  const strengthAxis = strengthAxisId ? C6_AXIS_BY_ID.get(strengthAxisId) : null;
  const growthAxis = growthAxisId ? C6_AXIS_BY_ID.get(growthAxisId) : null;

  if (!strengthAxis) {
    return '성장지도가 더 선명해지는 중이에요. 놀이가 조금 더 쌓이면 잘 들어온 문을 함께 살펴볼게요.';
  }

  const nextConcept = growthAxis?.parent_label ?? strengthAxis.parent_label;
  return `${subjectName(childName)} ${strengthAxis.world_region}에서 작은 단서를 찾는 데 오래 머물렀어요. 다음에는 이 관찰 강점을 활용해 ${withJosa(nextConcept, '을/를')} 이어갈게요.`;
}

function buildGrowthLine(profiles: readonly GrowthProfileSnapshot[]): string {
  const growthAxisId = pickGrowthAxis(profiles);
  const growthAxis = growthAxisId ? C6_AXIS_BY_ID.get(growthAxisId) : null;

  if (!growthAxis) {
    return '다음에 함께 열어볼 문을 천천히 고르고 있어요.';
  }

  return `${growthAxis.child_label}은 다음에 함께 열어볼 문이에요. ${growthAxis.world_region}에서 ${withJosa(growthAxis.parent_label, '을/를')} 짧게 이어갈게요.`;
}

function toThinkingTool(value: string | null | undefined): ThinkingTool | null {
  return value && THINKING_TOOL_SET.has(value as ThinkingTool) ? (value as ThinkingTool) : null;
}

function toGameType(value: string | null): GameType | null {
  return value && VALID_GAME_TYPES.has(value as GameType) ? (value as GameType) : null;
}

function rewardPayload(value: unknown): GameRoundResult['reward_payload'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as GameRoundResult['reward_payload'];
}

function thinkingToolFromRow(row: ThinkingRoundRow): ThinkingTool | null {
  const direct = toThinkingTool(row.thinking_tool);
  if (direct) return direct;

  const gameType = toGameType(row.game_type);
  if (!gameType) return null;

  const legacyRound: GameRoundResult = {
    game_type: gameType,
    difficulty: 1,
    objective_code: row.objective_code,
    standard_anchor: null,
    score: null,
    max_score: null,
    latency_ms: null,
    retried: false,
    reward_payload: rewardPayload(row.reward_payload),
  };

  for (const toolKey of inferC6Tools(legacyRound)) {
    const thinkingTool = toThinkingTool(LEGACY_TOOL_TO_THINKING[toolKey]);
    if (thinkingTool) return thinkingTool;
  }

  return null;
}

function formatKoreanList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]}와 ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}와 ${items.at(-1)}`;
}

function buildThinkingToolLines(rows: readonly ThinkingRoundRow[]): string[] {
  const counts = new Map<ThinkingTool, number>();

  for (const row of rows) {
    const tool = thinkingToolFromRow(row);
    if (!tool) continue;
    counts.set(tool, (counts.get(tool) ?? 0) + 1);
  }

  const topTools = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || THINKING_TOOLS.indexOf(a[0]) - THINKING_TOOLS.indexOf(b[0]))
    .slice(0, 3)
    .map(([tool]) => THINKING_TOOL_LABELS[tool]);

  if (topTools.length === 0) {
    return ['최근 놀이가 조금 더 쌓이면 어떤 생각도구가 자주 열렸는지 문장으로 남길게요.'];
  }

  return [
    `최근 놀이에서는 ${formatKoreanList(topTools)}이 자주 열렸어요.`,
    `다음 놀이에서도 ${topTools[0]} 흐름을 살려 짧게 이어갈게요.`,
  ];
}

async function loadThinkingRows(client: SupabaseClient, childId: string): Promise<ThinkingRoundRow[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from('game_rounds')
    .select('game_type, objective_code, thinking_tool, reward_payload')
    .eq('child_id', childId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(120);

  if (error) return [];
  return (data ?? []) as ThinkingRoundRow[];
}

function firstReason(result: Awaited<ReturnType<typeof getTodayRecommendation>>): string | null {
  if (!result) return null;

  const recommendationReason = safeText(result.recommendation?.parent_reason_summary);
  if (recommendationReason) return recommendationReason;

  for (const log of result.logs) {
    const reason = safeText(log.reason_summary_parent);
    if (reason) return reason;
  }

  return null;
}

async function storyTitlesForLogs(client: SupabaseClient, logs: readonly RecommendationLogRow[]): Promise<string[]> {
  const ids = logs
    .map((log) => log.recommended_story_seed_id)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) return [];

  const { data, error } = await client
    .from('story_seeds')
    .select('id, title')
    .in('id', ids);

  if (error) return [];

  const titleById = new Map((data ?? []).map((row) => {
    const item = row as StoryTitleRow;
    return [item.id, item.title] as const;
  }));

  return ids
    .map((id) => safeText(titleById.get(id)))
    .filter((title): title is string => Boolean(title));
}

async function loadRecommendation(
  client: SupabaseClient,
  childId: string,
  age: number,
): Promise<ReportRecommendation | null> {
  const result = await getTodayRecommendation(client, childId, age);
  const reason = firstReason(result);
  if (!result || !reason) return null;

  const createdTitles = result.recommendation?.story_seeds
    .map((seed) => safeText(seed.title))
    .filter((title): title is string => Boolean(title)) ?? [];
  const storyTitles = createdTitles.length > 0
    ? createdTitles
    : await storyTitlesForLogs(client, result.logs);

  return {
    storyTitles,
    reason,
  };
}

function safeAge(age: number | null): number {
  return typeof age === 'number' && Number.isFinite(age) ? age : 5;
}

export async function loadParentReportGrowthData(input: {
  childId: string;
  childName: string;
  age: number | null;
}): Promise<ParentReportGrowthData | null> {
  if (!isSupabaseServiceConfigured()) return null;

  const client = getSupabase();
  const { data: profileRows, error: profileError } = await client
    .from('child_growth_profiles')
    .select('axis_id, current_level, confidence, evidence_count')
    .eq('child_id', input.childId);

  if (profileError) throw profileError;

  const profiles = ((profileRows ?? []) as GrowthProfileRow[])
    .map(toProfileSnapshot)
    .filter((profile): profile is GrowthProfileSnapshot => Boolean(profile));

  if (!profiles.some((profile) => profile.evidence_count > 0)) return null;

  const [thinkingRows, recommendation] = await Promise.all([
    loadThinkingRows(client, input.childId),
    loadRecommendation(client, input.childId, safeAge(input.age)).catch(() => null),
  ]);

  return {
    seeds: buildSeedCards(profiles),
    strengthLine: buildStrengthLine(input.childName, profiles),
    growthLine: buildGrowthLine(profiles),
    thinkingToolLines: buildThinkingToolLines(thinkingRows),
    recommendation,
  };
}
