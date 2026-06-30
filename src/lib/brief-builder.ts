/**
 * Child + 학습 과정 선택 → Claude director 용 VideoBrief 로 변환.
 *
 * MVP 매핑 규칙 (GACS-3 피드백 루프는 다음 단계에서 가중치 적용):
 *   - topic: 학습 과정의 첫 에피소드 제목 (예: "비는 왜 올까?")
 *   - audience: `${age}세 (${audienceLabel})`
 *   - targetDurationSec: 기본 30 (15s single-call, 30s video-extension 자동 분기)
 *   - learningGoals: 학습 과정 concept + 단서 질문 키워드
 *   - styleReference: 선택된 스타일 + Pinkfong/Pororo-level 고정
 *   - tone: "밝고 따뜻한, 호기심 자극"
 *   - protagonistHint: 동물 마을은 모리 고정. legacy 학습 과정은 미리(Miri) 힌트 유지.
 */

import { ANIMAL_VILLAGE } from '@/data/worlds/animal-village';
import { CURRICULUM_MAP, STYLE_OPTIONS, TOPIC_OPTIONS } from '@/types';
import type { VideoBrief } from './video-providers/director.types';

interface BuildBriefInput {
  childName: string;
  age: number;
  styles: string[];     // ['story_forest', 'pattern_hill'] — STYLE_OPTIONS id
  topic: string;        // 'science' | 'english'
  episodeIndex?: number; // 0-based, 기본 0 (첫 에피소드)
  targetDurationSec?: number;
}

function audienceLabel(age: number): string {
  if (age <= 4) return '유아';
  if (age <= 6) return '유치원';
  return '초등 저학년';
}

function styleReferenceFrom(styleIds: string[]): string {
  const picks = styleIds
    .map((id) => STYLE_OPTIONS.find((s) => s.id === id)?.description)
    .filter(Boolean)
    .join(', ');
  const base = 'cinematic 2D cel animation with soft watercolor backgrounds, K-pop idol inspired character design meets Pinkfong/Pororo-level kid-friendly aesthetic, pastel palette, single-take feel';
  return picks ? `${base}. Scene mood: ${picks}` : base;
}

function MIRI_HINT(): string {
  return [
    '**인간형 여자아이 주인공 "미리(Miri)"**, 8~9세, K-pop 아이돌 스타일 (하이 포니테일 + 하늘색 물방울 헤어핀, 반짝이는 큰 갈색 눈, 분홍 볼, 또렷한 분홍 입술, 하늘색-화이트 후드 원피스 + 구름 자수, 흰 레깅스, 노란 레인부츠, 물방울 펜던트).',
    '입술·치아가 항상 명확히 렌더링되어야 함 (AI 립싱크 필수 조건).',
    '대사 있는 씬은 medium shot 이상 + 3/4 front angle 우선.',
    '표정 range: neutral smile / talking with teeth / surprised O / cheerful wide smile.',
  ].join(' ');
}

function MORI_HINT(): string {
  return [
    '**브랜드 마스코트 "모리(Mori)"**, 부드러운 크림색 털과 세이지 그린 스카프를 가진 작은 책정령.',
    '큰 귀는 펼친 책장처럼 보이고, 귀 안쪽은 종이 페이지 결을 가진다. 머리 위 문자나 로고 장식은 넣지 않는다.',
    '가슴에는 따뜻한 하트 불빛이 있고, 표정은 장난스럽지만 다정하다. 손과 발은 둥글고 말랑한 세이지색.',
    '3D plush storybook character, soft tactile fabric, warm cream background, gentle studio lighting, no scary shadows.',
    '대사 장면은 medium shot 이상, 얼굴과 입 모양이 잘 보이는 3/4 front angle 우선.',
  ].join(' ');
}

export function buildAnimalVillageFirstVideoBrief(input: {
  childName: string;
  age: number;
  targetDurationSec?: number;
}): VideoBrief {
  const session = ANIMAL_VILLAGE.sessions[0];
  const plan = session.firstVideo;
  const beats = plan.beats.map((beat, index) =>
    `${index + 1}. ${beat.visual_ko} / ${beat.narration_ko}`,
  );

  return {
    topic: plan.title,
    audience: `${input.age}세 ${audienceLabel(input.age)}`,
    targetDurationSec: input.targetDurationSec ?? plan.durationSec,
    learningGoals: [
      ...plan.teachingFocus,
      `영상 후 질문 후보: ${plan.quizPrompts.join(' / ')}`,
    ],
    styleReference: [
      'premium 3D plush storybook animation',
      'warm cream and sage palette matching Mori reference',
      'soft rounded animal-village props, readable facial expressions, slow camera movement',
      'clear visual clues for preschool and early elementary children',
    ].join(', '),
    tone: '따뜻하고 장난스럽지만 과하게 빠르지 않은 탐정 놀이',
    roughSynopsis: `${input.childName}에게 보여줄 첫 모리 영상. ${plan.logline} 장면 구성: ${beats.join(' ')}`,
    protagonistHint: MORI_HINT(),
  };
}

export function buildBriefFromChild(input: BuildBriefInput): VideoBrief {
  const { childName, age, styles, topic, episodeIndex = 0, targetDurationSec } = input;

  if (topic === 'animal-village') {
    return buildAnimalVillageFirstVideoBrief({ childName, age, targetDurationSec });
  }

  const ageBand = CURRICULUM_MAP[topic]?.[age];
  const episode = ageBand?.episodes?.[episodeIndex];
  const topicLabel = TOPIC_OPTIONS.find((t) => t.id === topic)?.label ?? topic;

  const subject = episode?.title ?? `${topicLabel} 학습`;
  const concept = episode?.concept ?? ageBand?.description ?? '';
  const quizKeywords = episode?.quiz?.flatMap((q) => q.options).slice(0, 6) ?? [];

  const learningGoals = [
    concept && `${concept} — 감각적으로 이해하기`,
    `${age}세 ${topicLabel} 학습 과정 (${ageBand?.theme ?? '기본 주제'}) 흐름에 맞춘 개념 전달`,
    quizKeywords.length ? `핵심 키워드: ${quizKeywords.slice(0, 4).join(', ')}` : null,
  ].filter(Boolean) as string[];

  const roughSynopsis = `${childName}(${age}세)에게 보여줄 "${subject}" 교육 영상. ` +
    `미리가 등장해 ${ageBand?.description ?? topicLabel}를 보여주고 한국어로 또박또박 설명한다. ` +
    `아이가 화면에 끝까지 집중할 수 있도록 single-take + 시각 임팩트 + 친근한 대사.`;

  return {
    topic: subject,
    audience: `${age}세 ${audienceLabel(age)}`,
    targetDurationSec: targetDurationSec ?? 30,
    learningGoals,
    styleReference: styleReferenceFrom(styles),
    tone: '밝고 따뜻하며 호기심을 자극하는',
    roughSynopsis,
    protagonistHint: MIRI_HINT(),
    // adjectives: GACS-3 Word Profile 연동 시 추가
  };
}

/** 영상 제목 생성 — 대본에서 받기 전 UI 가 미리 보여줄 placeholder */
export function titleFromBrief(childName: string, topicSubject: string): string {
  return `${childName}를 위한: ${topicSubject}`;
}
