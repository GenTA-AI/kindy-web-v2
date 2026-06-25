// 20분 게임 루프 공용 타입.
// 0016_game_events.sql 컬럼과 1:1 대응하는 필드는 DB 와 동일한 snake_case 를 유지한다.

export type GameType =
  | 'G1_match'
  | 'G2_sort'
  | 'G3_sequence'
  | 'G4_listen'
  | 'G5_find'
  | 'Q_quiz'
  | 'emotion_expression'
  // 콘텐츠 세계용 신규 활동 (동물 마을): 관찰형 숨은 친구 찾기 + 창작형 꾸미기.
  | 'hidden_friend'
  | 'decorate';

/** PRD §6 MVP 활성 게임 타입: G1 + G2 + Q + 잠긴 감정표현 슬롯. */
export const PHASE1_GAME_TYPES = [
  'G1_match',
  'G2_sort',
  'Q_quiz',
  'emotion_expression',
] as const satisfies readonly GameType[];

/** 커리큘럼 기준 태그. interpretive=true 는 원문 기준과 해석적 연결임을 뜻한다. */
export interface CurriculumTag {
  objective_code: string;
  objective_label_ko: string;
  standard_anchor: string;
  standard_source: 'nuri' | 'curriculum_2022';
  interpretive: boolean;
}

/** 템플릿과 파라미터 입력. */
export interface GameRoundParams {
  seed: number;
  difficulty: number;
  asset_pool_id: string;
  item_count: number;
  time_limit_sec?: number;
}

/** 세션 막(act) — 정서 사건 해결(emotion) → 나만의 방법 만들기(creativity). */
export type SessionAct = 'emotion' | 'creativity';

/** 완전히 계획된 1개 라운드. */
export interface GameRoundSpec {
  round_index: number;
  game_type: GameType;
  params: GameRoundParams;
  tag: CurriculumTag;
  topic: string;
  /** 2막 staged 세션에서 이 라운드가 속한 막. 레거시 토픽은 'emotion' 기본. */
  phase: SessionAct;
}

/** 보상 델타. 차감 없이 더하는 변경만 표현한다. */
export interface RewardDelta {
  stars: number;
  stickers: string[];
  collection_unlocks: string[];
}

/** game_rounds 적재에 맞춘 라운드 결과. */
export interface GameRoundResult {
  game_type: GameType;
  difficulty: number;
  objective_code: string | null;
  standard_anchor: string | null;
  score: number | null;
  max_score: number | null;
  latency_ms: number | null;
  retried: boolean;
  reward_payload: RewardDelta | null;
}

/** 누적 보상/컬렉션 상태. */
export interface CollectionState {
  total_stars: number;
  stickers: string[];
  collection: Record<string, number>;
}

/** 홈/키오스크 게임 루프 이벤트. */
export interface GameEvent {
  type: 'game_started' | 'game_round_completed' | 'game_completed' | 'collection_progress';
  round_index?: number;
  result?: GameRoundResult;
  payload?: Record<string, unknown>;
}

/**
 * 부모 리포트용 관찰 가능 활동 수. 기분/정서 판정·점수·능력 단정으로 사용하지 않는다.
 * skill_key 는 내부 식별자(코드), label_ko 는 부모 노출용 미래역량 구체어.
 */
export type FutureSkillKey =
  | 'self_directed'   // 자기주도 활동·꾸준함
  | 'persistence'     // 끈기 (다시 도전)
  | 'problem_solving' // 문제해결·표현 (퍼즐·창작)
  | 'communication'   // 소통·표현력 (정서표현·발화)
  | 'curiosity';      // 호기심 (새 시도)

export interface SelActivityCount {
  skill_key: FutureSkillKey;
  label_ko: string;
  icon: string;
  /** 부모 노출용 활동 표현 (예: 'N번 활동', 'N번 다시 도전'). */
  unit_ko: string;
  count: number;
}
