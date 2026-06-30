import type { LibraryVideo } from '@/types/library';

export const LOCAL_PREVIEW_LIBRARY_VIDEO: LibraryVideo = {
  id: 'local-preview-mori-video',
  title: '모리와 함께 보는 별빛 단서',
  description: '모리가 들은 작은 반짝 소리를 따라가며, 보고 찾고 만드는 첫 모험을 열어요.',
  topic: 'animal-village',
  age_band: 6,
  style_tags: ['story_forest', 'direct_web'],
  duration_sec: 15,
  video_url: '/demo-videos/mori-starlight-seed.mp4',
  thumbnail_url: '/ip/mori-reference-no-a.jpg',
  subtitles_url: '/demo-videos/mori-starlight-seed.vtt',
  script: null,
  scenes: null,
  episode_unit_sec: null,
  character_name: '모리',
  view_count: 0,
  published: true,
  featured: true,
  created_at: '2026-06-29T00:00:00.000Z',
};

export function localPreviewLibraryVideoForAge(ageBand?: number | null): LibraryVideo {
  const safeAgeBand = typeof ageBand === 'number' && Number.isInteger(ageBand) && ageBand >= 3 && ageBand <= 8
    ? ageBand
    : LOCAL_PREVIEW_LIBRARY_VIDEO.age_band;

  return {
    ...LOCAL_PREVIEW_LIBRARY_VIDEO,
    age_band: safeAgeBand,
  };
}

export const LOCAL_PREVIEW_ATTENTION_QUESTIONS = [
  {
    question: '누가 반짝 소리를 들었지?',
    options: ['모리', '방울', '나옹'],
    correctAnswer: 0,
    focus: 'appearance' as const,
  },
  {
    question: '무엇이 사라졌지?',
    options: ['반짝빛', '빨간 자동차', '파란 컵'],
    correctAnswer: 0,
    focus: 'detail' as const,
  },
  {
    question: '어디 단서를 찾을까?',
    options: ['풀숲', '구름 위', '물속'],
    correctAnswer: 0,
    focus: 'action' as const,
  },
];
