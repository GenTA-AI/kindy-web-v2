'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import GameTokenVisual from '@/components/game/GameTokenVisual';
import type { GameRoundResult, GameRoundSpec } from '@/types/game';

interface PuzzleGameProps {
  spec: GameRoundSpec;
  childName: string;
  feedback?: {
    success: string;
    retry: string;
    hint: string;
  };
  onComplete: (result: GameRoundResult) => void;
}

type PuzzleItem = {
  id: string;
  token: string;
  label_ko: string;
  category: string;
};

type MatchCard = {
  id: string;
  pairId: string;
  kind: 'token' | 'label';
  item: PuzzleItem;
};

type FeedbackTone = 'idle' | 'hint' | 'success' | 'retry';

type Feedback = {
  tone: FeedbackTone;
  message: string;
};

type RuntimePuzzleParams = GameRoundSpec['params'] & {
  items?: unknown;
  categories?: unknown;
  prompt_ko?: unknown;
  answer_token?: unknown;
};

const CATEGORY_LABELS: Record<string, string> = {
  animal: '동물',
  consonant: '닿소리',
  default: '같은 무리',
  digeut: 'ㄷ 소리',
  giyeok: 'ㄱ 소리',
  instrument: '악기',
  nieun: 'ㄴ 소리',
  note: '음',
  plant: '식물',
  positive: '밝은 마음',
  rhythm: '리듬',
  sky: '하늘',
  uncomfortable: '불편한 마음',
  vowel: '홀소리',
  weather: '날씨',
  word: '낱말',
  // 동물 마을
  water: '물',
  land: '땅',
  pattern: '무늬',
  calm: '편안한 마음',
};

const DEFAULT_FEEDBACK: Feedback = {
  tone: 'idle',
  message: '천천히 살펴봐요.',
};

export default function PuzzleGame({ spec, childName, feedback, onComplete }: PuzzleGameProps) {
  const roundKey = `${spec.round_index}:${spec.game_type}:${spec.params.seed}:${spec.params.asset_pool_id}`;

  if (spec.game_type === 'G1_match') {
    return <MatchPuzzle key={roundKey} spec={spec} childName={childName} feedback={feedback} onComplete={onComplete} />;
  }

  if (spec.game_type === 'G2_sort') {
    return <SortPuzzle key={roundKey} spec={spec} childName={childName} feedback={feedback} onComplete={onComplete} />;
  }

  if (spec.game_type === 'Q_quiz') {
    return <QuizPuzzle key={roundKey} spec={spec} childName={childName} feedback={feedback} onComplete={onComplete} />;
  }

  return (
    <section className="rounded-xl border border-line bg-sagebg p-5 text-center shadow-sm shadow-sagebg">
      <PuzzleFallbackIcon />
      <h2 className="mt-3 text-lg font-bold text-ink">퍼즐을 준비하고 있어요</h2>
      <p className="mt-2 text-sm font-medium text-saged">
        이번 놀이는 다른 화면에서 이어갈게요.
      </p>
    </section>
  );
}

