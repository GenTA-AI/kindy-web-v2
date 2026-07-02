'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import EmotionExpressionGame from '@/components/game/EmotionExpressionGame';
import HiddenFriendGame from '@/components/game/HiddenFriendGame';
import InteractiveVideoPlayer from '@/components/game/InteractiveVideoPlayer';
import JuiceBurst from '@/components/game/JuiceBurst';
import Mascot, { type MascotMood } from '@/components/game/Mascot';
import PuzzleGame from '@/components/game/PuzzleGame';
import MoriCharacter from '@/components/MoriCharacter';
import {
  FIRST_JOURNEY_ANALOGY_CHOICES,
  FIRST_JOURNEY_EMOTION_SPEC,
  FIRST_JOURNEY_ENTRY_SPEC,
  FIRST_JOURNEY_HIDDEN_SPEC,
  FIRST_JOURNEY_PATTERN_SPEC,
  FIRST_JOURNEY_ROUND_META,
  FIRST_JOURNEY_ROUNDS_TOTAL,
  FIRST_JOURNEY_RULE_SWITCH_SPECS,
  FIRST_JOURNEY_SEQUENCE_FALLBACK,
  FIRST_JOURNEY_TOPIC,
  FIRST_JOURNEY_VIDEO_GRAPH,
  FIRST_JOURNEY_VISIBLE_STEPS,
  FIRST_JOURNEY_WORD_IMAGE_SPEC,
  type AnalogyChoice,
  type FirstJourneyRoundKey,
  type FirstJourneyStepId,
} from '@/data/onboarding/first-journey';
import { C6_AXIS_BY_ID, type C6AxisId, type C6AxisMeta } from '@/lib/c6/axes';
import { emitGameEvent } from '@/lib/game/events-client';
import { useVoice } from '@/lib/useVoice';
import type { GameEvent, GameRoundResult } from '@/types/game';

type FirstJourneyShellProps = {
  childId: string;
  childName: string;
};

type SeedRecommendation = {
  strength: C6AxisMeta;
  growth: C6AxisMeta;
  recommendedAxisIds: [C6AxisId, C6AxisId];
  reasonCodes: ['bright_seed', 'growing_seed'];
};

const STEP_ORDER: readonly FirstJourneyStepId[] = [
  'entry',
  'hidden_sparkle',
  'rule_switch',
  'next_pattern',
  'heart_choice',
  'word_image',
  'cloud_idea',
  'starlight_video',
  'seed_summary',
];

const ROUND_INDEX: Record<FirstJourneyRoundKey, number> = {
  entry: 0,
  hidden_sparkle: 1,
  rule_switch: 2,
  next_pattern: 3,
  heart_choice: 4,
  word_image: 5,
  cloud_idea: 6,
  starlight_video: 7,
};

const STEP_LINES: Record<FirstJourneyStepId, { title: string; line: string; mascot: string; mood: MascotMood }> = {
  entry: {
    title: '모리의 숲 문이 열렸어',
    line: '모리가 너에게 빛나는 씨앗을 찾아볼게.',
    mascot: '준비되면 모리 손을 잡아줘.',
    mood: 'idle',
  },
  hidden_sparkle: {
    title: '나뭇잎 사이 반짝이를 찾아볼까?',
    line: '작은 빛은 천천히 볼수록 더 잘 보여.',
    mascot: '잎사귀 사이를 살펴보자.',
    mood: 'hint',
  },
  rule_switch: {
    title: '빛에서 모양으로 숲길이 바뀌었어',
    line: '처음에는 같은 빛, 다음에는 닮은 모양을 모아볼래?',
    mascot: '길이 바뀌어도 천천히 보면 돼.',
    mood: 'idle',
  },
  next_pattern: {
    title: '반짝 무늬가 이어지는 길',
    line: '비슷하게 이어지는 조각을 찾아 숲길을 밝혀줘.',
    mascot: '무늬가 속삭이는 짝을 찾아보자.',
    mood: 'hint',
  },
  heart_choice: {
    title: '친구 마음이 반짝이는 호수',
    line: '씨앗을 잃어버린 친구 마음을 골라볼래?',
    mascot: '어떤 마음이어도 괜찮아.',
    mood: 'idle',
  },
  word_image: {
    title: '그림과 말이 만나는 말장원',
    line: '그림이 들려주는 말을 이어줘.',
    mascot: '소리 내어 말해도 좋아.',
    mood: 'idle',
  },
  cloud_idea: {
    title: '이 구름은 무엇이 될 수 있을까?',
    line: '모리에게 떠오른 생각 하나를 보여줘.',
    mascot: '네 생각은 숲길을 새로 만들 수 있어.',
    mood: 'hint',
  },
  starlight_video: {
    title: '별빛 씨앗 이야기를 같이 볼까?',
    line: '짧은 이야기가 끝나면 모리가 한 번 물어볼게.',
    mascot: '영상이 멈추면 마음에 든 단서를 골라줘.',
    mood: 'idle',
  },
  seed_summary: {
    title: '오늘 빛난 씨앗 2개',
    line: '모리가 오늘의 반짝임을 모았어.',
    mascot: '보호자에게도 보여주자.',
    mood: 'cheer',
  },
};

