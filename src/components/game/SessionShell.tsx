'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LibraryPlayer from '@/components/LibraryPlayer';
import EmotionExpressionGame from '@/components/game/EmotionExpressionGame';
import PuzzleGame from '@/components/game/PuzzleGame';
import HiddenFriendGame from '@/components/game/HiddenFriendGame';
import DecorateGame from '@/components/game/DecorateGame';
import JuiceBurst from '@/components/game/JuiceBurst';
import Mascot, { type MascotMood } from '@/components/game/Mascot';
import RewardMeta from '@/components/game/RewardMeta';
import { emitGameEvent } from '@/lib/game/events-client';
import { nextDifficulty, planRound } from '@/lib/game/engine';
import { applyReward, rewardForRound } from '@/lib/game/rewards';
import { aggregateSelActivities, dialogueStarters } from '@/lib/game/sel-report';
import { useVoice } from '@/lib/useVoice';
import {
  CHARACTERS,
  activityVoiceId,
  sessionVoiceId,
  type ActivityConfig,
  type VillageSession,
} from '@/data/worlds/animal-village';
import type { LibraryVideo } from '@/types/library';
import type {
  CollectionState,
  GameEvent,
  GameRoundResult,
  GameRoundSpec,
  GameType,
  RewardDelta,
  SessionAct,
} from '@/types/game';

type SessionContext = 'home' | 'kiosk';
type SessionStage = 'intro' | 'video' | 'transition' | 'round' | 'gate' | 'complete';

// 시즌 "나만의 이야기" 진행: 이번 세션 = 1칸. 시즌 총 칸수 prop 이 없으면 placeholder 5칸.
const STORYBOOK_TOTAL_SLOTS_FALLBACK = 5;
const STORYBOOK_SESSION_SLOTS = 1;

// 부모 대화 스타터 정적 폴백(SEL 프레이밍 · 효능/점수 클레임 없음).
const DIALOGUE_STARTER_FALLBACK =
  '오늘 이야기에서 친구를 어떻게 도와줄 수 있을지 같이 얘기해보세요.';

const ACT_COPY: Record<SessionAct, { kicker: string; videoLead: string; transition: string }> = {
  emotion: {
    kicker: '1막 · 마음 이야기',
    videoLead: '먼저 오늘의 마음 이야기를 볼까요?',
    transition: '오늘의 마음을 함께 살펴봐요.',
  },
  creativity: {
    kicker: '2막 · 나만의 방법',
    videoLead: '이제 나만의 방법을 찾아볼까?',
    transition: '이제 나만의 방법을 만들어볼까?',
  },
};

interface SessionShellProps {
  childId?: string;
  childName: string;
  context?: SessionContext;
  kioskSessionId?: string;
  locationCode?: string;
  rounds: GameRoundSpec[];
  sessionSeed: number;
  topic: string;
  videos: LibraryVideo[];
  /** 동물 마을 세계 활동 config(라운드와 1:1). 있으면 테마/음성/캐릭터 렌더. */
  activities?: ActivityConfig[];
  /** 동물 마을 세션 시나리오(도입/전환/클로저 내레이션). */
  villageSession?: VillageSession;
}

const REPROMPT_DELAY_MS = 8000;
const INITIAL_COLLECTION: CollectionState = {
  total_stars: 0,
  stickers: [],
  collection: {},
};

function playableType(gameType: GameType): GameType {
  if (gameType === 'emotion_expression' || gameType === 'G1_match' || gameType === 'G2_sort') {
    return gameType;
  }

  return 'G1_match';
}

interface SessionActSlice {
  phase: SessionAct;
  startIndex: number;
  endIndex: number;
}

/** rounds(phase 순서로 묶여 옴)를 막(act) 단위 구간으로 분할. */
function buildActs(rounds: GameRoundSpec[]): SessionActSlice[] {
  const acts: SessionActSlice[] = [];

  rounds.forEach((round, index) => {
    const phase = round.phase ?? 'emotion';
    const last = acts[acts.length - 1];

    if (last && last.phase === phase) {
      last.endIndex = index;
    } else {
      acts.push({ phase, startIndex: index, endIndex: index });
    }
  });

  return acts;
}

