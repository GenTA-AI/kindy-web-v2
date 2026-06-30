/*
 * Static curriculum mapping for game-round learning tags.
 *
 * Research source: docs/research/korea-curriculum-alignment-2026-06-05.md
 * Caveat: 누리과정 원문에 '일대일 대응'·'CRA'는 없음. '물체를 세어 수량을 알아본다'가 anchor.
 *
 * Elementary mappings intentionally use generic 2022 curriculum grade-band anchors.
 * Specific achievement-standard codes are not enumerated until NCIC verification.
 */

import type { CurriculumTag, GameType } from '@/types/game';

export const CURRICULUM_TAGS: Record<string, CurriculumTag> = {
  math_count_quantity: {
    objective_code: 'math_count_quantity',
    objective_label_ko: '수 세기와 수량 알아보기',
    standard_anchor: '물체를 세어 수량을 알아본다',
    standard_source: 'nuri',
    interpretive: true,
  },
  hangul_sound_play: {
    objective_code: 'hangul_sound_play',
    objective_label_ko: '말놀이와 소리 감각',
    standard_anchor: '동화·동시에서 말의 재미를 느낀다 / 말놀이와 이야기 짓기를 즐긴다',
    standard_source: 'nuri',
    interpretive: true,
  },
  english_l1_transfer: {
    objective_code: 'english_l1_transfer',
    objective_label_ko: '한국어 말놀이 기반 영어 소리 듣기',
    standard_anchor: '동화·동시에서 말의 재미를 느낀다 / 말놀이와 이야기 짓기를 즐긴다',
    standard_source: 'nuri',
    interpretive: true,
  },
  science_observe: {
    objective_code: 'science_observe',
    objective_label_ko: '관찰과 분류 탐구',
    standard_anchor: '생활 속의 문제를 수학적, 과학적으로 탐구한다',
    standard_source: 'nuri',
    interpretive: true,
  },
  sel_emotion_awareness: {
    objective_code: 'sel_emotion_awareness',
    objective_label_ko: '감정 어휘 인식 활동',
    standard_anchor: '사회관계',
    standard_source: 'nuri',
    interpretive: true,
  },
  // CASEL 5역량 → 누리 '사회관계' (정서·표현 트랙). 부모 노출 라벨은 미래역량 구체어.
  sel_self_awareness: {
    objective_code: 'sel_self_awareness',
    objective_label_ko: '내 마음 알아채기',
    standard_anchor: '사회관계',
    standard_source: 'nuri',
    interpretive: true,
  },
  sel_self_management: {
    objective_code: 'sel_self_management',
    objective_label_ko: '감정 다루기·기다리기',
    standard_anchor: '사회관계',
    standard_source: 'nuri',
    interpretive: true,
  },
  sel_social_awareness: {
    objective_code: 'sel_social_awareness',
    objective_label_ko: '친구 마음 읽고 공감하기',
    standard_anchor: '사회관계',
    standard_source: 'nuri',
    interpretive: true,
  },
  sel_relationship: {
    objective_code: 'sel_relationship',
    objective_label_ko: '나누고 소통하기',
    standard_anchor: '사회관계',
    standard_source: 'nuri',
    interpretive: true,
  },
  sel_responsible: {
    objective_code: 'sel_responsible',
    objective_label_ko: '살펴보고 스스로 선택하기',
    standard_anchor: '사회관계', // CASEL Responsible Decision-Making (책임있는 의사결정)
    standard_source: 'nuri',
    interpretive: true,
  },
  // 창의(상상·문제해결) 트랙 → 누리 '예술경험'.
  // 근거: 호서대 이철재 「창의적 사고와 디자인」 14주 + 「생각의 탄생」(Sparks of Genius) 사고 활동 체계
  //   + 디자인사고(기하학·패턴·디자인원리·콜라주). 일반 Torrance facet 대신 이 교수 프레임을 채택.
  //   (docs/curriculum/changsa-creativity-mapping-2026-06-09.md)
  // 6단계 나선 순서: 관찰 → 상상·유추 → 패턴 → 변형·도형 → 디자인원리 → 통합·콜라주.
  // 정답 없음 = 참여도. 부모 노출 라벨은 미래역량 친화어(사고력·표현·문제해결).
  creativity_observe: {
    objective_code: 'creativity_observe',
    objective_label_ko: '자세히 관찰하기',
    standard_anchor: '예술경험', // 생각의 탄생: 관찰(적극적 보기·오감)
    standard_source: 'nuri',
    interpretive: true,
  },
  creativity_imagine: {
    objective_code: 'creativity_imagine',
    objective_label_ko: '상상하고 닮은 것 찾기',
    standard_anchor: '예술경험', // 생각의 탄생: 형상화·유추("뭐랑 닮았을까")
    standard_source: 'nuri',
    interpretive: true,
  },
  creativity_pattern: {
    objective_code: 'creativity_pattern',
    objective_label_ko: '패턴 찾고 만들기',
    standard_anchor: '예술경험', // 생각의 탄생: 패턴인식·패턴형성 / 디자인 패턴
    standard_source: 'nuri',
    interpretive: true,
  },
  creativity_transform: {
    objective_code: 'creativity_transform',
    objective_label_ko: '모양 바꾸고 만들기',
    standard_anchor: '예술경험', // 디자인: 기하학(도형)·변형
    standard_source: 'nuri',
    interpretive: true,
  },
  creativity_design: {
    objective_code: 'creativity_design',
    objective_label_ko: '색과 균형으로 꾸미기',
    standard_anchor: '예술경험', // 디자인 원리: 색·대칭·균형
    standard_source: 'nuri',
    interpretive: true,
  },
  creativity_compose: {
    objective_code: 'creativity_compose',
    objective_label_ko: '모아서 새로 만들기',
    standard_anchor: '예술경험', // 생각의 탄생: 통합 / 디자인: 콜라주(papier collé)
    standard_source: 'nuri',
    interpretive: true,
  },
  elementary_korean_grade_band: {
    objective_code: 'elementary_korean_grade_band',
    objective_label_ko: '초등 1~2 / 3~4학년군 국어 활동',
    standard_anchor: '국어과(별책 5) 성취기준 + 1~2 / 3~4학년군 성취수준',
    standard_source: 'curriculum_2022',
    interpretive: true,
  },
  elementary_math_grade_band: {
    objective_code: 'elementary_math_grade_band',
    objective_label_ko: '초등 1~2 / 3~4학년군 수학 활동',
    standard_anchor: '수학과(별책 8) 성취기준 + 1~2 / 3~4학년군 성취수준',
    standard_source: 'curriculum_2022',
    interpretive: true,
  },
};

