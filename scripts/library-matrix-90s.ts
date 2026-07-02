/** 이 영상이 주로 연습시키는 C6 창의도구 — 선별 기반 초개인화(약점 우선 배치)에 사용. 0020 참조. */
export type C6Focus = 'observe' | 'imagine' | 'pattern' | 'transform' | 'design' | 'compose';

export interface LibraryEpisodeSpec {
  title: string;
  description: string;
  topic: string;
  age_band: 5 | 6 | 7;
  style_tags: string[];
  protagonist_hint: string;
  topic_subject: string;
  rough_synopsis: string;
  learning_goals: string[];
  c6_focus: C6Focus;
  reference_image_paths?: string[];
}

export const EPISODE_UNIT_SEC = 90;

// topic_subject → 주로 연습되는 C6 창의도구.
// 여러 곳의 물을 찾아 살피기·글자 모양 관찰 = observe, 물방울이 모여 비가 되는 흐름/순서 = pattern,
// 동물과 영어 이름·소리를 연결·유추 = imagine.
const C6_FOCUS_BY_SUBJECT: Record<string, C6Focus> = {
  '물은 어디서 와요?': 'observe',
  '비는 왜 올까요?': 'pattern',
  'ABC 첫 만남': 'observe',
  '동물 이름 영어로': 'imagine',
};

const MORI_REFERENCE_IMAGE = 'public/ip/mori-reference-no-a.jpg';

const MORI_CANON_HINT = [
  '**책정령 모리(Mori)**, 5-7세 아이 곁에서 이야기를 보여주고 큰 선택을 도와주는 다정한 숲속 안내자.',
  '첨부된 public/ip/mori-reference-no-a.jpg 이미지를 정본으로 사용한다. 머리 위 글자 A, 떠 있는 문자, 로고, 워터마크는 절대 만들지 않는다.',
  '크림색 보송한 몸, 세이지 그린 스카프, 큰 잎/책장 같은 귀, 부드러운 초록 포인트, 작고 자신감 있는 미소, 따뜻한 눈빛.',
  '대사 있는 씬은 모리 얼굴과 입이 잘 보이는 medium close-up 또는 medium shot을 우선한다.',
].join(' ');

function moriAnimalHint(friend: string, mood: string): string {
  return [
    MORI_CANON_HINT,
    `반복 출연 친구: ${friend}.`,
    `정서 결: ${mood}.`,
    '동물 마을은 햇살, 나뭇잎, 작은 길, 별빛 축제가 어울린 따뜻한 이야기 숲이다.',
    '화면에는 글자 설명 대신 캐릭터 행동, 표정, 사물 단서, 큰 선택 순간이 보이게 한다.',
  ].join(' ');
}

