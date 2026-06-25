// MVP 라이브러리 매트릭스: 3 스타일 × 2 주제 × 2 연령 = 12편.
// 운영자가 brief 를 직접 편집해서 새 영상 생성 가능.

export interface LibraryBriefSpec {
  title: string;              // library_videos.title
  description: string;
  topic: 'science' | 'english';
  age_band: 5 | 6;
  style_tags: string[];       // e.g. ['princess']
  protagonist_hint: string;   // Miri 외 캐릭터도 가능
  topic_subject: string;      // Claude director 의 'topic' 입력
  rough_synopsis: string;
  learning_goals: string[];
  target_duration_sec: number; // 기본 30
}

const BASE_MIRI_HINT = [
  '**인간형 여자아이 주인공 "미리(Miri)"**, 8~9세, K-pop 아이돌 스타일의 밝은 한국 어린이 캐릭터.',
  '하이 포니테일 + 하늘색 물방울 헤어핀, 반짝이는 큰 갈색 눈, 분홍 볼, 또렷한 분홍 입술, 하늘색-화이트 기본 의상, 흰 레깅스, 노란 레인부츠, 물방울 펜던트.',
  '입술·치아가 항상 명확히 렌더링되어야 함 (AI 립싱크 필수 조건).',
  '대사 있는 씬은 medium shot 이상 + 3/4 front angle 우선.',
  '표정 range: neutral smile / talking with teeth / surprised O / cheerful wide smile.',
].join(' ');

function miriHint(style: 'princess' | 'kpop' | 'space'): string {
  const variants: Record<'princess' | 'kpop' | 'space', string> = {
    princess:
      '스타일 변형: 동화 공주풍 하늘색 케이프와 작은 티아라, 별빛 지팡이, 성 정원 또는 마법 무도회 소품. 기본 물방울 헤어핀과 레인부츠는 유지.',
    kpop:
      '스타일 변형: 어린이 K-pop 무대 의상, 반짝이는 짧은 재킷, 헤드셋 마이크, 리듬 스틱 또는 작은 응원봉. 기본 물방울 헤어핀과 노란 레인부츠는 유지.',
    space:
      '스타일 변형: 친근한 우주 탐험가 슈트, 별 모양 장갑, 작은 로켓 백팩, 투명 헬멧 바이저는 필요할 때만. 기본 물방울 헤어핀과 미리 얼굴 특징은 유지.',
  };
  return `${BASE_MIRI_HINT} ${variants[style]}`;
}