export const OBJECTIVE_CODES: readonly string[] = Object.keys(CURRICULUM_TAGS);

// 정서·표현(SEL) 트랙: gameType 별로 CASEL 역량을 회전 매핑.
const SEL_TRACK_TAGS: Record<GameType, CurriculumTag> = {
  G1_match: CURRICULUM_TAGS.sel_social_awareness, // 표정/마음 짝 맞추기 = 사회적 인식
  G2_sort: CURRICULUM_TAGS.sel_self_awareness, // 마음 분류 = 자기인식
  G3_sequence: CURRICULUM_TAGS.sel_self_management, // 차례·기다리기 = 자기관리
  G4_listen: CURRICULUM_TAGS.sel_social_awareness,
  G5_find: CURRICULUM_TAGS.sel_self_awareness,
  Q_quiz: CURRICULUM_TAGS.sel_relationship, // 소통·나눔 판단
  emotion_expression: CURRICULUM_TAGS.sel_self_awareness, // 내 마음 표현
  hidden_friend: CURRICULUM_TAGS.sel_social_awareness, // 친구 찾기 = 타인 인식
  decorate: CURRICULUM_TAGS.sel_relationship, // 선물 꾸미기 = 배려·관계
};

// 창의 6단계 나선 순서(관찰→상상유추→패턴→변형도형→디자인원리→통합콜라주).
// future_skills 창의 라운드는 roundIndex 로 이 배열을 순서대로 회전한다.
const CREATIVITY_SPIRAL: readonly CurriculumTag[] = [
  CURRICULUM_TAGS.creativity_observe,
  CURRICULUM_TAGS.creativity_imagine,
  CURRICULUM_TAGS.creativity_pattern,
  CURRICULUM_TAGS.creativity_transform,
  CURRICULUM_TAGS.creativity_design,
  CURRICULUM_TAGS.creativity_compose,
];

function creativitySpiralTag(roundIndex: number): CurriculumTag {
  const len = CREATIVITY_SPIRAL.length;
  const index = ((roundIndex % len) + len) % len;
  return CREATIVITY_SPIRAL[index];
}

// 창의(상상·문제해결) 트랙: gameType 별로 교수 도구를 매핑(나선 순서 진입점).
// 관찰=찾기, 상상·유추=짝/단서 연결, 패턴=순서·반복, 변형=분류·재구성, 통합=창작.
const CREATIVITY_TRACK_TAGS: Record<GameType, CurriculumTag> = {
  G1_match: CURRICULUM_TAGS.creativity_imagine, // 닮은 단서 잇기 = 상상·유추
  G2_sort: CURRICULUM_TAGS.creativity_transform, // 모양 분류·변형 = 변형·도형
  G3_sequence: CURRICULUM_TAGS.creativity_pattern, // 순서·반복 = 패턴
  G4_listen: CURRICULUM_TAGS.creativity_observe, // 듣고 자세히 = 관찰
  G5_find: CURRICULUM_TAGS.creativity_observe, // 숨은 것 찾기 = 관찰
  Q_quiz: CURRICULUM_TAGS.creativity_imagine, // "뭐랑 닮았을까" = 상상·유추
  emotion_expression: CURRICULUM_TAGS.creativity_compose, // 모아 새로 만들기 = 통합·콜라주
  hidden_friend: CURRICULUM_TAGS.creativity_observe, // 숨은 친구 찾기 = 관찰
  decorate: CURRICULUM_TAGS.creativity_compose, // 선물 꾸미기 = 통합·콜라주
};

