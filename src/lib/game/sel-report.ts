import type { GameRoundResult, SelActivityCount, FutureSkillKey } from '@/types/game';

/*
 * 부모 대시보드 MVP 집계 (부모대시보드_MVP_설계.md §2 / §6).
 *
 * 절대 규칙 (위반 = 법규/발달 위험):
 *  - 관찰 가능한 "활동 횟수"만 집계. 점수·등급·레벨·백분위·또래 비교·능력 단정 금지.
 *  - 라벨은 미래역량 구체어(자기주도·끈기·문제해결·소통·호기심). 추상 '정서/창의' 금지.
 *  - 내면 상태(기분/조절력) 추정 금지. 취향 프로파일은 빈도 패턴일 뿐 성향 단정 아님.
 */

const SKILL_ORDER: readonly FutureSkillKey[] = [
  'self_directed',
  'persistence',
  'problem_solving',
  'communication',
  'curiosity',
];

const SKILL_META: Record<FutureSkillKey, { label_ko: string; icon: string; unit_ko: string }> = {
  self_directed: { label_ko: '스스로 한 놀이', icon: '🌱', unit_ko: '번' },
  persistence: { label_ko: '끈기 (다시 도전)', icon: '💪', unit_ko: '번 다시 도전' },
  problem_solving: { label_ko: '문제해결·표현', icon: '🧩', unit_ko: '번 활동' },
  communication: { label_ko: '소통·표현력', icon: '💬', unit_ko: '번 표현' },
  curiosity: { label_ko: '호기심 (새 도전)', icon: '✨', unit_ko: '개 새 주제' },
};

// 문제해결·표현 신호: 퍼즐/창작 라운드.
const PROBLEM_SOLVING_GAME_TYPES: ReadonlySet<string> = new Set([
  'G1_match',
  'G2_sort',
  'G3_sequence',
  'G5_find',
]);
const PROBLEM_SOLVING_MARKERS: readonly string[] = [
  'creativity',
  'problem',
  '문제해결',
  '여러 방법',
  '나만의',
  '아이디어',
  '꾸미',
  '예술경험',
];

// 소통·표현력 신호: 정서표현/발화 라운드.
const COMMUNICATION_GAME_TYPES: ReadonlySet<string> = new Set(['emotion_expression']);
const COMMUNICATION_MARKERS: readonly string[] = [
  'sel_',
  'emotion',
  'empathy',
  'sharing',
  'relationship',
  'social',
  '공감',
  '소통',
  '나눔',
  '표현',
  '마음',
  '감정',
  '사회관계',
];

// 미래역량 친화적인 대화 스타터(가정에서 1분 대화). 효능 단정 없이 활동 연결만.
const STARTER_TEMPLATES: Record<FutureSkillKey, readonly string[]> = {
  self_directed: [
    '이번 주 스스로 {count}번 놀이를 시작했어요. 오늘 무엇을 가장 해보고 싶은지 아이에게 물어볼까요?',
  ],
  persistence: [
    '어려워도 {count}번 다시 도전했어요. "처음엔 어려웠는데 어떻게 다시 해봤어?"라고 물어볼까요?',
  ],
  problem_solving: [
    '이번 주 {count}번 문제를 풀고 만들어 봤어요. "다른 방법도 있을까?"라고 함께 떠올려볼까요?',
  ],
  communication: [
    '이번 주 {count}번 마음을 표현했어요. "오늘 친구가 슬프면 뭐라고 말해줄 수 있을까?"라고 물어볼까요?',
  ],
  curiosity: [
    '새로운 주제를 {count}개 시도했어요. 오늘 새로 궁금했던 것 하나를 같이 이야기해볼까요?',
  ],
};

const DEFAULT_STARTERS: readonly string[] = [
  '오늘 아이가 가장 해보고 싶은 놀이를 하나 같이 골라볼까요?',
  '"오늘 친구가 슬프면 뭐라고 말해줄 수 있을까?"처럼 짧게 1분 이야기해볼까요?',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizedText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('ko-KR') : '';
}

function nonNegativeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function includesAnyMarker(text: string, markers: readonly string[]): boolean {
  if (!text) return false;
  return markers.some((marker) => text.includes(marker.toLocaleLowerCase('ko-KR')));
}

function markerTexts(result: GameRoundResult): string[] {
  const looseResult = result as GameRoundResult & Record<string, unknown>;
  const payload = isRecord(looseResult.payload) ? looseResult.payload : null;
  const rewardPayload = isRecord(result.reward_payload) ? result.reward_payload : null;

  return [
    looseResult.sel_activity,
    looseResult.skill_key,
    payload?.sel_activity,
    payload?.skill_key,
    payload?.activity,
    rewardPayload?.sel_activity,
    rewardPayload?.skill_key,
    rewardPayload?.activity,
    result.objective_code,
    result.standard_anchor,
    result.game_type,
    ...(Array.isArray(result.reward_payload?.stickers) ? result.reward_payload.stickers : []),
    ...(Array.isArray(result.reward_payload?.collection_unlocks) ? result.reward_payload.collection_unlocks : []),
  ].map(normalizedText);
}

function isCommunicationRound(result: GameRoundResult): boolean {
  if (COMMUNICATION_GAME_TYPES.has(result.game_type)) return true;
  return markerTexts(result).some((text) => includesAnyMarker(text, COMMUNICATION_MARKERS));
}