function axisMeta(axisId: C6AxisId): C6AxisMeta {
  return C6_AXIS_BY_ID.get(axisId) ?? C6_AXIS_BY_ID.get('C1_focus_flow')!;
}

function nowMs(): number {
  return Date.now();
}

function boundedElapsed(value: number | null | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.round(value);
  return Math.max(0, Math.round(fallback));
}

function retryCountFor(result: GameRoundResult | null | undefined): number {
  return result?.retried ? 1 : 0;
}

function attemptCountFor(result: GameRoundResult | null | undefined): number {
  return 1 + retryCountFor(result);
}

function ratioFor(result: GameRoundResult): number | null {
  if (typeof result.score !== 'number' || typeof result.max_score !== 'number' || result.max_score <= 0) {
    return null;
  }
  return Math.max(0, Math.min(1, result.score / result.max_score));
}

function resultSignal(result: GameRoundResult): number {
  const base = ratioFor(result) ?? 0.72;
  const retryPenalty = (result.retry_count ?? retryCountFor(result)) * 0.08;
  const hintPenalty = (result.hint_count ?? 0) * 0.04;
  return Math.max(0.05, Math.min(1, base - retryPenalty - hintPenalty));
}

function chooseSeeds(results: readonly GameRoundResult[]): SeedRecommendation {
  const axisScores = new Map<C6AxisId, number[]>();

  for (const result of results) {
    const axisId = result.axis_id as C6AxisId | null | undefined;
    if (!axisId) continue;
    axisScores.set(axisId, [...(axisScores.get(axisId) ?? []), resultSignal(result)]);
  }

  const averaged = Array.from(axisScores.entries()).map(([axisId, scores]) => ({
    axisId,
    score: scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length),
  }));

  const fallbackStrength: C6AxisId = 'C2_observation_inquiry';
  const fallbackGrowth: C6AxisId = 'C5_imagination_analogy';
  const strengthId = averaged.sort((a, b) => b.score - a.score)[0]?.axisId ?? fallbackStrength;
  const growthId = averaged
    .filter((entry) => entry.axisId !== strengthId)
    .sort((a, b) => a.score - b.score)[0]?.axisId ?? fallbackGrowth;

  return {
    strength: axisMeta(strengthId),
    growth: axisMeta(growthId === strengthId ? fallbackGrowth : growthId),
    recommendedAxisIds: [strengthId, growthId === strengthId ? fallbackGrowth : growthId],
    reasonCodes: ['bright_seed', 'growing_seed'],
  };
}

function softReward(sticker: string): GameRoundResult['reward_payload'] {
  return {
    stars: 1,
    stickers: [sticker],
    collection_unlocks: [],
  };
}

