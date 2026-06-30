import type { GameRoundResult, GameType } from '@/types/game';

export type C6ToolKey =
  | 'observe'
  | 'imagine'
  | 'pattern'
  | 'transform'
  | 'design'
  | 'compose';

export interface C6ToolMeta {
  key: C6ToolKey;
  icon: string;
  codeLabel: string;
  parentLabel: string;
  childPlayLabel: string;
  objectiveCodes: readonly string[];
  gameTypes: readonly GameType[];
  doneBody: (count: number) => string;
  nextBody: string;
  homePrompt: string;
}

export type C6ToolProgress = C6ToolMeta & {
  count: number;
};

export type C6HomeAssignment = readonly [day: string, title: string, body: string];

export const C6_TOOLS: readonly C6ToolMeta[] = [
  {
    key: 'observe',
    icon: '보기',
    codeLabel: '보기 놀이',
    parentLabel: '자세히 보기',
    childPlayLabel: '숨은 단서 찾기',
    objectiveCodes: ['creativity_observe'],
    gameTypes: ['hidden_friend', 'G5_find', 'G4_listen'],
    doneBody: (count) => `작은 차이와 숨은 단서를 ${count}번 끝까지 살펴봤어요.`,
    nextBody: '그림에서 작은 차이 2개를 찾는 놀이로 시작하면 좋아요.',
    homePrompt: '같은 그림을 보며 "처음엔 안 보였는데 다시 보니 뭐가 보여?"라고 물어봐 주세요.',
  },
  {
    key: 'imagine',
    icon: '잇기',
    codeLabel: '잇기 놀이',
    parentLabel: '닮은 것 잇기',
    childPlayLabel: '어울리는 짝 찾기',
    objectiveCodes: ['creativity_imagine'],
    gameTypes: ['G1_match', 'Q_quiz'],
    doneBody: (count) => `서로 닮았거나 어울리는 단서를 ${count}번 이어봤어요.`,
    nextBody: '물건 두 개를 놓고 "뭐가 닮았을까?"를 말해보는 놀이가 잘 맞아요.',
    homePrompt: '집 안 물건 두 개를 골라 "이 둘은 어디가 비슷해?"라고 짧게 이어 주세요.',
  },
  {
    key: 'pattern',
    icon: '규칙',
    codeLabel: '규칙 놀이',
    parentLabel: '규칙 찾기',
    childPlayLabel: '다음 무늬 고르기',
    objectiveCodes: ['creativity_pattern'],
    gameTypes: ['G3_sequence'],
    doneBody: (count) => `반복되는 색, 모양, 차례를 ${count}번 찾아 이어봤어요.`,
    nextBody: '색-모양-색-모양처럼 짧은 규칙을 직접 만들어보면 좋아요.',
    homePrompt: '블록이나 양말로 짧은 반복을 만들고 "다음엔 뭐가 올까?"라고 물어봐 주세요.',
  },
  {
    key: 'transform',
    icon: '나눔',
    codeLabel: '나눔 놀이',
    parentLabel: '모양 바꾸기',
    childPlayLabel: '무리 나누기',
    objectiveCodes: ['creativity_transform'],
    gameTypes: ['G2_sort'],
    doneBody: (count) => `모양과 기준을 바꾸어 나누는 활동을 ${count}번 해봤어요.`,
    nextBody: '같은 물건을 색으로 한 번, 모양으로 한 번 다르게 나눠보면 좋아요.',
    homePrompt: '장난감을 "색깔로 나누면?", "크기로 나누면?"처럼 기준을 바꿔 다시 놓아봐 주세요.',
  },
  {
    key: 'design',
    icon: '꾸밈',
    codeLabel: '꾸밈 놀이',
    parentLabel: '보기 좋게 고르기',
    childPlayLabel: '색과 자리 꾸미기',
    objectiveCodes: ['creativity_design'],
    gameTypes: [],
    doneBody: (count) => `색과 자리를 살펴 고르는 활동을 ${count}번 해봤어요.`,
    nextBody: '두 가지 색만 골라 어디에 놓을지 정하는 놀이가 잘 맞아요.',
    homePrompt: '스티커나 색연필 두 가지만 골라 "어디에 놓으면 가장 마음에 들어?"라고 물어봐 주세요.',
  },
  {
    key: 'compose',
    icon: '만듦',
    codeLabel: '만들기 놀이',
    parentLabel: '모아서 만들기',
    childPlayLabel: '나만의 선물 만들기',
    objectiveCodes: ['creativity_compose'],
    gameTypes: ['decorate'],
    doneBody: (count) => `색, 모양, 스티커를 모아 새 결과물을 ${count}번 만들었어요.`,
    nextBody: '정답 없이 고르고 붙이는 놀이를 이어가면 표현이 자연스럽게 나와요.',
    homePrompt: '완성물을 보며 "이름을 붙인다면 뭐라고 할까?"라고 가볍게 물어봐 주세요.',
  },
];

