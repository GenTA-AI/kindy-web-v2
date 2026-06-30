// Core types for eduvid

export interface Child {
  id: string;
  name: string;
  age: number;
  parent_id: string;
  styles: string[];
  topics: string[];
  created_at: string;
}

/** 비디오 생성 파이프라인 단계 */
export type VideoPhase =
  | 'director'          // Claude Opus 대본 생성
  | 'refs'              // nano-banana-pro 캐릭터 레퍼런스 시트
  | 'keyframes'         // 각 씬 첫 키프레임
  | 'video_s01'         // Seedance 2.0 첫 15s 생성
  | 'video_s02'         // Video Extension 으로 2번째 15s (30s+ 영상 시)
  | 'concat'            // ffmpeg concat
  | 'upload'            // Supabase Storage 업로드
  | 'done';

/** 파이프라인 단계별 비용 breakdown */
export interface CostLedger {
  director?: number;
  refs?: number;
  keyframes?: number;
  video_s01?: number;
  video_s02?: number;
  concat?: number;
  upload?: number;
  total?: number;
}

export interface Video {
  id: string;
  child_id: string;
  title: string;
  description: string;
  video_url: string | null;
  thumbnail_url: string | null;
  /** 상위 상태. 세부 진행 단계는 `phase`. */
  status: 'queued' | 'generating' | 'ready' | 'failed';
  duration_sec: number | null;
  prompt_used: string | null;
  adjectives_used: string[];
  style_tags: string[];
  topic: string;
  episode_number: number;
  created_at: string;

  // 파이프라인 운영 컬럼 (migration 0002)
  request_id: string;
  cost_ledger: CostLedger;
  provider_used: string | null;
  error_reason: string | null;
  attempt_count: number;
  elapsed_ms: number | null;
  phase: VideoPhase | null;
  progress_pct: number;
  /** Claude director 결과 VideoScript (JSON) */
  script: unknown | null;
  /** Seedance seed (재현성) */
  seed: number | null;
  /** Storage 내부 경로 — signed URL 재발급용 */
  video_path: string | null;
  last_attempt_at: string | null;
}

export interface ViewEvent {
  id: string;
  video_id: string;
  child_id: string;
  event_type: 'play' | 'pause' | 'seek_forward' | 'seek_backward' | 'segment_replay' | 'drop_off' | 'complete';
  timestamp_sec: number;
  segment_start?: number;
  segment_end?: number;
  created_at: string;
}

export interface EmojiReaction {
  id: string;
  video_id: string;
  child_id: string;
  reaction: 'happy' | 'neutral' | 'sad';
  created_at: string;
}

export interface QuizResult {
  id: string;
  video_id: string;
  child_id: string;
  question: string;
  options: string[];
  correct_answer: number;
  selected_answer: number;
  is_correct: boolean;
  created_at: string;
}

export interface WordProfile {
  child_id: string;
  preferred_adjectives: string[];
  avoid_adjectives: string[];
  weights: Record<string, number>;
  updated_at: string;
}

export interface GACS3Output {
  preferred_styles: Array<{ tag: string; weight: number }>;
  preferred_scene_types: string[];
  optimal_duration: number;
  word_profile: WordProfile;
}

// Style options for onboarding: 아이가 고르는 이야기 숲 입구.
export const STYLE_OPTIONS = [
  { id: 'story_forest', label: '속삭이는 숲길', description: '친구 마음을 살피는 이야기' },
  { id: 'water_lab', label: '물방울 실험터', description: '왜 그럴까를 찾아보는 놀이' },
  { id: 'pattern_hill', label: '무늬 언덕', description: '규칙과 짝을 발견하는 놀이' },
  { id: 'star_workshop', label: '별빛 작업실', description: '내 방법으로 꾸미고 만드는 시간' },
] as const;

// Topic options.
// 미래역량 = 정서·표현 + 상상·문제해결을 한 이야기로 엮는 ONE 통합 프로그램(future_skills).
// 정서/창의를 따로 택1하지 않는다 — 매 세션이 두 차원을 함께 다룬다.
// 사용자 노출 라벨은 포지셔닝 규칙(사고력·문제해결·표현·자신감)을 따른다.
// 내부 식별자(future_skills / sel_emotion / creativity)는 코드 키로만 사용.
export const TOPIC_OPTIONS = [
  { id: 'future_skills', label: '생각하는 힘 키우기' },
  // 내부 호환용 — 온보딩 노출 X (future_skills 가 두 차원을 함께 다룸).
  { id: 'sel_emotion', label: '마음·표현력 키우기' },
  { id: 'creativity', label: '상상·문제해결 키우기' },
  { id: 'science', label: '과학 탐구' },
  { id: 'english', label: '영어' },
] as const;

