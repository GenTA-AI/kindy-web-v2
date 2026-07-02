import type { CharacterVoice } from '../../lib/video-providers/types';
import type { EpisodeVoiceEmotion } from '../../lib/video-providers/director.types';

export interface StudioEmotionSpec {
  visual: string;
  voiceStyle: string;
}

export interface StudioCastMember {
  id: string;
  nameKo: string;
  description: string;
  visualPromptBase: string;
  voice: Exclude<CharacterVoice, 'auto'>;
  voiceStyle: string;
  emotions: Record<EpisodeVoiceEmotion, StudioEmotionSpec>;
}

export interface StudioBible {
  project: string;
  visualStyle: {
    colorPalette: {
      primary: {
        sage: string;
        saged: string;
        sages: string;
        sagebg: string;
        mist: string;
      };
      secondary: {
        cream: string;
        deep: string;
        line: string;
        gold: string;
        surface: string;
      };
    };
    artDirection: string;
    characterStyle: string;
    backgroundStyle: string;
    lighting: string;
  };
  cast: StudioCastMember[];
  narrator: {
    voice: 'Kore';
    style: string;
  };
  promptRules: {
    mandatoryPrefix: string;
    mandatorySuffix: string;
    negativePrompt: string;
    aspectRatio: '16:9';
    styleConsistencyTags: string[];
  };
}

export const EPISODE_VOICE_EMOTIONS: EpisodeVoiceEmotion[] = [
  'bright',
  'serious',
  'excited',
  'storytelling',
  'whisper',
];

const BASE_EMOTIONS: Record<EpisodeVoiceEmotion, StudioEmotionSpec> = {
  bright: {
    visual: 'sparkling eyes, wide warm smile, light bounce',
    voiceStyle: '밝고 신나게, 웃음기를 담아',
  },
  serious: {
    visual: 'focused eyes, small closed mouth, leaning in',
    voiceStyle: '차분하고 진지하게, 조금 느리게',
  },
  excited: {
    visual: 'wide open eyes, ears up, big open smile',
    voiceStyle: '들뜬 목소리로 빠르고 높게, 감탄하듯',
  },
  storytelling: {
    visual: 'gentle gesture toward the listener, soft eyes',
    voiceStyle: '옛날이야기 들려주듯 부드럽고 리듬감 있게',
  },
  whisper: {
    visual: 'paw near mouth, hushed pose',
    voiceStyle: '비밀을 말하듯 아주 작게 조심스럽게 속삭이며',
  },
};

function emotions(overrides: Partial<Record<EpisodeVoiceEmotion, Partial<StudioEmotionSpec>>> = {}): Record<EpisodeVoiceEmotion, StudioEmotionSpec> {
  return EPISODE_VOICE_EMOTIONS.reduce((acc, emotion) => {
    acc[emotion] = {
      ...BASE_EMOTIONS[emotion],
      ...overrides[emotion],
    };
    return acc;
  }, {} as Record<EpisodeVoiceEmotion, StudioEmotionSpec>);
}

