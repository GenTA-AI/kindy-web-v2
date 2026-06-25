import type { CollectionState, GameRoundResult, RewardDelta } from '@/types/game';

/**
 * No dark-pattern contract: additive-only rewards. No resets, no decay,
 * no time-boxed urgency, and no peer comparisons. Every completed
 * attempt receives positive effort progress; stars, stickers, and collection
 * counts only move upward.
 */

const MIN_EFFORT_STARS = 1;
const SUCCESS_RATIO = 0.8;
const PERFECT_RATIO = 1;
const MAX_DIFFICULTY = 5;
const KEY_MAX_LENGTH = 80;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonNegativeWhole(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function nonNegativeNumber(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function normalizedDifficulty(difficulty: number): number {
  if (!Number.isFinite(difficulty)) return 1;
  return clamp(Math.floor(difficulty), 1, MAX_DIFFICULTY);
}

function scoreRatio(result: GameRoundResult): number {
  const score = finiteNumber(result.score);
  const maxScore = finiteNumber(result.max_score);
  if (score === null || maxScore === null || maxScore <= 0) return 0;
  return clamp(score / maxScore, 0, 1);
}

function keyPart(value: string | null | undefined): string | null {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, KEY_MAX_LENGTH);

  return normalized || null;
}

function topicKey(result: GameRoundResult): string {
  return (
    keyPart(result.objective_code) ??
    keyPart(result.standard_anchor) ??
    keyPart(result.game_type) ??
    'game_round'
  );
}

function starReward(ratio: number, difficulty: number, retried: boolean): number {
  const progressStars = Math.ceil(ratio * 3);
  const successStars = ratio >= SUCCESS_RATIO ? 2 : 0;
  const perfectStars = ratio >= PERFECT_RATIO ? 1 : 0;
  const difficultyStars = ratio >= SUCCESS_RATIO ? Math.ceil(difficulty / 2) : ratio >= 0.5 ? 1 : 0;
  const retryStars = retried && ratio >= 0.5 ? 1 : 0;

  return MIN_EFFORT_STARS + progressStars + successStars + perfectStars + difficultyStars + retryStars;
}

function stickerRewards(key: string, ratio: number, difficulty: number, retried: boolean): string[] {
  const stickers: string[] = [];

  if (ratio >= PERFECT_RATIO) {
    stickers.push(`sticker:${key}:perfect`);
  } else if (ratio >= SUCCESS_RATIO) {
    stickers.push(`sticker:${key}:clear`);
  }

  if (ratio >= SUCCESS_RATIO && difficulty >= 4) {
    stickers.push(`sticker:${key}:challenge`);
  }

  if (retried && ratio >= 0.5) {
    stickers.push(`sticker:${key}:steady_try`);
  }

  return stickers;
}

function cleanKeys(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function rewardForRound(result: GameRoundResult): RewardDelta {
  const ratio = scoreRatio(result);
  const difficulty = normalizedDifficulty(result.difficulty);
  const key = topicKey(result);

  return {
    stars: starReward(ratio, difficulty, result.retried),
    stickers: stickerRewards(key, ratio, difficulty, result.retried),
    collection_unlocks: [`collection:${key}`],
  };
}

export function applyReward(state: CollectionState, delta: RewardDelta): CollectionState {
  const currentStars = nonNegativeNumber(state.total_stars);
  const totalStars = currentStars + nonNegativeWhole(delta.stars);
  const stickers = [...state.stickers];
  const collection = { ...state.collection };

  for (const sticker of cleanKeys(delta.stickers)) {
    if (!stickers.includes(sticker)) stickers.push(sticker);
  }

  for (const key of cleanKeys(delta.collection_unlocks)) {
    collection[key] = nonNegativeWhole(collection[key]) + 1;
  }

  return {
    total_stars: Math.max(currentStars, totalStars),
    stickers,
    collection,
  };
}

export function collectionProgressPct(state: CollectionState, totalDefinedSlots: number): number {
  const totalSlots = nonNegativeWhole(totalDefinedSlots);
  if (totalSlots === 0) return 0;

  const filledSlots = Object.values(state.collection).reduce(
    (sum, count) => sum + nonNegativeWhole(count),
    0,
  );

  return clamp((filledSlots / totalSlots) * 100, 0, 100);
}
