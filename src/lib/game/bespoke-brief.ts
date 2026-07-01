/**
 * 비스포크 브리프 — 아이의 C6 약점(struggleTool)을 겨냥한 그 아이용 영상 생성 브리프.
 *
 * 초개인화 불변핵심의 실체: 진단(learning-profile)이 찾은 '시도했지만 버거운 도구'를
 * 다음 콘텐츠가 자연스럽게 연습시키도록 VideoBrief 를 구성한다. 주인공은 브랜드
 * 마스코트 모리, 배경은 동물 마을(공유 세계관)로 고정해 일관성 유지.
 */
import { C6_TOOLS, type C6ToolKey } from './c6-profile';
import type { VideoBrief } from '@/lib/video-providers/director.types';

const MORI_HINT = [
  '**브랜드 마스코트 "모리(Mori)"**, 부드러운 크림색 털과 세이지 그린 스카프를 가진 작은 책정령.',
  '큰 귀는 펼친 책장처럼 보이고 안쪽은 종이 페이지 결. 가슴에 따뜻한 하트 불빛, 장난스럽지만 다정한 표정.',
  '3D plush storybook character, soft tactile fabric, warm cream background, gentle studio lighting, no scary shadows.',
  '대사 장면은 medium shot 이상, 입 모양이 잘 보이는 3/4 front angle 우선.',
].join(' ');

const STYLE_REFERENCE =
  'cinematic 3D plush storybook animation, soft watercolor backgrounds, warm cream+sage palette, Pinkfong/Pororo-level kid-friendly, calm pacing, single-take feel';

function audienceLabel(age: number): string {
  if (age <= 4) return '유아';
  if (age <= 6) return '유치원';
  return '초등 저학년';
}

export interface BespokeBriefInput {
  childName: string;
  age: number;
  toolKey: C6ToolKey;
  /** 아이가 좋아하는 관심 테마(예: '공룡') — 외피만 스킨, 학습목표는 불변. */
  interestTheme?: string | null;
  targetDurationSec?: number;
}

export function buildBespokeBrief(input: BespokeBriefInput): VideoBrief {
  const tool = C6_TOOLS.find((t) => t.key === input.toolKey) ?? C6_TOOLS[0];
  const theme = input.interestTheme?.trim();
  const themeClause = theme ? ` (${input.childName}가 좋아하는 '${theme}' 소재로 자연스럽게 감싸되 학습 흐름은 그대로)` : '';

  return {
    topic: 'animal-village',
    audience: `${input.age}세 (${audienceLabel(input.age)})`,
    targetDurationSec: input.targetDurationSec ?? 30,
    learningGoals: [
      `'${tool.childPlayLabel}'를 자연스럽게 연습하게 하는 장면을 반드시 포함`,
      tool.nextBody,
      `${input.childName}가 스스로 ${tool.parentLabel} 방법을 써서 친구를 돕도록 유도`,
    ],
    styleReference: STYLE_REFERENCE,
    tone: '밝고 따뜻하며 호기심을 자극하되 과하게 빠르지 않은, 정답을 강요하지 않는',
    roughSynopsis:
      `모리와 동물 마을 친구들이 '${tool.childPlayLabel}'가 필요한 작은 사건을 만난다${themeClause}. ` +
      `${input.childName}가 직접 ${tool.parentLabel}로 단서를 풀어 친구를 돕는 짧은 이야기. 마지막은 열린 결말로 놀이로 이어지게.`,
    protagonistHint: MORI_HINT,
  };
}
