// 동물 마을 — 시즌 1 콘텐츠 데이터 (docs/content/animal-village-season1.md = 스펙).
//
// 추상 드릴이 아니라 "사랑받는 세계 + 캐릭터 + 이야기"에 정서(CASEL)+창의(교수 6도구) 활동을 입힌다.
// 만 3–7세 · 웹 · 음성 필수. 일러스트는 이모지 플레이스홀더(진짜 아트는 후속).
//
// 포지셔닝: 부모 대면은 미래역량 언어. 점수·등수·"정서/창의 교육" 단어 금지.

import type { GameType, SessionAct } from '@/types/game';

// Gemini TTS 아동 음성 id (src/lib/video-providers/types.ts CharacterVoice 와 동일).
// 브라우저 Web Speech 는 품질이 낮아 폐기 — 사전 생성한 Gemini 아동 음성을 재생한다.
export type VillageVoice =
  | 'Puck'      // 7살 여아, 밝고 활기찬
  | 'Leda'      // 8살 남아, 걱정/여린
  | 'Aoede'     // 9살 여아, 또박또박 관찰자
  | 'Fenrir'    // 8살 남아, 힘없고 슬픈
  | 'Kore'      // 10살 여아 내레이션
  | 'Charon'    // 9살 남아, 답답한
  | 'Despina'   // 8살 여아, 불안한
  | 'Enceladus'; // 10살 남아, 차분한 내레이터

export type CharacterId =
  | 'toto'
  | 'kkumi'
  | 'bangul'
  | 'naong'
  | 'doto'
  | 'owl';

export interface VillageCharacter {
  id: CharacterId;
  name: string;
  species: string;
  emoji: string;
  /** 성격 한 줄. */
  trait: string;
  /** 이 친구가 다루는 정서 결. */
  emotion: string;
  /** 마스코트(토토)의 응원 톤 등에 쓰는 색 키. */
  accent: 'amber' | 'rose' | 'sky' | 'emerald' | 'violet' | 'slate';
  /** Gemini TTS 아동 음성. */
  voice: VillageVoice;
}

