'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameTokenVisual from '@/components/game/GameTokenVisual';
import MoriCharacter from '@/components/MoriCharacter';
import { useVoice } from '@/lib/useVoice';
import type { GameRoundResult, GameType } from '@/types/game';
import type { ChoiceOption, ChoicePoint, InteractiveSessionGraph, Scene } from '@/types/interactive-session';

type PlayerPhase = 'ready' | 'playing' | 'choice' | 'done';
type ChoiceTally = Record<string, number>;

interface InteractiveVideoPlayerProps {
  graph: InteractiveSessionGraph;
  childName?: string;
  onRoundResult: (result: GameRoundResult) => void | Promise<void>;
  onComplete: (tally: ChoiceTally) => void | Promise<void>;
}

const REPROMPT_DELAY_MS = 15000;
const AUTO_CHOOSE_DELAY_MS = 30000;

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function addTally(current: ChoiceTally, next: ChoiceTally | undefined): ChoiceTally {
  if (!next) return current;
  const merged = { ...current };
  for (const [key, value] of Object.entries(next)) {
    if (!Number.isFinite(value)) continue;
    merged[key] = (merged[key] ?? 0) + value;
  }
  return merged;
}

function thresholdMet(tally: ChoiceTally, threshold: ChoiceTally): boolean {
  return Object.entries(threshold).every(([key, value]) => (tally[key] ?? 0) >= value);
}

function optionGameType(format: ChoicePoint['format']): GameType {
  if (format === 'emotion') return 'emotion_expression';
  if (format === 'creative') return 'decorate';
  return 'Q_quiz';
}

function buildRoundResult(input: {
  choice: ChoicePoint;
  option: ChoiceOption;
  latencyMs: number;
  retried: boolean;
  autoSelected: boolean;
}): GameRoundResult {
  const gameType = optionGameType(input.choice.format);

  // 분기 선택에는 정답이 없다 — 형식과 무관하게 1/1점을 지어내지 않는다 (로드맵 P0).
  // 정오답 없는 라운드는 노출·사용성 신호이며 isAssessableRound 게이트가 역량 갱신에서 제외한다.
  return {
    game_type: gameType,
    difficulty: 1,
    objective_code: input.option.objective_code ?? null,
    standard_anchor: 'interactive_video_session',
    score: null,
    max_score: null,
    latency_ms: input.latencyMs,
    retried: input.retried,
    auto_selected: input.autoSelected,
    reward_payload: null,
  };
}

function isFinalChoice(scene: Scene): boolean {
  if (!scene.choice) return false;
  return scene.choice.options.every((option) => !option.branchScenes || option.branchScenes.length === 0);
}

function unlockAudioForIOS() {
  try {
    const maybeWindow = window as WindowWithWebkitAudio;
    const AudioContextCtor = window.AudioContext ?? maybeWindow.webkitAudioContext;
    if (!AudioContextCtor) return;
    const audioContext = new AudioContextCtor();
    void audioContext.resume().finally(() => {
      void audioContext.close().catch(() => {});
    });
  } catch {
    // 오디오 잠금 해제는 best-effort.
  }
}