export const ANIMAL_VILLAGE_BIBLE: StudioBible = {
  project: '모리 동물마을 스튜디오 바이블',
  visualStyle: {
    colorPalette: {
      primary: {
        sage: '#5F735F',
        saged: '#3F5140',
        sages: '#AFC4AE',
        sagebg: '#DDE8DE',
        mist: '#F0F3EE',
      },
      secondary: {
        cream: '#FBF7EF',
        deep: '#EEE5D4',
        line: '#E3D8C8',
        gold: '#D19A43',
        surface: '#FFFFFF',
      },
    },
    artDirection: '2D stylized illustration with soft gradients and rounded shapes. Children\'s picture book meets modern animation concept art. NOT photorealistic, NOT 3D render.',
    characterStyle: 'cute round animal friends with expressive large eyes, simple facial features, soft fluffy bodies, clearly drawn mouths',
    backgroundStyle: 'warm storybook forest village — rolling hills, heart-tree, story library, starlight festival lanterns, layered soft depth',
    lighting: 'warm sunlight and gentle lantern glow, soft shadows, no harsh contrast',
  },
  cast: [
    {
      id: 'toto',
      nameKo: '모리',
      description: '책정령 호스트. 유일하게 화면 밖 아이를 보는 다정한 안내자. 크림색 보송한 몸, 세이지 스카프, 큰 잎/책장 귀, 작고 자신감 있는 미소.',
      visualPromptBase: 'Mori, a tiny cream-colored fluffy book spirit host with a sage green scarf, large leaf-and-book-page ears, expressive eyes, and a small confident smile, warmly looking toward the child beyond the camera',
      voice: 'Puck',
      voiceStyle: '7살 아이처럼 아주 높고 맑은 목소리로, 밝고 다정하게. 아이에게 말 걸듯 또박또박. 절대 어른 목소리가 아닌.',
      emotions: emotions({
        storytelling: {
          visual: 'gentle guiding gesture toward the child, soft eyes, small confident smile',
        },
      }),
    },
    {
      id: 'kkumi',
      nameKo: '꾸미',
      description: '아기 곰 주인공. 수줍고 마음 여린 친구로, 슬픔과 위로를 맡는다. 여린 마음에서 씩씩함으로 천천히 나아간다.',
      visualPromptBase: 'Kkumi, a shy baby bear with a soft round body, gentle eyes, small cautious posture, and tender expressions that shift from teary to brave',
      voice: 'Fenrir',
      voiceStyle: '8살 남자아이가 힘없이 천천히 말하듯, 높지만 살짝 가라앉은 목소리. 수줍고 여린 느낌. 절대 어른 목소리가 아닌.',
      emotions: emotions({
        bright: {
          visual: 'teary eyes becoming sparkling, shy warm smile, tiny brave bounce',
          voiceStyle: '조금 수줍지만 밝고 신나게, 웃음기를 담아',
        },
        serious: {
          visual: 'soft worried eyes, small closed mouth, paws held close',
        },
      }),
    },
    {
      id: 'bangul',
      nameKo: '방울',
      description: '활발한 강아지. 질문을 던지는 친구이며 너무 신나면 앞서 달린다. 기쁨과 자기조절을 맡는다.',
      visualPromptBase: 'Bangul, an energetic puppy friend with bright eyes, perky ears, a big open smile, and playful bouncing body language',
      voice: 'Aoede',
      voiceStyle: '9살 여자아이가 신나서 조잘대듯 높고 맑은 목소리. 질문 많고 활기찬 톤, 또박또박. 절대 어른 목소리가 아닌.',
      emotions: emotions({
        excited: {
          visual: 'extra wide open eyes, ears high, tail-wagging bounce, big open smile',
        },
        whisper: {
          visual: 'paw near mouth, playful hushed pose, curious eyes',
        },
      }),
    },
    {
      id: 'naong',
      nameKo: '나옹',
      description: '새침하지만 속정 깊은 고양이. 닮은점을 찾는 친구로, 부끄러움과 우정을 맡는다.',
      visualPromptBase: 'Naong, a neat young cat with delicate features, slightly shy posture, soft narrow smile, and warm caring eyes under a prim expression',
      voice: 'Despina',
      voiceStyle: '8살 여자아이가 조심스럽게 말하듯 높고 가는 목소리. 새침한데 다정함이 배어나는 톤. 절대 어른 목소리가 아닌.',
      emotions: emotions({
        bright: {
          visual: 'reserved sparkling eyes, tiny warm smile, light graceful bounce',
          voiceStyle: '조심스럽지만 밝게, 작은 웃음기를 담아',
        },
        storytelling: {
          visual: 'gentle paw gesture, soft eyes, shy caring smile',
        },
      }),
    },
    {
      id: 'doto',
      nameKo: '도토',
      description: '겁 많고 잘 숨는 다람쥐. 두려움과 용기를 맡고, 작은 용기를 낼 때 가장 빛난다.',
      visualPromptBase: 'Doto, a small timid squirrel with a fluffy tail, cautious round eyes, tiny paws near the chest, and a brave little smile emerging',
      voice: 'Leda',
      voiceStyle: '8살 남자아이가 걱정하며 말하듯 높고 여린 목소리. 조금 떨리듯 조심스러운 톤. 절대 어른 목소리가 아닌.',
      emotions: emotions({
        serious: {
          visual: 'worried focused eyes, small closed mouth, leaning carefully forward',
          voiceStyle: '걱정이 조금 담기지만 차분하고 진지하게, 조금 느리게',
        },
        excited: {
          visual: 'wide open eyes, tail lifted, surprised brave smile',
          voiceStyle: '겁이 조금 섞인 들뜬 목소리로 빠르고 높게, 감탄하듯',
        },
      }),
    },
    {
      id: 'owl',
      nameKo: '올빼미 할아버지',
      description: '밤의 지혜를 가진 올빼미 이야기꾼. 도입과 마무리에서 차분하게 길을 열고 닫는다.',
      visualPromptBase: 'Grandpa Owl, a calm wise owl storyteller with round glasses-like eyes, soft feathers, gentle wings, and a peaceful bedtime-story presence',
      voice: 'Enceladus',
      voiceStyle: '10살 남자아이가 차분하고 깊게 이야기하듯, 살짝 낮지만 어린이 음색. 천천히 또박또박. 절대 어른 목소리가 아닌.',
      emotions: emotions({
        storytelling: {
          visual: 'gentle wing gesture toward the listener, moonlit soft eyes, calm storyteller posture',
          voiceStyle: '밤 이야기를 들려주듯 부드럽고 리듬감 있게',
        },
        whisper: {
          visual: 'wing near beak, hushed pose, soft moonlit eyes',
        },
      }),
    },
  ],
  narrator: {
    voice: 'Kore',
    style: '어린이 교육 방송 여자 내레이터처럼 따뜻하고 차분하며 신뢰감 있게. EBS 어린이 프로그램 내레이션 느낌으로 또박또박.',
  },
  promptRules: {
    mandatoryPrefix: 'Children\'s picture-book animation concept art, 2D stylized illustration, warm cream and sage green palette,',
    mandatorySuffix: 'soft warm lighting, rounded gentle shapes, cozy storybook forest village, safe and warm mood, high quality, detailed',
    negativePrompt: 'photorealistic, 3D render, scary, horror, dark shadows, villain, predator, sharp teeth, violence, letter A above head, floating letters, any text, captions, subtitles, logo, watermark, UI elements, realistic human',
    aspectRatio: '16:9',
    styleConsistencyTags: [
      'children\'s picture book style',
      'soft gradient shading',
      'cream and sage color harmony',
      'cute round animal friends',
      'warm storybook forest village',
    ],
  },
};

