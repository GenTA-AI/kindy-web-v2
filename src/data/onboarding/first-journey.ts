import type { C6AxisId, ThinkingTool } from '@/lib/c6/axes';
import type { GameRoundSpec, GameType } from '@/types/game';
import type { InteractiveSessionGraph } from '@/types/interactive-session';

export type FirstJourneyStepId =
  | 'entry'
  | 'hidden_sparkle'
  | 'rule_switch'
  | 'next_pattern'
  | 'heart_choice'
  | 'word_image'
  | 'cloud_idea'
  | 'starlight_video'
  | 'seed_summary';

export type FirstJourneyRoundKey = Exclude<FirstJourneyStepId, 'seed_summary'>;

export type FirstJourneyRoundMeta = {
  key: FirstJourneyRoundKey;
  axisId: C6AxisId;
  thinkingTool: ThinkingTool;
  storySeedId: string;
  worldRegion: string;
};

export type AnalogyChoice = {
  id: string;
  label: string;
  helper: string;
  token: string;
  noveltyTag: 'gentle_familiar' | 'nature_bridge' | 'story_shift' | 'playful_transform';
};

export const FIRST_JOURNEY_VISIBLE_STEPS = 9;
export const FIRST_JOURNEY_ROUNDS_TOTAL = 8;
export const FIRST_JOURNEY_TOPIC = 'first_journey';
export const FIRST_JOURNEY_SEQUENCE_FALLBACK = 'G3_sequence_unsupported_use_G1_match_pattern_variant';

export const FIRST_JOURNEY_ROUND_META: Record<FirstJourneyRoundKey, FirstJourneyRoundMeta> = {
  entry: {
    key: 'entry',
    axisId: 'C1_focus_flow',
    thinkingTool: 'play',
    storySeedId: '00000000-0000-4000-8000-000000000101',
    worldRegion: '숲 입구',
  },
  hidden_sparkle: {
    key: 'hidden_sparkle',
    axisId: 'C2_observation_inquiry',
    thinkingTool: 'observation',
    storySeedId: '00000000-0000-4000-8000-000000000102',
    worldRegion: '숨은 관찰길',
  },
  rule_switch: {
    key: 'rule_switch',
    axisId: 'C3_pattern_problem',
    thinkingTool: 'pattern_recognition',
    storySeedId: '00000000-0000-4000-8000-000000000103',
    worldRegion: '물방울 실험터',
  },
  next_pattern: {
    key: 'next_pattern',
    axisId: 'C3_pattern_problem',
    thinkingTool: 'pattern_forming',
    storySeedId: '00000000-0000-4000-8000-000000000104',
    worldRegion: '물방울 실험터',
  },
  heart_choice: {
    key: 'heart_choice',
    axisId: 'C6_social_emotional',
    thinkingTool: 'empathy',
    storySeedId: '00000000-0000-4000-8000-000000000105',
    worldRegion: '마음 호수',
  },
  word_image: {
    key: 'word_image',
    axisId: 'C4_language_expression',
    thinkingTool: 'visualization',
    storySeedId: '00000000-0000-4000-8000-000000000106',
    worldRegion: '말장원',
  },
  cloud_idea: {
    key: 'cloud_idea',
    axisId: 'C5_imagination_analogy',
    thinkingTool: 'analogy',
    storySeedId: '00000000-0000-4000-8000-000000000107',
    worldRegion: '거꾸로 시장',
  },
  starlight_video: {
    key: 'starlight_video',
    axisId: 'C1_focus_flow',
    thinkingTool: 'play',
    storySeedId: '00000000-0000-4000-8000-000000000108',
    worldRegion: '별빛 언덕',
  },
};

const BASE_TAG = {
  standard_anchor: 'first_journey_baseline',
  standard_source: 'nuri' as const,
  interpretive: true,
};

function roundSpec(input: {
  roundIndex: number;
  gameType: GameType;
  difficulty?: number;
  templateId: string;
  prompt: string;
  objectiveCode: string;
  items: Array<{ token: string; label_ko: string; category?: string }>;
  categories?: string[];
  answerToken?: string;
}): GameRoundSpec {
  return {
    round_index: input.roundIndex,
    game_type: input.gameType,
    topic: FIRST_JOURNEY_TOPIC,
    phase: 'creativity',
    tag: {
      ...BASE_TAG,
      objective_code: input.objectiveCode,
      objective_label_ko: '모리의 숲 입장 여행',
    },
    params: {
      seed: 9100 + input.roundIndex,
      difficulty: input.difficulty ?? 1,
      asset_pool_id: 'first_journey_onboarding',
      item_count: input.items.length,
      template_id: input.templateId,
      prompt_ko: input.prompt,
      items: input.items,
      ...(input.categories ? { categories: input.categories } : {}),
      ...(input.answerToken ? { answer_token: input.answerToken } : {}),
    },
  };
}

export const FIRST_JOURNEY_ENTRY_SPEC = roundSpec({
  roundIndex: 0,
  gameType: 'Q_quiz',
  templateId: 'entry_choice_v1',
  prompt: '모리와 숲길을 열어요',
  objectiveCode: 'first_journey_entry',
  items: [{ token: 'seed', label_ko: '반짝 씨앗', category: 'entry' }],
});

