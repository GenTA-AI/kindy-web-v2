// 국어·독서 5-7세 미취학 커리큘럼 콘텐츠 데이터.
// scripts/seed-syllabus.ts 가 이 데이터를 읽어 syllabus/units/lessons 를 채운다.
// 차시 진행: 한글 인지 -> 자음·모음 -> 낱말 읽기 -> 짧은 문장·독해.

export interface SeedLesson {
  title: string;
  objective: string;
  estimated_min: number;
  sort_order: number;
  /** library_videos 매핑 힌트. 시드 스크립트가 topic/age_band/title 로 영상을 찾는다.
   * 매칭 실패 시 library_video_id=null (콘텐츠 준비중). */
  videoMatch: { topic: string; age_band: number; titleLike?: string } | null;
}

export interface SeedUnit {
  title: string;
  description: string;
  objective: string;
  lessons: SeedLesson[];
}

export interface SeedSyllabus {
  subject: string;
  age_band: number;
  level_code: string;
  title: string;
  description: string;
  units: SeedUnit[];
}

export const KOREAN_PRESCHOOL_SYLLABUS: SeedSyllabus = {
  subject: 'korean_reading',
  age_band: 6,
  level_code: 'K-READ-1',
  title: '국어·독서 — 한글 떼기 첫걸음 (5-7세)',
  description:
    '소리와 글자에 친해지는 것부터 짧은 이야기를 읽는 것까지, 미취학 아이의 한글·독서 4단원 커리큘럼.',
  units: [
    {
      title: '1단원 · 한글이랑 친해지기',
      description: '글자가 무엇인지 알고, 말소리에 귀 기울여요.',
      objective: '한글이 의미를 가진 글자임을 인식하고 친숙한 말소리를 구별한다.',
      lessons: [
        {
          title: '글자가 가득한 우리 동네',
          objective: '주변 간판과 책 표지에서 한글을 찾아보며 글자에 흥미를 가진다.',
          estimated_min: 5,
          sort_order: 0,
          videoMatch: null,
        },
        {
          title: '내 이름 글자를 찾아요',
          objective: '자기 이름에 들어 있는 글자의 모양을 알아보고 같은 글자를 찾는다.',
          estimated_min: 5,
          sort_order: 1,
          videoMatch: null,
        },
        {
          title: '그림과 글자 짝꿍',
          objective: '익숙한 그림과 글자를 짝지으며 글자가 뜻을 나타냄을 안다.',
          estimated_min: 4,
          sort_order: 2,
          videoMatch: null,
        },
        {
          title: '같은 소리를 찾아요',
          objective: '낱말을 듣고 처음 소리가 같은 말을 골라 말소리를 구별한다.',
          estimated_min: 5,
          sort_order: 3,
          videoMatch: null,
        },
        {
          title: '말소리 박수 놀이',
          objective: '낱말을 소리 마디로 나누어 듣고 박수로 리듬을 맞춘다.',
          estimated_min: 4,
          sort_order: 4,
          videoMatch: null,
        },
      ],
    },
    {
      title: '2단원 · 자음과 모음',
      description: 'ㄱㄴㄷ과 ㅏㅑㅓㅕ를 만나고 글자가 만들어지는 원리를 배워요.',
      objective: '기본 자음과 모음의 모양·소리를 알고 자음과 모음을 합쳐 글자를 만든다.',
      lessons: [
        {
          title: 'ㄱㄴㄷ 친구들을 만나요',
          objective: '기본 자음의 모양과 소리를 놀이처럼 익힌다.',
          estimated_min: 5,
          sort_order: 0,
          videoMatch: { topic: 'hangul', age_band: 5, titleLike: '한글 숲' },
        },
        {
          title: '자음 소리 귀 쫑긋',
          objective: 'ㄱ, ㄴ, ㄷ, ㄹ, ㅁ, ㅂ, ㅅ의 소리를 듣고 알맞은 글자를 고른다.',
          estimated_min: 6,
          sort_order: 1,
          videoMatch: null,
        },
        {
          title: '아야어여 노래를 불러요',
          objective: '기본 모음 ㅏ, ㅑ, ㅓ, ㅕ의 모양과 소리를 안다.',
          estimated_min: 5,
          sort_order: 2,
          videoMatch: null,
        },
        {
          title: '모음 길을 따라가요',
          objective: '모음의 방향과 위치를 보며 비슷한 모음을 구별한다.',
          estimated_min: 5,
          sort_order: 3,
          videoMatch: null,
        },
        {
          title: 'ㄱ 더하기 ㅏ는 가',
          objective: '자음과 모음이 만나 한 글자가 되는 원리를 이해한다.',
          estimated_min: 6,
          sort_order: 4,
          videoMatch: null,
        },
        {
          title: '글자 블록을 쌓아요',
          objective: '자음과 모음 카드를 조합해 받침 없는 글자를 만들어 읽는다.',
          estimated_min: 6,
          sort_order: 5,
          videoMatch: null,
        },
      ],
    },
    {
      title: '3단원 · 낱말 읽기',
      description: '두 글자 낱말부터 생활 낱말까지 또박또박 읽어요.',
      objective: '받침 없는 낱말과 받침 있는 낱말을 구별하고 생활 낱말을 읽는다.',
      lessons: [
        {
          title: '두 글자 낱말 산책',
          objective: '받침 없는 두 글자 낱말을 소리 내어 읽는다.',
          estimated_min: 5,
          sort_order: 0,
          videoMatch: null,
        },
        {
          title: '가족 이름을 읽어요',
          objective: '엄마, 아빠처럼 익숙한 가족 낱말을 읽고 뜻을 말한다.',
          estimated_min: 5,
          sort_order: 1,
          videoMatch: null,
        },
        {
          title: '동물 낱말 카드',
          objective: '동물 그림을 보고 알맞은 낱말을 골라 읽는다.',
          estimated_min: 5,
          sort_order: 2,
          videoMatch: null,
        },
        {
          title: '맛있는 음식 낱말',
          objective: '음식 이름 낱말을 읽고 그림과 연결한다.',
          estimated_min: 5,
          sort_order: 3,
          videoMatch: null,
        },
        {
          title: '받침이 숨어 있어요',
          objective: '받침이 있는 쉬운 낱말을 보고 받침 소리를 천천히 읽는다.',
          estimated_min: 6,
          sort_order: 4,
          videoMatch: { topic: 'hangul', age_band: 6, titleLike: '받침 놀이' },
        },
        {
          title: '그림과 낱말 줄 잇기',
          objective: '그림의 뜻을 생각하며 알맞은 낱말을 찾아 읽는다.',
          estimated_min: 5,
          sort_order: 5,
          videoMatch: null,
        },
      ],
    },
    {
      title: '4단원 · 짧은 문장과 이야기 읽기',
      description: '짧은 문장과 그림책 장면을 읽고 내용을 말해요.',
      objective: '짧은 문장을 읽고 누가 무엇을 했는지 이해하며 이야기 순서를 파악한다.',
      lessons: [
        {
          title: '짧은 문장을 또박또박',
          objective: '두세 낱말로 된 짧은 문장을 천천히 읽는다.',
          estimated_min: 5,
          sort_order: 0,
          videoMatch: null,
        },
        {
          title: '누가 무엇을 했을까',
          objective: '문장을 읽고 등장인물과 행동을 찾아 말한다.',
          estimated_min: 6,
          sort_order: 1,
          videoMatch: null,
        },
        {
          title: '그림책 한 장면 읽기',
          objective: '그림과 짧은 글을 함께 보며 장면의 내용을 이해한다.',
          estimated_min: 6,
          sort_order: 2,
          videoMatch: null,
        },
        {
          title: '이야기 순서대로 놓기',
          objective: '짧은 이야기의 처음, 가운데, 끝을 그림으로 맞춘다.',
          estimated_min: 7,
          sort_order: 3,
          videoMatch: null,
        },
        {
          title: '읽고 대답해요',
          objective: '짧은 글을 읽고 누가, 어디서, 무엇을 했는지 대답한다.',
          estimated_min: 6,
          sort_order: 4,
          videoMatch: null,
        },
      ],
    },
  ],
};