function collectionCount(state: CollectionState): number {
  return Object.values(state.collection).reduce((sum, count) => {
    if (typeof count !== 'number' || !Number.isFinite(count)) return sum;
    return sum + Math.max(0, Math.floor(count));
  }, 0);
}

function uniqueCount(values: string[]): number {
  return new Set(values.map((value) => value.trim()).filter(Boolean)).size;
}

function useContingentReprompt(activeKey: string | null) {
  const respondedRef = useRef(false);
  const [repromptState, setRepromptState] = useState<{
    key: string | null;
    reprompted: boolean;
    visible: boolean;
  }>({
    key: null,
    reprompted: false,
    visible: false,
  });

  useEffect(() => {
    respondedRef.current = false;

    if (!activeKey) return undefined;

    const timerId = window.setTimeout(() => {
      if (respondedRef.current) return;
      setRepromptState({
        key: activeKey,
        reprompted: true,
        visible: true,
      });
    }, REPROMPT_DELAY_MS);

    return () => window.clearTimeout(timerId);
  }, [activeKey]);

  const markResponded = useCallback(() => {
    respondedRef.current = true;
    setRepromptState((current) => (
      current.key === activeKey
        ? { ...current, visible: false }
        : current
    ));
  }, [activeKey]);

  const isCurrentKey = repromptState.key === activeKey;

  return {
    markResponded,
    reprompted: isCurrentKey && repromptState.reprompted,
    repromptVisible: isCurrentKey && repromptState.visible,
  };
}

