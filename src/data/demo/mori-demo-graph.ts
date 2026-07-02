import type { C6AxisId } from '@/lib/c6/axes';
import type { InteractiveSessionGraph } from '@/types/interactive-session';

const MORI_DEMO_VIDEO_CLIP = {
  videoUrl: '/demo-videos/mori-starlight-seed.mp4',
  subtitlesUrl: '/demo-videos/mori-starlight-seed.vtt',
  posterUrl: '/ip/generated/mori-village-hero.png',
};

export const MORI_DEMO_OPTION_AXIS_BY_ID = {
  mori_demo_heart_care: 'C6_social_emotional',
  mori_demo_heart_face: 'C2_observation_inquiry',
  mori_demo_clue_leaf: 'C2_observation_inquiry',
  mori_demo_clue_light: 'C3_pattern_problem',
  mori_demo_creative_gift: 'C5_imagination_analogy',
  mori_demo_creative_story: 'C4_language_expression',
} satisfies Record<string, C6AxisId>;

export const MORI_DEMO_CHOICE_ID_BY_OPTION_ID = {
  mori_demo_heart_care: 'mori_demo_heart',
  mori_demo_heart_face: 'mori_demo_heart',
  mori_demo_clue_leaf: 'mori_demo_clue',
  mori_demo_clue_light: 'mori_demo_clue',
  mori_demo_creative_gift: 'mori_demo_creative',
  mori_demo_creative_story: 'mori_demo_creative',
} satisfies Record<keyof typeof MORI_DEMO_OPTION_AXIS_BY_ID, string>;

export const MORI_DEMO_GRAPH: InteractiveSessionGraph = {
  startSceneId: 'mori-demo-opening',
  scenes: [
    {
      id: 'mori-demo-opening',
      videoClip: { ...MORI_DEMO_VIDEO_CLIP, startSec: 0, endSec: 4.8 },
      choice: {
        id: 'mori_demo_heart',
        prompt_ko: '꾸미를 어떻게 먼저 살펴볼까?',
        format: 'emotion',
        rejoin: 'mori-demo-clue',
        options: [
          {
            id: 'mori_demo_heart_care',
            label_ko: '마음 듣기',
            icon: 'sad',
            branchScenes: ['mori-demo-heart-branch'],
            tally: { C6_social_emotional: 1 },
            objective_code: 'mori_demo_heart_care',
          },
          {
            id: 'mori_demo_heart_face',
            label_ko: '표정 몸짓',
            icon: 'worried',
            branchScenes: ['mori-demo-heart-branch'],
            tally: { C2_observation_inquiry: 1 },
            objective_code: 'mori_demo_heart_face',
          },
        ],
      },
    },
    {
      id: 'mori-demo-heart-branch',
      videoClip: { ...MORI_DEMO_VIDEO_CLIP, startSec: 4.8, endSec: 7.2 },
    },
    {
      id: 'mori-demo-clue',
      videoClip: { ...MORI_DEMO_VIDEO_CLIP, startSec: 7.2, endSec: 11.4 },
      choice: {
        id: 'mori_demo_clue',
        prompt_ko: '반짝 단서는 어디를 먼저 볼까?',
        format: 'clue',
        rejoin: 'mori-demo-creative',
        options: [
          {
            id: 'mori_demo_clue_leaf',
            label_ko: '잎 그림자',
            icon: 'leaf',
            branchScenes: ['mori-demo-clue-branch'],
            tally: { C2_observation_inquiry: 1 },
            objective_code: 'mori_demo_clue_leaf',
          },
          {
            id: 'mori_demo_clue_light',
            label_ko: '반복된 빛',
            icon: 'seed',
            branchScenes: ['mori-demo-clue-branch'],
            tally: { C3_pattern_problem: 1 },
            objective_code: 'mori_demo_clue_light',
          },
        ],
      },
    },
    {
      id: 'mori-demo-clue-branch',
      videoClip: { ...MORI_DEMO_VIDEO_CLIP, startSec: 11.4, endSec: 12.2 },
    },
    {
      id: 'mori-demo-creative',
      videoClip: { ...MORI_DEMO_VIDEO_CLIP, startSec: 12.2, endSec: 13.45 },
      choice: {
        id: 'mori_demo_creative',
        prompt_ko: '모리가 무엇으로 별빛을 이어볼까?',
        format: 'creative',
        rejoin: '',
        options: [
          {
            id: 'mori_demo_creative_gift',
            label_ko: '선물별',
            icon: 'gift',
            tally: { C5_imagination_analogy: 1 },
            objective_code: 'mori_demo_creative_gift',
          },
          {
            id: 'mori_demo_creative_story',
            label_ko: '말로 잇기',
            icon: '말',
            tally: { C4_language_expression: 1 },
            objective_code: 'mori_demo_creative_story',
          },
        ],
      },
    },
  ],
  endings: [],
};
