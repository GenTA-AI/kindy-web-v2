import { poolForTopic } from '@/data/games/asset-pools';
import { creativityStagedTag, tagForGameType } from '@/lib/game/curriculum-tags';
import type { CurriculumTag, GameRoundParams, GameRoundSpec, GameType, SessionAct } from '@/types/game';

type PoolItem = ReturnType<typeof poolForTopic>['items'][number];

type PlannedItem = {
  token: string;
  label_ko: string;
  category?: string;
};

type EngineRoundParams = GameRoundParams & {
  template_id: string;
  items: PlannedItem[];
  categories?: string[];
  prompt_ko?: string;
  answer_token?: string;
  option_tokens?: string[];
};

type LastRoundResult = {
  score: number | null;
  max_score: number | null;
  latency_ms: number | null;
  retried: boolean;
};

const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 5;
const DEFAULT_TOPIC = 'science';
const PHASE1_SESSION_TYPES: readonly GameType[] = ['G1_match', 'G2_sort', 'Q_quiz'];
// 통합 미래역량 토픽 — 한 세션이 정서표현 + 퍼즐/문제해결을 함께 다룬다.
// future_skills 가 정식 통합 토픽이며, sel_emotion/creativity 는 내부 호환 alias.
const TRACK_TOPIC_MARKERS: readonly string[] = [
  'future_skills',
  'sel_emotion',
  'creativity',
  '미래역량',
  '생각하는 힘',
  '정서',
  '표현',
  '마음',
  '감정',
  '창의',
  '상상',
  '만들기',
  '문제해결',
];

function isTrackTopic(topic: string): boolean {
  const topicKey = (topic || '').trim().toLocaleLowerCase('ko-KR');
  return TRACK_TOPIC_MARKERS.some((marker) => topicKey.includes(marker));
}

/*
 * Research A1 puzzle-first weights: match + sort are the main draw pool.
 * Emotion expression is scheduled by the session shell, so its random weight is 0.
 */
export const GAME_TYPE_WEIGHTS: Record<GameType, number> = {
  G1_match: 5,
  G2_sort: 5,
  G3_sequence: 1,
  G4_listen: 1,
  G5_find: 1,
  Q_quiz: 3,
  emotion_expression: 0,
  // 콘텐츠 세계 전용 활동 — 랜덤 생성 대상 아님(세계 시나리오가 직접 배치). weight 0.
  hidden_friend: 0,
  decorate: 0,
};

export function seededRng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function planRound(input: {
  seed: number;
  round_index: number;
  topic: string;
  difficulty: number;
  forceType?: GameType;
  /** 2막 staged 세션의 막. 지정 시 막에 맞는 풀/태그(정서=SEL, 창의=creativity)를 강제. */
  phase?: SessionAct;
}): GameRoundSpec {
  const difficulty = clampDifficulty(input.difficulty);
  const roundSeed = seedForRound(input.seed, input.round_index, input.topic, difficulty);
  const rng = seededRng(roundSeed);
  const gameType = input.forceType ?? selectWeightedGameType(rng, GAME_TYPE_WEIGHTS);
  const trackSession = isTrackTopic(input.topic);
  const stagedPhase = trackSession ? input.phase : undefined;
  // 막이 지정된 트랙 세션은 막이 풀·태그를 전적으로 결정한다.
  //   정서 막: emotion 풀 + SEL 태그.
  //   창의 막: creativity 풀 + creativity 태그 (emotion_expression 라운드는 '나만의 방법' 창작형).
  const phase: SessionAct = input.phase ?? (gameType === 'emotion_expression' ? 'emotion' : 'creativity');
  const poolTopic = stagedPhase
    ? stagedPhase === 'emotion'
      ? 'emotion'
      : 'creativity'
    : gameType === 'emotion_expression'
      ? 'emotion'
      : input.topic || DEFAULT_TOPIC;
  const pool = poolForTopic(poolTopic);
  const itemCount = itemCountForDifficulty(difficulty, pool.items.length);
  const items = sampleItemsForType(gameType, pool.items, itemCount, rng);
  const params = paramsForGameType(gameType, {
    seed: roundSeed,
    difficulty,
    assetPoolId: pool.id,
    timeLimitSec: timeLimitForDifficulty(gameType, difficulty),
    items,
    rng,
  });
  const tag = stagedPhase
    ? stagedTag(gameType, stagedPhase, input.round_index)
    // 막 미지정(레거시/무토픽): emotion_expression 은 'emotion' 폴백 → SEL.
    : tagForGameType(
        gameType,
        gameType === 'emotion_expression' ? input.topic || 'emotion' : input.topic,
        input.round_index,
      );

  return {
    round_index: input.round_index,
    game_type: gameType,
    params,
    tag,
    topic: input.topic,
    phase,
  };
}

