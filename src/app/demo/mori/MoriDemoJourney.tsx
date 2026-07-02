'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import InteractiveVideoPlayer from '@/components/game/InteractiveVideoPlayer';
import MoriCharacter from '@/components/MoriCharacter';
import {
  MORI_DEMO_CHOICE_ID_BY_OPTION_ID,
  MORI_DEMO_GRAPH,
  MORI_DEMO_OPTION_AXIS_BY_ID,
} from '@/data/demo/mori-demo-graph';
import { C6_AXES, C6_AXIS_BY_ID, type C6AxisId } from '@/lib/c6/axes';
import {
  serializeDemoObservationDocumentCookie,
  type DemoObservationChoice,
  type DemoObservationCookie,
} from '@/lib/demo-observation';
import type { GameRoundResult } from '@/types/game';

const START_HREF = '/start?from=ai-diagnosis';
const SAMPLE_REPORT_HREF = '/sample/report';

const DEMO_AXIS_PRIORITY: readonly C6AxisId[] = [
  'C5_imagination_analogy',
  'C2_observation_inquiry',
  'C3_pattern_problem',
  'C4_language_expression',
  'C6_social_emotional',
];

const DEMO_PRESENTED_AXIS_IDS = DEMO_AXIS_PRIORITY;

const STRENGTH_LINES: Record<C6AxisId, string> = {
  C1_focus_flow: '이야기 안에 머물며 다음 장면을 기다리는 힘을 먼저 살펴봤어요.',
  C2_observation_inquiry: '작은 흔적을 먼저 바라보는 힘을 먼저 살펴봤어요.',
  C3_pattern_problem: '반복과 차례를 이어 보는 힘을 먼저 살펴봤어요.',
  C4_language_expression: '본 것을 자기 말과 그림으로 잇는 힘을 먼저 살펴봤어요.',
  C5_imagination_analogy: '서로 다른 것을 포근하게 이어 보는 힘을 먼저 살펴봤어요.',
  C6_social_emotional: '친구의 표정과 상황을 함께 바라보는 힘을 먼저 살펴봤어요.',
};

const GROWTH_LINES: Record<C6AxisId, string> = {
  C1_focus_flow: '별빛 씨앗이 더 자랄 수 있어요.',
  C2_observation_inquiry: '반짝 씨앗이 더 자랄 수 있어요.',
  C3_pattern_problem: '물방울 씨앗이 더 자랄 수 있어요.',
  C4_language_expression: '말 씨앗이 더 자랄 수 있어요.',
  C5_imagination_analogy: '거꾸로 씨앗이 더 자랄 수 있어요.',
  C6_social_emotional: '마음 씨앗이 더 자랄 수 있어요.',
};

type JourneyState = 'watching' | 'card';

function buildObservation(choices: DemoObservationChoice[]): DemoObservationCookie {
  const strengthAxis = pickStrengthAxis(choices);
  const growthAxis = pickGrowthAxis(choices, strengthAxis);

  return {
    v: 1,
    choices,
    strength_axis: strengthAxis,
    growth_axis: growthAxis,
    created_at: new Date().toISOString(),
  };
}

function pickStrengthAxis(choices: DemoObservationChoice[]): C6AxisId {
  const counts = new Map<C6AxisId, number>();

  choices.forEach((choice) => {
    counts.set(choice.axisId, (counts.get(choice.axisId) ?? 0) + 1);
  });

  return DEMO_AXIS_PRIORITY.reduce<C6AxisId>((selected, axisId) => {
    const selectedCount = counts.get(selected) ?? 0;
    const axisCount = counts.get(axisId) ?? 0;

    if (axisCount > selectedCount) return axisId;
    return selected;
  }, DEMO_AXIS_PRIORITY[0]);
}

function pickGrowthAxis(choices: DemoObservationChoice[], strengthAxis: C6AxisId): C6AxisId {
  const selected = new Set(choices.map((choice) => choice.axisId));
  // The demo presents five axes and records three choices, so at least two presented axes remain unselected.
  return DEMO_PRESENTED_AXIS_IDS.find((axisId) => axisId !== strengthAxis && !selected.has(axisId))
    ?? DEMO_PRESENTED_AXIS_IDS.find((axisId) => axisId !== strengthAxis)
    ?? strengthAxis;
}

