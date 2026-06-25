export type AssetPoolItem = {
  token: string;
  label_ko: string;
  category?: string;
};

export type AssetPool = {
  id: string;
  topic: string;
  items: AssetPoolItem[];
};

export const ASSET_POOLS: Record<string, AssetPool> = {
  science: {
    id: 'science_core_v1',
    topic: 'science',
    items: [
      { token: 'seed', label_ko: '씨앗', category: 'plant' },
      { token: 'leaf', label_ko: '잎', category: 'plant' },
      { token: 'flower', label_ko: '꽃', category: 'plant' },
      { token: 'butterfly', label_ko: '나비', category: 'animal' },
      { token: 'fish', label_ko: '물고기', category: 'animal' },
      { token: 'frog', label_ko: '개구리', category: 'animal' },
      { token: 'sun', label_ko: '해', category: 'sky' },
      { token: 'moon', label_ko: '달', category: 'sky' },
      { token: 'rain', label_ko: '비', category: 'weather' },
      { token: 'snow', label_ko: '눈', category: 'weather' },
    ],
  },
  english: {
    id: 'english_core_v1',
    topic: 'english',
    items: [
      { token: 'A', label_ko: '에이', category: 'vowel' },
      { token: 'E', label_ko: '이', category: 'vowel' },
      { token: 'I', label_ko: '아이', category: 'vowel' },
      { token: 'B', label_ko: '비', category: 'consonant' },
      { token: 'C', label_ko: '씨', category: 'consonant' },
      { token: 'D', label_ko: '디', category: 'consonant' },
      { token: 'cat', label_ko: '고양이', category: 'word' },
      { token: 'dog', label_ko: '강아지', category: 'word' },
      { token: 'sun', label_ko: '해', category: 'word' },
    ],
  },
  hangul: {
    id: 'hangul_core_v1',
    topic: 'hangul',
    items: [
      { token: '가', label_ko: '가', category: 'giyeok' },
      { token: '구', label_ko: '구', category: 'giyeok' },
      { token: '기', label_ko: '기', category: 'giyeok' },
      { token: '나', label_ko: '나', category: 'nieun' },
      { token: '누', label_ko: '누', category: 'nieun' },
      { token: '니', label_ko: '니', category: 'nieun' },
      { token: '다', label_ko: '다', category: 'digeut' },
      { token: '두', label_ko: '두', category: 'digeut' },
      { token: '디', label_ko: '디', category: 'digeut' },
    ],
  },
  music: {
    id: 'music_core_v1',
    topic: 'music',
    items: [
      { token: 'do', label_ko: '도', category: 'note' },
      { token: 're', label_ko: '레', category: 'note' },
      { token: 'mi', label_ko: '미', category: 'note' },
      { token: 'fa', label_ko: '파', category: 'note' },
      { token: 'sol', label_ko: '솔', category: 'note' },
      { token: 'clap', label_ko: '손뼉', category: 'rhythm' },
      { token: 'tap', label_ko: '톡톡', category: 'rhythm' },
      { token: 'shake', label_ko: '흔들기', category: 'rhythm' },
      { token: 'drum', label_ko: '북', category: 'instrument' },
      { token: 'bell', label_ko: '방울', category: 'instrument' },
    ],
  },
  emotion: {
    id: 'emotion_core_v1',
    topic: 'emotion',
    items: [
      { token: 'happy', label_ko: '기쁨', category: 'positive' },
      { token: 'proud', label_ko: '뿌듯함', category: 'positive' },
      { token: 'calm', label_ko: '편안함', category: 'positive' },
      { token: 'sad', label_ko: '슬픔', category: 'uncomfortable' },
      { token: 'angry', label_ko: '화남', category: 'uncomfortable' },
      { token: 'worried', label_ko: '걱정', category: 'uncomfortable' },
    ],
  },
  // 창의(상상·문제해결) 트랙 풀 — 교수 도구 자산(도형·색·패턴·콜라주).
  // 근거: 「창의적 사고와 디자인」 + 「생각의 탄생」(기하학·디자인원리·패턴·콜라주).
  creativity: {
    id: 'creativity_core_v2',
    topic: 'creativity',
    items: [
      // 도형(기하학) — 변형·차원적 사고
      { token: 'circle', label_ko: '동그라미', category: 'geometry' },
      { token: 'triangle', label_ko: '세모', category: 'geometry' },
      { token: 'square', label_ko: '네모', category: 'geometry' },
      { token: 'star', label_ko: '별', category: 'geometry' },
      // 색 — 디자인 원리(색·대칭·균형)
      { token: 'red', label_ko: '빨강', category: 'color' },
      { token: 'blue', label_ko: '파랑', category: 'color' },
      { token: 'yellow', label_ko: '노랑', category: 'color' },
      // 패턴 — 패턴 인식·형성
      { token: 'stripe', label_ko: '줄무늬', category: 'pattern' },
      { token: 'dot', label_ko: '물방울', category: 'pattern' },
      { token: 'check', label_ko: '체크무늬', category: 'pattern' },
      { token: 'zigzag', label_ko: '지그재그', category: 'pattern' },
      // 재료(콜라주) — 통합·모아 새로 만들기
      { token: 'block', label_ko: '블록', category: 'collage' },
      { token: 'clay', label_ko: '점토', category: 'collage' },
      { token: 'paper', label_ko: '색종이', category: 'collage' },
    ],
  },
};

export function poolForTopic(topic: string): AssetPool {
  const topicKey = topic.trim().toLocaleLowerCase('ko-KR');
  const directPool = ASSET_POOLS[topicKey];

  if (directPool) {
    return directPool;
  }

  if (includesAny(topicKey, ['english', '영어', 'alphabet', 'phonics'])) {
    return ASSET_POOLS.english;
  }

  if (includesAny(topicKey, ['한글', '국어', '말놀이', 'korean', 'hangul'])) {
    return ASSET_POOLS.hangul;
  }

  if (includesAny(topicKey, ['music', '음악', '노래', '리듬', '소리'])) {
    return ASSET_POOLS.music;
  }

  // 통합 미래역량의 비-정서(사고/창의) 라운드는 창의 풀을 쓴다.
  // (정서표현 라운드는 engine 이 emotion 풀을 강제하므로 한 세션이 두 풀을 함께 사용.)
  if (includesAny(topicKey, ['future_skills', '미래역량', '생각하는 힘', '창의', '상상', '만들기', '문제해결', 'creativity', 'idea', 'creative'])) {
    return ASSET_POOLS.creativity;
  }

  if (includesAny(topicKey, ['emotion', 'feeling', 'sel', '정서', '감정', '마음', '표정', '표현'])) {
    return ASSET_POOLS.emotion;
  }

  if (includesAny(topicKey, ['science', '과학', '관찰', '분류', '탐구'])) {
    return ASSET_POOLS.science;
  }

  // 기본 트랙 = 정서·표현. (과목 우선 시대의 science 폴백을 대체.)
  return ASSET_POOLS.emotion;
}

function includesAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}