export const LIBRARY_MATRIX_ANIMAL_VILLAGE: LibraryEpisodeSpec[] = [
  {
    title: '모리와 꾸미의 사라진 별빛 단서',
    description: '별빛 축제 아침, 꾸미의 사라진 반짝빛을 함께 살피는 동물 마을 첫 90초 이야기',
    topic: 'animal-village',
    age_band: 5,
    style_tags: ['story_forest', 'direct_mobile', 'animal_village', 'limited_animation'],
    protagonist_hint: moriAnimalHint('꾸미(수줍고 마음 여린 아기 곰)', '속상함을 알아주고 작은 단서를 함께 본다'),
    topic_subject: '동물 마을 첫 단서 보기',
    rough_synopsis: '모리가 아이를 동물 마을 별빛 축제에 초대한다. 꾸미가 품고 있던 작은 반짝빛을 잃어버려 속상해하고, 모리는 잎 그림자와 풀숲, 꾸미의 표정을 천천히 살피며 아이에게 어디를 볼지 묻는다.',
    learning_goals: [
      '친구의 표정과 몸짓에서 속상한 마음을 알아차린다',
      '장면 속 작은 사물 단서를 자세히 살핀다',
      '정답을 맞히기보다 먼저 볼 곳을 고르는 경험을 한다',
    ],
    c6_focus: 'observe',
    reference_image_paths: [MORI_REFERENCE_IMAGE],
  },
  {
    title: '모리와 방울의 톡톡 발자국 길',
    description: '너무 신난 방울이가 흩뜨린 별빛 발자국을 순서대로 이어보는 90초 이야기',
    topic: 'animal-village',
    age_band: 5,
    style_tags: ['story_forest', 'direct_mobile', 'animal_village', 'limited_animation'],
    protagonist_hint: moriAnimalHint('방울(활발하고 너무 신나면 앞서 달리는 강아지)', '기쁨과 멈춤을 함께 배운다'),
    topic_subject: '별빛 발자국 순서 잇기',
    rough_synopsis: '방울이가 축제 길을 너무 신나게 뛰다가 별빛 발자국을 여기저기 남긴다. 모리는 아이와 함께 작은 발자국, 큰 발자국, 반짝 발자국의 반복을 보고 방울이가 천천히 돌아오도록 돕는다.',
    learning_goals: [
      '반복되는 모양과 순서를 알아차린다',
      '신난 마음을 멈추고 천천히 보는 방법을 경험한다',
      '다음에 올 발자국을 그림 단서로 예상한다',
    ],
    c6_focus: 'pattern',
    reference_image_paths: [MORI_REFERENCE_IMAGE],
  },
  {
    title: '모리와 나옹의 리본 선물',
    description: '부끄러운 나옹이가 친구에게 줄 리본 선물을 고르도록 닮은 점을 찾아보는 90초 이야기',
    topic: 'animal-village',
    age_band: 6,
    style_tags: ['story_forest', 'direct_mobile', 'animal_village', 'limited_animation'],
    protagonist_hint: moriAnimalHint('나옹(새침하지만 속정 깊은 고양이)', '부끄러움 속의 다정함을 표현한다'),
    topic_subject: '친구와 닮은 선물 찾기',
    rough_synopsis: '나옹이는 꾸미에게 고맙다고 말하고 싶지만 부끄러워 숨어 있다. 모리는 나옹이가 고른 리본, 꽃잎, 작은 종을 친구의 마음과 연결해 보고 아이에게 어떤 선물이 닮았는지 물어본다.',
    learning_goals: [
      '친구의 특징과 선물의 닮은 점을 연결한다',
      '부끄러운 마음도 다정한 행동으로 표현할 수 있음을 느낀다',
      '서로 다른 사물을 관계로 묶어본다',
    ],
    c6_focus: 'imagine',
    reference_image_paths: [MORI_REFERENCE_IMAGE],
  },
  {
    title: '모리와 도토의 작은 용기 숨바꼭질',
    description: '무서워 숨어버린 도토를 잎과 돌 사이 단서로 찾고 용기를 나누는 90초 이야기',
    topic: 'animal-village',
    age_band: 5,
    style_tags: ['story_forest', 'direct_mobile', 'animal_village', 'limited_animation'],
    protagonist_hint: moriAnimalHint('도토(겁 많고 잘 숨는 다람쥐)', '두려움을 작게 나누어 용기로 바꾼다'),
    topic_subject: '숨어 있는 친구 단서 찾기',
    rough_synopsis: '축제 북소리에 놀란 도토가 잎더미 뒤에 숨는다. 모리는 흔들리는 잎, 작은 꼬리, 도토리 자국을 하나씩 보며 아이가 도토를 찾고 천천히 나오게 돕는다.',
    learning_goals: [
      '배경 속에 숨어 있는 시각 단서를 찾는다',
      '무서운 마음을 작게 나누어 말할 수 있음을 안다',
      '친구를 재촉하지 않고 기다리는 태도를 경험한다',
    ],
    c6_focus: 'observe',
    reference_image_paths: [MORI_REFERENCE_IMAGE],
  },
  {
    title: '모리와 올빼미의 별빛 무늬 지도',
    description: '올빼미 할아버지의 오래된 축제 지도를 보고 무늬 규칙을 찾아 길을 여는 90초 이야기',
    topic: 'animal-village',
    age_band: 6,
    style_tags: ['story_forest', 'direct_mobile', 'animal_village', 'limited_animation'],
    protagonist_hint: moriAnimalHint('올빼미 할아버지(차분한 이야기꾼)', '차례와 규칙을 부드럽게 알려준다'),
    topic_subject: '별빛 무늬 규칙 찾기',
    rough_synopsis: '올빼미 할아버지가 별빛 축제로 가는 오래된 지도를 펼친다. 별, 잎, 달 무늬가 반복되지만 한 칸이 비어 있고, 모리는 아이와 함께 다음 무늬를 골라 길을 밝힌다.',
    learning_goals: [
      '그림 무늬의 반복 규칙을 찾는다',
      '비어 있는 자리에 올 단서를 예상한다',
      '차례대로 살피면 길을 찾을 수 있음을 경험한다',
    ],
    c6_focus: 'pattern',
    reference_image_paths: [MORI_REFERENCE_IMAGE],
  },
  {
    title: '모리와 친구들의 축제 선물 공방',
    description: '동물 마을 친구들이 모은 재료를 하나의 축제 선물로 조합하는 90초 마무리 이야기',
    topic: 'animal-village',
    age_band: 6,
    style_tags: ['story_forest', 'direct_mobile', 'animal_village', 'limited_animation'],
    protagonist_hint: moriAnimalHint('꾸미·방울·나옹·도토가 함께 등장', '각자의 마음과 재료를 하나로 모은다'),
    topic_subject: '축제 선물 함께 만들기',
    rough_synopsis: '모리와 친구들이 꿀빛 잎, 톡톡 발자국, 리본, 도토리를 한곳에 모은다. 아이는 무엇을 먼저 놓을지 고르고, 친구들은 서로의 재료가 합쳐져 별빛 선물이 되는 장면을 본다.',
    learning_goals: [
      '여러 재료를 하나의 결과물로 조합한다',
      '친구마다 다른 마음과 역할이 있음을 느낀다',
      '색, 자리, 순서를 고르며 나만의 표현을 경험한다',
    ],
    c6_focus: 'compose',
    reference_image_paths: [MORI_REFERENCE_IMAGE],
  },
];