// 나이별 과학탐구 커리큘럼 (누리과정 + 초등 과학 교육과정 기반)
export const SCIENCE_CURRICULUM: Record<number, {
  theme: string;
  description: string;
  episodes: Array<{ title: string; concept: string; quiz: Array<{ question: string; options: string[]; correctAnswer: number }> }>;
}> = {
  3: {
    theme: '감각 탐구',
    description: '주변 사물을 오감으로 탐색해요',
    episodes: [
      {
        title: '빨간 건 뭐가 있을까?',
        concept: '색깔을 관찰하고 분류하기',
        quiz: [
          { question: '사과는 무슨 색일까요?', options: ['빨간색', '파란색'], correctAnswer: 0 },
          { question: '하늘은 무슨 색일까요?', options: ['초록색', '파란색'], correctAnswer: 1 },
        ],
      },
      {
        title: '만져보면 어떤 느낌일까?',
        concept: '촉감의 차이 알아보기',
        quiz: [
          { question: '솜은 어떤 느낌일까요?', options: ['부드러워요', '딱딱해요'], correctAnswer: 0 },
          { question: '돌멩이는 어떤 느낌일까요?', options: ['말랑해요', '딱딱해요'], correctAnswer: 1 },
        ],
      },
      {
        title: '어떤 소리가 들려?',
        concept: '소리를 듣고 구별하기',
        quiz: [
          { question: '강아지는 어떤 소리를 낼까요?', options: ['멍멍', '야옹'], correctAnswer: 0 },
          { question: '비가 오면 어떤 소리가 날까요?', options: ['주르륵', '쿵쿵'], correctAnswer: 0 },
        ],
      },
    ],
  },
  4: {
    theme: '동물과 식물',
    description: '생명체의 특징과 성장을 관찰해요',
    episodes: [
      {
        title: '숲에는 누가 살고 있을까?',
        concept: '다양한 동물의 생김새와 특징',
        quiz: [
          { question: '토끼의 귀는 어떤 모양일까요?', options: ['길쭉해요', '동그래요'], correctAnswer: 0 },
          { question: '다람쥐는 뭘 좋아할까요?', options: ['도토리', '생선'], correctAnswer: 0 },
        ],
      },
      {
        title: '씨앗이 꽃이 되는 비밀',
        concept: '식물의 성장 과정',
        quiz: [
          { question: '식물이 자라려면 뭐가 필요할까요?', options: ['물과 햇빛', '바람과 돌'], correctAnswer: 0 },
          { question: '씨앗 다음에 뭐가 나올까요?', options: ['싹', '꽃'], correctAnswer: 0 },
        ],
      },
      {
        title: '물속에도 친구가 있어!',
        concept: '수중 생물 관찰하기',
        quiz: [
          { question: '물고기는 뭘로 숨을 쉴까요?', options: ['아가미', '코'], correctAnswer: 0 },
          { question: '문어 다리는 몇 개일까요?', options: ['8개', '4개'], correctAnswer: 0 },
        ],
      },
    ],
  },
  5: {
    theme: '물과 날씨',
    description: '자연현상의 원리를 알아봐요',
    episodes: [
      {
        title: '비는 왜 올까?',
        concept: '물의 순환과 날씨의 원리',
        quiz: [
          { question: '구름은 뭘로 만들어질까요?', options: ['작은 물방울', '솜'], correctAnswer: 0 },
          { question: '비가 오기 전에 하늘은?', options: ['어두워져요', '밝아져요'], correctAnswer: 0 },
        ],
      },
      {
        title: '얼음이 사라졌어!',
        concept: '물의 세 가지 상태 변화',
        quiz: [
          { question: '물을 얼리면 뭐가 될까요?', options: ['얼음', '수증기'], correctAnswer: 0 },
          { question: '물을 끓이면 뭐가 올라올까요?', options: ['김(수증기)', '거품'], correctAnswer: 0 },
        ],
      },
      {
        title: '무지개는 어떻게 생길까?',
        concept: '빛과 색의 원리',
        quiz: [
          { question: '무지개는 언제 볼 수 있을까요?', options: ['비 온 뒤 햇빛이 나올 때', '밤에'], correctAnswer: 0 },
          { question: '무지개는 몇 가지 색일까요?', options: ['일곱 가지', '세 가지'], correctAnswer: 0 },
        ],
      },
    ],
  },
  6: {
    theme: '우주와 지구',
    description: '지구 밖 우주의 신비를 탐험해요',
    episodes: [
      {
        title: '달은 왜 모양이 바뀔까?',
        concept: '달의 위상 변화',
        quiz: [
          { question: '달이 동그랗게 보이는 건?', options: ['보름달', '반달'], correctAnswer: 0 },
          { question: '달은 스스로 빛을 낼까요?', options: ['아니요, 햇빛을 반사해요', '네, 빛나요'], correctAnswer: 0 },
        ],
      },
      {
        title: '낮과 밤은 왜 생길까?',
        concept: '지구의 자전',
        quiz: [
          { question: '지구가 뭘 하면 낮과 밤이 생길까요?', options: ['빙글빙글 돌아요', '위아래로 움직여요'], correctAnswer: 0 },
          { question: '해가 뜨면 뭐가 될까요?', options: ['낮', '밤'], correctAnswer: 0 },
        ],
      },
      {
        title: '태양계 친구들을 만나자',
        concept: '태양계 행성의 특징',
        quiz: [
          { question: '태양에서 가장 가까운 행성은?', options: ['수성', '지구'], correctAnswer: 0 },
          { question: '고리가 있는 행성은?', options: ['토성', '화성'], correctAnswer: 0 },
        ],
      },
    ],
  },
  7: {
    theme: '힘과 운동',
    description: '놀이 속에서 과학 원리를 발견해요',
    episodes: [
      {
        title: '왜 미끄럼틀에서 내려갈까?',
        concept: '중력의 기본 개념',
        quiz: [
          { question: '물건을 놓으면 왜 아래로 떨어질까요?', options: ['지구가 잡아당기니까', '바람이 부니까'], correctAnswer: 0 },
          { question: '높은 곳에서 공을 떨어뜨리면?', options: ['아래로 떨어져요', '옆으로 가요'], correctAnswer: 0 },
        ],
      },
      {
        title: '자석의 신기한 힘',
        concept: '자석의 성질과 활용',
        quiz: [
          { question: '자석에 붙는 것은?', options: ['철 클립', '나무 블록'], correctAnswer: 0 },
          { question: '자석의 같은 극을 가까이 하면?', options: ['밀어내요', '붙어요'], correctAnswer: 0 },
        ],
      },
      {
        title: '빠르게, 느리게, 멈춰!',
        concept: '속력과 마찰력',
        quiz: [
          { question: '얼음 위에서 왜 잘 미끄러질까요?', options: ['마찰이 적으니까', '바람이 부니까'], correctAnswer: 0 },
          { question: '자전거 브레이크는 뭘 이용할까요?', options: ['마찰력', '중력'], correctAnswer: 0 },
        ],
      },
    ],
  },
  8: {
    theme: '생물의 한살이',
    description: '생물이 태어나고 자라는 과정을 관찰해요',
    episodes: [
      {
        title: '나비는 어떻게 태어날까?',
        concept: '곤충의 완전변태',
        quiz: [
          { question: '나비가 되기 전 단계는?', options: ['번데기', '알'], correctAnswer: 0 },
          { question: '애벌레 다음은 뭘까요?', options: ['번데기', '나비'], correctAnswer: 0 },
        ],
      },
      {
        title: '개구리의 놀라운 변신',
        concept: '양서류의 변태 과정',
        quiz: [
          { question: '올챙이가 자라면 뭐가 될까요?', options: ['개구리', '물고기'], correctAnswer: 0 },
          { question: '올챙이는 뭘로 숨을 쉴까요?', options: ['아가미', '폐'], correctAnswer: 0 },
        ],
      },
      {
        title: '콩 한 알의 여행',
        concept: '식물의 한살이와 씨앗의 여행',
        quiz: [
          { question: '민들레 씨앗은 어떻게 이동할까요?', options: ['바람을 타고', '땅속으로'], correctAnswer: 0 },
          { question: '씨앗이 자라려면 뭐가 필요할까요?', options: ['물, 햇빛, 흙', '바람, 돌, 모래'], correctAnswer: 0 },
        ],
      },
    ],
  },
};