function axisMeta(axisId: C6AxisId) {
  return C6_AXIS_BY_ID.get(axisId) ?? C6_AXES[0];
}

export default function MoriDemoJourney() {
  const [journeyState, setJourneyState] = useState<JourneyState>('watching');
  const [observation, setObservation] = useState<DemoObservationCookie | null>(null);
  const choicesRef = useRef<DemoObservationChoice[]>([]);

  const handleRoundResult = useCallback((result: GameRoundResult) => {
    const optionId = result.objective_code;
    if (!optionId) return;

    const axisId = MORI_DEMO_OPTION_AXIS_BY_ID[optionId as keyof typeof MORI_DEMO_OPTION_AXIS_BY_ID];
    const choiceId = MORI_DEMO_CHOICE_ID_BY_OPTION_ID[optionId as keyof typeof MORI_DEMO_CHOICE_ID_BY_OPTION_ID];
    if (!axisId || !choiceId) return;

    choicesRef.current = [
      ...choicesRef.current.filter((choice) => choice.choiceId !== choiceId),
      { choiceId, optionId, axisId },
    ];
  }, []);

  const handleComplete = useCallback(() => {
    const nextObservation = buildObservation(choicesRef.current);
    document.cookie = serializeDemoObservationDocumentCookie(nextObservation);
    setObservation(nextObservation);
    setJourneyState('card');
  }, []);

  if (journeyState === 'card' && observation) {
    const strength = axisMeta(observation.strength_axis);
    const growth = axisMeta(observation.growth_axis);

    return (
      <main className="min-h-screen bg-cream px-5 py-8 text-ink [word-break:keep-all] sm:px-8">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col justify-center">
          <div className="text-center">
            <MoriCharacter
              className="mx-auto h-24 w-24 overflow-hidden rounded-full border border-line bg-white"
              imageClassName="scale-125"
              label="모리"
              withGlow={false}
            />
            <p className="mt-5 text-xs font-black uppercase tracking-[.16em] text-sage">첫 씨앗 카드</p>
            <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
              모리가 작은 씨앗을
              <br />
              함께 살펴봤어요
            </h1>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
              <p className="text-xs font-black text-sage">강점 씨앗</p>
              <h2 className="mt-2 text-2xl font-black leading-tight">{strength.child_label}</h2>
              <p className="mt-1 text-sm font-black text-ink3">{strength.parent_label}</p>
              <p className="mt-4 text-sm font-semibold leading-relaxed text-ink2">{STRENGTH_LINES[strength.id]}</p>
            </section>

            <section className="rounded-3xl border border-line bg-white p-5 shadow-sm">
              <p className="text-xs font-black text-clay">더 자랄 씨앗</p>
              <h2 className="mt-2 text-2xl font-black leading-tight">{growth.child_label}</h2>
              <p className="mt-1 text-sm font-black text-ink3">{growth.parent_label}</p>
              <p className="mt-4 text-sm font-semibold leading-relaxed text-ink2">{GROWTH_LINES[growth.id]}</p>
            </section>
          </div>

          <p className="mx-auto mt-7 max-w-lg text-center text-base font-black leading-relaxed text-saged">
            하루 15분, 이야기 하나면 충분해요
          </p>

          <div className="mx-auto mt-5 grid w-full max-w-sm gap-3">
            <Link
              href={START_HREF}
              className="inline-flex min-h-14 items-center justify-center rounded-full bg-saged px-7 text-base font-black text-white shadow-[0_18px_36px_-18px_rgba(35,49,38,.64)] transition hover:bg-ink active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2"
            >
              모리와 이어 보기
            </Link>
            <Link
              href={SAMPLE_REPORT_HREF}
              className="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-black text-ink3 transition hover:bg-mist hover:text-saged active:scale-[0.98]"
            >
              보호자 기록 예시 보기
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream px-5 py-8 text-ink [word-break:keep-all] sm:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center justify-center">
        <InteractiveVideoPlayer
          graph={MORI_DEMO_GRAPH}
          childName="아이"
          onRoundResult={handleRoundResult}
          onComplete={handleComplete}
        />
      </section>
    </main>
  );
}