const BASE_MIRI_HINT = [
  '**인간형 여자아이 주인공 "미리(Miri)"**, 8~9세, K-pop 아이돌 스타일의 밝은 한국 어린이 캐릭터.',
  '하이 포니테일 + 하늘색 물방울 헤어핀, 반짝이는 큰 갈색 눈, 분홍 볼, 또렷한 분홍 입술, 하늘색-화이트 기본 의상, 흰 레깅스, 노란 레인부츠, 물방울 펜던트.',
  '입술·치아가 항상 명확히 렌더링되어야 함 (fal-ai/sync-lipsync 필수 조건).',
  '대사 있는 씬은 medium close-up 또는 medium shot + front/3-4 front angle 우선.',
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

// Deprecated: 2026-07-02 이후 런칭용 90초 실배치는 동물 마을 매트릭스를 기본으로 쓴다.
// 미리 매트릭스는 과거 실험/비교용으로만 남긴다.
const RAW_MIRI_MATRIX_90S_DEPRECATED: Omit<LibraryEpisodeSpec, 'c6_focus'>[] = [
  {
    title: '공주 미리의 물 여행 에피소드',
    description: '성 정원과 집 안의 컵을 오가며 물이 어디에서 오는지 배우는 90초 과학 에피소드',
    topic: 'science',
    age_band: 5,
    style_tags: ['princess'],
    protagonist_hint: miriHint('princess'),
    topic_subject: '물은 어디서 와요?',
    rough_synopsis: '공주 미리가 성 정원의 분수, 컵 속 물, 구름, 작은 냇물을 차례로 살피며 물이 하늘과 땅과 우리 생활을 오간다는 사실을 알려준다.',
    learning_goals: [
      '물은 컵, 강, 구름처럼 여러 곳에 있다는 것을 안다',
      '구름과 비가 물과 연결된다는 것을 감각적으로 이해한다',
      '손 씻기와 마실 물을 떠올리며 물을 아껴 쓰는 태도를 갖는다',
    ],
  },
  {
    title: '공주 미리와 빗방울 성 에피소드',
    description: '구름 속 물방울이 모여 비가 되는 흐름을 90초 동안 배우는 6세 과학 에피소드',
    topic: 'science',
    age_band: 6,
    style_tags: ['princess'],
    protagonist_hint: miriHint('princess'),
    topic_subject: '비는 왜 올까요?',
    rough_synopsis: '공주 미리가 구름 성에 올라가 작은 물방울들이 모이고 무거워져 비로 내려오는 과정을 성 정원 식물과 연결해 설명한다.',
    learning_goals: [
      '작은 물방울이 모여 구름이 된다는 것을 안다',
      '구름 속 물방울이 무거워지면 비가 내린다는 흐름을 이해한다',
      '비가 식물과 사람에게 필요하다는 것을 말할 수 있다',
    ],
  },
  {
    title: 'K팝 미리의 물 출발 에피소드',
    description: 'K-pop 무대와 실제 물병을 연결해 물이 어디에서 오는지 배우는 90초 과학 에피소드',
    topic: 'science',
    age_band: 5,
    style_tags: ['kpop'],
    protagonist_hint: miriHint('kpop'),
    topic_subject: '물은 어디서 와요?',
    rough_synopsis: '미리가 물방울 조명이 반짝이는 무대에서 컵 속 물, 강물, 구름을 리듬에 맞춰 연결하고 아이에게 주변 물을 찾아보게 한다.',
    learning_goals: [
      '마시는 물과 자연 속 물이 연결되어 있음을 느낀다',
      '물방울이 모이면 큰 물이 된다는 이미지를 이해한다',
      '물의 소중함을 짧은 구호로 말한다',
    ],
  },
  {
    title: '공주 미리와 ABC 무도회 에피소드',
    description: 'A, B, C 글자와 첫 소리를 공주 무도회에서 만나는 90초 영어 에피소드',
    topic: 'english',
    age_band: 5,
    style_tags: ['princess'],
    protagonist_hint: miriHint('princess'),
    topic_subject: 'ABC 첫 만남',
    rough_synopsis: '공주 미리가 무도회장과 책상 위 알파벳 카드를 오가며 A, B, C 이름과 첫 소리를 천천히 소개한다.',
    learning_goals: [
      'A, B, C 글자 모양에 친숙해진다',
      '알파벳을 영어 이름으로 따라 말한다',
      '영어 소리를 놀이처럼 즐긴다',
    ],
  },
  {
    title: '공주 미리의 동물 티파티 에피소드',
    description: 'cat, dog, bird 를 공주 티파티와 실제 동물 그림 카드로 익히는 90초 영어 에피소드',
    topic: 'english',
    age_band: 6,
    style_tags: ['princess'],
    protagonist_hint: miriHint('princess'),
    topic_subject: '동물 이름 영어로',
    rough_synopsis: '공주 미리가 티파티에 온 고양이, 강아지, 새 친구를 소개하고 실제 그림 카드와 연결해 cat, dog, bird 를 반복한다.',
    learning_goals: [
      '친숙한 동물 이름 cat, dog, bird 를 영어로 말한다',
      '동물 울음소리와 영어 단어를 연결한다',
      '짧은 영어 단어를 자신 있게 따라 말한다',
    ],
  },
  {
    title: 'K팝 미리의 빗방울 리듬 에피소드',
    description: '비가 오는 이유를 박자와 창밖 비 관찰로 익히는 90초 과학 에피소드',
    topic: 'science',
    age_band: 6,
    style_tags: ['kpop'],
    protagonist_hint: miriHint('kpop'),
    topic_subject: '비는 왜 올까요?',
    rough_synopsis: '미리가 빗방울 비트에 맞춰 물방울이 구름 속에 모이고 톡톡 떨어지는 과정을 보여준 뒤 창밖 비와 식물을 연결한다.',
    learning_goals: [
      '작은 물방울이 구름으로 모이는 흐름을 안다',
      '비가 내리는 과정을 순서대로 말한다',
      '과학 현상을 리듬과 움직임으로 기억한다',
    ],
  },
  {
    title: '미리의 ABC 리듬 스테이지 에피소드',
    description: 'A, B, C 를 무대 리듬과 알파벳 카드로 따라 하는 90초 영어 에피소드',
    topic: 'english',
    age_band: 5,
    style_tags: ['kpop'],
    protagonist_hint: miriHint('kpop'),
    topic_subject: 'ABC 첫 만남',
    rough_synopsis: '미리가 조명 무대에서 A, B, C 글자를 하나씩 부르고 실제 알파벳 카드와 연결해 아이가 박자에 맞춰 따라 말하게 한다.',
    learning_goals: [
      'A, B, C 글자 이름을 듣고 따라 말한다',
      '영어 소리에 대한 거부감을 낮춘다',
      '짧은 콜앤리스폰스 활동에 참여한다',
    ],
  },
  {
    title: '미리의 동물 영어 콘서트 에피소드',
    description: 'cat, dog, bird 를 콘서트 콜앤리스폰스와 동물 그림으로 배우는 90초 영어 에피소드',
    topic: 'english',
    age_band: 6,
    style_tags: ['kpop'],
    protagonist_hint: miriHint('kpop'),
    topic_subject: '동물 이름 영어로',
    rough_synopsis: '미리가 동물 밴드 친구들과 콘서트를 열고 cat, dog, bird 를 리듬 구호처럼 반복하며 실제 그림 카드와 연결한다.',
    learning_goals: [
      'cat, dog, bird 단어를 듣고 동물을 고른다',
      '동물 이름을 영어로 또박또박 말한다',
      '짧은 영어 단어를 리듬 속에서 기억한다',
    ],
  },
  {
    title: '우주 미리의 물별 탐험 에피소드',
    description: '물은 어디에서 오는지 우주 탐험과 생활 속 컵 물로 만나는 90초 과학 에피소드',
    topic: 'science',
    age_band: 5,
    style_tags: ['space'],
    protagonist_hint: miriHint('space'),
    topic_subject: '물은 어디서 와요?',
    rough_synopsis: '우주 탐험가 미리가 물별에 도착해 컵, 강, 구름 속 물방울을 찾아보고 아이에게 주변 물을 관찰하게 한다.',
    learning_goals: [
      '물은 컵, 강, 하늘처럼 여러 모습으로 있다는 것을 안다',
      '물방울 캐릭터를 통해 물의 이동을 감각적으로 본다',
      '물을 찾고 말하는 관찰 활동에 참여한다',
    ],
  },
  {
    title: '우주 미리와 비구름 로켓 에피소드',
    description: '비가 왜 오는지 구름과 물방울을 우주 미션으로 배우는 90초 과학 에피소드',
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
  },
  {
    title: '우주 미리의 ABC 신호 에피소드',
    description: 'A, B, C 를 우주 신호와 책상 위 카드로 처음 만나는 90초 영어 에피소드',
    topic: 'english',
    age_band: 5,
    style_tags: ['space'],
    protagonist_hint: miriHint('space'),
    topic_subject: 'ABC 첫 만남',
    rough_synopsis: '우주 미리가 별빛 신호 A, B, C 를 수신하고 각 글자의 이름을 밝고 천천히 따라 말하게 하며 실제 카드와 연결한다.',
    learning_goals: [
      'A, B, C 글자 모양을 구별해 본다',
      '알파벳 이름을 듣고 따라 말한다',
      '영어를 신호 놀이처럼 즐겁게 접한다',
    ],
  },
  {
    title: '우주 미리의 동물 이름 탐사 에피소드',
    description: 'cat, dog, bird 를 우주 동물 친구들과 실제 그림 카드로 익히는 90초 영어 에피소드',
    topic: 'english',
    age_band: 6,
    style_tags: ['space'],
    protagonist_hint: miriHint('space'),
    topic_subject: '동물 이름 영어로',
    rough_synopsis: '우주 미리가 별 행성에서 만난 고양이, 강아지, 새 친구를 cat, dog, bird 로 소개하고 실제 동물 그림과 연결해 반복 학습한다.',
    learning_goals: [
      'cat, dog, bird 영어 단어와 동물을 연결한다',
      '동물 이름을 듣고 따라 말한다',
      '짧은 영어 단어를 상황 속에서 기억한다',
    ],
  },
];

export const LIBRARY_MATRIX_MIRI_DEPRECATED: LibraryEpisodeSpec[] = RAW_MIRI_MATRIX_90S_DEPRECATED.map((spec) => ({
  ...spec,
  c6_focus: C6_FOCUS_BY_SUBJECT[spec.topic_subject] ?? 'observe',
}));

export const LIBRARY_MATRIX_90S: LibraryEpisodeSpec[] = LIBRARY_MATRIX_ANIMAL_VILLAGE;