/**
 * staged 세션의 막 전용 태그.
 *   정서막 → SEL(gameType별 CASEL 역량).
 *   창의막 → 교수 도구 6단계 나선(관찰→…→통합)을 roundIndex 순서로 회전.
 */
function stagedTag(gameType: GameType, phase: SessionAct, roundIndex: number): CurriculumTag {
  if (phase === 'emotion') {
    return tagForGameType(gameType, 'sel_emotion', roundIndex);
  }
  return creativityStagedTag(roundIndex);
}

export function nextDifficulty(prev: number, lastResult: LastRoundResult): number {
  const current = clampDifficulty(prev);

  if (lastResult.score === null || lastResult.max_score === null || lastResult.max_score <= 0) {
    return current;
  }

  const accuracy = lastResult.score / lastResult.max_score;

  if (accuracy < 0.7) {
    return clampDifficulty(current - 1);
  }

  if (lastResult.retried) {
    return accuracy >= 0.9 ? current : clampDifficulty(current - 1);
  }

  if (accuracy >= 0.9 && isFastEnough(current, lastResult.latency_ms)) {
    return clampDifficulty(current + 1);
  }

  return current;
}

/**
 * 트랙 세션을 2막 staged 구조로 계획한다(핸드오프 §3).
 *   1막 정서: 영상1(감정 사건) → 정서 라운드(emotion_expression + match/quiz, SEL 태그) = 정서 문제 해결.
 *   2막 창의: 영상2/전환 → 창의 라운드(sort/창의 표현, creativity 태그) = 나만의 방법 만들기.
 * 라운드를 phase 순서대로(emotion 먼저, creativity 다음) 묶어 반환. 결정성 유지.
 */
function planStagedTrackSession(input: { seed: number; topic: string; round_count: number }): GameRoundSpec[] {
  const roundCount = Math.max(0, Math.floor(input.round_count));
  if (roundCount === 0) return [];

  const sessionRng = seededRng(seedForRound(input.seed, roundCount, input.topic, 7));
  // 막별 라운드 수 배분: 정서 1~2, 창의 1~2. 라운드가 1개뿐이면 정서만.
  const emotionPhaseCount = roundCount <= 1 ? roundCount : Math.min(2, Math.max(1, Math.ceil(roundCount / 2)));
  const creativityPhaseCount = roundCount - emotionPhaseCount;

  // 1막 정서 라운드 게임타입: 첫 라운드는 emotion_expression(감정 사건 해결), 다음은 표정 짝맞추기/감정 퀴즈.
  const emotionTypes: GameType[] = [];
  for (let i = 0; i < emotionPhaseCount; i += 1) {
    if (i === 0) {
      emotionTypes.push('emotion_expression');
    } else {
      emotionTypes.push(sessionRng() < 0.5 ? 'G1_match' : 'Q_quiz');
    }
  }

  // 2막 창의 라운드 게임타입: 분류(G2_sort) 중심 + 창의 표현(emotion_expression 일반화) 회전.
  const creativityTypes: GameType[] = [];
  for (let i = 0; i < creativityPhaseCount; i += 1) {
    creativityTypes.push(i % 2 === 0 ? 'G2_sort' : 'emotion_expression');
  }

  const ordered: Array<{ type: GameType; phase: SessionAct }> = [
    ...emotionTypes.map((type) => ({ type, phase: 'emotion' as const })),
    ...creativityTypes.map((type) => ({ type, phase: 'creativity' as const })),
  ];

  return ordered.map((slot, roundIndex) => {
    const difficulty = clampDifficulty(1 + Math.floor(roundIndex / 3));
    return planRound({
      seed: input.seed,
      round_index: roundIndex,
      topic: input.topic,
      difficulty,
      forceType: slot.type,
      phase: slot.phase,
    });
  });
}