export const LIBRARY_MATRIX: LibraryBriefSpec[] = [
  {
    title: '공주 미리와 물의 여행',
    description: '마법 성 정원에서 물이 어디에서 오는지 살펴보는 5세 과학 영상',
    topic: 'science',
    age_band: 5,
    style_tags: ['princess'],
    protagonist_hint: miriHint('princess'),
    topic_subject: '물은 어디서 와요?',
    rough_synopsis: '공주 미리가 성 정원의 분수, 구름, 작은 냇물을 따라가며 물이 하늘과 땅을 오간다는 사실을 5세 눈높이로 보여준다.',
    learning_goals: [
      '물은 우리 주변 여러 곳에 있다는 것을 안다',
      '구름과 비가 물과 연결된다는 것을 감각적으로 이해한다',
      '물을 아껴 쓰는 태도를 갖는다',
    ],
    target_duration_sec: 30,
  },
  {
    title: '공주 미리와 빗방울 성의 비밀',
    description: '비가 왜 오는지 구름 성과 빗방울 친구로 배우는 6세 과학 영상',
    topic: 'science',
    age_band: 6,
    style_tags: ['princess'],
    protagonist_hint: miriHint('princess'),
    topic_subject: '비는 왜 올까요?',
    rough_synopsis: '공주 미리가 구름 성에 올라가 물방울이 모이고 무거워져 비가 되는 과정을 마법 파티처럼 설명한다.',
    learning_goals: [
      '작은 물방울이 모여 구름이 된다는 것을 안다',
      '구름 속 물방울이 무거워지면 비가 내린다는 흐름을 이해한다',
      '비가 식물과 사람에게 필요하다는 것을 말할 수 있다',
    ],
    target_duration_sec: 30,
  },
  {
    title: '공주 미리와 ABC 첫 무도회',
    description: 'A, B, C 글자와 소리를 처음 만나는 5세 영어 영상',
    topic: 'english',
    age_band: 5,
    style_tags: ['princess'],
    protagonist_hint: miriHint('princess'),
    topic_subject: 'ABC 첫 만남',
    rough_synopsis: '공주 미리가 무도회장에 나타난 A, B, C 빛 글자를 만나 각각의 이름과 첫 소리를 리듬 있게 소개한다.',
    learning_goals: [
      'A, B, C 글자 모양에 친숙해진다',
      '알파벳을 영어 이름으로 따라 말한다',
      '영어 소리를 놀이처럼 즐긴다',
    ],
    target_duration_sec: 30,
  },
  {
    title: '공주 미리와 동물 영어 티파티',
    description: 'cat, dog, bird 를 공주 티파티에서 익히는 6세 영어 영상',
    topic: 'english',
    age_band: 6,
    style_tags: ['princess'],
    protagonist_hint: miriHint('princess'),
    topic_subject: '동물 이름 영어로',
    rough_synopsis: '공주 미리가 티파티에 온 고양이, 강아지, 새 친구를 소개하며 cat, dog, bird 를 자연스럽게 따라 말하게 한다.',
    learning_goals: [
      '친숙한 동물 이름 cat, dog, bird 를 영어로 말한다',
      '동물 울음소리와 영어 단어를 연결한다',
      '짧은 영어 단어를 자신 있게 따라 말한다',
    ],
    target_duration_sec: 30,
  },
  {
    title: '무대 위 미리와 물의 출발',
    description: 'K-pop 리듬 무대에서 물이 어디에서 오는지 배우는 5세 과학 영상',
    topic: 'science',
    age_band: 5,
    style_tags: ['kpop'],
    protagonist_hint: miriHint('kpop'),
    topic_subject: '물은 어디서 와요?',
    rough_synopsis: '미리가 물방울 조명이 반짝이는 무대에서 컵 속 물, 강물, 구름을 리듬에 맞춰 연결해 보여준다.',
    learning_goals: [
      '마시는 물과 자연 속 물이 연결되어 있음을 느낀다',
      '물방울이 모이면 큰 물이 된다는 이미지를 이해한다',
      '물의 소중함을 짧은 구호로 말한다',
    ],
    target_duration_sec: 30,
  },
  {
    title: 'K팝 미리의 빗방울 리듬',
    description: '비가 오는 이유를 박자와 안무로 익히는 6세 과학 영상',
    topic: 'science',
    age_band: 6,
    style_tags: ['kpop'],
    protagonist_hint: miriHint('kpop'),
    topic_subject: '비는 왜 올까요?',
    rough_synopsis: '미리가 빗방울 비트에 맞춰 물방울이 구름 속에 모이고 톡톡 떨어지는 과정을 무대 연출로 설명한다.',
    learning_goals: [
      '수증기와 작은 물방울이 구름으로 모이는 흐름을 안다',
      '비가 내리는 과정을 순서대로 말한다',
      '과학 현상을 리듬과 움직임으로 기억한다',
    ],
    target_duration_sec: 30,
  },
  {
    title: '미리의 ABC 리듬 스테이지',
    description: 'A, B, C 를 박자에 맞춰 처음 따라 하는 5세 영어 영상',
    topic: 'english',
    age_band: 5,
    style_tags: ['kpop'],
    protagonist_hint: miriHint('kpop'),
    topic_subject: 'ABC 첫 만남',
    rough_synopsis: '미리가 조명 무대에서 A, B, C 글자를 하나씩 부르고 아이가 박자에 맞춰 따라 말할 수 있게 이끈다.',
    learning_goals: [
      'A, B, C 글자 이름을 듣고 따라 말한다',
      '영어 소리에 대한 거부감을 낮춘다',
      '짧은 콜앤리스폰스 활동에 참여한다',
    ],
    target_duration_sec: 30,
  },
  {
    title: '미리의 동물 영어 콘서트',
    description: 'cat, dog, bird 를 콘서트 콜앤리스폰스로 배우는 6세 영어 영상',
    topic: 'english',
    age_band: 6,
    style_tags: ['kpop'],
    protagonist_hint: miriHint('kpop'),
    topic_subject: '동물 이름 영어로',
    rough_synopsis: '미리가 동물 밴드 친구들과 콘서트를 열고 cat, dog, bird 를 리듬 구호처럼 반복해 말한다.',
    learning_goals: [
      'cat, dog, bird 단어를 듣고 동물을 고른다',
      '동물 이름을 영어로 또박또박 말한다',
      '짧은 영어 단어를 리듬 속에서 기억한다',
    ],
    target_duration_sec: 30,
  },
  {
    title: '우주 미리와 물별 탐험',
    description: '물은 어디에서 오는지 우주 탐험 이야기로 만나는 5세 과학 영상',
    topic: 'science',
    age_band: 5,
    style_tags: ['space'],
    protagonist_hint: miriHint('space'),
    topic_subject: '물은 어디서 와요?',
    rough_synopsis: '우주 탐험가 미리가 물별에 도착해 컵, 강, 구름 속 물방울을 찾아보며 물이 곳곳에 있음을 보여준다.',
    learning_goals: [
      '물은 컵, 강, 하늘처럼 여러 모습으로 있다는 것을 안다',
      '물방울 캐릭터를 통해 물의 이동을 감각적으로 본다',
      '물을 찾고 말하는 관찰 활동에 참여한다',
    ],
    target_duration_sec: 30,
  },
  {
    title: '우주 미리와 비구름 로켓',
    description: '비가 왜 오는지 구름과 물방울을 우주 미션으로 배우는 6세 과학 영상',
    topic: 'science',
    age_band: 6,
    style_tags: ['space'],
    protagonist_hint: miriHint('space'),
    topic_subject: '비는 왜 올까요?',
    rough_synopsis: '우주 미리가 비구름 로켓을 타고 작은 물방울들이 모여 무거워지고 지구로 내려오는 과정을 탐험한다.',
    learning_goals: [
      '구름 속 물방울이 많아지면 비가 된다는 것을 이해한다',
      '비가 내리는 순서를 간단히 설명한다',
      '자연 현상을 탐험 미션처럼 흥미롭게 받아들인다',
    ],
    target_duration_sec: 30,
  },
  {
    title: '우주 미리의 ABC 신호',
    description: 'A, B, C 를 우주 신호처럼 처음 만나는 5세 영어 영상',
    topic: 'english',
    age_band: 5,
    style_tags: ['space'],
    protagonist_hint: miriHint('space'),
    topic_subject: 'ABC 첫 만남',
    rough_synopsis: '우주 미리가 별빛 신호 A, B, C 를 수신하고 각 글자의 이름을 밝고 천천히 따라 말하게 한다.',
    learning_goals: [
      'A, B, C 글자 모양을 구별해 본다',
      '알파벳 이름을 듣고 따라 말한다',
      '영어를 신호 놀이처럼 즐겁게 접한다',
    ],
    target_duration_sec: 30,
  },
  {
    title: '우주 미리의 동물 이름 탐사',
    description: 'cat, dog, bird 를 우주 동물 친구들과 익히는 6세 영어 영상',
    topic: 'english',
    age_band: 6,
    style_tags: ['space'],
    protagonist_hint: miriHint('space'),
    topic_subject: '동물 이름 영어로',
    rough_synopsis: '우주 미리가 별 행성에서 만난 고양이, 강아지, 새 친구를 cat, dog, bird 로 소개하며 반복 학습한다.',
    learning_goals: [
      'cat, dog, bird 영어 단어와 동물을 연결한다',
      '동물 이름을 듣고 따라 말한다',
      '짧은 영어 단어를 상황 속에서 기억한다',
    ],
    target_duration_sec: 30,
  },
];