// 나이별 영어 커리큘럼 (유아 영어교육 단계 기반)
export const ENGLISH_CURRICULUM: Record<number, {
  theme: string;
  description: string;
  episodes: Array<{ title: string; concept: string; quiz: Array<{ question: string; options: string[]; correctAnswer: number }> }>;
}> = {
  3: {
    theme: '영어 소리 놀이',
    description: '영어 소리에 친숙해져요',
    episodes: [
      {
        title: 'Hello! Hi! Bye!',
        concept: '영어 인사 소리 따라 하기',
        quiz: [
          { question: '만났을 때 뭐라고 할까요?', options: ['Hello!', 'Bye!'], correctAnswer: 0 },
          { question: '헤어질 때 뭐라고 할까요?', options: ['Bye!', 'Hello!'], correctAnswer: 0 },
        ],
      },
      {
        title: 'ABC Song',
        concept: '알파벳 노래 따라 부르기',
        quiz: [
          { question: 'A 다음에 오는 글자는?', options: ['B', 'C'], correctAnswer: 0 },
          { question: '알파벳은 모두 몇 개일까요?', options: ['26개', '10개'], correctAnswer: 0 },
        ],
      },
      {
        title: 'Animal Sounds',
        concept: '동물 소리를 영어로 배우기',
        quiz: [
          { question: '강아지는 영어로 뭐라고 울까요?', options: ['Woof woof', 'Meow'], correctAnswer: 0 },
          { question: '고양이는 영어로 뭐라고 울까요?', options: ['Meow', 'Moo'], correctAnswer: 0 },
        ],
      },
    ],
  },
  4: {
    theme: '알파벳 인식',
    description: '글자 모양과 소리를 연결해요',
    episodes: [
      {
        title: 'A is for Apple (A~F)',
        concept: 'A부터 F까지 글자와 단어 연결',
        quiz: [
          { question: 'Apple의 첫 글자는?', options: ['A', 'B'], correctAnswer: 0 },
          { question: 'Cat의 첫 글자는?', options: ['C', 'D'], correctAnswer: 0 },
        ],
      },
      {
        title: 'G is for Giraffe (G~L)',
        concept: 'G부터 L까지 글자와 단어 연결',
        quiz: [
          { question: 'Ice cream의 첫 글자는?', options: ['I', 'H'], correctAnswer: 0 },
          { question: 'Lion의 첫 글자는?', options: ['L', 'K'], correctAnswer: 0 },
        ],
      },
      {
        title: 'M is for Moon (M~R)',
        concept: 'M부터 R까지 글자와 단어 연결',
        quiz: [
          { question: 'Moon의 첫 글자는?', options: ['M', 'N'], correctAnswer: 0 },
          { question: 'Rainbow의 첫 글자는?', options: ['R', 'P'], correctAnswer: 0 },
        ],
      },
    ],
  },
  5: {
    theme: '파닉스 기초',
    description: '글자가 내는 소리를 배워요',
    episodes: [
      {
        title: 'Cat, Bat, Hat',
        concept: '짧은 a 소리 (Short A)',
        quiz: [
          { question: 'Cat에서 가운데 소리는?', options: ['아(a)', '오(o)'], correctAnswer: 0 },
          { question: 'Hat과 같은 소리가 나는 단어는?', options: ['Bat', 'Dog'], correctAnswer: 0 },
        ],
      },
      {
        title: 'Dog, Log, Fog',
        concept: '짧은 o 소리 (Short O)',
        quiz: [
          { question: 'Dog에서 가운데 소리는?', options: ['오(o)', '아(a)'], correctAnswer: 0 },
          { question: 'Log와 같은 소리가 나는 단어는?', options: ['Fog', 'Cat'], correctAnswer: 0 },
        ],
      },
      {
        title: 'Sun, Fun, Run',
        concept: '짧은 u 소리 (Short U)',
        quiz: [
          { question: 'Sun에서 가운데 소리는?', options: ['어(u)', '이(i)'], correctAnswer: 0 },
          { question: 'Fun과 같은 소리가 나는 단어는?', options: ['Run', 'Dog'], correctAnswer: 0 },
        ],
      },
    ],
  },
  6: {
    theme: '단어 읽기',
    description: '3~4글자 단어를 읽어요',
    episodes: [
      {
        title: 'Color Words',
        concept: 'Red, Blue, Green 색깔 단어 읽기',
        quiz: [
          { question: '빨간색은 영어로?', options: ['Red', 'Blue'], correctAnswer: 0 },
          { question: '초록색은 영어로?', options: ['Green', 'Yellow'], correctAnswer: 0 },
        ],
      },
      {
        title: 'Number Words',
        concept: 'One부터 Ten까지 숫자 단어',
        quiz: [
          { question: '3은 영어로?', options: ['Three', 'Five'], correctAnswer: 0 },
          { question: '7은 영어로?', options: ['Seven', 'Nine'], correctAnswer: 0 },
        ],
      },
      {
        title: 'My Body',
        concept: 'Head, Hand, Foot 신체 부위 단어',
        quiz: [
          { question: '머리는 영어로?', options: ['Head', 'Hand'], correctAnswer: 0 },
          { question: '발은 영어로?', options: ['Foot', 'Eye'], correctAnswer: 0 },
        ],
      },
    ],
  },
  7: {
    theme: '짧은 문장',
    description: '주어+동사 문장을 말해요',
    episodes: [
      {
        title: 'I like ~',
        concept: '좋아하는 것 말하기',
        quiz: [
          { question: '"나는 사과를 좋아해"를 영어로?', options: ['I like apples', 'I am apples'], correctAnswer: 0 },
          { question: '"나는 고양이를 좋아해"를 영어로?', options: ['I like cats', 'I see cats'], correctAnswer: 0 },
        ],
      },
      {
        title: 'I can ~',
        concept: '할 수 있는 것 말하기',
        quiz: [
          { question: '"나는 달릴 수 있어"를 영어로?', options: ['I can run', 'I like run'], correctAnswer: 0 },
          { question: '"나는 노래할 수 있어"를 영어로?', options: ['I can sing', 'I am sing'], correctAnswer: 0 },
        ],
      },
      {
        title: 'I see ~',
        concept: '보이는 것 말하기',
        quiz: [
          { question: '"나는 별이 보여"를 영어로?', options: ['I see stars', 'I like stars'], correctAnswer: 0 },
          { question: '"나는 나무가 보여"를 영어로?', options: ['I see a tree', 'I can tree'], correctAnswer: 0 },
        ],
      },
    ],
  },
  8: {
    theme: '대화와 표현',
    description: '짧은 대화를 주고받아요',
    episodes: [
      {
        title: "What's your name?",
        concept: '자기소개 대화',
        quiz: [
          { question: '"이름이 뭐야?"를 영어로?', options: ["What's your name?", 'How are you?'], correctAnswer: 0 },
          { question: '"내 이름은 서연이야"를 영어로?', options: ['My name is Seoyeon', 'I am name Seoyeon'], correctAnswer: 0 },
        ],
      },
      {
        title: "How's the weather?",
        concept: '날씨 대화',
        quiz: [
          { question: '"날씨가 어때?"를 영어로?', options: ["How's the weather?", "What's your name?"], correctAnswer: 0 },
          { question: '"맑아"를 영어로?', options: ["It's sunny", "It's rainy"], correctAnswer: 0 },
        ],
      },
      {
        title: 'What do you want?',
        concept: '원하는 것 표현하기',
        quiz: [
          { question: '"뭘 원해?"를 영어로?', options: ['What do you want?', 'What is your name?'], correctAnswer: 0 },
          { question: '"물 주세요"를 영어로?', options: ['Water, please', 'Water, thank you'], correctAnswer: 0 },
        ],
      },
    ],
  },
};