export default function FirstJourneyShell({ childId, childName }: FirstJourneyShellProps) {
  const [stage, setStage] = useState<FirstJourneyStepId>('entry');
  const [ruleSwitchPhase, setRuleSwitchPhase] = useState<0 | 1>(0);
  const [savingIssue, setSavingIssue] = useState(false);
  const [juiceKey, setJuiceKey] = useState(0);
  const [recommendation, setRecommendation] = useState<SeedRecommendation | null>(null);
  const { speak, muted, toggleMute } = useVoice();

  const sessionIdRef = useRef<string | null>(null);
  const startPromiseRef = useRef<Promise<string | null> | null>(null);
  const eventQueueRef = useRef<Promise<void>>(Promise.resolve());
  const completedRef = useRef(false);
  const stageStartedAtRef = useRef(nowMs());
  const journeyStartMsRef = useRef(nowMs());
  const journeyStartIsoRef = useRef(new Date().toISOString());
  const roundResultsRef = useRef<GameRoundResult[]>([]);
  const recordedRoundKeysRef = useRef<Set<FirstJourneyRoundKey>>(new Set());
  const ruleSwitchStartedAtRef = useRef(nowMs());
  const firstRuleResultRef = useRef<GameRoundResult | null>(null);
  const emotionChoiceRef = useRef<string | null>(null);

  const stepIndex = STEP_ORDER.indexOf(stage);
  const visibleStep = Math.max(0, stepIndex);
  const lines = STEP_LINES[stage];

  const reportHref = useMemo(
    () => `/dashboard/report?childId=${encodeURIComponent(childId)}`,
    [childId],
  );

  const goToStage = useCallback((next: FirstJourneyStepId) => {
    const startedAt = nowMs();
    stageStartedAtRef.current = startedAt;
    if (next === 'rule_switch') {
      setRuleSwitchPhase(0);
      firstRuleResultRef.current = null;
      ruleSwitchStartedAtRef.current = startedAt;
    }
    setStage(next);
  }, []);

  useEffect(() => {
    speak({ text: lines.mascot });
  }, [lines.mascot, speak]);

  const rememberSession = useCallback((id: string | null | undefined) => {
    if (!id) return null;
    sessionIdRef.current = id;
    return id;
  }, []);

  const startGameSession = useCallback(async () => {
    if (sessionIdRef.current) return sessionIdRef.current;
    if (startPromiseRef.current) return startPromiseRef.current;

    startPromiseRef.current = (async () => {
      const result = await emitGameEvent(
        {
          type: 'game_started',
          payload: {
            source: 'first_journey',
            rounds_total: FIRST_JOURNEY_ROUNDS_TOTAL,
            journey_steps: FIRST_JOURNEY_VISIBLE_STEPS,
            start_time: journeyStartIsoRef.current,
            sequence_fallback: FIRST_JOURNEY_SEQUENCE_FALLBACK,
          },
        },
        { context: 'home', childId, topic: FIRST_JOURNEY_TOPIC },
      );

      if (!result.ok) {
        setSavingIssue(true);
        return null;
      }

      return rememberSession(result.game_session_id);
    })();

    const sessionId = await startPromiseRef.current;
    startPromiseRef.current = null;
    return sessionId;
  }, [childId, rememberSession]);

  const emitJourneyEvent = useCallback(
    async (event: GameEvent) => {
      const sessionId = event.type === 'game_started' ? null : await startGameSession();
      const payload = {
        ...(event.payload ?? {}),
        ...(sessionId && event.type !== 'game_started' ? { game_session_id: sessionId } : {}),
      };
      const result = await emitGameEvent(
        {
          ...event,
          payload: Object.keys(payload).length > 0 ? payload : undefined,
        },
        { context: 'home', childId, topic: FIRST_JOURNEY_TOPIC },
      );

      if (result.game_session_id) rememberSession(result.game_session_id);
      if (!result.ok) setSavingIssue(true);
      return result;
    },
    [childId, rememberSession, startGameSession],
  );

  const enqueueJourneyEvent = useCallback(
    (event: GameEvent) => {
      eventQueueRef.current = eventQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          await emitJourneyEvent(event);
        })
        .catch(() => {
          setSavingIssue(true);
        });
    },
    [emitJourneyEvent],
  );

  const completeRound = useCallback(
    (
      key: FirstJourneyRoundKey,
      rawResult: GameRoundResult,
      responsePayload: Record<string, unknown>,
      options: { elapsedMs?: number; hintCount?: number; retryCount?: number; rewardSticker?: string } = {},
    ) => {
      if (recordedRoundKeysRef.current.has(key)) return null;
      recordedRoundKeysRef.current.add(key);

      const meta = FIRST_JOURNEY_ROUND_META[key];
      const fallbackElapsed = nowMs() - stageStartedAtRef.current;
      const elapsedMs = boundedElapsed(options.elapsedMs ?? rawResult.latency_ms, fallbackElapsed);
      const retryCount = options.retryCount ?? retryCountFor(rawResult);
      const result: GameRoundResult = {
        ...rawResult,
        retried: rawResult.retried || retryCount > 0,
        reward_payload: rawResult.reward_payload ?? softReward(options.rewardSticker ?? meta.worldRegion),
        axis_id: meta.axisId,
        thinking_tool: meta.thinkingTool,
        story_seed_id: meta.storySeedId,
        world_region: meta.worldRegion,
        elapsed_ms: elapsedMs,
        hint_count: options.hintCount ?? 0,
        retry_count: retryCount,
        is_correct: null,
        response_payload: responsePayload,
      };

      roundResultsRef.current = [...roundResultsRef.current, result];
      setJuiceKey((current) => current + 1);
      enqueueJourneyEvent({
        type: 'game_round_completed',
        round_index: ROUND_INDEX[key],
        result,
      });
      return result;
    },
    [enqueueJourneyEvent],
  );

  const finishJourney = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    const nextRecommendation = chooseSeeds(roundResultsRef.current);
    setRecommendation(nextRecommendation);
    goToStage('seed_summary');

    enqueueJourneyEvent({
      type: 'game_completed',
      payload: {
        source: 'first_journey',
        rounds_total: FIRST_JOURNEY_ROUNDS_TOTAL,
        journey_steps: FIRST_JOURNEY_VISIBLE_STEPS,
        recommended_axis_ids: nextRecommendation.recommendedAxisIds,
        reason_codes: nextRecommendation.reasonCodes,
      },
    });
  }, [enqueueJourneyEvent, goToStage]);

  const handleEntry = (skipIntro: boolean) => {
    const elapsedMs = nowMs() - journeyStartMsRef.current;
    goToStage('hidden_sparkle');
    completeRound(
      'entry',
      {
        game_type: FIRST_JOURNEY_ENTRY_SPEC.game_type,
        difficulty: FIRST_JOURNEY_ENTRY_SPEC.params.difficulty,
        objective_code: FIRST_JOURNEY_ENTRY_SPEC.tag.objective_code,
        standard_anchor: FIRST_JOURNEY_ENTRY_SPEC.tag.standard_anchor,
        score: null,
        max_score: null,
        latency_ms: elapsedMs,
        retried: false,
        reward_payload: null,
      },
      {
        start_time: journeyStartIsoRef.current,
        skip_intro: skipIntro,
      },
      { elapsedMs, rewardSticker: '숲 문' },
    );
  };

  const handleHiddenComplete = (result: GameRoundResult) => {
    const elapsedMs = boundedElapsed(result.latency_ms, nowMs() - stageStartedAtRef.current);
    goToStage('rule_switch');
    completeRound(
      'hidden_sparkle',
      result,
      {
        found_count: result.score ?? 1,
        elapsed_ms: elapsedMs,
        hint_count: 0,
      },
      { elapsedMs, retryCount: retryCountFor(result), rewardSticker: '반짝이' },
    );
  };

  const handleRuleSwitchComplete = (result: GameRoundResult) => {
    if (ruleSwitchPhase === 0) {
      firstRuleResultRef.current = result;
      setRuleSwitchPhase(1);
      return;
    }

    const firstResult = firstRuleResultRef.current;
    const elapsedMs = nowMs() - ruleSwitchStartedAtRef.current;
    const retryCount = retryCountFor(firstResult) + retryCountFor(result);
    const score = typeof firstResult?.score === 'number' && typeof result.score === 'number'
      ? firstResult.score + result.score
      : result.score;
    const maxScore = typeof firstResult?.max_score === 'number' && typeof result.max_score === 'number'
      ? firstResult.max_score + result.max_score
      : result.max_score;

    goToStage('next_pattern');
    completeRound(
      'rule_switch',
      {
        ...result,
        score,
        max_score: maxScore,
        latency_ms: elapsedMs,
        retried: retryCount > 0,
        objective_code: 'first_journey_rule_switch',
        standard_anchor: 'first_journey_baseline',
      },
      {
        rule_switch_success: retryCountFor(result) === 0,
        attempts: attemptCountFor(firstResult) + attemptCountFor(result),
      },
      { elapsedMs, retryCount, rewardSticker: '바뀐 길' },
    );
  };

  const handlePatternComplete = (result: GameRoundResult) => {
    const elapsedMs = boundedElapsed(result.latency_ms, nowMs() - stageStartedAtRef.current);
    const retryCount = retryCountFor(result);
    goToStage('heart_choice');
    completeRound(
      'next_pattern',
      result,
      {
        accuracy: ratioFor(result),
        retry_count: retryCount,
        fallback: FIRST_JOURNEY_SEQUENCE_FALLBACK,
      },
      { elapsedMs, retryCount, rewardSticker: '무늬 길' },
    );
  };

  const handleEmotionComplete = (result: GameRoundResult) => {
    const elapsedMs = boundedElapsed(result.latency_ms, nowMs() - stageStartedAtRef.current);
    goToStage('word_image');
    completeRound(
      'heart_choice',
      result,
      {
        emotion_choice: emotionChoiceRef.current ?? '마음 고름',
        response_time: elapsedMs,
      },
      { elapsedMs, retryCount: 0, rewardSticker: '마음 호수' },
    );
  };

  const handleWordImageComplete = (result: GameRoundResult) => {
    const elapsedMs = boundedElapsed(result.latency_ms, nowMs() - stageStartedAtRef.current);
    goToStage('cloud_idea');
    completeRound(
      'word_image',
      result,
      {
        selected_answer: '그림과 말 연결',
        confidence_proxy: elapsedMs,
      },
      { elapsedMs, retryCount: retryCountFor(result), rewardSticker: '말장원' },
    );
  };

  const handleAnalogyChoice = (choice: AnalogyChoice) => {
    const elapsedMs = nowMs() - stageStartedAtRef.current;
    goToStage('starlight_video');
    completeRound(
      'cloud_idea',
      {
        game_type: 'decorate',
        difficulty: 1,
        objective_code: 'first_journey_analogy',
        standard_anchor: 'first_journey_baseline',
        score: null,
        max_score: null,
        latency_ms: elapsedMs,
        retried: false,
        reward_payload: null,
      },
      {
        idea_choice: choice.id,
        novelty_tag: choice.noveltyTag,
      },
      { elapsedMs, rewardSticker: '구름 생각' },
    );
  };

  const handleVideoRound = (result: GameRoundResult) => {
    const elapsedMs = boundedElapsed(result.latency_ms, nowMs() - stageStartedAtRef.current);
    completeRound(
      'starlight_video',
      result,
      {
        video_completion: true,
        quiz_result: '단서 선택',
      },
      { elapsedMs, retryCount: retryCountFor(result), rewardSticker: '별빛 이야기' },
    );
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-cream text-ink [overflow-wrap:anywhere] [word-break:keep-all]">
      <JourneyChromeStyles />
      <JuiceBurst fireKey={juiceKey} variant="stars" />

      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-56 bg-cover bg-center opacity-45"
        style={{ backgroundImage: "linear-gradient(180deg, rgba(251,247,239,.22), #FBF7EF), url('/ip/generated/hidden-forest.png')" }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-4 sm:px-6 sm:py-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MoriCharacter className="h-12 w-12 overflow-hidden rounded-full border border-line bg-white" imageClassName="scale-125" label="모리" withGlow={false} />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.16em] text-sage">Mori Forest</p>
              <h1 className="text-lg font-black leading-tight text-ink sm:text-xl">모리의 숲 입장 여행</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleMute}
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-2xl border border-line bg-white px-3 text-sm font-black text-saged shadow-sm transition hover:bg-mist active:scale-[0.98]"
            aria-label={muted ? '소리 켜기' : '소리 끄기'}
          >
            {muted ? '소리 켜기' : '소리 끄기'}
          </button>
        </header>

        <nav aria-label="숲길 발자국" className="mt-5">
          <ol className="flex items-center gap-2">
            {STEP_ORDER.map((step, index) => (
              <li key={step} className="flex flex-1 items-center">
                <span
                  aria-current={step === stage ? 'step' : undefined}
                  className={`h-3 min-w-3 flex-1 rounded-full transition ${
                    index <= visibleStep ? 'bg-saged shadow-sm shadow-sagebg' : 'bg-white/80 ring-1 ring-line'
                  }`}
                />
              </li>
            ))}
          </ol>
        </nav>

        <section className="mt-5 grid flex-1 content-start gap-5 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <aside className="rounded-[28px] border border-line bg-white/92 p-5 shadow-sm backdrop-blur sm:p-6 lg:sticky lg:top-6">
            <div className="flex items-start gap-4">
              <MoriCharacter className="h-24 w-24 shrink-0 overflow-hidden rounded-[24px] border border-line bg-cream" imageClassName="scale-125" label="모리" />
              <div>
                <h2 className="text-2xl font-black leading-tight text-ink sm:text-3xl">{lines.title}</h2>
                <p className="mt-3 text-base font-bold leading-relaxed text-ink2">{lines.line}</p>
              </div>
            </div>
            {savingIssue && (
              <p className="mt-4 rounded-2xl border border-clay/30 bg-cream px-4 py-3 text-sm font-bold leading-relaxed text-clay">
                보호자 화면 반영이 조금 늦을 수 있어요.
              </p>
            )}
          </aside>

          <div className="min-w-0">
            {stage === 'entry' && (
              <EntryStep
                childName={childName}
                disabled={false}
                onStart={() => void handleEntry(false)}
                onSkip={() => void handleEntry(true)}
              />
            )}

            {stage === 'hidden_sparkle' && (
              <div className="first-journey-hidden">
                <HiddenFriendGame
                  spec={FIRST_JOURNEY_HIDDEN_SPEC}
                  childName={childName}
                  prompt="나뭇잎 사이 반짝이를 찾아볼래?"
                  feedback={{
                    success: '반짝이가 손을 흔들었어.',
                    retry: '다른 잎도 천천히 볼까?',
                    hint: '작은 빛은 가장자리에도 숨어 있어.',
                  }}
                  onComplete={(result) => void handleHiddenComplete(result)}
                  onCorrect={() => speak({ text: '반짝이를 찾았어.' })}
                  onWrong={() => speak({ text: '괜찮아, 다른 잎도 살펴보자.' })}
                  onSpeak={(text) => speak({ text })}
                />
              </div>
            )}

            {stage === 'rule_switch' && (
              <div className="first-journey-puzzle">
                <PuzzleGame
                  key={`rule-switch-${ruleSwitchPhase}`}
                  spec={FIRST_JOURNEY_RULE_SWITCH_SPECS[ruleSwitchPhase]}
                  childName={childName}
                  feedback={{
                    success: ruleSwitchPhase === 0 ? '빛끼리 모였어. 이제 길이 바뀔 거야.' : '새 길도 잘 따라왔어.',
                    retry: '다른 바구니도 천천히 살펴볼까?',
                    hint: '먼저 카드를 고르고 닮은 바구니를 톡 눌러.',
                  }}
                  onComplete={(result) => void handleRuleSwitchComplete(result)}
                />
              </div>
            )}

            {stage === 'next_pattern' && (
              <div className="first-journey-puzzle">
                <PuzzleGame
                  spec={FIRST_JOURNEY_PATTERN_SPEC}
                  childName={childName}
                  feedback={{
                    success: '무늬 길이 반짝였어.',
                    retry: '다른 무늬도 이어서 살펴볼까?',
                    hint: '앞뒤가 닮은 조각을 찾아봐.',
                  }}
                  onComplete={(result) => void handlePatternComplete(result)}
                />
              </div>
            )}

            {stage === 'heart_choice' && (
              <div
                className="first-journey-emotion"
                onClickCapture={(event) => {
                  const target = event.target as HTMLElement;
                  const button = target.closest('button[aria-pressed]');
                  const label = button?.textContent?.trim();
                  if (label) emotionChoiceRef.current = label;
                }}
              >
                <EmotionExpressionGame
                  spec={FIRST_JOURNEY_EMOTION_SPEC}
                  childName={childName}
                  activityTitle="친구 마음 고르기"
                  prompt="씨앗을 잃어버린 친구 마음은 어떨까?"
                  clipPosterUrl="/ip/generated/squirrel-friend.png"
                  onComplete={(result) => void handleEmotionComplete(result)}
                />
              </div>
            )}

            {stage === 'word_image' && (
              <div className="first-journey-puzzle">
                <PuzzleGame
                  spec={FIRST_JOURNEY_WORD_IMAGE_SPEC}
                  childName={childName}
                  feedback={{
                    success: '그림과 말이 손을 잡았어.',
                    retry: '그림을 한 번 더 보고 이어볼까?',
                    hint: '그림 이름을 입으로 말해봐.',
                  }}
                  onComplete={(result) => void handleWordImageComplete(result)}
                />
              </div>
            )}

            {stage === 'cloud_idea' && (
              <CloudIdeaStep
                choices={FIRST_JOURNEY_ANALOGY_CHOICES}
                disabled={false}
                onChoose={(choice) => void handleAnalogyChoice(choice)}
              />
            )}

            {stage === 'starlight_video' && (
              <div className="first-journey-video">
                <InteractiveVideoPlayer
                  graph={FIRST_JOURNEY_VIDEO_GRAPH}
                  childName={childName}
                  onRoundResult={handleVideoRound}
                  onComplete={() => void finishJourney()}
                />
              </div>
            )}

            {stage === 'seed_summary' && recommendation && (
              <SeedSummary childName={childName} recommendation={recommendation} reportHref={reportHref} />
            )}
          </div>
        </section>
      </div>

      {stage !== 'seed_summary' && <Mascot mood={lines.mood} message={lines.mascot} onSpeak={(text) => speak({ text })} />}
    </main>
  );
}