export function getCastMember(id: string): StudioCastMember | null {
  return ANIMAL_VILLAGE_BIBLE.cast.find((member) => member.id === id) ?? null;
}

export function resolveVoiceCasting(speakerId?: string): { voice: Exclude<CharacterVoice, 'auto'>; style: string } {
  const member = speakerId ? getCastMember(speakerId) : null;
  if (member) {
    return { voice: member.voice, style: member.voiceStyle };
  }
  return { voice: ANIMAL_VILLAGE_BIBLE.narrator.voice, style: ANIMAL_VILLAGE_BIBLE.narrator.style };
}

export function resolveVoiceStyle(speakerId: string | undefined, emotion?: EpisodeVoiceEmotion): string {
  const casting = resolveVoiceCasting(speakerId);
  const member = speakerId ? getCastMember(speakerId) : null;
  const emotionStyle = member && emotion ? member.emotions[emotion]?.voiceStyle : undefined;
  return emotionStyle ? `${casting.style} ${emotionStyle}.` : casting.style;
}

export function wrapWithPromptRules(core: string): string {
  const { mandatoryPrefix, mandatorySuffix, negativePrompt, styleConsistencyTags } = ANIMAL_VILLAGE_BIBLE.promptRules;
  return [
    `${mandatoryPrefix} ${core.trim()} ${mandatorySuffix}`,
    `Style consistency: ${styleConsistencyTags.join(', ')}`,
    `NEGATIVE (must NOT appear): ${negativePrompt}`,
  ].join('\n');
}