export const CHARACTERS: Record<CharacterId, VillageCharacter> = {
  toto: {
    id: 'toto',
    name: '토토',
    species: '토끼',
    emoji: '🐰',
    trait: '마을을 안내하는 다정한 친구',
    emotion: '응원·안내',
    accent: 'violet',
    voice: 'Puck', // 밝고 활기찬 아이 가이드
  },
  kkumi: {
    id: 'kkumi',
    name: '꾸미',
    species: '아기 곰',
    emoji: '🐻',
    trait: '수줍고 잘 우는 마음 여린 친구',
    emotion: '슬픔·위로',
    accent: 'amber',
    voice: 'Fenrir', // 힘없고 슬픈 톤
  },
  bangul: {
    id: 'bangul',
    name: '방울',
    species: '강아지',
    emoji: '🐶',
    trait: '활발하고 가끔 너무 신나는 친구',
    emotion: '기쁨·자기조절',
    accent: 'sky',
    voice: 'Aoede', // 활기차고 또박또박
  },
  naong: {
    id: 'naong',
    name: '나옹',
    species: '고양이',
    emoji: '🐱',
    trait: '새침하지만 속정 깊은 친구',
    emotion: '부끄러움·우정',
    accent: 'rose',
    voice: 'Despina', // 조심스럽고 가는 목소리
  },
  doto: {
    id: 'doto',
    name: '도토',
    species: '다람쥐',
    emoji: '🐿️',
    trait: '겁 많고 잘 숨는 친구',
    emotion: '두려움·용기',
    accent: 'emerald',
    voice: 'Leda', // 걱정/여린 톤
  },
  owl: {
    id: 'owl',
    name: '올빼미 할아버지',
    species: '올빼미',
    emoji: '🦉',
    trait: '지혜로운 이야기꾼',
    emotion: '도입·마무리 내레이션',
    accent: 'slate',
    voice: 'Enceladus', // 차분한 내레이터
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 활동(아이템) 자산 — 동물 테마 이모지. PuzzleGame/EmotionExpression 이 읽는 형태.
// ─────────────────────────────────────────────────────────────────────────────

export interface VillageItem {
  token: string; // 이모지 또는 마크
  label_ko: string;
  category: string;
}

/** 동물–좋아하는 먹이 짝 맞추기(유추). */
const FRIEND_TREAT_ITEMS: VillageItem[] = [
  { token: '🐻🍯', label_ko: '곰과 꿀', category: 'pair_bear' },
  { token: '🐶🦴', label_ko: '강아지와 뼈다귀', category: 'pair_dog' },
  { token: '🐱🐟', label_ko: '고양이와 생선', category: 'pair_cat' },
  { token: '🐿️🌰', label_ko: '다람쥐와 도토리', category: 'pair_squirrel' },
];

/** 하늘·물·땅 친구로 무리 나누기(추상화·분류). */
const HABITAT_ITEMS: VillageItem[] = [
  { token: '🐦', label_ko: '새', category: 'sky' },
  { token: '🦋', label_ko: '나비', category: 'sky' },
  { token: '🐟', label_ko: '물고기', category: 'water' },
  { token: '🐢', label_ko: '거북이', category: 'water' },
  { token: '🐰', label_ko: '토끼', category: 'land' },
  { token: '🐿️', label_ko: '다람쥐', category: 'land' },
];

/** 목도리/울타리 무늬 잇기(패턴) — 색·모양 토큰. */
const PATTERN_ITEMS: VillageItem[] = [
  { token: '🔴', label_ko: '빨강', category: 'pattern' },
  { token: '🔵', label_ko: '파랑', category: 'pattern' },
  { token: '🟡', label_ko: '노랑', category: 'pattern' },
  { token: '⭐', label_ko: '별', category: 'pattern' },
];

/** 숨은 친구 찾기(관찰) — 정답 1, 방해꾼 다수. */
const HIDDEN_FRIEND_ITEMS: VillageItem[] = [
  { token: '🐿️', label_ko: '도토', category: 'target' },
  { token: '🍂', label_ko: '낙엽', category: 'decoy' },
  { token: '🌿', label_ko: '풀잎', category: 'decoy' },
  { token: '🍄', label_ko: '버섯', category: 'decoy' },
  { token: '🪨', label_ko: '돌', category: 'decoy' },
  { token: '🌰', label_ko: '도토리', category: 'decoy' },
];

/** 선물 꾸미기(통합·콜라주) — 색/모양/스티커 팔레트. 정답 없음 = 참여. */
export interface DecoratePalette {
  colors: VillageItem[];
  shapes: VillageItem[];
  stickers: VillageItem[];
}

const DECORATE_PALETTE: DecoratePalette = {
  colors: [
    { token: '🟥', label_ko: '빨강', category: 'color' },
    { token: '🟦', label_ko: '파랑', category: 'color' },
    { token: '🟨', label_ko: '노랑', category: 'color' },
    { token: '🟩', label_ko: '초록', category: 'color' },
  ],
  shapes: [
    { token: '⭐', label_ko: '별', category: 'shape' },
    { token: '❤️', label_ko: '하트', category: 'shape' },
    { token: '🌸', label_ko: '꽃', category: 'shape' },
    { token: '🔶', label_ko: '마름모', category: 'shape' },
  ],
  stickers: [
    { token: '🎀', label_ko: '리본', category: 'sticker' },
    { token: '✨', label_ko: '반짝이', category: 'sticker' },
    { token: '🌟', label_ko: '큰별', category: 'sticker' },
    { token: '🍓', label_ko: '딸기', category: 'sticker' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 활동 템플릿 8종 config — game_type + 안내문 + 음성 대사 + 피드백 문구 + 자산.
// ─────────────────────────────────────────────────────────────────────────────

export interface ActivityFeedback {
  success: string;
  retry: string;
  hint: string;
}

export interface ActivityVoice {
  /** 활동 진입 시 토토/올빼미가 읽어주는 안내. */
  intro: string;
  /** 정답/완료 칭찬. */
  praise: string;
}

export interface ActivityConfig {
  id: string;
  game_type: GameType;
  phase: SessionAct;
  /** 화면 제목(아이 눈높이). */
  title: string;
  /** 안내문(음성으로도 읽음). */
  prompt_ko: string;
  /** 이 활동을 이끄는 캐릭터. */
  leadCharacter: CharacterId;
  items: VillageItem[];
  categories?: string[];
  /** 정답 토큰(있으면) — hidden_friend/match 등. */
  answerToken?: string;
  /** 창작형이면 true(정답 없음 = 참여도). */
  freeform?: boolean;
  /** 선물 꾸미기 팔레트(decorate 전용). */
  palette?: DecoratePalette;
  voice: ActivityVoice;
  feedback: ActivityFeedback;
}

function uniqueCategories(items: VillageItem[]): string[] {
  return Array.from(new Set(items.map((item) => item.category)));
}

/** 활동 템플릿 8종(스펙 표). 세션 시나리오가 이 중 6개를 골라 2막으로 배치. */
export const ACTIVITY_TEMPLATES: Record<string, ActivityConfig> = {
  // 1. 표정 읽기 (정서/관찰)
  read_face: {
    id: 'read_face',
    game_type: 'emotion_expression',
    phase: 'emotion',
    title: '꾸미 마음 찾기',
    prompt_ko: '꾸미는 지금 어떤 마음일까? 얼굴을 보고 골라줘.',
    leadCharacter: 'kkumi',
    items: [
      { token: '😢', label_ko: '슬퍼요', category: 'uncomfortable' },
      { token: '😊', label_ko: '기뻐요', category: 'positive' },
      { token: '😟', label_ko: '걱정돼요', category: 'uncomfortable' },
      { token: '😴', label_ko: '졸려요', category: 'calm' },
    ],
    voice: {
      intro: '꾸미가 고개를 숙이고 있어. 꾸미는 지금 어떤 마음일까?',
      praise: '꾸미 마음을 알아줬구나. 정말 다정해!',
    },
    feedback: {
      success: '꾸미 마음을 알아줬어!',
      retry: '괜찮아, 얼굴을 한 번 더 살펴볼까?',
      hint: '입꼬리가 어느 쪽으로 갔는지 봐봐.',
    },
  },
  // 2. 마음 헤아리기 (정서/공감) — 표정 표현 라운드로 재사용
  guess_feeling: {
    id: 'guess_feeling',
    game_type: 'emotion_expression',
    phase: 'emotion',
    title: '꾸미는 왜 슬플까',
    prompt_ko: '꾸미가 왜 그런 마음인지 같이 생각해보자.',
    leadCharacter: 'kkumi',
    items: [
      { token: '🎈', label_ko: '풍선을 놓쳤어요', category: 'reason' },
      { token: '🧸', label_ko: '인형을 잃어버렸어요', category: 'reason' },
      { token: '🌧️', label_ko: '비가 와서 못 놀았어요', category: 'reason' },
    ],
    voice: {
      intro: '꾸미가 좋아하던 게 사라졌대. 왜 슬픈지 같이 헤아려볼까?',
      praise: '꾸미 마음을 깊이 헤아렸어. 친구는 정말 든든하겠다!',
    },
    feedback: {
      success: '꾸미 마음을 헤아렸어!',
      retry: '천천히 다시 생각해봐도 괜찮아.',
      hint: '꾸미가 무엇을 보고 슬퍼했을까?',
    },
  },
  // 3. 숨은 친구 찾기 (관찰)
  find_hidden: {
    id: 'find_hidden',
    game_type: 'hidden_friend',
    phase: 'emotion',
    title: '숨은 친구 찾기',
    prompt_ko: '풀숲에 숨은 도토를 찾아 톡 눌러줘!',
    leadCharacter: 'doto',
    items: HIDDEN_FRIEND_ITEMS,
    answerToken: '🐿️',
    voice: {
      intro: '겁 많은 도토가 풀숲에 숨었어. 자세히 보고 도토를 찾아줄래?',
      praise: '도토를 찾았어! 자세히 보는 눈이 정말 좋구나.',
    },
    feedback: {
      success: '도토를 찾았어!',
      retry: '거의 다 왔어. 다른 곳도 살펴볼까?',
      hint: '꼬리가 살짝 보이는 곳이 있어.',
    },
  },
  // 4. 선물 짝 맞추기 (유추)
  match_treat: {
    id: 'match_treat',
    game_type: 'G1_match',
    phase: 'creativity',
    title: '선물 짝 맞추기',
    prompt_ko: '친구가 좋아하는 선물을 짝지어줘.',
    leadCharacter: 'toto',
    items: FRIEND_TREAT_ITEMS,
    voice: {
      intro: '친구마다 좋아하는 게 달라. 누가 무엇을 좋아할지 짝지어볼까?',
      praise: '딱 맞는 짝을 찾았어! 친구들이 좋아하겠다.',
    },
    feedback: {
      success: '딱 맞는 짝이야!',
      retry: '괜찮아, 다른 짝을 찾아볼까?',
      hint: '곰은 달콤한 걸 좋아해.',
    },
  },
  // 5. 무늬 잇기 (패턴)
  finish_pattern: {
    id: 'finish_pattern',
    game_type: 'G2_sort',
    phase: 'creativity',
    title: '목도리 무늬 잇기',
    prompt_ko: '꾸미 목도리 무늬를 같은 색끼리 모아줘.',
    leadCharacter: 'kkumi',
    items: PATTERN_ITEMS,
    categories: uniqueCategories(PATTERN_ITEMS),
    voice: {
      intro: '꾸미에게 따뜻한 목도리를 만들어주자. 무늬를 골라볼까?',
      praise: '멋진 무늬가 완성됐어! 꾸미가 좋아하겠다.',
    },
    feedback: {
      success: '무늬가 이어졌어!',
      retry: '거의 다 왔어. 다른 무늬를 골라볼까?',
      hint: '같은 색이 어디 있는지 봐봐.',
    },
  },
  // 6. 무리 나누기 (추상화·분류)
  sort_habitat: {
    id: 'sort_habitat',
    game_type: 'G2_sort',
    phase: 'creativity',
    title: '친구들 집 찾기',
    prompt_ko: '하늘·물·땅 친구로 나누어줘.',
    leadCharacter: 'toto',
    items: HABITAT_ITEMS,
    categories: uniqueCategories(HABITAT_ITEMS),
    voice: {
      intro: '친구들이 집을 찾고 있어. 하늘·물·땅으로 나눠줄까?',
      praise: '모두 집을 찾았어! 정말 잘 나눴구나.',
    },
    feedback: {
      success: '모두 집을 찾았어!',
      retry: '괜찮아, 다른 곳을 골라볼까?',
      hint: '나비는 어디를 날아다닐까?',
    },
  },
  // 7. 짝 맞추기(관계) — 동물·집 짝 (변주용)
  match_home: {
    id: 'match_home',
    game_type: 'G1_match',
    phase: 'creativity',
    title: '친구와 집 짝 맞추기',
    prompt_ko: '친구가 사는 집을 짝지어줘.',
    leadCharacter: 'toto',
    items: [
      { token: '🐦🪺', label_ko: '새와 둥지', category: 'home_bird' },
      { token: '🐟🌊', label_ko: '물고기와 물', category: 'home_fish' },
      { token: '🐰🕳️', label_ko: '토끼와 굴', category: 'home_rabbit' },
    ],
    voice: {
      intro: '친구마다 사는 곳이 달라. 누가 어디 사는지 짝지어볼까?',
      praise: '집을 잘 찾아줬어! 친구들이 편안하겠다.',
    },
    feedback: {
      success: '집을 찾아줬어!',
      retry: '괜찮아, 다른 짝을 찾아볼까?',
      hint: '물고기는 물에서 살아.',
    },
  },
  // 8. 선물 꾸미기 (통합·콜라주 / 창작 — 정답 없음)
  decorate_gift: {
    id: 'decorate_gift',
    game_type: 'decorate',
    phase: 'creativity',
    title: '나만의 선물 꾸미기',
    prompt_ko: '색·모양·스티커로 꾸미에게 줄 선물을 만들어줘.',
    leadCharacter: 'kkumi',
    items: [...DECORATE_PALETTE.colors, ...DECORATE_PALETTE.shapes, ...DECORATE_PALETTE.stickers],
    freeform: true,
    palette: DECORATE_PALETTE,
    voice: {
      intro: '이제 꾸미에게 줄 선물을 나만의 방법으로 꾸며보자!',
      praise: '와, 세상에 하나뿐인 멋진 선물이야!',
    },
    feedback: {
      success: '나만의 선물이 완성됐어!',
      retry: '마음껏 더 꾸며도 좋아.',
      hint: '좋아하는 색부터 골라볼까?',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 세션 시나리오 — "꾸미 곰의 날" (2막, 6활동)
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionScene {
  /** 도입/전환 내레이션(음성). */
  narratorId: CharacterId;
  line: string;
}

export interface VillageSession {
  id: string;
  title: string;
  /** 이 세션의 주인공 친구. */
  heroCharacter: CharacterId;
  intro: SessionScene[];
  /** 1막(정서) 활동 id 순서. */
  act1: string[];
  transition: SessionScene;
  /** 2막(창의) 활동 id 순서. */
  act2: string[];
  closing: SessionScene;
}

export const KKUMI_DAY_SESSION: VillageSession = {
  id: 'kkumi-day',
  title: '꾸미 곰의 날',
  heroCharacter: 'kkumi',
  intro: [
    { narratorId: 'owl', line: '오늘은 꾸미가 슬퍼 보이는구나…' },
    { narratorId: 'toto', line: '왜 그런지 같이 알아볼까?' },
  ],
  act1: ['read_face', 'guess_feeling', 'find_hidden'],
  transition: {
    narratorId: 'toto',
    line: '이제 꾸미를 어떻게 도와줄까? 나만의 방법을 만들어보자!',
  },
  act2: ['match_treat', 'finish_pattern', 'decorate_gift'],
  closing: {
    narratorId: 'kkumi',
    line: '고마워! 덕분에 기분이 환해졌어. 별빛 축제에서 또 만나자!',
  },
};

export interface AnimalVillageWorld {
  id: 'animal-village';
  name: string;
  tagline: string;
  characters: Record<CharacterId, VillageCharacter>;
  mascotId: CharacterId;
  activities: Record<string, ActivityConfig>;
  sessions: VillageSession[];
}

export const ANIMAL_VILLAGE: AnimalVillageWorld = {
  id: 'animal-village',
  name: '동물 마을',
  tagline: '별빛 축제를 함께 준비하는 동물 친구들의 마을',
  characters: CHARACTERS,
  mascotId: 'toto',
  activities: ACTIVITY_TEMPLATES,
  sessions: [KKUMI_DAY_SESSION],
};

export function getActivity(id: string): ActivityConfig | null {
  return ACTIVITY_TEMPLATES[id] ?? null;
}

export function getCharacter(id: CharacterId): VillageCharacter {
  return CHARACTERS[id];
}

// ─────────────────────────────────────────────────────────────────────────────
// 음성 라인 enumeration — 안정적 id 부여. 생성 스크립트와 useVoice 가 공유한다.
// id 규칙: act.<activityId>.<intro|praise> / sess.<sessionId>.<intro.N|transition|closing>
// ─────────────────────────────────────────────────────────────────────────────

export interface VoiceLine {
  id: string;
  text: string;
  /** Gemini TTS 아동 음성. */
  voice: VillageVoice;
  /** 이 라인을 말하는 캐릭터(디버그·매핑용). */
  characterId: CharacterId;
}

/** 활동 안내 음성 id. */
export function activityVoiceId(activityId: string, kind: 'intro' | 'praise'): string {
  return `act.${activityId}.${kind}`;
}

/** 세션 내레이션 음성 id. */
export function sessionVoiceId(sessionId: string, kind: 'intro' | 'transition' | 'closing', index = 0): string {
  return kind === 'intro' ? `sess.${sessionId}.intro.${index}` : `sess.${sessionId}.${kind}`;
}

/** 동물 마을의 모든 음성 라인을 평탄화해 반환(생성 스크립트 + 런타임 공용). */
export function collectVoiceLines(): VoiceLine[] {
  const lines: VoiceLine[] = [];
  const seen = new Set<string>();

  const push = (id: string, text: string, characterId: CharacterId) => {
    if (seen.has(id)) return;
    seen.add(id);
    lines.push({ id, text, voice: CHARACTERS[characterId].voice, characterId });
  };

  // 활동 intro/praise (lead character 음성).
  for (const activity of Object.values(ACTIVITY_TEMPLATES)) {
    push(activityVoiceId(activity.id, 'intro'), activity.voice.intro, activity.leadCharacter);
    push(activityVoiceId(activity.id, 'praise'), activity.voice.praise, activity.leadCharacter);
  }

  // 세션 내레이션 (narrator 음성).
  for (const session of ANIMAL_VILLAGE.sessions) {
    session.intro.forEach((scene, i) => {
      push(sessionVoiceId(session.id, 'intro', i), scene.line, scene.narratorId);
    });
    push(sessionVoiceId(session.id, 'transition'), session.transition.line, session.transition.narratorId);
    push(sessionVoiceId(session.id, 'closing'), session.closing.line, session.closing.narratorId);
  }

  return lines;
}