function EntryStep({
  childName,
  disabled,
  onStart,
  onSkip,
}: {
  childName: string;
  disabled: boolean;
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-line bg-white shadow-sm">
      <div className="relative min-h-[440px] bg-cover bg-center p-5 sm:p-7" style={{ backgroundImage: "linear-gradient(180deg, rgba(255,255,255,.72), rgba(251,247,239,.94)), url('/ip/generated/mori-hero.png')" }}>
        <div className="flex min-h-[390px] flex-col justify-end">
          <MoriCharacter className="h-40 w-40 overflow-hidden rounded-[32px] border border-line bg-white/80 shadow-sm" imageClassName="scale-125" label="모리" />
          <h2 className="mt-5 max-w-xl text-3xl font-black leading-tight text-ink sm:text-4xl">
            {childName}, 모리랑 숲길에 들어가 볼래?
          </h2>
          <p className="mt-3 max-w-lg text-base font-bold leading-relaxed text-ink2">
            빛나는 씨앗은 네가 고르고 찾는 순간마다 조금씩 반짝여.
          </p>
          <div className="mt-6 grid gap-3 sm:max-w-sm">
            <button
              type="button"
              disabled={disabled}
              onClick={onStart}
              className="min-h-14 rounded-2xl bg-saged px-6 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
            >
              모리 손잡기
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onSkip}
              className="min-h-12 rounded-2xl border border-line bg-white/88 px-6 text-sm font-black text-saged transition hover:bg-mist active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
            >
              바로 숲길 걷기
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CloudIdeaStep({
  choices,
  disabled,
  onChoose,
}: {
  choices: readonly AnalogyChoice[];
  disabled: boolean;
  onChoose: (choice: AnalogyChoice) => void;
}) {
  return (
    <section className="rounded-[28px] border border-line bg-white p-4 shadow-sm sm:p-5">
      <div className="relative overflow-hidden rounded-[24px] bg-sky-50 px-5 py-8 text-center ring-1 ring-sky-100">
        <div className="mx-auto flex h-28 w-48 items-center justify-center rounded-[48px] bg-white text-5xl shadow-sm ring-1 ring-sky-100" aria-hidden="true">
          구름
        </div>
        <h2 className="mt-5 text-2xl font-black leading-tight text-ink">무엇으로 보일까?</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            disabled={disabled}
            onClick={() => onChoose(choice)}
            className="flex min-h-[156px] flex-col items-center justify-center rounded-3xl border-2 border-line bg-cream p-4 text-center transition hover:border-sage hover:bg-mist active:scale-[0.97] disabled:cursor-wait disabled:opacity-70"
          >
            <span className="text-4xl" aria-hidden="true">{choice.token}</span>
            <span className="mt-3 text-lg font-black text-ink sm:text-xl">{choice.label}</span>
            <span className="mt-1 text-xs font-bold leading-relaxed text-ink3 sm:text-sm">{choice.helper}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SeedSummary({
  childName,
  recommendation,
  reportHref,
}: {
  childName: string;
  recommendation: SeedRecommendation;
  reportHref: string;
}) {
  return (
    <section className="rounded-[28px] border border-line bg-white p-5 text-center shadow-sm sm:p-7">
      <MoriCharacter className="mx-auto h-32 w-32 overflow-hidden rounded-[32px] border border-line bg-cream" imageClassName="scale-125" label="모리" />
      <p className="mt-4 text-[11px] font-black uppercase tracking-[.16em] text-sage">오늘 빛난 씨앗</p>
      <h2 className="mt-2 text-3xl font-black leading-tight text-ink">
        모리가 {childName}의 반짝임을 봤어
      </h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <SeedCard
          label="오늘 환하게 빛났어"
          axis={recommendation.strength}
          tone="bright"
        />
        <SeedCard
          label="다음 숲길에서 더 키워볼래"
          axis={recommendation.growth}
          tone="grow"
        />
      </div>
      <Link
        href={reportHref}
        className="mt-7 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-saged px-6 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98] sm:w-auto sm:min-w-72"
      >
        보호자에게 보여주기
      </Link>
    </section>
  );
}

function SeedCard({
  label,
  axis,
  tone,
}: {
  label: string;
  axis: C6AxisMeta;
  tone: 'bright' | 'grow';
}) {
  return (
    <article className={`rounded-3xl border p-5 text-left ${tone === 'bright' ? 'border-gold/40 bg-amber-50' : 'border-sagebg bg-mist'}`}>
      <p className="text-xs font-black text-saged">{label}</p>
      <h3 className="mt-2 text-2xl font-black text-ink">{axis.child_label}</h3>
      <p className="mt-2 text-sm font-bold leading-relaxed text-ink2">{axis.parent_label} 숲길에서 반짝였어.</p>
    </article>
  );
}

function JourneyChromeStyles() {
  return (
    <style>
      {`
        .first-journey-hidden > section > p:first-child,
        .first-journey-puzzle > section > div:first-child > div:first-child > div:first-child > p,
        .first-journey-emotion section[aria-labelledby='emotion-expression-title'] > div > div:first-child p.text-xs {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .first-journey-puzzle > section > div:first-child > div:first-child > span,
        .first-journey-puzzle [role='progressbar'],
        .first-journey-hidden div[aria-live='polite'] span > span[aria-hidden='true'],
        .first-journey-puzzle div[aria-live='polite'] span > span[aria-hidden='true'] {
          display: none;
        }
      `}
    </style>
  );
}