function rewardSummary(delta: RewardDelta | null): string {
  if (!delta) return '이번 판 보상을 정리하고 있어요.';

  const parts = [
    delta.stars > 0 ? `별 ${delta.stars}개` : null,
    delta.stickers.length > 0 ? `스티커 ${uniqueCount(delta.stickers)}개` : null,
    delta.collection_unlocks.length > 0 ? `컬렉션 ${uniqueCount(delta.collection_unlocks)}칸` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : '끝까지 해낸 기록이 남았어요.';
}

function durationLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '영상';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

export default function SessionShell({
  childId,
  childName,
  context = 'home',
  kioskSessionId,
  locationCode,
  rounds,
  sessionSeed,
  topic,
  videos,
  activities,
  villageSession,
}: SessionShellProps) {
  const isVillage = Boolean(villageSession && activities && activities.length > 0);
  const { speak, muted, toggleMute, supported: voiceSupported } = useVoice();
  // 정답/완료 juice 트리거 + 마스코트 기분.
  const [juiceKey, setJuiceKey] = useState(0);
  const [mascotMood, setMascotMood] = useState<MascotMood>('idle');
  const [mascotMessage, setMascotMessage] = useState<string>('');

  const fireJuice = useCallback(() => setJuiceKey((k) => k + 1), []);
  // 사전 생성 음성 라인 재생(id 우선, 텍스트는 폴백).
  const speakLine = useCallback((id: string, text: string) => speak({ id, text }), [speak]);

  const playableVideos = useMemo(
    () => videos.filter((video) => video.video_url.trim().length > 0),
    [videos],
  );

  // 막(act) 경계 계산: rounds 는 planSession 이 emotion-phase → creativity-phase 순서로 묶어 보낸다.
  const acts = useMemo(() => buildActs(rounds), [rounds]);
  // 각 막의 영상: 1막 = videos[0], 2막 = videos[1](있으면). 영상이 부족하면 전환 카드로 폴백.
  const actVideoIndex = useCallback(
    (actIndex: number) => (playableVideos.length > actIndex ? actIndex : -1),
    [playableVideos.length],
  );

  const firstHasVideo = actVideoIndex(0) >= 0;
  // 세션 진입 시 바로 영상 ❌ → "오늘의 이야기" 인트로 카드부터(학습자 제어).
  const [stage, setStage] = useState<SessionStage>('intro');
  const [actCursor, setActCursor] = useState(0);
  const [roundCursor, setRoundCursor] = useState(0);
  const [difficulty, setDifficulty] = useState(() => rounds[0]?.params.difficulty ?? 1);
  const [collectionState, setCollectionState] = useState<CollectionState>(INITIAL_COLLECTION);
  const [lastDelta, setLastDelta] = useState<RewardDelta | null>(null);
  const [lastResult, setLastResult] = useState<GameRoundResult | null>(null);
  const [completedRounds, setCompletedRounds] = useState(0);
  // 부모 대화 스타터 생성을 위해 세션 동안 누적하는 라운드 결과.
  const [roundResults, setRoundResults] = useState<GameRoundResult[]>([]);
  const gameSessionIdRef = useRef<string | null>(null);
  const startedSessionKeyRef = useRef<string | null>(null);
  const completedSessionRef = useRef(false);
  const sessionKey = `${context}:${childId ?? 'anonymous'}:${topic}:${sessionSeed}`;

  const currentAct = acts[actCursor] ?? null;
  const currentPlan = rounds[roundCursor] ?? null;
  const currentActivity = activities?.[roundCursor] ?? null;
  const currentActPhase: SessionAct = currentPlan?.phase ?? currentAct?.phase ?? 'emotion';
  const currentRound = useMemo(() => {
    if (!currentPlan) return null;

    // 동물 마을 라운드는 themed params(이모지·안내문·정답)를 보존해야 하므로 재계획하지 않는다.
    if (isVillage) return currentPlan;

    return planRound({
      seed: sessionSeed,
      round_index: currentPlan.round_index,
      topic: currentPlan.topic || topic,
      difficulty,
      forceType: playableType(currentPlan.game_type),
      phase: currentPlan.phase,
    });
  }, [currentPlan, difficulty, isVillage, sessionSeed, topic]);
  const activeRoundKey = stage === 'round' && currentRound
    ? `${sessionKey}:${currentRound.round_index}:${currentRound.game_type}`
    : null;
  const { markResponded, reprompted, repromptVisible } = useContingentReprompt(activeRoundKey);
  const currentVideoIndex = currentAct ? actVideoIndex(actCursor) : -1;
  const currentVideo = currentVideoIndex >= 0 ? playableVideos[currentVideoIndex] : null;
  const totalSlots = Math.max(1, rounds.length);
  const isFinalRound = roundCursor >= rounds.length - 1;
  const isLastRoundOfAct = currentAct ? roundCursor >= currentAct.endIndex : isFinalRound;
  const hasNextAct = actCursor < acts.length - 1;
  // 인트로 "오늘의 이야기" 카드용 — 첫 영상(있으면)의 제목/주제 힌트.
  const introVideo = firstHasVideo ? playableVideos[0] : null;

  const emitSessionEvent = useCallback(
    async (event: GameEvent, sessionIdOverride?: string | null) => {
      const activeSessionId = sessionIdOverride ?? gameSessionIdRef.current;
      const payload = {
        ...(event.payload ?? {}),
        ...(activeSessionId && event.type !== 'game_started' ? { game_session_id: activeSessionId } : {}),
      };
      const result = await emitGameEvent(
        {
          ...event,
          payload: Object.keys(payload).length > 0 ? payload : undefined,
        },
        {
          context,
          childId,
          kioskSessionId,
          locationCode,
          topic,
        },
      );

      if (result.game_session_id) {
        gameSessionIdRef.current = result.game_session_id;
      }

      return result;
    },
    [childId, context, kioskSessionId, locationCode, topic],
  );

  useEffect(() => {
    if (startedSessionKeyRef.current === sessionKey) return;
    startedSessionKeyRef.current = sessionKey;

    void emitSessionEvent({
      type: 'game_started',
      payload: {
        rounds_total: rounds.length,
        video_count: playableVideos.length,
        session_seed: sessionSeed,
        topic,
      },
    });
  }, [emitSessionEvent, playableVideos.length, rounds.length, sessionKey, sessionSeed, topic]);

  const emitCompletionOnce = useCallback(
    async (state: CollectionState, sessionIdOverride?: string | null) => {
      if (completedSessionRef.current) return;
      completedSessionRef.current = true;

      await emitSessionEvent(
        {
          type: 'game_completed',
          payload: {
            rounds_total: rounds.length,
            total_stars: state.total_stars,
            stickers_count: state.stickers.length,
            collection_count: collectionCount(state),
          },
        },
        sessionIdOverride,
      );
    },
    [emitSessionEvent, rounds.length],
  );

  const handleRoundComplete = useCallback(
    async (rawResult: GameRoundResult) => {
      if (!currentRound) return;

      const result: GameRoundResult = {
        ...rawResult,
        retried: rawResult.retried || reprompted,
      };
      const delta = result.reward_payload ?? rewardForRound(result);
      const resultWithReward: GameRoundResult = {
        ...result,
        reward_payload: delta,
      };
      const previousState = collectionState;
      const nextState = applyReward(previousState, delta);
      const nextRoundCount = Math.min(rounds.length, roundCursor + 1);

      setCollectionState(nextState);
      setLastDelta(delta);
      setLastResult(resultWithReward);
      setCompletedRounds(nextRoundCount);
      setRoundResults((prev) => [...prev, resultWithReward]);
      setDifficulty(nextDifficulty(difficulty, resultWithReward));
      // 재미 토대: 완료 시 별 팡 + 마스코트 환호 + 칭찬 음성(사전 생성 mp3).
      fireJuice();
      const praise = currentActivity?.voice.praise ?? `${childName} 해냈어! 짝짝짝`;
      setMascotMood('cheer');
      setMascotMessage(praise);
      if (currentActivity) speakLine(activityVoiceId(currentActivity.id, 'praise'), praise);
      setStage('gate');

      const roundEvent = await emitSessionEvent({
        type: 'game_round_completed',
        round_index: currentRound.round_index,
        result: resultWithReward,
      });
      const activeSessionId = roundEvent.game_session_id ?? gameSessionIdRef.current;

      if (collectionCount(nextState) > collectionCount(previousState)) {
        await emitSessionEvent(
          {
            type: 'collection_progress',
            round_index: currentRound.round_index,
            payload: {
              delta,
              total_stars: nextState.total_stars,
              stickers_count: nextState.stickers.length,
              collection_count: collectionCount(nextState),
            },
          },
          activeSessionId,
        );
      }

      if (isFinalRound) {
        await emitCompletionOnce(nextState, activeSessionId);
      }
    },
    [
      childName,
      collectionState,
      currentActivity,
      currentRound,
      difficulty,
      emitCompletionOnce,
      emitSessionEvent,
      fireJuice,
      isFinalRound,
      reprompted,
      roundCursor,
      rounds.length,
      speakLine,
    ],
  );

  function continueAfterGate() {
    if (isFinalRound) {
      setStage('complete');
      return;
    }

    setLastDelta(null);
    setLastResult(null);

    // 같은 막 안의 다음 라운드 → 영상 없이 바로 라운드.
    if (!isLastRoundOfAct) {
      setRoundCursor((value) => value + 1);
      setStage('round');
      return;
    }

    // 막 종료 → 다음 막으로 전환(학습자 제어). 영상이 있으면 영상, 없으면 전환 카드.
    if (hasNextAct) {
      const nextActIndex = actCursor + 1;
      setActCursor(nextActIndex);
      setRoundCursor((value) => value + 1);
      setStage(actVideoIndex(nextActIndex) >= 0 ? 'video' : 'transition');
      return;
    }

    setStage('complete');
  }

  // 인트로 "오늘의 이야기" 카드 → 첫 막으로. 영상 있으면 영상.
  // 영상이 없을 때: 동물 마을은 인트로 카드가 이미 1막 도입을 했으므로 바로 라운드,
  // 일반 세션은 전환 카드로 진입.
  function startSession() {
    if (firstHasVideo) {
      setStage('video');
      return;
    }
    setStage(isVillage ? 'round' : 'transition');
  }

  // 전환 카드/영상 종료 후 막의 첫 라운드로 진입(학습자 제어 — 고정 자동 진행 아님).
  function startActRounds() {
    setStage('round');
  }

  // 라운드 진입 시 마스코트를 대기로 되돌리고 활동 안내를 음성으로 한 번 읽어준다.
  // (setTimeout 콜백에서만 setState → effect 내 동기 setState 회피)
  const spokenRoundRef = useRef<string>('');
  useEffect(() => {
    if (stage !== 'round') return undefined;
    const timer = window.setTimeout(() => {
      setMascotMood('idle');
      setMascotMessage('');
    }, 0);
    if (isVillage && currentActivity) {
      const key = `round-${roundCursor}`;
      if (spokenRoundRef.current !== key) {
        spokenRoundRef.current = key;
        const intro = currentActivity.voice.intro ?? currentActivity.prompt_ko;
        speakLine(activityVoiceId(currentActivity.id, 'intro'), intro);
      }
    }
    return () => window.clearTimeout(timer);
  }, [stage, roundCursor, isVillage, currentActivity, speakLine]);

  // 세션 마무리 시 도와준 친구의 클로저 대사를 음성으로 읽어준다(1회).
  const spokeClosingRef = useRef(false);
  useEffect(() => {
    if (stage !== 'complete' || !isVillage || spokeClosingRef.current) return;
    spokeClosingRef.current = true;
    if (villageSession) speakLine(sessionVoiceId(villageSession.id, 'closing'), villageSession.closing.line);
  }, [stage, isVillage, villageSession, speakLine]);

  function gateButtonLabel(): string {
    if (isFinalRound) return '획득물 요약 보기';
    if (isLastRoundOfAct && hasNextAct) {
      return actVideoIndex(actCursor + 1) >= 0 ? '다음 영상 볼래' : '이제 나만의 방법 만들기';
    }
    return '다음 놀이 할래';
  }

  if (rounds.length === 0) {
    return (
      <main className="min-h-screen bg-violet-50 px-6 py-10">
        <section className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-bold text-violet-500">놀이 준비 중</p>
          <h1 className="mt-2 text-2xl font-black text-gray-900">오늘 라운드가 아직 없어요</h1>
          <p className="mt-3 text-sm font-medium leading-relaxed text-gray-500">
            곧 영상 뒤에 이어질 놀이를 불러올게요.
          </p>
        </section>
      </main>
    );
  }

  if (stage === 'complete') {
    const watchedVideoCount = acts.reduce(
      (sum, _act, index) => sum + (actVideoIndex(index) >= 0 ? 1 : 0),
      0,
    );
    // (b) 부모 대화 스타터: 세션 누적 라운드 결과로 1개 생성, 없으면 정적 폴백.
    const sessionStarters = dialogueStarters(aggregateSelActivities(roundResults));
    const dialogueStarter = sessionStarters[0] ?? DIALOGUE_STARTER_FALLBACK;
    // (a) "나만의 이야기" 진행: 이번 세션 = 1칸 (시즌 총 칸수 placeholder).
    const storybookTotal = STORYBOOK_TOTAL_SLOTS_FALLBACK;
    const storybookFilled = Math.min(STORYBOOK_SESSION_SLOTS, storybookTotal);

    return (
      <main className="min-h-screen bg-violet-50 px-6 pb-24 pt-10">
        <JuiceBurst fireKey={juiceKey} variant="confetti" />
        <div className="mx-auto max-w-md space-y-4 lg:max-w-2xl">
          {/* 동물 마을 클로저 — 도와준 친구의 환한 마무리 + 음성. */}
          {isVillage && villageSession && (
            <section className="rounded-3xl bg-gradient-to-br from-amber-400 to-amber-300 p-6 text-center text-amber-950 shadow-sm">
              <div className="text-5xl" aria-hidden="true">
                {CHARACTERS[villageSession.closing.narratorId].emoji}🎉
              </div>
              <h1 className="mt-3 text-2xl font-black leading-snug">{villageSession.closing.line}</h1>
            </section>
          )}
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-500">획득물 요약</p>
            <h1 className="mt-2 text-2xl font-black leading-tight text-gray-900">
              {childName}의 오늘 세션
            </h1>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-violet-50 p-3 text-center">
                <p className="text-xl font-black text-violet-700">{collectionState.total_stars}</p>
                <p className="mt-1 text-xs font-bold text-violet-500">별</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-3 text-center">
                <p className="text-xl font-black text-amber-700">{collectionState.stickers.length}</p>
                <p className="mt-1 text-xs font-bold text-amber-600">스티커</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3 text-center">
                <p className="text-xl font-black text-emerald-700">{collectionCount(collectionState)}</p>
                <p className="mt-1 text-xs font-bold text-emerald-600">컬렉션</p>
              </div>
            </div>
            <p className="mt-5 text-sm font-semibold leading-relaxed text-gray-600">
              영상 {watchedVideoCount}번, 놀이 {completedRounds}번을 마쳤어요.
            </p>
          </section>

          {/* (a) 나만의 이야기 진행 칸 */}
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-500">나만의 이야기</p>
            <h2 className="mt-2 text-lg font-black leading-snug text-gray-900">
              오늘 이야기 완성! 🧩 나만의 이야기가 한 칸 채워졌어요
            </h2>
            <div className="mt-4 flex gap-1.5" aria-label={`나만의 이야기 ${storybookTotal}칸 중 ${storybookFilled}칸`}>
              {Array.from({ length: storybookTotal }, (_, i) => (
                <div
                  key={i}
                  className={`h-2.5 flex-1 rounded-full ${i < storybookFilled ? 'bg-violet-500' : 'bg-violet-100'}`}
                />
              ))}
            </div>
            <p className="mt-3 text-xs font-medium leading-relaxed text-gray-500">
              이번 시즌 이야기책이 한 칸씩 채워지고 있어요.
            </p>
          </section>

          {/* (b) 부모 대화 스타터 1개 */}
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-500">오늘 이렇게 물어보세요</p>
            <p className="mt-3 rounded-2xl bg-violet-50 p-4 text-sm font-semibold leading-relaxed text-gray-700">
              {dialogueStarter}
            </p>
            <p className="mt-3 text-xs font-medium leading-relaxed text-gray-400">
              추가 화면 없이 1분이면 충분한 대화예요.
            </p>
          </section>

          {/* (c) 다음 이야기 예고 (open loop) */}
          <section className="rounded-3xl bg-gradient-to-br from-violet-500 to-violet-400 p-6 text-white shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-violet-100">다음 이야기</p>
            <h2 className="mt-2 text-lg font-black leading-snug">
              다음엔 새로운 모험이 {childName}를 기다려요
            </h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-violet-100">
              다음 이야기에서 또 새로운 친구와 만나요.
            </p>
          </section>

          <RewardMeta state={collectionState} lastDelta={lastDelta} totalSlots={totalSlots} />
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-violet-50 px-4 pb-24 pt-4 sm:px-6 lg:pb-10">
      {/* 정답/완료 별 팡(juice) — 전체 화면 오버레이, 조작 방해 없음. */}
      <JuiceBurst fireKey={juiceKey} variant="confetti" />
      {/* 아이패드 가로(landscape) 우선: 넓은 컨테이너 + 상단 바. 세로도 반응형 유지. */}
      <div className="mx-auto max-w-md lg:max-w-5xl">
        <header className="mb-4 rounded-3xl bg-white p-4 shadow-sm sm:p-5">
          {/* 가로: 제목 + 진행 칩 + 음소거를 한 줄 상단 바로. 세로: 쌓임. */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center justify-between gap-3 lg:justify-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-violet-500">
                  {isVillage ? '동물 마을' : 'Kindy Play'}
                </p>
                <h1 className="mt-1 text-xl font-black leading-tight text-gray-900 sm:text-2xl">
                  {isVillage ? villageSession?.title ?? '동물 마을' : `${childName}의 영상 놀이`}
                </h1>
              </div>
              {voiceSupported && (
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-pressed={muted}
                  aria-label={muted ? '소리 켜기' : '소리 끄기'}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-50 text-2xl transition hover:bg-violet-100 lg:hidden"
                >
                  <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="grid flex-1 grid-cols-3 gap-2 text-center lg:flex lg:flex-none lg:gap-3">
                <div className="rounded-2xl bg-violet-50 px-4 py-3">
                  <p className="text-lg font-black text-violet-700">{completedRounds}/{rounds.length}</p>
                  <p className="mt-1 text-xs font-bold text-violet-500">라운드</p>
                </div>
                <div className="rounded-2xl bg-amber-50 px-4 py-3">
                  <p className="text-lg font-black text-amber-700">{collectionState.total_stars}</p>
                  <p className="mt-1 text-xs font-bold text-amber-600">별</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                  <p className="text-lg font-black text-emerald-700">{collectionCount(collectionState)}</p>
                  <p className="mt-1 text-xs font-bold text-emerald-600">모음</p>
                </div>
              </div>
              {voiceSupported && (
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-pressed={muted}
                  aria-label={muted ? '소리 켜기' : '소리 끄기'}
                  className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-50 text-2xl transition hover:bg-violet-100 lg:flex"
                >
                  <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* 아이패드 가로 권장 힌트 — 세로(좁은 화면)에서만, 가로 화면에선 숨김. */}
        {isVillage && (
          <div className="mb-4 rounded-2xl bg-violet-100/70 px-4 py-2 text-center text-xs font-bold text-violet-700 portrait:block landscape:hidden lg:hidden">
            태블릿을 가로로 돌리면 더 크고 편하게 즐길 수 있어요 📱↔️
          </div>
        )}

        {stage === 'intro' && (
          <section className="mx-auto rounded-3xl bg-white p-6 text-center shadow-sm sm:p-8 lg:max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-500">오늘의 이야기</p>
            {isVillage && villageSession ? (
              <>
                <div className="mt-2 text-5xl" aria-hidden="true">
                  {CHARACTERS[villageSession.heroCharacter].emoji}
                </div>
                <h2 className="mt-3 text-2xl font-black leading-tight text-gray-900">{villageSession.title}</h2>
                <div className="mt-4 space-y-2 text-left">
                  {villageSession.intro.map((scene, i) => (
                    <div key={i} className="rounded-2xl bg-violet-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">
                        {CHARACTERS[scene.narratorId].name}
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-gray-800">{scene.line}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-2 text-2xl font-black leading-tight text-gray-900">
                  {childName}, 오늘 이야기를 만나러 가요
                </h2>
                <p className="mt-3 text-sm font-medium leading-relaxed text-gray-500">
                  이야기를 보고 함께 놀이하며 생각하는 힘을 키워요.
                </p>
                {introVideo && (
                  <div className="mt-5 rounded-2xl bg-violet-50 p-4 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">
                      {ACT_COPY.emotion.kicker}
                    </p>
                    <p className="mt-1 text-base font-black leading-snug text-gray-900">{introVideo.title}</p>
                  </div>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => {
                if (isVillage && villageSession && villageSession.intro[0]) {
                  speakLine(sessionVoiceId(villageSession.id, 'intro', 0), villageSession.intro[0].line);
                }
                startSession();
              }}
              className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-violet-600 px-6 text-base font-black text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-violet-300 focus:ring-offset-2"
            >
              시작할래
            </button>
          </section>
        )}

        {stage === 'video' && currentVideo && (
          <section aria-labelledby="session-video-title" className="mx-auto overflow-hidden rounded-3xl bg-white shadow-sm lg:max-w-3xl">
            <LibraryPlayer
              key={`${currentVideo.id}:${actCursor}`}
              videoUrl={currentVideo.video_url}
              posterUrl={currentVideo.thumbnail_url}
              subtitlesUrl={currentVideo.subtitles_url ?? null}
              onEnded={startActRounds}
            />
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-violet-500">
                {ACT_COPY[currentActPhase].kicker} · {durationLabel(currentVideo.duration_sec)}
              </p>
              <h2 id="session-video-title" className="mt-1 text-xl font-black leading-tight text-gray-900">
                {currentVideo.title}
              </h2>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-violet-600">
                {ACT_COPY[currentActPhase].videoLead}
              </p>
              {currentVideo.description && (
                <p className="mt-2 text-sm font-medium leading-relaxed text-gray-500">
                  {currentVideo.description}
                </p>
              )}
              {/* 학습자 제어: 영상이 끝나면 onEnded 로 진입하지만, 아이가 먼저 시작할 수도 있다. */}
              <button
                type="button"
                onClick={startActRounds}
                className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-violet-600 px-6 text-sm font-black text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-violet-300 focus:ring-offset-2"
              >
                놀이 시작할래
              </button>
            </div>
          </section>
        )}

        {stage === 'transition' && currentAct && (
          <section className="mx-auto rounded-3xl bg-white p-6 text-center shadow-sm sm:p-8 lg:max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-500">
              {ACT_COPY[currentActPhase].kicker}
            </p>
            {isVillage && villageSession ? (
              <>
                <div className="mt-2 text-4xl" aria-hidden="true">
                  {CHARACTERS[villageSession.transition.narratorId].emoji}
                </div>
                <h2 className="mt-3 text-xl font-black leading-snug text-gray-900">
                  {villageSession.transition.line}
                </h2>
              </>
            ) : (
              <h2 className="mt-2 text-2xl font-black leading-tight text-gray-900">
                {ACT_COPY[currentActPhase].transition}
              </h2>
            )}
            <button
              type="button"
              onClick={() => {
                if (isVillage && villageSession) {
                  speakLine(sessionVoiceId(villageSession.id, 'transition'), villageSession.transition.line);
                }
                startActRounds();
              }}
              className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-violet-600 px-6 text-base font-black text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-violet-300 focus:ring-offset-2"
            >
              좋아, 시작할래
            </button>
          </section>
        )}

        {stage === 'round' && currentRound && (
          <div
            className="space-y-4"
            onInputCapture={markResponded}
            onKeyDownCapture={markResponded}
            onPointerDownCapture={markResponded}
          >
            <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-5 lg:p-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-violet-500 sm:text-sm">
                    {roundCursor + 1}번째 놀이 · {currentActPhase === 'emotion' ? '마음 이야기' : '나만의 방법'}
                  </p>
                  <h2 className="mt-1 text-lg font-black text-gray-900 sm:text-2xl">
                    {currentActivity?.title ?? currentRound.tag.objective_label_ko}
                  </h2>
                </div>
                <span className="inline-flex min-h-[44px] items-center rounded-full bg-violet-50 px-4 text-2xl sm:text-3xl">
                  {currentActivity ? CHARACTERS[currentActivity.leadCharacter].emoji : currentActPhase === 'emotion' ? '💛' : '🎨'}
                </span>
              </div>

              {repromptVisible && (
                <div aria-live="polite" className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-700">
                  한 번 더 살펴볼까? 마음에 드는 것을 톡 골라봐.
                </div>
              )}

              {currentRound.game_type === 'hidden_friend' ? (
                <HiddenFriendGame
                  spec={currentRound}
                  childName={childName}
                  prompt={currentActivity?.prompt_ko}
                  answerToken={currentActivity?.answerToken}
                  feedback={currentActivity?.feedback}
                  onCorrect={fireJuice}
                  onWrong={() => {
                    setMascotMood('encourage');
                    setMascotMessage(currentActivity?.feedback.retry ?? '거의 다 왔어, 한 번 더!');
                  }}
                  onComplete={(result) => {
                    void handleRoundComplete(result);
                  }}
                />
              ) : currentRound.game_type === 'decorate' && currentActivity?.palette ? (
                <DecorateGame
                  spec={currentRound}
                  childName={childName}
                  prompt={currentActivity.prompt_ko}
                  palette={currentActivity.palette}
                  feedback={currentActivity.feedback}
                  onChoose={() => setMascotMood('idle')}
                  onFinish={fireJuice}
                  onComplete={(result) => {
                    void handleRoundComplete(result);
                  }}
                />
              ) : currentRound.game_type === 'emotion_expression' ? (
                <EmotionExpressionGame
                  spec={currentRound}
                  childName={childName}
                  clipPosterUrl={currentVideo?.thumbnail_url ?? null}
                  onComplete={(result) => {
                    void handleRoundComplete(result);
                  }}
                />
              ) : (
                <PuzzleGame
                  spec={currentRound}
                  childName={childName}
                  onComplete={(result) => {
                    void handleRoundComplete(result);
                  }}
                />
              )}
            </section>

            <RewardMeta state={collectionState} lastDelta={lastDelta} totalSlots={totalSlots} />
          </div>
        )}

        {stage === 'gate' && (
          <section className="mx-auto space-y-4 lg:max-w-2xl">
            <div className="rounded-3xl bg-white p-6 text-center shadow-sm sm:p-8">
              <p className="text-xs font-bold uppercase tracking-wider text-violet-500">
                {lastResult ? `${lastResult.score ?? 0}/${lastResult.max_score ?? 0}` : '라운드 완료'}
              </p>
              <h2 className="mt-2 text-2xl font-black text-gray-900">
                {childName} 해냈어!
              </h2>
              <p className="mt-3 text-sm font-bold text-gray-600">{rewardSummary(lastDelta)}</p>
              <button
                type="button"
                onClick={continueAfterGate}
                className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-violet-600 px-6 text-base font-black text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-violet-300 focus:ring-offset-2"
              >
                {gateButtonLabel()}
              </button>
            </div>

            <RewardMeta state={collectionState} lastDelta={lastDelta} totalSlots={totalSlots} />
          </section>
        )}
      </div>

      {/* 마스코트(토토) — 동물 마을에서 상시 표시, 상태별 반응 + 음성. (complete 화면은 별도 처리) */}
      {isVillage && (
        <Mascot mood={mascotMood} message={mascotMessage} />
      )}
    </main>
  );
}