function isProblemSolvingRound(result: GameRoundResult): boolean {
  if (COMMUNICATION_GAME_TYPES.has(result.game_type)) return false;
  if (PROBLEM_SOLVING_GAME_TYPES.has(result.game_type)) return true;
  return markerTexts(result).some((text) => includesAnyMarker(text, PROBLEM_SOLVING_MARKERS));
}

function emptyCountMap(): Record<FutureSkillKey, number> {
  return {
    self_directed: 0,
    persistence: 0,
    problem_solving: 0,
    communication: 0,
    curiosity: 0,
  };
}

function countMapFromCounts(counts: SelActivityCount[]): Record<FutureSkillKey, number> {
  const map = emptyCountMap();
  for (const item of counts) {
    if (item.skill_key in map) {
      map[item.skill_key] += nonNegativeCount(item.count);
    }
  }
  return map;
}

function toCountList(map: Record<FutureSkillKey, number>): SelActivityCount[] {
  return SKILL_ORDER.map((skillKey) => ({
    skill_key: skillKey,
    label_ko: SKILL_META[skillKey].label_ko,
    icon: SKILL_META[skillKey].icon,
    unit_ko: SKILL_META[skillKey].unit_ko,
    count: map[skillKey],
  }));
}

/**
 * GameRoundResult[] → 5개 미래역량 활동 횟수 (관찰 가능 카운트만).
 * - self_directed: 완료 라운드 수(스스로 한 놀이).
 * - persistence: retried=true 횟수.
 * - problem_solving: 퍼즐/창작 라운드 수.
 * - communication: 정서표현/발화 라운드 수.
 * - curiosity: 처음 등장한 game_type×objective 조합 수(새 시도).
 */
export function aggregateSelActivities(results: GameRoundResult[]): SelActivityCount[] {
  const counts = emptyCountMap();
  const seenNovelty = new Set<string>();

  for (const result of results) {
    counts.self_directed += 1;

    if (result.retried) {
      counts.persistence += 1;
    }

    if (isProblemSolvingRound(result)) {
      counts.problem_solving += 1;
    }

    if (isCommunicationRound(result)) {
      counts.communication += 1;
    }

    const noveltyKey = `${result.game_type}:${result.objective_code ?? ''}`;
    if (!seenNovelty.has(noveltyKey)) {
      seenNovelty.add(noveltyKey);
      counts.curiosity += 1;
    }
  }

  return toCountList(counts);
}

export function dialogueStarters(counts: SelActivityCount[]): string[] {
  const map = countMapFromCounts(counts);
  const activeSkills = [...SKILL_ORDER]
    .filter((skillKey) => map[skillKey] > 0)
    .sort((a, b) => map[b] - map[a]);

  if (activeSkills.length === 0) {
    return [...DEFAULT_STARTERS];
  }

  return activeSkills
    .flatMap((skillKey) =>
      STARTER_TEMPLATES[skillKey].map((template) => template.replace('{count}', String(map[skillKey]))),
    )
    .slice(0, 4);
}

/** HERO 지표 문장: 스스로 한 활동 + 자기 대비(또래 비교 금지). */
export function weeklySummaryLine(counts: SelActivityCount[]): string {
  const map = countMapFromCounts(counts);
  return `이번 주 스스로 ${map.self_directed}번 놀이했어요`;
}

/**
 * 성장 하이라이트 — 강점기반 서사 1문장(템플릿 + 관찰 데이터).
 * 능력·효능 단정 금지. 가장 두드러진 활동을 사실로만 서술.
 */
export function growthHighlight(counts: SelActivityCount[], childName?: string): string {
  const map = countMapFromCounts(counts);
  const who = childName?.trim() ? `${childName.trim()}이가` : '아이가';

  if (map.persistence > 0) {
    return `${who} 어려운 놀이도 ${map.persistence}번 다시 도전했어요.`;
  }
  if (map.problem_solving > 0) {
    return `${who} 이번 주에 ${map.problem_solving}번 스스로 문제를 풀고 만들어 봤어요.`;
  }
  if (map.communication > 0) {
    return `${who} 자기 마음을 ${map.communication}번 표현했어요.`;
  }
  if (map.self_directed > 0) {
    return `${who} 스스로 ${map.self_directed}번 놀이를 시작했어요.`;
  }
  return `${who} 새로운 놀이를 시작할 준비를 하고 있어요.`;
}

/** 취향 프로파일 1줄(빈도 패턴). 성향·능력 단정이 아님을 라벨로 명시. */
export interface TasteProfileItem {
  label_ko: string;
  value_ko: string;
}

export function tasteProfile(input: {
  favoriteStory?: string | null;
  frequentQuestion?: string | null;
  favoriteColors?: string[] | null;
}): TasteProfileItem[] {
  const items: TasteProfileItem[] = [];

  if (input.favoriteStory?.trim()) {
    items.push({ label_ko: '가장 좋아한 이야기', value_ko: input.favoriteStory.trim() });
  }
  if (input.frequentQuestion?.trim()) {
    items.push({ label_ko: '자주 고른 질문', value_ko: input.frequentQuestion.trim() });
  }
  const colors = (input.favoriteColors ?? []).filter((color) => color.trim());
  if (colors.length > 0) {
    items.push({ label_ko: '좋아하는 색', value_ko: colors.join('·') });
  }

  return items;
}

const selReport = {
  aggregateSelActivities,
  dialogueStarters,
  weeklySummaryLine,
  growthHighlight,
  tasteProfile,
};

export default selReport;
