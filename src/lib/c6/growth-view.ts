import type { C6AxisId, C6AxisMeta } from './axes';

export type GrowthStage = 'first_look' | 'sprouting' | 'growing' | 'shining';

export type GrowthProfileSnapshot = {
  axis_id: C6AxisId;
  current_level: number;
  confidence: number;
  evidence_count: number;
};

export type SeedState = {
  axis_id: C6AxisId;
  child_label: string;
  parent_label: string;
  world_region: string;
  stage: GrowthStage;
  parent_line: string;
};

const GROWING_LINES: Record<C6AxisId, string> = {
  C1_focus_flow: '짧은 놀이 안에서 머무는 힘이 조금씩 보이고 있어요.',
  C2_observation_inquiry: '작은 차이를 발견하고 다시 살피는 모습이 자라고 있어요.',
  C3_pattern_problem: '순서와 규칙을 알아차리는 장면이 놀이 속에 나타나고 있어요.',
  C4_language_expression: '그림과 말, 선택을 이어 자기 방식으로 표현하고 있어요.',
  C5_imagination_analogy: '익숙한 것을 새롭게 연결하는 생각이 조금씩 열리고 있어요.',
  C6_social_emotional: '마음과 상황을 살피며 고르는 모습이 놀이 속에서 보이고 있어요.',
};

const FIRST_LOOK_LINES: Record<C6AxisId, string> = {
  C1_focus_flow: '놀이가 쌓이면 머무는 힘의 모습을 살펴볼 수 있어요.',
  C2_observation_inquiry: '놀이가 쌓이면 작은 단서를 살피는 모습을 만날 수 있어요.',
  C3_pattern_problem: '놀이가 쌓이면 순서와 규칙을 만나는 모습을 살펴볼 수 있어요.',
  C4_language_expression: '놀이가 쌓이면 자기 방식으로 전하는 모습을 만날 수 있어요.',
  C5_imagination_analogy: '놀이가 쌓이면 새롭게 떠올리고 연결하는 모습을 살펴볼 수 있어요.',
  C6_social_emotional: '놀이가 쌓이면 마음과 상황을 살피는 모습을 만날 수 있어요.',
};

const SHINING_LINES: Record<C6AxisId, string> = {
  C1_focus_flow: '요즘은 한 가지 놀이에 머무는 씨앗이 환하게 빛나요.',
  C2_observation_inquiry: '요즘은 작은 단서를 찾아내는 씨앗이 환하게 빛나요.',
  C3_pattern_problem: '요즘은 순서와 규칙을 살피는 씨앗이 환하게 빛나요.',
  C4_language_expression: '요즘은 자기 방식으로 전하는 씨앗이 환하게 빛나요.',
  C5_imagination_analogy: '요즘은 새롭게 떠올리고 연결하는 씨앗이 환하게 빛나요.',
  C6_social_emotional: '요즘은 마음을 살피고 고르는 씨앗이 환하게 빛나요.',
};

function stageFor(profile: GrowthProfileSnapshot | null): GrowthStage {
  if (!profile || profile.evidence_count === 0) return 'first_look';
  if (profile.confidence < 0.3) return 'sprouting';
  if (profile.current_level >= 70) return 'shining';
  return 'growing';
}

function parentLineFor(stage: GrowthStage, axisId: C6AxisId): string {
  if (stage === 'first_look') {
    return `아직 처음 만나는 씨앗이에요. ${FIRST_LOOK_LINES[axisId]}`;
  }
  if (stage === 'sprouting') {
    return `성장지도가 더 선명해지는 중이에요. ${GROWING_LINES[axisId]}`;
  }
  if (stage === 'shining') {
    return SHINING_LINES[axisId];
  }
  return GROWING_LINES[axisId];
}

export function toSeedState(
  profile: GrowthProfileSnapshot | null,
  axisMeta: C6AxisMeta,
): SeedState {
  const stage = stageFor(profile);

  return {
    axis_id: axisMeta.id,
    child_label: axisMeta.child_label,
    parent_label: axisMeta.parent_label,
    world_region: axisMeta.world_region,
    stage,
    parent_line: parentLineFor(stage, axisMeta.id),
  };
}

export function pickStrengthAxis(profiles: readonly GrowthProfileSnapshot[]): C6AxisId | null {
  const eligible = profiles.filter((profile) => profile.confidence >= 0.3);
  if (eligible.length === 0) return null;

  return eligible.reduce((best, profile) => (
    profile.current_level > best.current_level ? profile : best
  )).axis_id;
}

export function pickGrowthAxis(profiles: readonly GrowthProfileSnapshot[]): C6AxisId | null {
  const eligible = profiles.filter((profile) => profile.evidence_count >= 1);
  if (eligible.length === 0) return null;

  return eligible.reduce((lowest, profile) => (
    profile.current_level < lowest.current_level ? profile : lowest
  )).axis_id;
}