function QuizPuzzle({ spec, childName, feedback: feedbackCopy, onComplete }: PuzzleGameProps) {
  const items = useMemo(() => readItems(spec), [spec]);
  const answerToken = readAnswerToken(spec);
  const prompt = readPrompt(spec, '이야기에서 본 단서를 골라요');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [wrongItemIds, setWrongItemIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(DEFAULT_FEEDBACK);
  const { completed, completeRound, markRetried, retried } = useRoundCompletion(spec, onComplete);
  const delay = useTimerQueue();

  if (items.length === 0) {
    return <EmptyPuzzleState title="단서 질문을 준비하고 있어요" />;
  }

  if (completed) {
    return <CompletedState childName={childName} score={1} maxScore={1} retried={retried} />;
  }

  function isAnswer(item: PuzzleItem): boolean {
    if (answerToken) return item.token === answerToken;
    return item.category === 'answer' || item.category === 'correct';
  }

  function handlePick(item: PuzzleItem) {
    if (selectedItemId) return;

    if (isAnswer(item)) {
      setSelectedItemId(item.id);
      setFeedback({
        tone: 'success',
        message: feedbackCopy?.success ?? '맞아, 방금 이야기에서 본 단서야!',
      });
      delay(() => completeRound(1, 1), 650);
      return;
    }

    markRetried();
    setWrongItemIds((prev) => [...prev, item.id]);
    setFeedback({
      tone: 'retry',
      message: feedbackCopy?.retry ?? '가까워졌어. 이야기 장면을 다시 떠올려볼까?',
    });
  }

  return (
    <section className="rounded-xl border border-line bg-white p-4 shadow-sm shadow-sagebg">
      <PuzzleHeader
        eyebrow={`단서 질문 ${spec.round_index + 1}`}
        title={prompt}
        progressLabel={selectedItemId ? '찾았어요' : '1개 찾기'}
        progressValue={selectedItemId ? 1 : 0}
        progressMax={1}
      />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-5">
        {items.map((item) => {
          const picked = selectedItemId === item.id;
          const wrong = wrongItemIds.includes(item.id);

          return (
            <button
              key={item.id}
              type="button"
              aria-label={`${item.label_ko} 고르기`}
              aria-pressed={picked}
              disabled={Boolean(selectedItemId)}
              onClick={() => handlePick(item)}
              className={`min-h-[118px] rounded-xl border-2 p-3 text-center transition-all duration-300 active:scale-95 lg:min-h-[156px] lg:p-5 ${
                picked
                  ? 'scale-105 border-emerald-300 bg-emerald-50 text-emerald-700'
                  : wrong
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-line bg-sagebg text-gray-800 hover:border-sage hover:bg-mist'
              }`}
            >
              <TokenVisual item={item} />
              <span className="mt-3 block text-sm font-black lg:text-base">{item.label_ko}</span>
              <span className="mt-1 block text-xs font-bold text-sage">
                {picked ? '찾았어요' : wrong ? '다시 보기' : '톡 눌러보기'}
              </span>
            </button>
          );
        })}
      </div>

      <FeedbackLine feedback={feedback} />
    </section>
  );
}

function MatchPuzzle({ spec, childName, feedback: feedbackCopy, onComplete }: PuzzleGameProps) {
  const items = useMemo(() => readItems(spec), [spec]);
  const cards = useMemo(() => makeMatchCards(items, spec.params.seed), [items, spec.params.seed]);
  const prompt = readPrompt(spec, '같은 짝을 찾아요');
  const totalPairs = items.length;
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [mismatchedCardIds, setMismatchedCardIds] = useState<string[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(DEFAULT_FEEDBACK);
  const { completed, completeRound, markRetried, retried } = useRoundCompletion(spec, onComplete);
  const delay = useTimerQueue();

  if (items.length === 0) {
    return <EmptyPuzzleState title="짝 맞추기 재료를 준비하고 있어요" />;
  }

  if (completed) {
    return <CompletedState childName={childName} score={totalPairs} maxScore={totalPairs} retried={retried} />;
  }

  const matchedSet = new Set(matchedPairIds);
  const selectedSet = new Set(selectedCardIds);
  const mismatchedSet = new Set(mismatchedCardIds);
  const isChecking = mismatchedCardIds.length > 0;

  function handleCardSelect(card: MatchCard) {
    if (isChecking || matchedSet.has(card.pairId) || selectedSet.has(card.id)) return;

    const nextSelected = [...selectedCardIds, card.id];

    if (nextSelected.length === 1) {
      setSelectedCardIds(nextSelected);
      setFeedback({
        tone: 'hint',
        message: `${card.item.label_ko}의 짝을 찾아볼까?`,
      });
      return;
    }

    const firstCard = cards.find((candidate) => candidate.id === nextSelected[0]);
    const isMatch = Boolean(firstCard && firstCard.pairId === card.pairId && firstCard.kind !== card.kind);

    if (isMatch) {
      const nextMatched = [...matchedPairIds, card.pairId];
      setMatchedPairIds(nextMatched);
      setSelectedCardIds([]);
      setFeedback({
        tone: 'success',
        message: nextMatched.length === totalPairs
          ? feedbackCopy?.success ?? '모든 짝을 찾았어!'
          : '짝을 찾았어!',
      });

      if (nextMatched.length === totalPairs) {
        delay(() => completeRound(totalPairs, totalPairs), 650);
      }

      return;
    }

    markRetried();
    setSelectedCardIds(nextSelected);
    setMismatchedCardIds(nextSelected);
    setFeedback({
      tone: 'retry',
      message: feedbackCopy?.retry ?? '거의 다 왔어! 다른 짝을 찾아볼까?',
    });
    delay(() => {
      setSelectedCardIds([]);
      setMismatchedCardIds([]);
      setFeedback(DEFAULT_FEEDBACK);
    }, 800);
  }

  return (
    <section className="rounded-xl border border-line bg-white p-4 shadow-sm shadow-sagebg">
      <PuzzleHeader
        eyebrow={`퍼즐 ${spec.round_index + 1}`}
        title={prompt}
        progressLabel={`${matchedPairIds.length}/${totalPairs}짝`}
        progressValue={matchedPairIds.length}
        progressMax={totalPairs}
      />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-5">
        {cards.map((card) => {
          const isMatched = matchedSet.has(card.pairId);
          const isSelected = selectedSet.has(card.id);
          const isMismatch = mismatchedSet.has(card.id);

          return (
            <button
              key={card.id}
              type="button"
              aria-label={`${card.item.label_ko} ${card.kind === 'token' ? '그림' : '이름'} 카드 고르기`}
              aria-pressed={isSelected || isMatched}
              disabled={isMatched || isChecking}
              onClick={() => handleCardSelect(card)}
              className={`min-h-[112px] rounded-lg border-2 p-3 text-center transition-all duration-300 active:scale-95 lg:min-h-[150px] lg:p-5 ${
                isMatched
                  ? 'scale-95 border-emerald-300 bg-emerald-50 text-emerald-700'
                  : isMismatch
                    ? 'border-rose-200 bg-rose-50 text-rose-600'
                    : isSelected
                      ? 'scale-105 border-sage bg-mist text-ink shadow-sm shadow-sagebg'
                      : 'border-line bg-sagebg text-gray-800 hover:border-sage hover:bg-mist'
              }`}
            >
              {card.kind === 'token' ? (
                <TokenVisual item={card.item} />
              ) : (
                <span className="flex min-h-[72px] items-center justify-center text-2xl font-black">
                  {card.item.label_ko}
                </span>
              )}
              <span className="mt-2 block text-xs font-bold text-sage">
                {isMatched ? '찾았어요' : card.kind === 'token' ? '그림' : '이름'}
              </span>
            </button>
          );
        })}
      </div>

      <FeedbackLine feedback={feedback} />
    </section>
  );
}

function SortPuzzle({ spec, childName, feedback: feedbackCopy, onComplete }: PuzzleGameProps) {
  const items = useMemo(() => readItems(spec), [spec]);
  const categories = useMemo(() => readCategories(spec, items), [spec, items]);
  const prompt = readPrompt(spec, '같은 무리끼리 나누어요');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Feedback>(DEFAULT_FEEDBACK);
  const { completed, completeRound, markRetried, retried } = useRoundCompletion(spec, onComplete);
  const delay = useTimerQueue();

  if (items.length === 0 || categories.length === 0) {
    return <EmptyPuzzleState title="분류 놀이 재료를 준비하고 있어요" />;
  }

  const placedCount = Object.keys(assignments).length;
  const selectedItem = selectedItemId ? items.find((item) => item.id === selectedItemId) ?? null : null;
  const unplacedItems = items.filter((item) => !assignments[item.id]);

  if (completed) {
    return <CompletedState childName={childName} score={items.length} maxScore={items.length} retried={retried} />;
  }

  function handleItemSelect(item: PuzzleItem) {
    if (assignments[item.id]) return;

    setSelectedItemId(item.id);
    setFeedback({
      tone: 'hint',
      message: `${item.label_ko}은 어디에 들어갈까?`,
    });
  }

  function handleCategorySelect(category: string) {
    if (!selectedItem) {
      setFeedback({
        tone: 'hint',
        message: '먼저 그림 카드를 골라요.',
      });
      return;
    }

    if (selectedItem.category !== category) {
      markRetried();
      setFeedback({
        tone: 'retry',
        message: feedbackCopy?.retry ?? '거의 다 왔어! 다른 바구니를 골라볼까?',
      });
      return;
    }

    const nextAssignments = {
      ...assignments,
      [selectedItem.id]: category,
    };

    setAssignments(nextAssignments);
    setSelectedItemId(null);
    setFeedback({
      tone: 'success',
      message: Object.keys(nextAssignments).length === items.length
        ? feedbackCopy?.success ?? '모두 잘 나누었어!'
        : '잘 넣었어!',
    });

    if (Object.keys(nextAssignments).length === items.length) {
      delay(() => completeRound(items.length, items.length), 650);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-white p-4 shadow-sm shadow-sagebg">
      <PuzzleHeader
        eyebrow={`퍼즐 ${spec.round_index + 1}`}
        title={prompt}
        progressLabel={`${placedCount}/${items.length}개`}
        progressValue={placedCount}
        progressMax={items.length}
      />

      <div className="mt-4">
        <div className="flex flex-wrap gap-3">
          {unplacedItems.map((item) => {
            const isSelected = selectedItemId === item.id;

            return (
              <button
                key={item.id}
                type="button"
                aria-label={`${item.label_ko} 카드 선택하기`}
                aria-pressed={isSelected}
                onClick={() => handleItemSelect(item)}
                className={`flex min-h-[72px] min-w-[88px] flex-1 items-center gap-3 rounded-lg border-2 px-3 py-2 text-left transition-all duration-300 active:scale-95 sm:flex-none lg:min-h-[88px] lg:px-5 ${
                  isSelected
                    ? 'scale-105 border-sage bg-mist text-ink shadow-sm shadow-sagebg'
                    : 'border-line bg-sagebg text-gray-800 hover:border-sage hover:bg-mist'
                }`}
              >
                <TokenVisual item={item} compact />
                <span className="text-sm font-black lg:text-lg">{item.label_ko}</span>
              </button>
            );
          })}
        </div>

        {unplacedItems.length === 0 && (
          <div className="flex min-h-[72px] items-center justify-center rounded-lg bg-emerald-50 px-4 text-sm font-bold text-emerald-700">
            모든 카드를 넣었어요
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {categories.map((category) => {
          const placedItems = items.filter((item) => assignments[item.id] === category);

          return (
            <button
              key={category}
              type="button"
              aria-label={`${categoryLabel(category)} 바구니에 넣기`}
              onClick={() => handleCategorySelect(category)}
              className={`min-h-[132px] rounded-lg border-2 p-3 text-left transition-all duration-300 active:scale-95 ${
                selectedItem
                  ? 'border-sagebg bg-sagebg hover:border-sage hover:bg-mist'
                  : 'border-gray-100 bg-gray-50'
              }`}
            >
              <span className="block text-sm font-black text-ink">{categoryLabel(category)}</span>
              <span className="mt-1 block text-xs font-bold text-sage">
                {placedItems.length}개 모였어요
              </span>
              <span className="mt-3 flex flex-wrap gap-2">
                {placedItems.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-white px-3 text-sm font-bold text-gray-800 shadow-sm"
                  >
                    <TokenVisual item={item} compact />
                    {item.label_ko}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <FeedbackLine feedback={feedback} />
    </section>
  );
}

function PuzzleHeader({
  eyebrow,
  title,
  progressLabel,
  progressValue,
  progressMax,
}: {
  eyebrow: string;
  title: string;
  progressLabel: string;
  progressValue: number;
  progressMax: number;
}) {
  const progressPct = progressMax > 0 ? Math.min(100, Math.round((progressValue / progressMax) * 100)) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-sage">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-black text-gray-900">{title}</h2>
        </div>
        <span className="inline-flex min-h-[44px] min-w-[68px] items-center justify-center rounded-full bg-mist px-3 text-sm font-black text-saged">
          {progressLabel}
        </span>
      </div>
      <div
        aria-label={`진행률 ${progressPct}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progressPct}
        className="mt-3 h-3 overflow-hidden rounded-full bg-sagebg"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-saged transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  return (
    <div aria-live="polite" className="mt-4 min-h-[54px] text-center">
      <div
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm font-black transition-all duration-300 ${
          feedback.tone === 'success'
            ? 'scale-105 bg-emerald-100 text-emerald-700'
            : feedback.tone === 'retry'
              ? 'bg-amber-100 text-amber-700'
              : feedback.tone === 'hint'
                ? 'bg-mist text-saged'
                : 'bg-gray-50 text-gray-500'
        }`}
      >
        <span aria-hidden="true" className="text-lg">
          {feedback.tone === 'success' ? '✓' : feedback.tone === 'retry' ? '•' : '·'}
        </span>
        {feedback.message}
      </div>
    </div>
  );
}

function CompletedState({
  childName,
  score,
  maxScore,
  retried,
}: {
  childName: string;
  score: number;
  maxScore: number;
  retried: boolean;
}) {
  return (
    <section className="rounded-xl border border-line bg-white p-6 text-center shadow-sm shadow-sagebg">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sagebg text-3xl font-black text-saged transition-all duration-300" aria-hidden="true">
        ✓
      </div>
      <h2 className="mt-3 text-xl font-black text-gray-900">
        {childName} 해냈어!
      </h2>
      <p className="mt-2 text-sm font-bold text-saged">
        {score}/{maxScore}개 완성했어요
      </p>
      <p className="mt-1 text-sm font-medium text-gray-500">
        {retried ? '다시 살펴보고 끝까지 해냈어요.' : '한 번에 차근차근 찾았어요.'}
      </p>
    </section>
  );
}

function EmptyPuzzleState({ title }: { title: string }) {
  return (
    <section className="rounded-xl border border-line bg-sagebg p-5 text-center shadow-sm shadow-sagebg">
      <PuzzleFallbackIcon />
      <h2 className="mt-3 text-lg font-bold text-ink">{title}</h2>
      <p className="mt-2 text-sm font-medium text-saged">
        잠깐 뒤에 다시 놀이해요.
      </p>
    </section>
  );
}

function PuzzleFallbackIcon() {
  return (
    <div className="mx-auto grid h-14 w-14 grid-cols-2 gap-1 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-line" aria-hidden="true">
      <span className="rounded-tl-xl rounded-br-md bg-sage" />
      <span className="rounded-tr-xl rounded-bl-md bg-mint" />
      <span className="rounded-bl-xl rounded-tr-md bg-honey" />
      <span className="rounded-br-xl rounded-tl-md bg-coral" />
    </div>
  );
}

function TokenVisual({ item, compact = false }: { item: PuzzleItem; compact?: boolean }) {
  return <GameTokenVisual token={item.token} label={item.label_ko} compact={compact} />;
}

function useRoundCompletion(spec: GameRoundSpec, onComplete: (result: GameRoundResult) => void) {
  const startedAtRef = useRef<number | null>(null);
  const retriedRef = useRef(false);
  const completedRef = useRef(false);
  const [retried, setRetried] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  function markRetried() {
    retriedRef.current = true;
    setRetried(true);
  }

  function completeRound(score: number, maxScore: number) {
    if (completedRef.current) return;

    completedRef.current = true;
    const completedAt = Date.now();
    const startedAt = startedAtRef.current ?? completedAt;
    setCompleted(true);
    onComplete({
      game_type: spec.game_type,
      difficulty: spec.params.difficulty,
      objective_code: spec.tag.objective_code,
      standard_anchor: spec.tag.standard_anchor,
      score,
      max_score: maxScore,
      latency_ms: Math.max(0, completedAt - startedAt),
      retried: retriedRef.current,
      reward_payload: null,
    });
  }

  return {
    completed,
    completeRound,
    markRetried,
    retried,
  };
}

function useTimerQueue() {
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      for (const timerId of timersRef.current) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  return (callback: () => void, ms: number) => {
    const timerId = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((queuedId) => queuedId !== timerId);
      callback();
    }, ms);

    timersRef.current.push(timerId);
  };
}

function makeMatchCards(items: PuzzleItem[], seed: number): MatchCard[] {
  const cards = items.flatMap((item): MatchCard[] => [
    {
      id: `${item.id}:token`,
      pairId: item.id,
      kind: 'token',
      item,
    },
    {
      id: `${item.id}:label`,
      pairId: item.id,
      kind: 'label',
      item,
    },
  ]);

  return seededShuffle(cards, seed + 17);
}

function readItems(spec: GameRoundSpec): PuzzleItem[] {
  const params = spec.params as RuntimePuzzleParams;

  if (!Array.isArray(params.items)) return [];

  return params.items
    .map((rawItem, index): PuzzleItem | null => {
      if (!isRecord(rawItem)) return null;

      const token = stringValue(rawItem.token) ?? stringValue(rawItem.id);
      if (!token) return null;

      const label = stringValue(rawItem.label_ko) ?? stringValue(rawItem.label) ?? token;
      const category = stringValue(rawItem.category) ?? 'default';

      return {
        id: `item-${index}`,
        token,
        label_ko: label,
        category,
      };
    })
    .filter((item): item is PuzzleItem => Boolean(item));
}

function readCategories(spec: GameRoundSpec, items: PuzzleItem[]): string[] {
  const params = spec.params as RuntimePuzzleParams;
  const categoryValues = Array.isArray(params.categories)
    ? params.categories.map((category) => stringValue(category)).filter((category): category is string => Boolean(category))
    : [];
  const itemCategories = items.map((item) => item.category);

  return uniqueStrings(categoryValues.length > 0 ? categoryValues : itemCategories);
}

function readPrompt(spec: GameRoundSpec, fallback: string): string {
  const params = spec.params as RuntimePuzzleParams;
  return stringValue(params.prompt_ko) ?? fallback;
}

function readAnswerToken(spec: GameRoundSpec): string | null {
  const params = spec.params as RuntimePuzzleParams;
  return stringValue(params.answer_token);
}

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const shuffled = [...items];
  let state = seed >>> 0;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    const random = ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    const swapIndex = Math.floor(random * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