// 정서·표현(SEL) 트랙 커리큘럼 — 꼬꼬 마을 시즌1 주차 아크 기반.
// 부모 노출 라벨은 미래역량 구체어(자신감·감정표현·사회성), 내부 키는 sel_emotion.
export const SEL_EMOTION_CURRICULUM: Record<number, {
  theme: string;
  description: string;
  episodes: Array<{ title: string; concept: string; quiz: Array<{ question: string; options: string[]; correctAnswer: number }> }>;
}> = {
  3: {
    theme: '내 마음 알아채기',
    description: '내 마음에 이름을 붙여 표현해요',
    episodes: [
      {
        title: '꼬꼬는 지금 어떤 마음일까?',
        concept: '기쁨·슬픔 같은 기본 감정 알아채기',
        quiz: [
          { question: '웃고 있을 때는 어떤 마음일까요?', options: ['기뻐요', '슬퍼요'], correctAnswer: 0 },
          { question: '눈물이 날 때는 어떤 마음일까요?', options: ['슬퍼요', '신나요'], correctAnswer: 0 },
        ],
      },
      {
        title: '친구 표정을 읽어요',
        concept: '친구 표정 보고 마음 짐작하기(공감)',
        quiz: [
          { question: '친구가 울고 있으면 어떤 마음일까요?', options: ['슬퍼요', '기뻐요'], correctAnswer: 0 },
          { question: '친구가 활짝 웃으면 어떤 마음일까요?', options: ['기뻐요', '화나요'], correctAnswer: 0 },
        ],
      },
      {
        title: '같이 쓰면 더 즐거워',
        concept: '나누고 차례 기다리기(소통)',
        quiz: [
          { question: '장난감을 같이 쓰려면 어떻게 할까요?', options: ['차례를 정해요', '혼자 가져요'], correctAnswer: 0 },
          { question: '친구가 도와줬을 때 할 말은?', options: ['고마워', '싫어'], correctAnswer: 0 },
        ],
      },
    ],
  },
  4: {
    theme: '친구 마음 읽고 공감하기',
    description: '친구의 마음을 읽고 다정하게 표현해요',
    episodes: [
      {
        title: '삐약이가 울고 있어',
        concept: '친구 표정 읽고 공감하기',
        quiz: [
          { question: '슬퍼하는 친구에게 어떤 말을 할까요?', options: ['괜찮아?', '저리 가'], correctAnswer: 0 },
          { question: '친구를 위로하는 방법은?', options: ['옆에 있어주기', '모른 척하기'], correctAnswer: 0 },
        ],
      },
      {
        title: '조금만 기다려 볼까?',
        concept: '조급한 마음 다스리고 기다리기',
        quiz: [
          { question: '내 차례가 아닐 때는?', options: ['기다려요', '새치기해요'], correctAnswer: 0 },
          { question: '화가 날 때 먼저 할 일은?', options: ['숨을 천천히 쉬어요', '소리 질러요'], correctAnswer: 0 },
        ],
      },
      {
        title: '같이 나누는 마을 잔치',
        concept: '나눔과 소통으로 함께하기',
        quiz: [
          { question: '간식이 하나 남았을 때는?', options: ['나눠 먹어요', '내가 다 먹어요'], correctAnswer: 0 },
          { question: '다툰 친구와 화해하려면?', options: ['미안하다고 말해요', '말 안 해요'], correctAnswer: 0 },
        ],
      },
    ],
  },
  5: {
    theme: '내 마음 알아채고 표현하기',
    description: '내 마음을 알아채고 친구 마음에 공감해요',
    episodes: [
      {
        title: '낯선 마을에 도착한 꼬꼬',
        concept: '설렘·불안 같은 내 감정 알아채기(자기인식)',
        quiz: [
          { question: '새로운 곳에 가면 어떤 마음이 들까요?', options: ['설레고 조금 떨려요', '아무 마음도 없어요'], correctAnswer: 0 },
          { question: '내 마음을 알면 좋은 점은?', options: ['표현할 수 있어요', '없어요'], correctAnswer: 0 },
        ],
      },
      {
        title: '삐약이가 울고 있어',
        concept: '친구 표정 읽고 공감하기(사회적 인식)',
        quiz: [
          { question: '친구가 어깨를 늘어뜨리면 어떤 마음일까요?', options: ['속상해요', '신나요'], correctAnswer: 0 },
          { question: '슬픈 친구 옆에서 할 수 있는 일은?', options: ['이야기를 들어줘요', '놀려요'], correctAnswer: 0 },
        ],
      },
      {
        title: '두근두근 알 깨기 대회',
        concept: '조급함 다스리고 기다리기(자기관리)',
        quiz: [
          { question: '기다리는 게 힘들 때는?', options: ['천천히 숨을 쉬어요', '포기해요'], correctAnswer: 0 },
          { question: '실망했을 때 마음을 다루는 법은?', options: ['괜찮아 하고 다시 해요', '화를 내요'], correctAnswer: 0 },
        ],
      },
      {
        title: '마을 잔치 준비 대소동',
        concept: '다툼 풀고 나누기(소통·관계)',
        quiz: [
          { question: '친구와 의견이 다를 때는?', options: ['서로 이야기해요', '내 말만 해요'], correctAnswer: 0 },
          { question: '함께 일할 때 좋은 말은?', options: ['같이 하자', '너 혼자 해'], correctAnswer: 0 },
        ],
      },
    ],
  },
  6: {
    theme: '감정 다루고 함께하기',
    description: '어려운 마음을 다루고 친구와 마음을 나눠요',
    episodes: [
      {
        title: '비 오는 날의 마음',
        concept: '실망한 마음 다루기(자기관리)',
        quiz: [
          { question: '계획이 틀어졌을 때 할 수 있는 말은?', options: ['괜찮아, 다른 방법이 있어', '다 망했어'], correctAnswer: 0 },
          { question: '속상한 마음을 가라앉히는 방법은?', options: ['깊게 숨 쉬기', '발 구르기'], correctAnswer: 0 },
        ],
      },
      {
        title: '안개 숲의 용기',
        concept: '무서운 마음 이겨내기(자기관리)',
        quiz: [
          { question: '무서울 때 도움이 되는 건?', options: ['친구와 함께 가기', '혼자 숨기'], correctAnswer: 0 },
          { question: '용기를 내는 첫걸음은?', options: ['작게 한 번 해보기', '아예 안 하기'], correctAnswer: 0 },
        ],
      },
      {
        title: '꼬꼬의 비밀 선물',
        concept: '배려와 고마움 전하기(관계·책임)',
        quiz: [
          { question: '도움을 받았을 때 전할 마음은?', options: ['고마운 마음', '미운 마음'], correctAnswer: 0 },
          { question: '친구를 배려하는 행동은?', options: ['먼저 양보하기', '먼저 가지기'], correctAnswer: 0 },
        ],
      },
    ],
  },
  7: {
    theme: '두 마음 함께 느끼기',
    description: '내 마음과 친구 마음을 함께 헤아려요',
    episodes: [
      {
        title: '우리 마을 이야기책',
        concept: '내 감정과 친구 감정을 함께 느끼기(종합)',
        quiz: [
          { question: '나는 신나지만 친구는 속상할 때는?', options: ['친구 마음도 살펴요', '내 기분만 챙겨요'], correctAnswer: 0 },
          { question: '서로 다른 마음을 알면 좋은 점은?', options: ['더 잘 어울려요', '없어요'], correctAnswer: 0 },
        ],
      },
      {
        title: '함께 정한 약속',
        concept: '소통하며 갈등 풀기(관계 기술)',
        quiz: [
          { question: '의견이 부딪힐 때 좋은 방법은?', options: ['서로의 이유를 들어요', '큰 소리로 말해요'], correctAnswer: 0 },
          { question: '약속을 지키면 어떤 점이 좋을까요?', options: ['서로 믿을 수 있어요', '아무 일 없어요'], correctAnswer: 0 },
        ],
      },
      {
        title: '마음을 말로 전하기',
        concept: '내 마음 또렷이 표현하기(표현력)',
        quiz: [
          { question: '속상할 때 좋은 표현은?', options: ['나는 ~해서 속상해', '아무 말 안 하기'], correctAnswer: 0 },
          { question: '내 마음을 말하면 좋은 점은?', options: ['친구가 알아줘요', '없어요'], correctAnswer: 0 },
        ],
      },
    ],
  },
  8: {
    theme: '마음을 이끄는 힘',
    description: '내 감정을 다루고 친구와 함께 문제를 풀어요',
    episodes: [
      {
        title: '함께 푸는 다툼',
        concept: '갈등을 대화로 해결하기(관계 기술)',
        quiz: [
          { question: '친구와 싸웠을 때 먼저 할 일은?', options: ['차분히 이야기 나누기', '계속 화내기'], correctAnswer: 0 },
          { question: '둘 다 만족하는 방법은?', options: ['서로 조금씩 양보', '한 명만 이기기'], correctAnswer: 0 },
        ],
      },
      {
        title: '나를 다독이는 말',
        concept: '스스로 감정 다루기(자기관리)',
        quiz: [
          { question: '실수했을 때 나에게 할 말은?', options: ['다음엔 더 잘할 수 있어', '나는 안 돼'], correctAnswer: 0 },
          { question: '긴장될 때 도움이 되는 건?', options: ['천천히 숨 쉬기', '눈 감고 멈추기'], correctAnswer: 0 },
        ],
      },
      {
        title: '서로를 돕는 마을',
        concept: '배려와 협력으로 함께하기(사회성)',
        quiz: [
          { question: '힘든 친구를 보면?', options: ['먼저 도와줘요', '지나가요'], correctAnswer: 0 },
          { question: '함께 해내면 좋은 점은?', options: ['더 큰 일도 해내요', '없어요'], correctAnswer: 0 },
        ],
      },
    ],
  },
};