export const FIRST_JOURNEY_HIDDEN_SPEC = roundSpec({
  roundIndex: 1,
  gameType: 'hidden_friend',
  templateId: 'hidden_sparkle_v1',
  prompt: '나뭇잎 사이 반짝이를 찾아볼래?',
  objectiveCode: 'first_journey_observation',
  answerToken: 'seed',
  items: [
    { token: 'leaf', label_ko: '잎사귀', category: 'forest' },
    { token: 'flower', label_ko: '꽃잎', category: 'forest' },
    { token: 'butterfly', label_ko: '나비', category: 'forest' },
    { token: 'seed', label_ko: '반짝이', category: 'target' },
    { token: 'moon', label_ko: '작은 달', category: 'sky' },
  ],
});

export const FIRST_JOURNEY_RULE_SWITCH_SPECS = [
  roundSpec({
    roundIndex: 2,
    gameType: 'G2_sort',
    templateId: 'sort_by_color_v1',
    prompt: '먼저 같은 빛끼리 모아볼래?',
    objectiveCode: 'first_journey_rule_switch_color',
    categories: ['노란 빛', '초록 빛'],
    items: [
      { token: 'sun', label_ko: '노란 해', category: '노란 빛' },
      { token: 'bell', label_ko: '노란 방울', category: '노란 빛' },
      { token: 'leaf', label_ko: '초록 잎', category: '초록 빛' },
      { token: 'flower', label_ko: '초록 꽃', category: '초록 빛' },
    ],
  }),
  roundSpec({
    roundIndex: 2,
    gameType: 'G2_sort',
    templateId: 'sort_by_shape_v1',
    prompt: '이번엔 모양이 닮은 것끼리 모아볼래?',
    objectiveCode: 'first_journey_rule_switch_shape',
    categories: ['동그란 모양', '길쭉한 모양'],
    items: [
      { token: 'sun', label_ko: '동그란 해', category: '동그란 모양' },
      { token: 'moon', label_ko: '동그란 달', category: '동그란 모양' },
      { token: 'leaf', label_ko: '길쭉한 잎', category: '길쭉한 모양' },
      { token: 'rain', label_ko: '길쭉한 비', category: '길쭉한 모양' },
    ],
  }),
] as const satisfies readonly [GameRoundSpec, GameRoundSpec];

export const FIRST_JOURNEY_PATTERN_SPEC = roundSpec({
  roundIndex: 3,
  gameType: 'G1_match',
  templateId: 'match_pattern_variant_v1',
  prompt: '반짝 무늬가 이어지게 짝을 찾아볼래?',
  objectiveCode: 'first_journey_pattern_forming',
  items: [
    { token: 'sun', label_ko: '해-달-해', category: 'pattern' },
    { token: 'moon', label_ko: '달-해-달', category: 'pattern' },
    { token: 'leaf', label_ko: '잎-꽃-잎', category: 'pattern' },
  ],
});

export const FIRST_JOURNEY_EMOTION_SPEC = roundSpec({
  roundIndex: 4,
  gameType: 'emotion_expression',
  templateId: 'heart_lake_choice_v1',
  prompt: '씨앗을 잃어버린 친구 마음은 어떨까?',
  objectiveCode: 'first_journey_empathy',
  items: [
    { token: 'worried', label_ko: '걱정돼요', category: 'heart' },
    { token: 'sad', label_ko: '속상해요', category: 'heart' },
    { token: 'curious', label_ko: '궁금해요', category: 'heart' },
  ],
});

export const FIRST_JOURNEY_WORD_IMAGE_SPEC = roundSpec({
  roundIndex: 5,
  gameType: 'G1_match',
  templateId: 'word_image_match_v1',
  prompt: '그림과 어울리는 말을 이어볼래?',
  objectiveCode: 'first_journey_word_image',
  items: [
    { token: 'seed', label_ko: '씨앗', category: 'word' },
    { token: 'flower', label_ko: '꽃', category: 'word' },
    { token: 'rain', label_ko: '비', category: 'word' },
  ],
});

export const FIRST_JOURNEY_ANALOGY_CHOICES: readonly AnalogyChoice[] = [
  {
    id: 'pillow',
    label: '폭신한 베개',
    helper: '구름처럼 쉬어갈 수 있어',
    token: '☁️',
    noveltyTag: 'gentle_familiar',
  },
  {
    id: 'boat',
    label: '하늘 배',
    helper: '바람을 타고 둥실둥실',
    token: '⛵',
    noveltyTag: 'nature_bridge',
  },
  {
    id: 'dragon',
    label: '이야기 용',
    helper: '꼬리가 길게 움직일 것 같아',
    token: '🐉',
    noveltyTag: 'story_shift',
  },
  {
    id: 'popcorn',
    label: '팝콘 산',
    helper: '톡톡 피어나는 모양이 닮았어',
    token: '🍿',
    noveltyTag: 'playful_transform',
  },
];

export const FIRST_JOURNEY_VIDEO_GRAPH: InteractiveSessionGraph = {
  startSceneId: 'starlight-seed',
  scenes: [
    {
      id: 'starlight-seed',
      videoClip: {
        videoUrl: '/demo-videos/mori-starlight-seed.mp4',
        subtitlesUrl: '/demo-videos/mori-starlight-seed.vtt',
        posterUrl: '/ip/generated/mori-village-hero.png',
      },
      choice: {
        id: 'starlight-choice',
        prompt_ko: '반짝빛을 찾으려면 무엇을 먼저 볼까?',
        format: 'clue',
        rejoin: '',
        options: [
          {
            id: 'seed',
            label_ko: '씨앗 빛',
            icon: 'seed',
            tally: { focus: 1 },
            objective_code: 'first_journey_video_clue',
          },
          {
            id: 'friend',
            label_ko: '친구 얼굴',
            icon: 'doto',
            tally: { focus: 1 },
            objective_code: 'first_journey_video_clue',
          },
        ],
      },
    },
  ],
  endings: [],
};