export function tagForObjective(code: string): CurriculumTag | null {
  return CURRICULUM_TAGS[code] ?? null;
}

// 통합 미래역량(future_skills): 한 세션이 정서 + 창의 두 차원을 함께 다룬다.
// 정서표현 라운드 → SEL 태그(감정이입은 CASEL 공감이 커버), 사고/창의 라운드 → 교수 도구 태그.
// 한 세션에 두 라운드 유형이 공존하므로 SEL·creativity 태그가 둘 다 나온다.
// 창의 차원은 roundIndex 로 6단계 나선(관찰→…→통합)을 순서대로 회전(결정성 유지).
function unifiedTag(gameType: GameType, roundIndex: number): CurriculumTag {
  if (gameType === 'emotion_expression') {
    return SEL_TRACK_TAGS[gameType];
  }
  return creativitySpiralTag(roundIndex);
}

/** 창의 phase 전용: roundIndex 로 6단계 나선 도구를 순서대로 회전(engine staged 세션이 호출). */
export function creativityStagedTag(roundIndex: number): CurriculumTag {
  return creativitySpiralTag(roundIndex);
}

export function tagForGameType(gameType: GameType, topic: string, roundIndex = 0): CurriculumTag {
  const topicKey = topic.toLocaleLowerCase('ko-KR');
  const isElementary = includesAny(topicKey, [
    '초등',
    '학년군',
    '1학년',
    '2학년',
    '3학년',
    '6-9',
    'grade',
    'elementary',
  ]);

  // 통합 미래역량 토픽 — 라운드별로 정서(SEL) ↔ 창의(creativity) 차원을 함께 커버.
  if (includesAny(topicKey, ['future_skills', '미래역량', '생각하는 힘'])) {
    return unifiedTag(gameType, roundIndex);
  }

  // 상상·문제해결(창의) — gameType 별 Torrance 4요소 회전.
  // 단, 정서표현 라운드는 통합 세션에서 정서 차원을 보장하기 위해 SEL 태그를 붙인다.
  if (includesAny(topicKey, ['창의', '상상', '만들기', '문제해결', 'creativity', 'idea', 'creative'])) {
    return gameType === 'emotion_expression' ? SEL_TRACK_TAGS[gameType] : CREATIVITY_TRACK_TAGS[gameType];
  }

  // 정서·표현(SEL) — gameType 별 CASEL 역량 회전.
  if (includesAny(topicKey, ['정서', '표현', '감정', '마음', '표정', 'sel_emotion', 'emotion', 'feeling', 'sel'])) {
    return SEL_TRACK_TAGS[gameType];
  }

  if (includesAny(topicKey, ['english', '영어', 'alphabet', 'phonics'])) {
    return CURRICULUM_TAGS.english_l1_transfer;
  }

  if (includesAny(topicKey, ['한글', '국어', '말놀이', '동화', '동시', '소리', 'korean', 'hangul'])) {
    return isElementary ? CURRICULUM_TAGS.elementary_korean_grade_band : CURRICULUM_TAGS.hangul_sound_play;
  }

  if (includesAny(topicKey, ['수학', '숫자', '수량', '세기', 'count', 'number', 'math'])) {
    return isElementary ? CURRICULUM_TAGS.elementary_math_grade_band : CURRICULUM_TAGS.math_count_quantity;
  }

  if (includesAny(topicKey, ['과학', '관찰', '분류', '탐구', 'science', 'observe', 'sort'])) {
    return CURRICULUM_TAGS.science_observe;
  }

  switch (gameType) {
    case 'G1_match':
      return CURRICULUM_TAGS.hangul_sound_play;
    case 'G2_sort':
      return CURRICULUM_TAGS.science_observe;
    case 'G3_sequence':
      return CURRICULUM_TAGS.math_count_quantity;
    case 'G4_listen':
      return CURRICULUM_TAGS.hangul_sound_play;
    case 'G5_find':
      return CURRICULUM_TAGS.science_observe;
    case 'Q_quiz':
      return CURRICULUM_TAGS.math_count_quantity;
    case 'emotion_expression':
      return SEL_TRACK_TAGS.emotion_expression;
    case 'hidden_friend':
      return CREATIVITY_TRACK_TAGS.hidden_friend;
    case 'decorate':
      return CREATIVITY_TRACK_TAGS.decorate;
  }
}

function includesAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}