const C6_BY_KEY = new Map(C6_TOOLS.map((tool) => [tool.key, tool]));
const C6_BY_OBJECTIVE = new Map(
  C6_TOOLS.flatMap((tool) => tool.objectiveCodes.map((code) => [code, tool.key] as const)),
);
const C6_BY_GAME_TYPE = new Map(
  C6_TOOLS.flatMap((tool) => tool.gameTypes.map((gameType) => [gameType, tool.key] as const)),
);
const C6_SECONDARY_BY_GAME_TYPE = new Map<GameType, readonly C6ToolKey[]>([
  // 꾸미기는 결과물을 모아 만드는 C6 활동이지만, 색과 위치를 고르는 C5 신호도 함께 남긴다.
  ['decorate', ['design']],
]);

function rewardTexts(result: GameRoundResult): string[] {
  const reward = result.reward_payload;
  if (!reward) return [];

  return [
    ...(Array.isArray(reward.stickers) ? reward.stickers : []),
    ...(Array.isArray(reward.collection_unlocks) ? reward.collection_unlocks : []),
  ].filter((value) => typeof value === 'string');
}

export function inferC6Tool(result: GameRoundResult): C6ToolKey | null {
  if (result.objective_code && C6_BY_OBJECTIVE.has(result.objective_code)) {
    return C6_BY_OBJECTIVE.get(result.objective_code) ?? null;
  }

  for (const text of rewardTexts(result)) {
    const normalized = text.toLocaleLowerCase('ko-KR');
    for (const [objectiveCode, toolKey] of C6_BY_OBJECTIVE) {
      if (normalized.includes(objectiveCode)) return toolKey;
    }
  }

  return C6_BY_GAME_TYPE.get(result.game_type) ?? null;
}

export function inferC6Tools(result: GameRoundResult): C6ToolKey[] {
  const toolKeys = new Set<C6ToolKey>();
  const primary = inferC6Tool(result);

  if (primary) toolKeys.add(primary);

  for (const text of rewardTexts(result)) {
    const normalized = text.toLocaleLowerCase('ko-KR');
    for (const [objectiveCode, toolKey] of C6_BY_OBJECTIVE) {
      if (normalized.includes(objectiveCode)) toolKeys.add(toolKey);
    }
  }

  for (const toolKey of C6_SECONDARY_BY_GAME_TYPE.get(result.game_type) ?? []) {
    toolKeys.add(toolKey);
  }

  return [...toolKeys];
}

export function aggregateC6Profile(results: GameRoundResult[]): C6ToolProgress[] {
  const counts: Record<C6ToolKey, number> = {
    observe: 0,
    imagine: 0,
    pattern: 0,
    transform: 0,
    design: 0,
    compose: 0,
  };

  for (const result of results) {
    for (const toolKey of inferC6Tools(result)) {
      counts[toolKey] += 1;
    }
  }

  return C6_TOOLS.map((tool) => ({
    ...tool,
    count: counts[tool.key],
  }));
}

export function c6NextStep(profile: C6ToolProgress[]): C6ToolProgress {
  const sorted = [...profile].sort((a, b) => {
    if (a.count !== b.count) return a.count - b.count;
    return C6_TOOLS.findIndex((tool) => tool.key === a.key) - C6_TOOLS.findIndex((tool) => tool.key === b.key);
  });

  return sorted[0] ?? { ...C6_BY_KEY.get('observe')!, count: 0 };
}

export function c6HomeAssignments(profile: C6ToolProgress[]): C6HomeAssignment[] {
  const next = c6NextStep(profile);

  return [
    ['1일차', `${next.childPlayLabel} 짧은 이야기`, next.nextBody],
    ['2일차', `${next.parentLabel} 한마디`, next.homePrompt],
    ['3일차', '모리와 다시 만들기', '같은 단서를 한 번 더 보고, 아이가 고른 방법으로 작은 결과물을 완성해요.'],
  ];
}
