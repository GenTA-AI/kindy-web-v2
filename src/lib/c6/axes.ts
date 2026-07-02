import type { C6ToolKey } from '@/lib/game/c6-profile';

export type C6AxisId =
  | 'C1_focus_flow'
  | 'C2_observation_inquiry'
  | 'C3_pattern_problem'
  | 'C4_language_expression'
  | 'C5_imagination_analogy'
  | 'C6_social_emotional';

export const C6_AXIS_IDS: readonly C6AxisId[] = [
  'C1_focus_flow',
  'C2_observation_inquiry',
  'C3_pattern_problem',
  'C4_language_expression',
  'C5_imagination_analogy',
  'C6_social_emotional',
];

export interface C6AxisMeta {
  id: C6AxisId;
  name_ko: string;
  world_region: string;
  parent_label: string;
  child_label: string;
  description: string;
}

export const C6_AXES: readonly C6AxisMeta[] = [
  {
    id: 'C1_focus_flow',
    name_ko: '집중·몰입',
    world_region: '별빛 언덕',
    parent_label: '집중·몰입',
    child_label: '별빛 씨앗',
    description: '짧은 활동에 머물고 규칙을 기억하며 힌트 후 다시 시도해요',
  },
  {
    id: 'C2_observation_inquiry',
    name_ko: '관찰·탐구',
    world_region: '숨은 관찰길',
    parent_label: '관찰·탐구',
    child_label: '반짝 씨앗',
    description: '작은 차이·질감·소리·변화를 주의 깊게 발견해요',
  },
  {
    id: 'C3_pattern_problem',
    name_ko: '패턴·문제해결',
    world_region: '물방울 실험터',
    parent_label: '패턴·문제해결',
    child_label: '물방울 씨앗',
    description: '반복·순서·규칙을 알아차리고 예측하거나 새 규칙을 만들어요',
  },
  {
    id: 'C4_language_expression',
    name_ko: '언어·표현',
    world_region: '말장원',
    parent_label: '언어·표현',
    child_label: '말 씨앗',
    description: '단어·그림·소리·문장을 연결하고 자기 방식으로 설명해요',
  },
  {
    id: 'C5_imagination_analogy',
    name_ko: '상상·유추',
    world_region: '거꾸로 시장',
    parent_label: '상상·유추',
    child_label: '거꾸로 씨앗',
    description: '서로 다른 것을 연결하고 익숙한 것을 낯설게 봐요',
  },
  {
    id: 'C6_social_emotional',
    name_ko: '마음·사회성',
    world_region: '마음 호수',
    parent_label: '마음·사회성',
    child_label: '마음 씨앗',
    description: '캐릭터의 마음과 관점을 알아차리고 돕는 방법을 골라요',
  },
];

export const C6_AXIS_BY_ID: ReadonlyMap<C6AxisId, C6AxisMeta> = new Map(
  C6_AXES.map((axis) => [axis.id, axis] as const),
);

export type ThinkingTool =
  | 'observation'
  | 'visualization'
  | 'abstraction'
  | 'pattern_recognition'
  | 'pattern_forming'
  | 'analogy'
  | 'body_thinking'
  | 'empathy'
  | 'dimensional_thinking'
  | 'modeling'
  | 'play'
  | 'transformation'
  | 'synthesis';

export const THINKING_TOOLS: readonly ThinkingTool[] = [
  'observation',
  'visualization',
  'abstraction',
  'pattern_recognition',
  'pattern_forming',
  'analogy',
  'body_thinking',
  'empathy',
  'dimensional_thinking',
  'modeling',
  'play',
  'transformation',
  'synthesis',
];

export type TaskTemplateId =
  | 'T1_HIDDEN_CLUE'
  | 'T2_RULE_SWITCH'
  | 'T3_SEQUENCE'
  | 'T4_WORD_IMAGE'
  | 'T5_ANALOGY_MARKET'
  | 'T6_HEART_LAKE'
  | 'T7_CREATE_SCENE';

export type TaskEvidenceField =
  | 'elapsed_ms'
  | 'found_count'
  | 'hint_count'
  | 'rule_switch_success'
  | 'retry_count'
  | 'sequence_order'
  | 'selected_answer'
  | 'exposure_count'
  | 'idea_choice'
  | 'novelty_tag'
  | 'reason_type'
  | 'emotion_choice'
  | 'prosocial_choice'
  | 'asset_count'
  | 'saved'
  | 'diversity_index';

export interface TaskTemplateMeta {
  id: TaskTemplateId;
  child_name: string;
  primary_axis: C6AxisId;
  secondary_axis: C6AxisId | null;
  evidence_fields: readonly TaskEvidenceField[];
}

export const TASK_TEMPLATE_IDS: readonly TaskTemplateId[] = [
  'T1_HIDDEN_CLUE',
  'T2_RULE_SWITCH',
  'T3_SEQUENCE',
  'T4_WORD_IMAGE',
  'T5_ANALOGY_MARKET',
  'T6_HEART_LAKE',
  'T7_CREATE_SCENE',
];