// 상상·문제해결(창의) 트랙 커리큘럼 — Torrance 4요소(유창성·융통성·독창성·정교성) 기반.
// 부모 노출 라벨은 미래역량 구체어(창의력·문제해결·사고력), 내부 키는 creativity.
// 창작·확산적 사고 활동 = 정답이 하나가 아닌 '여러 방법 떠올리기' 중심.
export const CREATIVITY_CURRICULUM: Record<number, {
  theme: string;
  description: string;
  episodes: Array<{ title: string; concept: string; quiz: Array<{ question: string; options: string[]; correctAnswer: number }> }>;
}> = {
  3: {
    theme: '여러 방법 떠올리기',
    description: '한 가지 일도 여러 방법으로 생각해요',
    episodes: [
      {
        title: '꼬꼬의 여러 가지 인사',
        concept: '아이디어 많이 떠올리기(유창성)',
        quiz: [
          { question: '인사는 한 가지 방법뿐일까요?', options: ['여러 가지가 있어요', '하나뿐이에요'], correctAnswer: 0 },
          { question: '손을 흔드는 것도 인사일까요?', options: ['네', '아니요'], correctAnswer: 0 },
        ],
      },
      {
        title: '블록으로 뭐든지!',
        concept: '같은 재료로 다르게 만들기(융통성)',
        quiz: [
          { question: '블록으로 만들 수 있는 건?', options: ['집도, 다리도', '집만'], correctAnswer: 0 },
          { question: '한 가지로 막혔을 때는?', options: ['다른 방법을 찾아요', '그만둬요'], correctAnswer: 0 },
        ],
      },
      {
        title: '나만의 그림',
        concept: '나만의 방법으로 꾸미기(독창성)',
        quiz: [
          { question: '하늘은 꼭 파란색만 칠해야 할까요?', options: ['내 마음대로 칠해요', '파란색만요'], correctAnswer: 0 },
          { question: '내가 만든 게 친구와 다르면?', options: ['멋진 거예요', '틀린 거예요'], correctAnswer: 0 },
        ],
      },
    ],
  },
  4: {
    theme: '나만의 방법 만들기',
    description: '문제를 나만의 방법으로 풀어봐요',
    episodes: [
      {
        title: '비를 막는 발명품',
        concept: '나만의 도구 만들기(독창성)',
        quiz: [
          { question: '비를 막으려면 무엇이 필요할까요?', options: ['우산 같은 것을 만들어요', '그냥 맞아요'], correctAnswer: 0 },
          { question: '없는 물건은 어떻게 할까요?', options: ['있는 걸로 만들어요', '포기해요'], correctAnswer: 0 },
        ],
      },
      {
        title: '길을 찾는 여러 방법',
        concept: '여러 해결 방법 떠올리기(융통성)',
        quiz: [
          { question: '길이 막히면 어떻게 할까요?', options: ['다른 길을 찾아요', '멈춰요'], correctAnswer: 0 },
          { question: '방법은 몇 가지일까요?', options: ['여러 가지', '하나뿐'], correctAnswer: 0 },
        ],
      },
      {
        title: '잔치 아이디어 모으기',
        concept: '아이디어 많이 내기(유창성)',
        quiz: [
          { question: '재미있는 잔치를 만들려면?', options: ['생각을 많이 내요', '하나만 정해요'], correctAnswer: 0 },
          { question: '친구 생각이 나와 다르면?', options: ['둘 다 좋아요', '내 것만 좋아요'], correctAnswer: 0 },
        ],
      },
    ],
  },
  5: {
    theme: '상상하고 만들기',
    description: '상상한 것을 나만의 방법으로 만들어요',
    episodes: [
      {
        title: '알에서 뭐가 나올까?',
        concept: '여러 가능성 상상하기(유창성)',
        quiz: [
          { question: '알에서 나올 수 있는 건?', options: ['상상한 만큼 많아요', '병아리뿐'], correctAnswer: 0 },
          { question: '상상은 정답이 있을까요?', options: ['여러 답이 있어요', '하나뿐'], correctAnswer: 0 },
        ],
      },
      {
        title: '위로하는 여러 가지 방법',
        concept: '여러 방법으로 생각하기(융통성)',
        quiz: [
          { question: '슬픈 친구를 위로하는 방법은?', options: ['여러 가지가 있어요', '하나뿐'], correctAnswer: 0 },
          { question: '한 방법이 안 통하면?', options: ['다른 방법을 써요', '포기해요'], correctAnswer: 0 },
        ],
      },
      {
        title: '비를 막을 나만의 도구',
        concept: '나만의 방법 만들기(독창성)',
        quiz: [
          { question: '나만의 발명품을 만들 때는?', options: ['내 생각대로 만들어요', '똑같이 따라 해요'], correctAnswer: 0 },
          { question: '실패하면 어떻게 할까요?', options: ['고쳐서 다시 해요', '그만둬요'], correctAnswer: 0 },
        ],
      },
      {
        title: '우리만의 이야기 꾸미기',
        concept: '자세히 꾸미고 정교화하기(정교성)',
        quiz: [
          { question: '이야기를 더 재미있게 하려면?', options: ['자세히 꾸며요', '짧게 끝내요'], correctAnswer: 0 },
          { question: '내가 더 넣고 싶은 게 있으면?', options: ['덧붙여 꾸며요', '그냥 둬요'], correctAnswer: 0 },
        ],
      },
    ],
  },
  6: {
    theme: '문제를 푸는 여러 길',
    description: '문제를 여러 방법으로 풀고 새롭게 만들어요',
    episodes: [
      {
        title: '안개 숲에서 길 찾기',
        concept: '여러 해결 방법 떠올리기(융통성)',
        quiz: [
          { question: '길을 못 찾을 때 좋은 생각은?', options: ['다른 방법도 떠올려요', '한 가지만 고집해요'], correctAnswer: 0 },
          { question: '방법이 많을수록?', options: ['풀 기회가 많아요', '더 헷갈려요'], correctAnswer: 0 },
        ],
      },
      {
        title: '나만의 선물 만들기',
        concept: '나만의 방법으로 만들기(독창성)',
        quiz: [
          { question: '특별한 선물을 만들려면?', options: ['나만의 아이디어를 넣어요', '똑같이 사요'], correctAnswer: 0 },
          { question: '아이디어가 떠오르지 않으면?', options: ['주변을 다시 살펴봐요', '안 해요'], correctAnswer: 0 },
        ],
      },
      {
        title: '이야기 더 꾸미기',
        concept: '자세히 더하고 다듬기(정교성)',
        quiz: [
          { question: '만든 것을 더 멋지게 하려면?', options: ['자세히 다듬어요', '그대로 둬요'], correctAnswer: 0 },
          { question: '작은 부분을 바꾸면?', options: ['더 새로워져요', '똑같아요'], correctAnswer: 0 },
        ],
      },
    ],
  },
  7: {
    theme: '새롭게 생각하기',
    description: '익숙한 것도 새로운 눈으로 바라봐요',
    episodes: [
      {
        title: '하나로 여러 가지 만들기',
        concept: '한 가지를 여러 용도로 생각하기(융통성)',
        quiz: [
          { question: '컵으로 할 수 있는 일은?', options: ['물 담기·모래 푸기 등 여러 가지', '물 담기만'], correctAnswer: 0 },
          { question: '평소와 다르게 쓰면?', options: ['새 아이디어가 돼요', '쓸모없어요'], correctAnswer: 0 },
        ],
      },
      {
        title: '나만의 발명 노트',
        concept: '독창적인 아이디어 만들기(독창성)',
        quiz: [
          { question: '아무도 생각 못 한 방법은?', options: ['멋진 독창성이에요', '이상한 거예요'], correctAnswer: 0 },
          { question: '아이디어를 더 키우려면?', options: ['적고 발전시켜요', '잊어버려요'], correctAnswer: 0 },
        ],
      },
      {
        title: '작품을 완성하기',
        concept: '끝까지 정교하게 다듬기(정교성)',
        quiz: [
          { question: '거의 다 만든 작품은?', options: ['세심하게 마무리해요', '대충 끝내요'], correctAnswer: 0 },
          { question: '꼼꼼히 다듬으면?', options: ['더 완성도가 높아져요', '똑같아요'], correctAnswer: 0 },
        ],
      },
    ],
  },
  8: {
    theme: '문제를 푸는 창의력',
    description: '복잡한 문제도 여러 방법으로 새롭게 풀어요',
    episodes: [
      {
        title: '막힌 문제 뚫기',
        concept: '여러 방법으로 문제 풀기(융통성)',
        quiz: [
          { question: '한 방법이 안 될 때는?', options: ['다른 방법을 시도해요', '바로 포기해요'], correctAnswer: 0 },
          { question: '문제를 푸는 좋은 태도는?', options: ['여러 길을 생각해요', '한 길만 봐요'], correctAnswer: 0 },
        ],
      },
      {
        title: '세상에 없던 아이디어',
        concept: '독창적으로 생각하기(독창성)',
        quiz: [
          { question: '남들과 다른 생각은?', options: ['소중한 아이디어예요', '틀린 거예요'], correctAnswer: 0 },
          { question: '아이디어를 모으려면?', options: ['많이 떠올려봐요', '하나만 정해요'], correctAnswer: 0 },
        ],
      },
      {
        title: '계획을 멋지게 다듬기',
        concept: '계획을 자세히 정교화하기(정교성)',
        quiz: [
          { question: '좋은 계획을 만들려면?', options: ['단계를 자세히 짜요', '대충 정해요'], correctAnswer: 0 },
          { question: '계획을 다듬으면?', options: ['더 잘 해낼 수 있어요', '달라지지 않아요'], correctAnswer: 0 },
        ],
      },
    ],
  },
};