export function planSession(input: { seed: number; topic: string; round_count: number }): GameRoundSpec[] {
  if (isTrackTopic(input.topic)) {
    return planStagedTrackSession(input);
  }

  // 레거시(과목) 토픽: 기존 PHASE1 동작 유지.
  const roundCount = Math.max(0, Math.floor(input.round_count));
  const emotionIndex = roundCount === 0 ? -1 : Math.min(roundCount - 1, Math.max(1, Math.floor(roundCount / 2)));
  const sessionRng = seededRng(seedForRound(input.seed, roundCount, input.topic, 1));
  const rounds: GameRoundSpec[] = [];
  const nonEmotionCount = Math.max(0, roundCount - 1);
  const quizBudget = Math.floor(nonEmotionCount / 3);
  let quizCount = 0;

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    const difficulty = clampDifficulty(1 + Math.floor(roundIndex / 3));
    const forceType =
      roundIndex === emotionIndex
        ? 'emotion_expression'
        : selectPhase1Type(sessionRng, quizCount, quizBudget);

    if (forceType === 'Q_quiz') {
      quizCount += 1;
    }

    rounds.push(
      planRound({
        seed: input.seed,
        round_index: roundIndex,
        topic: input.topic,
        difficulty,
        forceType,
      }),
    );
  }

  return rounds;
}

function paramsForGameType(
  gameType: GameType,
  input: {
    seed: number;
    difficulty: number;
    assetPoolId: string;
    timeLimitSec: number;
    items: PoolItem[];
    rng: () => number;
  },
): EngineRoundParams {
  const plannedItems = input.items.map(toPlannedItem);
  const baseParams: GameRoundParams = {
    seed: input.seed,
    difficulty: input.difficulty,
    asset_pool_id: input.assetPoolId,
    item_count: plannedItems.length,
    time_limit_sec: input.timeLimitSec,
  };

  switch (gameType) {
    case 'G1_match':
      return {
        ...baseParams,
        template_id: 'match_token_label_v1',
        items: plannedItems,
        prompt_ko: '같은 짝을 찾아요',
      };
    case 'G2_sort':
      return {
        ...baseParams,
        template_id: 'sort_by_category_v1',
        items: plannedItems,
        categories: categoriesFromItems(plannedItems),
        prompt_ko: '같은 무리끼리 나누어요',
      };
    case 'G3_sequence':
      return {
        ...baseParams,
        template_id: 'sequence_order_v1',
        items: plannedItems,
        prompt_ko: '순서를 맞춰요',
      };
    case 'G4_listen':
      return {
        ...baseParams,
        template_id: 'listen_pick_v1',
        items: plannedItems,
        answer_token: plannedItems[0]?.token,
        option_tokens: shuffle(plannedItems, input.rng).map((item) => item.token),
        prompt_ko: '듣고 골라요',
      };
    case 'G5_find':
      return {
        ...baseParams,
        template_id: 'find_target_v1',
        items: plannedItems,
        answer_token: plannedItems[0]?.token,
        prompt_ko: '같은 것을 찾아요',
      };
    case 'Q_quiz': {
      const answer = plannedItems[0];
      return {
        ...baseParams,
        template_id: 'quiz_pick_one_v1',
        items: plannedItems,
        answer_token: answer?.token,
        option_tokens: shuffle(plannedItems, input.rng).map((item) => item.token),
        prompt_ko: answer ? `${answer.label_ko}와 같은 것을 골라요` : '알맞은 답을 골라요',
      };
    }
    case 'emotion_expression':
      return {
        ...baseParams,
        template_id: 'emotion_expression_v1',
        items: plannedItems,
        categories: categoriesFromItems(plannedItems),
        prompt_ko: '오늘 마음을 골라요',
      };
    case 'hidden_friend':
      return {
        ...baseParams,
        template_id: 'hidden_friend_v1',
        items: plannedItems,
        answer_token: plannedItems[0]?.token,
        prompt_ko: '숨은 친구를 찾아봐요',
      };
    case 'decorate':
      return {
        ...baseParams,
        template_id: 'decorate_v1',
        items: plannedItems,
        categories: categoriesFromItems(plannedItems),
        prompt_ko: '나만의 선물을 꾸며요',
      };
  }
}

function selectWeightedGameType(rng: () => number, weights: Record<GameType, number>): GameType {
  const entries = Object.entries(weights).filter((entry): entry is [GameType, number] => entry[1] > 0);
  const total = entries.reduce((sum, entry) => sum + entry[1], 0);
  let cursor = rng() * total;

  for (const [gameType, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) {
      return gameType;
    }
  }

  return 'G1_match';
}