function EmotionChoiceFace({ icon }: { icon?: string }) {
  const mood = icon === 'worried' ? 'worried' : icon === 'sad' ? 'sad' : 'warm';
  const bg = mood === 'sad'
    ? 'bg-blue-100 ring-blue-200'
    : mood === 'worried'
      ? 'bg-sagebg ring-sage/20'
      : 'bg-amber-100 ring-amber-200';
  const mouth = mood === 'warm'
    ? 'h-3 w-8 rounded-b-full border-b-4 border-ink'
    : 'h-3 w-8 rounded-t-full border-t-4 border-ink';

  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-24 w-24 items-center justify-center rounded-full ring-2 ${bg}`}
    >
      <span className="absolute left-[29%] top-[38%] h-2 w-2 rounded-full bg-ink" />
      <span className="absolute right-[29%] top-[38%] h-2 w-2 rounded-full bg-ink" />
      {mood !== 'warm' && (
        <>
          <span className="absolute left-[23%] top-[25%] h-1 w-4 rotate-[18deg] rounded-full bg-ink" />
          <span className="absolute right-[23%] top-[25%] h-1 w-4 rotate-[-18deg] rounded-full bg-ink" />
        </>
      )}
      <span className={`absolute bottom-[23%] ${mouth}`} />
    </span>
  );
}

export default function InteractiveVideoPlayer({
  graph,
  childName = '아이',
  onRoundResult,
  onComplete,
}: InteractiveVideoPlayerProps) {
  const sceneById = useMemo(() => new Map(graph.scenes.map((scene) => [scene.id, scene])), [graph.scenes]);
  const initialSceneId = graph.startSceneId ?? graph.scenes[0]?.id ?? '';
  const [phase, setPhase] = useState<PlayerPhase>('ready');
  const [sceneId, setSceneId] = useState(initialSceneId);
  const [routeQueue, setRouteQueue] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [isChoosing, setIsChoosing] = useState(false);
  // iOS Safari 는 제스처 밖(useEffect)의 소리 있는 play() 를 거부할 수 있다.
  // 거부되면 탭 오버레이를 띄워 제스처 안에서 직접 play() 한다.
  const [needsTap, setNeedsTap] = useState(false);
  // state 클로저 경합 방지(유저 탭 vs 30초 자동선택 타이머) — ref 가 단일 진실.
  const choosingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const choiceShownAtRef = useRef<number>(Date.now());
  const repromptedRef = useRef(false);
  const tallyRef = useRef<ChoiceTally>({});
  const completedRef = useRef(false);
  const sceneFinishedRef = useRef<string | null>(null);
  const { speak } = useVoice();

  const currentScene = sceneById.get(sceneId) ?? graph.scenes[0] ?? null;
  const currentChoice = phase === 'choice' ? currentScene?.choice ?? null : null;

  const completeOnce = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setPhase('done');
    void onComplete(tallyRef.current);
  }, [onComplete]);

  const goToScene = useCallback((nextSceneId: string, queue: string[] = []) => {
    if (!sceneById.has(nextSceneId)) {
      // 그래프 오작성(존재하지 않는 씬)도 세션을 삼키지 않는다 — 완료로 마감해 기록을 남긴다.
      completeOnce();
      return;
    }
    sceneFinishedRef.current = null;
    setLoadError(false);
    setIsChoosing(false);
    choosingRef.current = false;
    setSceneId(nextSceneId);
    setRouteQueue(queue);
    setPhase('playing');
  }, [completeOnce, sceneById]);

  const finishCurrentScene = useCallback(() => {
    if (!currentScene || sceneFinishedRef.current === currentScene.id) return;
    sceneFinishedRef.current = currentScene.id;

    if (currentScene.choice) {
      setPhase('choice');
      return;
    }

    if (currentScene.next) {
      goToScene(currentScene.next, routeQueue);
      return;
    }

    if (routeQueue.length > 0) {
      const [nextSceneId, ...rest] = routeQueue;
      goToScene(nextSceneId, rest);
      return;
    }

    completeOnce();
  }, [completeOnce, currentScene, goToScene, routeQueue]);

  useEffect(() => {
    if (phase !== 'playing' || !currentScene) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;
    let cancelled = false;

    const playScene = () => {
      if (cancelled) return;
      const startSec = currentScene.videoClip.startSec ?? 0;
      try {
        video.currentTime = Math.max(0, startSec);
      } catch {
        // metadata 로드 전 currentTime 설정 실패는 무시.
      }
      void video.play().then(
        () => setNeedsTap(false),
        () => {
          // iOS 자동재생 거부 — 컨트롤 없는 영상이라 탭 오버레이로 이어간다.
          if (!cancelled) setNeedsTap(true);
        },
      );
    };

    if (video.readyState >= 1) {
      playScene();
    } else {
      video.addEventListener('loadedmetadata', playScene, { once: true });
    }

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', playScene);
    };
  }, [currentScene, phase]);

  useEffect(() => {
    if (!currentChoice) return undefined;
    choiceShownAtRef.current = Date.now();
    repromptedRef.current = false;
    speak({ text: currentChoice.prompt_ko });

    const repromptTimer = window.setTimeout(() => {
      repromptedRef.current = true;
      speak({ text: currentChoice.prompt_ko });
    }, REPROMPT_DELAY_MS);

    const autoTimer = window.setTimeout(() => {
      const first = currentChoice.options[0];
      if (first) {
        void selectOption(first, true);
      }
    }, AUTO_CHOOSE_DELAY_MS);

    return () => {
      window.clearTimeout(repromptTimer);
      window.clearTimeout(autoTimer);
    };
    // selectOption 은 현재 scene/choice state 를 읽으므로 dependency 에 넣지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChoice?.id, speak]);

  const chooseEnding = useCallback((tally: ChoiceTally): string | null => {
    const matched = graph.endings.find((rule) => thresholdMet(tally, rule.threshold));
    return matched?.sceneId ?? graph.endings[0]?.sceneId ?? null;
  }, [graph.endings]);

  const selectOption = useCallback(async (option: ChoiceOption, autoSelected = false) => {
    // choosingRef 가 경합의 단일 진실 — 유저 탭 직후 30초 자동선택 타이머가
    // 아직 살아 있는 좁은 창(await 중)에서도 이중 기록을 막는다.
    if (!currentScene?.choice || choosingRef.current) return;
    choosingRef.current = true;
    const choice = currentScene.choice;
    setIsChoosing(true);
    const nextTally = addTally(tallyRef.current, option.tally);
    tallyRef.current = nextTally;

    const latencyMs = Math.max(0, Date.now() - choiceShownAtRef.current);
    await onRoundResult(buildRoundResult({
      choice,
      option,
      latencyMs,
      retried: repromptedRef.current,
      autoSelected,
    }));

    speak({ text: autoSelected ? '모리가 함께 골라봤어. 이어서 볼까?' : `${option.label_ko}, 좋아. 이어서 볼까?` });

    if (isFinalChoice(currentScene)) {
      const endingSceneId = chooseEnding(nextTally);
      if (endingSceneId) {
        goToScene(endingSceneId);
      } else {
        completeOnce();
      }
      return;
    }

    const branchScenes = option.branchScenes ?? [];
    if (branchScenes.length > 0) {
      const [firstBranch, ...restBranches] = branchScenes;
      goToScene(firstBranch, [...restBranches, choice.rejoin]);
      return;
    }

    goToScene(choice.rejoin || currentScene.next || routeQueue[0] || '');
  }, [
    chooseEnding,
    completeOnce,
    currentScene,
    goToScene,
    onRoundResult,
    routeQueue,
    speak,
  ]);

  const startPlayer = () => {
    unlockAudioForIOS();
    setPhase('playing');
  };

  const retryVideo = () => {
    const video = videoRef.current;
    setLoadError(false);
    if (!video || !currentScene) return;
    video.load();
    const startSec = currentScene.videoClip.startSec ?? 0;
    try {
      video.currentTime = Math.max(0, startSec);
    } catch {
      // 무시.
    }
    void video.play().catch(() => {});
  };

  if (!currentScene) {
    return (
      <section className="rounded-3xl border border-line bg-white p-6 text-center shadow-sm">
        <p className="text-lg font-black text-ink">이야기를 준비하고 있어요</p>
      </section>
    );
  }

  if (phase === 'ready') {
    return (
      <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
        <div
          className="relative flex aspect-video min-h-[260px] items-center justify-center bg-cover bg-center px-6 text-center"
          style={{ backgroundImage: `linear-gradient(180deg,rgba(255,255,255,.72),rgba(246,241,231,.92)), url(${currentScene.videoClip.posterUrl ?? ''})` }}
        >
          <div>
            <MoriCharacter className="mx-auto h-28 w-28 overflow-hidden rounded-full border border-line bg-white" imageClassName="scale-125" label="모리" withGlow={false} />
            <p className="mt-4 text-xs font-black uppercase tracking-[.18em] text-sage">모리 영상</p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-ink">
              {childName}와 모리가
              <br />
              이야기 속으로 들어가요
            </h2>
            <button
              type="button"
              onClick={startPlayer}
              className="mt-6 inline-flex min-h-[56px] min-w-48 items-center justify-center rounded-2xl bg-saged px-7 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2"
            >
              같이 볼래
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
      <div className="relative bg-black">
        <video
          ref={videoRef}
          src={currentScene.videoClip.videoUrl}
          poster={currentScene.videoClip.posterUrl}
          playsInline
          preload="metadata"
          onTimeUpdate={(event) => {
            const endSec = currentScene.videoClip.endSec;
            if (typeof endSec === 'number' && event.currentTarget.currentTime >= endSec - 0.05) {
              event.currentTarget.pause();
              finishCurrentScene();
            }
          }}
          onEnded={finishCurrentScene}
          onError={() => setLoadError(true)}
          className="aspect-video w-full bg-black"
        >
          {currentScene.videoClip.subtitlesUrl && (
            <track kind="subtitles" srcLang="ko" label="한국어" src={currentScene.videoClip.subtitlesUrl} default />
          )}
        </video>

        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-cream px-6 text-center">
            <p className="text-sm font-black text-ink">이야기를 불러오지 못했어요</p>
            <p className="text-xs font-medium leading-relaxed text-ink2">잠시 후 다시 볼까요?</p>
            <button
              type="button"
              onClick={retryVideo}
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-saged px-5 text-sm font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
            >
              다시 보기
            </button>
          </div>
        )}

        {needsTap && !loadError && !currentChoice && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/30">
            <button
              type="button"
              onClick={() => {
                setNeedsTap(false);
                const video = videoRef.current;
                if (video) void video.play().catch(() => setNeedsTap(true));
              }}
              className="inline-flex min-h-[56px] items-center justify-center rounded-2xl bg-white px-7 text-base font-black text-ink shadow-2xl transition hover:bg-mist active:scale-[0.97]"
            >
              톡 눌러서 이어 보기
            </button>
          </div>
        )}

        {currentChoice && (
          <div className="absolute inset-0 flex items-end bg-ink/45 p-3 sm:p-5">
            <div className="w-full rounded-3xl bg-white p-4 shadow-2xl sm:p-5">
              <p className="text-xs font-black uppercase tracking-[.16em] text-sage">잠깐 골라볼래</p>
              <h2 className="mt-1 text-2xl font-black leading-tight text-ink">{currentChoice.prompt_ko}</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {currentChoice.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={isChoosing}
                    onClick={() => {
                      void selectOption(option);
                    }}
                    className="flex min-h-[150px] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-line bg-white p-3 text-center text-ink transition hover:border-sage hover:bg-mist active:scale-[0.97] disabled:cursor-wait disabled:opacity-75"
                  >
                    {currentChoice.format === 'emotion' ? (
                      <EmotionChoiceFace icon={option.icon} />
                    ) : (
                      <GameTokenVisual token={option.icon ?? option.id} label={option.label_ko} className="h-24 w-24" />
                    )}
                    <span className="text-xl font-black sm:text-2xl">{option.label_ko}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