// 통합 미래역량 커리큘럼(future_skills) — 꼬꼬 마을 시즌1.
// 핵심: 각 주차가 *감정 사건*(정서)과 *나만의 방법으로 해결*(창의)을 한 이야기 안에 함께 다룬다.
// 정서·창의를 분리하지 않는다. 부모 노출 라벨은 미래역량 구체어(사고력·문제해결·표현·자신감).
export const FUTURE_SKILLS_CURRICULUM: Record<number, {
  theme: string;
  description: string;
  episodes: Array<{ title: string; concept: string; quiz: Array<{ question: string; options: string[]; correctAnswer: number }> }>;
}> = {
  3: {
    theme: '내 마음 알아채고 표현하기',
    description: '마음을 알아채고 자세히 보며 표현해요',
    episodes: [
      {
        title: '꼬꼬의 마음과 자세히 보기',
        concept: '내 마음 알아채기(정서) + 자세히 관찰하기(창의: 관찰)',
        quiz: [
          { question: '웃고 있을 때는 어떤 마음일까요?', options: ['기뻐요', '슬퍼요'], correctAnswer: 0 },
          { question: '자세히 보면 무엇이 좋을까요?', options: ['숨은 것도 찾아요', '아무것도 없어요'], correctAnswer: 0 },
        ],
      },
      {
        title: '친구 표정 읽고 닮은 것 찾기',
        concept: '친구 마음 공감(정서) + 상상하고 닮은 것 찾기(창의: 상상·유추)',
        quiz: [
          { question: '친구가 울고 있으면 어떤 마음일까요?', options: ['슬퍼요', '기뻐요'], correctAnswer: 0 },
          { question: '동그란 구름은 무엇을 닮았을까요?', options: ['솜사탕 같아요', '닮은 게 없어요'], correctAnswer: 0 },
        ],
      },
      {
        title: '같이 무늬를 만들어요',
        concept: '나누고 차례 기다리기(정서) + 패턴 찾고 만들기(창의: 패턴)',
        quiz: [
          { question: '장난감을 같이 쓰려면?', options: ['차례를 정해요', '혼자 가져요'], correctAnswer: 0 },
          { question: '빨강·파랑·빨강 다음은?', options: ['파랑', '노랑'], correctAnswer: 0 },
        ],
      },
    ],
  },
  4: {
    theme: '마음 다루고 자세히 보며 만들기',
    description: '마음을 다루며 관찰하고 패턴으로 만들어요',
    episodes: [
      {
        title: '삐약이를 자세히 살펴봐',
        concept: '친구 마음 공감(정서) + 자세히 관찰하기(창의: 관찰)',
        quiz: [
          { question: '슬퍼하는 친구에게 할 말은?', options: ['괜찮아?', '저리 가'], correctAnswer: 0 },
          { question: '표정을 자세히 보면?', options: ['마음을 알 수 있어요', '알 수 없어요'], correctAnswer: 0 },
        ],
      },
      {
        title: '구름은 무엇을 닮았을까',
        concept: '실망한 마음 다루기(정서) + 상상하고 닮은 것 찾기(창의: 상상·유추)',
        quiz: [
          { question: '계획이 틀어졌을 때는?', options: ['다른 방법을 찾아요', '다 망했어 해요'], correctAnswer: 0 },
          { question: '뭉게구름은 무엇을 닮았을까요?', options: ['토끼 같아요', '닮은 게 없어요'], correctAnswer: 0 },
        ],
      },
      {
        title: '잔치 무늬 꾸미기',
        concept: '나눔·소통(정서) + 패턴 찾고 만들기(창의: 패턴)',
        quiz: [
          { question: '간식이 하나 남았을 때는?', options: ['나눠 먹어요', '내가 다 먹어요'], correctAnswer: 0 },
          { question: '줄무늬 다음에 줄무늬가 오면?', options: ['반복되는 무늬예요', '아무거나예요'], correctAnswer: 0 },
        ],
      },
    ],
  },
  5: {
    theme: '마음 알아채고 자세히 보며 만들기',
    description: '마음을 알아채고 관찰·패턴·도형으로 만들어요',
    episodes: [
      {
        title: '낯선 마을을 자세히 둘러봐',
        concept: '설렘·불안 알아채기(정서) + 자세히 관찰하기(창의: 관찰)',
        quiz: [
          { question: '새로운 곳에 가면 어떤 마음일까요?', options: ['설레고 조금 떨려요', '아무 마음도 없어요'], correctAnswer: 0 },
          { question: '자세히 둘러보면?', options: ['새로운 것을 발견해요', '아무것도 없어요'], correctAnswer: 0 },
        ],
      },
      {
        title: '삐약이 마음은 무엇을 닮았을까',
        concept: '친구 표정 읽고 공감(정서) + 상상하고 닮은 것 찾기(창의: 상상·유추)',
        quiz: [
          { question: '친구가 어깨를 늘어뜨리면?', options: ['속상해요', '신나요'], correctAnswer: 0 },
          { question: '축 처진 어깨는 무엇을 닮았나요?', options: ['시든 꽃 같아요', '닮은 게 없어요'], correctAnswer: 0 },
        ],
      },
      {
        title: '비를 막을 무늬 만들기',
        concept: '실망한 마음 다루기(정서) + 패턴 찾고 만들기(창의: 패턴)',
        quiz: [
          { question: '속상한 마음을 가라앉히려면?', options: ['깊게 숨 쉬기', '발 구르기'], correctAnswer: 0 },
          { question: '물방울·물방울 다음은?', options: ['물방울', '아무거나'], correctAnswer: 0 },
        ],
      },
      {
        title: '도형을 바꿔 잔치 꾸미기',
        concept: '다툼 풀고 나누기(정서) + 모양 바꾸고 만들기(창의: 변형·도형)',
        quiz: [
          { question: '친구와 의견이 다를 때는?', options: ['서로 이야기해요', '내 말만 해요'], correctAnswer: 0 },
          { question: '세모 두 개를 붙이면?', options: ['새 모양이 돼요', '그대로예요'], correctAnswer: 0 },
        ],
      },
    ],
  },
  6: {
    theme: '용기 내어 도형·색으로 만들기',
    description: '어려운 마음을 다루며 도형·색·콜라주로 만들어요',
    episodes: [
      {
        title: '안개 숲의 도형 길 찾기',
        concept: '무서운 마음 이겨내기(정서) + 모양 바꾸고 만들기(창의: 변형·도형)',
        quiz: [
          { question: '무서울 때 도움이 되는 건?', options: ['친구와 함께 가기', '혼자 숨기'], correctAnswer: 0 },
          { question: '네모를 반으로 자르면?', options: ['세모 두 개가 돼요', '그대로예요'], correctAnswer: 0 },
        ],
      },
      {
        title: '색과 균형으로 만드는 선물',
        concept: '배려·고마움 전하기(정서) + 색과 균형으로 꾸미기(창의: 디자인원리)',
        quiz: [
          { question: '도움을 받았을 때 전할 마음은?', options: ['고마운 마음', '미운 마음'], correctAnswer: 0 },
          { question: '양쪽이 똑같이 보이면?', options: ['균형이 맞아요', '기울어요'], correctAnswer: 0 },
        ],
      },
      {
        title: '조각 모아 우리 이야기 만들기',
        concept: '두 마음 함께 느끼기(정서) + 모아서 새로 만들기(창의: 통합·콜라주)',
        quiz: [
          { question: '나는 신나지만 친구는 속상할 때는?', options: ['친구 마음도 살펴요', '내 기분만 챙겨요'], correctAnswer: 0 },
          { question: '색종이 조각을 모으면?', options: ['새 작품이 돼요', '쓰레기가 돼요'], correctAnswer: 0 },
        ],
      },
    ],
  },
  7: {
    theme: '마음을 말로, 패턴과 디자인으로',
    description: '내 마음을 표현하고 패턴·디자인·콜라주로 만들어요',
    episodes: [
      {
        title: '마음을 말로, 무늬로 전하기',
        concept: '내 마음 표현하기(정서) + 패턴 찾고 만들기(창의: 패턴)',
        quiz: [
          { question: '속상할 때 좋은 표현은?', options: ['나는 ~해서 속상해', '아무 말 안 하기'], correctAnswer: 0 },
          { question: '체크무늬는 무엇이 반복될까요?', options: ['가로·세로 줄', '아무것도'], correctAnswer: 0 },
        ],
      },
      {
        title: '색과 균형으로 약속 카드 만들기',
        concept: '소통하며 갈등 풀기(정서) + 색과 균형으로 꾸미기(창의: 디자인원리)',
        quiz: [
          { question: '의견이 부딪힐 때는?', options: ['서로의 이유를 들어요', '큰 소리로 말해요'], correctAnswer: 0 },
          { question: '가운데를 중심으로 똑같으면?', options: ['대칭이에요', '비뚤어요'], correctAnswer: 0 },
        ],
      },
      {
        title: '조각 모아 우리만의 작품',
        concept: '두 마음 함께 느끼기(정서) + 모아서 새로 만들기(창의: 통합·콜라주)',
        quiz: [
          { question: '서로 다른 마음을 알면 좋은 점은?', options: ['더 잘 어울려요', '없어요'], correctAnswer: 0 },
          { question: '여러 조각을 한데 모으면?', options: ['새로운 작품이 돼요', '그대로예요'], correctAnswer: 0 },
        ],
      },
    ],
  },
  8: {
    theme: '마음을 이끌고 도형·디자인으로 풀다',
    description: '내 감정을 다루며 도형·디자인·콜라주로 새롭게 만들어요',
    episodes: [
      {
        title: '도형을 바꿔 다툼 풀기',
        concept: '갈등을 대화로 풀기(정서) + 모양 바꾸고 만들기(창의: 변형·도형)',
        quiz: [
          { question: '친구와 싸웠을 때 먼저 할 일은?', options: ['차분히 이야기 나누기', '계속 화내기'], correctAnswer: 0 },
          { question: '같은 도형도 돌리면?', options: ['새롭게 보여요', '똑같아요'], correctAnswer: 0 },
        ],
      },
      {
        title: '색과 균형으로 새 아이디어',
        concept: '스스로 감정 다루기(정서) + 색과 균형으로 꾸미기(창의: 디자인원리)',
        quiz: [
          { question: '실수했을 때 나에게 할 말은?', options: ['다음엔 더 잘할 수 있어', '나는 안 돼'], correctAnswer: 0 },
          { question: '색을 골고루 쓰면?', options: ['보기 좋게 균형이 잡혀요', '지저분해요'], correctAnswer: 0 },
        ],
      },
      {
        title: '조각 모아 마을 계획 완성',
        concept: '배려·협력(정서) + 모아서 새로 만들기(창의: 통합·콜라주)',
        quiz: [
          { question: '힘든 친구를 보면?', options: ['먼저 도와줘요', '지나가요'], correctAnswer: 0 },
          { question: '여러 생각을 모으면?', options: ['더 좋은 계획이 돼요', '복잡해져요'], correctAnswer: 0 },
        ],
      },
    ],
  },
};

// 주제별 커리큘럼 매핑 (통합 미래역량 + 내부 호환 트랙 + legacy 과목)
export const CURRICULUM_MAP: Record<string, typeof SCIENCE_CURRICULUM> = {
  future_skills: FUTURE_SKILLS_CURRICULUM,
  sel_emotion: SEL_EMOTION_CURRICULUM,
  creativity: CREATIVITY_CURRICULUM,
  science: SCIENCE_CURRICULUM,
  english: ENGLISH_CURRICULUM,
};

export const EMOJI_SCORE: Record<EmojiReaction['reaction'], number> = {
  happy: 1.0,
  neutral: 0.5,
  sad: 0.0,
};