export const TASK_TEMPLATES: readonly TaskTemplateMeta[] = [
  {
    id: 'T1_HIDDEN_CLUE',
    child_name: '숨은 관찰길',
    primary_axis: 'C2_observation_inquiry',
    secondary_axis: 'C1_focus_flow',
    evidence_fields: ['elapsed_ms', 'found_count', 'hint_count'],
  },
  {
    id: 'T2_RULE_SWITCH',
    child_name: '반대로 찾기',
    primary_axis: 'C1_focus_flow',
    secondary_axis: 'C3_pattern_problem',
    evidence_fields: ['rule_switch_success', 'retry_count'],
  },
  {
    id: 'T3_SEQUENCE',
    child_name: '물방울 길 만들기',
    primary_axis: 'C3_pattern_problem',
    secondary_axis: null,
    evidence_fields: ['sequence_order', 'retry_count'],
  },
  {
    id: 'T4_WORD_IMAGE',
    child_name: '말장원 연결',
    primary_axis: 'C4_language_expression',
    secondary_axis: null,
    evidence_fields: ['selected_answer', 'exposure_count'],
  },
  {
    id: 'T5_ANALOGY_MARKET',
    child_name: '거꾸로 시장',
    primary_axis: 'C5_imagination_analogy',
    secondary_axis: null,
    evidence_fields: ['idea_choice', 'novelty_tag', 'reason_type'],
  },
  {
    id: 'T6_HEART_LAKE',
    child_name: '마음 호수',
    primary_axis: 'C6_social_emotional',
    secondary_axis: null,
    evidence_fields: ['emotion_choice', 'prosocial_choice'],
  },
  {
    id: 'T7_CREATE_SCENE',
    child_name: '별빛 작업실',
    primary_axis: 'C4_language_expression',
    secondary_axis: 'C5_imagination_analogy',
    evidence_fields: ['asset_count', 'saved', 'diversity_index'],
  },
];

export const TASK_TEMPLATE_BY_ID: ReadonlyMap<TaskTemplateId, TaskTemplateMeta> = new Map(
  TASK_TEMPLATES.map((template) => [template.id, template] as const),
);

export const LEGACY_TOOL_TO_THINKING: Record<string, ThinkingTool> = {
  observe: 'observation',
  imagine: 'analogy',
  pattern: 'pattern_recognition',
  transform: 'transformation',
  design: 'modeling',
  compose: 'synthesis',
} satisfies Record<C6ToolKey, ThinkingTool>;

export const LEGACY_TOOL_TO_AXIS: Record<string, C6AxisId> = {
  observe: 'C2_observation_inquiry',
  imagine: 'C5_imagination_analogy',
  pattern: 'C3_pattern_problem',
  transform: 'C3_pattern_problem',
  design: 'C4_language_expression',
  compose: 'C4_language_expression',
} satisfies Record<C6ToolKey, C6AxisId>;

const LEGACY_OBJECTIVE_TO_AXIS: Readonly<Partial<Record<string, C6AxisId>>> = {
  creativity_observe: 'C2_observation_inquiry',
  creativity_pattern: 'C3_pattern_problem',
  creativity_imagine: 'C5_imagination_analogy',
  creativity_transform: 'C3_pattern_problem',
  creativity_design: 'C4_language_expression',
  creativity_compose: 'C4_language_expression',
};

const LEGACY_GAME_TYPE_TO_AXIS: Readonly<Partial<Record<string, C6AxisId>>> = {
  hidden_friend: 'C2_observation_inquiry',
  G5_find: 'C2_observation_inquiry',
  G4_listen: 'C2_observation_inquiry',
  G3_sequence: 'C3_pattern_problem',
  G2_sort: 'C3_pattern_problem',
  G1_match: 'C5_imagination_analogy',
  Q_quiz: 'C5_imagination_analogy',
  emotion_expression: 'C6_social_emotional',
  decorate: 'C4_language_expression',
};

export function inferAxisFromLegacyRound(input: {
  game_type: string;
  objective_code: string | null;
}): C6AxisId | null {
  if (input.objective_code?.startsWith('sel_')) {
    return 'C6_social_emotional';
  }

  if (input.objective_code) {
    return LEGACY_OBJECTIVE_TO_AXIS[input.objective_code] ?? LEGACY_GAME_TYPE_TO_AXIS[input.game_type] ?? null;
  }

  return LEGACY_GAME_TYPE_TO_AXIS[input.game_type] ?? null;
}

/**
 * C6 growth event standard fields:
 * event_type, child_id, session_id, round_id, axis_id, thinking_tool,
 * story_seed_id, elapsed_ms, hint_count, retry_count,
 * is_correct (boolean | null), response_payload (jsonb).
 */
export const C6_EVENT_STANDARD_FIELDS = [
  'event_type',
  'child_id',
  'session_id',
  'round_id',
  'axis_id',
  'thinking_tool',
  'story_seed_id',
  'elapsed_ms',
  'hint_count',
  'retry_count',
  'is_correct',
  'response_payload',
] as const;

export type C6EventStandardField = (typeof C6_EVENT_STANDARD_FIELDS)[number];