function selectPhase1Type(rng: () => number, quizCount: number, quizBudget: number): GameType {
  const picked = selectWeightedGameType(rng, {
    ...GAME_TYPE_WEIGHTS,
    G3_sequence: 0,
    G4_listen: 0,
    G5_find: 0,
    emotion_expression: 0,
  });

  if (picked === 'Q_quiz' && quizCount >= quizBudget) {
    return rng() < 0.5 ? 'G1_match' : 'G2_sort';
  }

  return PHASE1_SESSION_TYPES.includes(picked) ? picked : 'G1_match';
}

function sampleItemsForType(
  gameType: GameType,
  items: readonly PoolItem[],
  itemCount: number,
  rng: () => number,
): PoolItem[] {
  if (gameType !== 'G2_sort') {
    return sampleItems(items, itemCount, rng);
  }

  const byCategory = groupItemsByCategory(items);
  const categories = shuffle(Object.keys(byCategory), rng).slice(0, Math.min(3, Object.keys(byCategory).length));
  const selected: PoolItem[] = [];
  let categoryIndex = 0;

  while (selected.length < itemCount && categories.length > 0) {
    const category = categories[categoryIndex % categories.length];
    const categoryItems = byCategory[category] ?? [];
    const item = categoryItems[Math.floor(selected.length / categories.length)];

    if (item) {
      selected.push(item);
    } else {
      const fallback = sampleItems(items, itemCount, rng).find(
        (candidate) => !selected.some((selectedItem) => selectedItem.token === candidate.token),
      );

      if (!fallback) {
        break;
      }

      selected.push(fallback);
    }

    categoryIndex += 1;
  }

  return selected;
}

function sampleItems<T>(items: readonly T[], count: number, rng: () => number): T[] {
  return shuffle(items, rng).slice(0, count);
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function groupItemsByCategory(items: readonly PoolItem[]): Record<string, PoolItem[]> {
  const grouped: Record<string, PoolItem[]> = {};

  for (const item of items) {
    const category = item.category ?? 'default';
    grouped[category] = grouped[category] ?? [];
    grouped[category].push(item);
  }

  return grouped;
}

function toPlannedItem(item: PoolItem): PlannedItem {
  return {
    token: item.token,
    label_ko: item.label_ko,
    ...(item.category ? { category: item.category } : {}),
  };
}

function categoriesFromItems(items: readonly PlannedItem[]): string[] {
  return Array.from(new Set(items.map((item) => item.category).filter((category): category is string => Boolean(category))));
}

function itemCountForDifficulty(difficulty: number, poolSize: number): number {
  const targetCount = 2 + clampDifficulty(difficulty);
  return Math.max(1, Math.min(poolSize, targetCount));
}

function timeLimitForDifficulty(gameType: GameType, difficulty: number): number {
  const baseTimeByType: Record<GameType, number> = {
    G1_match: 48,
    G2_sort: 52,
    G3_sequence: 46,
    G4_listen: 44,
    G5_find: 42,
    Q_quiz: 36,
    emotion_expression: 45,
    hidden_friend: 50,
    decorate: 60,
  };

  return Math.max(18, baseTimeByType[gameType] - (clampDifficulty(difficulty) - 1) * 5);
}

function isFastEnough(difficulty: number, latencyMs: number | null): boolean {
  if (latencyMs === null) {
    return false;
  }

  const thresholds = [0, 1200, 1400, 1700, 2100, 2600];
  return latencyMs <= thresholds[clampDifficulty(difficulty)];
}

function clampDifficulty(value: number): number {
  return Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, Math.round(value)));
}

function seedForRound(seed: number, roundIndex: number, topic: string, difficulty: number): number {
  let mixed = seed >>> 0;
  mixed ^= Math.imul(roundIndex + 1, 0x9e3779b1);
  mixed ^= Math.imul(clampDifficulty(difficulty) + 17, 0x85ebca6b);
  mixed ^= hashString(topic || DEFAULT_TOPIC);
  return mixed >>> 0;
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

const gameEngine = {
  seededRng,
  GAME_TYPE_WEIGHTS,
  planRound,
  nextDifficulty,
  planSession,
};

export default gameEngine;
