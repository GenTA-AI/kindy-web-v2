/**
 * 수업 정본: 쇠라 〈그랑드 자트 섬의 일요일 오후〉 — "점으로 그린 일요일" (docs/plan/09 MVP-2).
 * LearningSessionSpec v2의 슬림 구현 — 영상을 의미 단위 장(章)으로 나누고, 장 사이에 질문.
 * 측정 원칙(로드맵 P0): 정답이 실재하는 관찰·회상 문항만 채점(is_correct),
 * 관점·취향 문항은 노출(exposure)로만 기록한다. 문항별 주 목표 1개.
 */

export interface LessonQuestion {
  id: string;
  /** 채점 여부 — true 면 correctIndex 가 실제 정답 (지어내지 않는다). */
  scored: boolean;
  correctIndex?: number;
  objectiveCode: string;
  gameType: 'Q_quiz' | 'emotion_expression';
  prompt: string;
  options: string[];
  /** 선택 직후 아이에게 들려주는 피드백 (정답 해설 또는 공감 반응). */
  feedback: string;
  /** 근거 말하기 유도 — "왜?"를 어른과의 대화로 연결 (산출물 캡처는 P1 후속). */
  reasonPrompt?: string;
}

export interface LessonChapter {
  id: string;
  title: string;
  /** 수업 영상 내 구간 (초). */
  startS: number;
  endS: number;
  question: LessonQuestion;
}

export interface DocentLesson {
  id: string;
  topic: string;
  title: string;
  artwork: string;
  videoPath: string; // Supabase storage 경로 (서버에서 서명)
  posterPath: string; // public 경로
  chapters: LessonChapter[];
  /** 완료 화면의 부모 대화 스타터 — 관찰 문장, 효능 단정 금지. */
  parentPrompt: string;
}

export const SEURAT_01: DocentLesson = {
  id: 'seurat-01',
  topic: 'docent_seurat',
  title: '점으로 그린 일요일',
  artwork: '조르주 쇠라, 〈그랑드 자트 섬의 일요일 오후〉 (1886)',
  videoPath: 'first-story/seurat-episode-720p.mp4',
  posterPath: '/landing/seurat-poster.jpg',
  chapters: [
    {
      id: 'ch1',
      title: '일요일의 강가',
      startS: 0,
      endS: 55.8,
      question: {
        id: 'q1-observe',
        scored: true,
        correctIndex: 0,
        objectiveCode: 'docent_observe_detail',
        gameType: 'Q_quiz',
        prompt: '물가에 있던 여인은 무엇을 하고 있었을까?',
        options: ['낚시', '수영', '요리'],
        feedback: '맞아, 낚싯줄이 물까지 내려가 있었지! 눈으로 잘 따라갔구나.',
        reasonPrompt: '그림 어디에서 봤는지 옆에 있는 어른에게 손가락으로 알려줄래?',
      },
    },
    {
      id: 'ch2',
      title: '그림 속 친구들',
      startS: 55.8,
      endS: 106.8,
      question: {
        id: 'q2-perspective',
        scored: false,
        objectiveCode: 'docent_perspective_taking',
        gameType: 'emotion_expression',
        prompt: '흰옷을 입은 꼬마 숙녀는 지금 어떤 기분일 것 같아?',
        options: ['궁금해요', '신나요', '조용하고 편안해요'],
        feedback: '그렇게 느꼈구나. 같은 그림도 보는 사람마다 다르게 느껴져 — 그게 그림 보는 재미야.',
        reasonPrompt: '왜 그렇게 느꼈는지 어른에게 이야기해 볼까?',
      },
    },
    {
      id: 'ch3',
      title: '점의 비밀',
      startS: 106.8,
      endS: 147.9,
      question: {
        id: 'q3-recall',
        scored: true,
        correctIndex: 2,
        objectiveCode: 'docent_recall_technique',
        gameType: 'Q_quiz',
        prompt: '쇠라 아저씨는 이 큰 그림을 무엇으로 채워 그렸다고 했지?',
        options: ['긴 선', '커다란 붓자국', '수많은 작은 점'],
        feedback: '딩동댕! 가까이 가면 점, 멀리서 보면 그림 — 점묘법이라고 불러.',
        reasonPrompt: '집에 있는 물건 중에 점으로 그릴 수 있는 게 있을까? 어른과 하나 골라봐!',
      },
    },
  ],
  parentPrompt:
    '오늘 아이가 쇠라의 점묘 그림을 보고 관찰·관점·회상 질문에 답했어요. "가까이서 보면 뭐가 보였지?"라고 물어보시면 아이가 수업 내용을 자기 말로 다시 꺼내볼 수 있어요.',
};

export const LESSONS: Record<string, DocentLesson> = {
  [SEURAT_01.id]: SEURAT_01,
};
