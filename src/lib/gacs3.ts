import { EMOJI_SCORE, type EmojiReaction, type ViewEvent, type WordProfile } from '@/types';

/**
 * GACS-3: Generative Adjective & Content Scoring v3
 *
 * Core engine that calculates per-child word weights for video generation prompts.
 * MVP: rule-based. Post-MVP: ML-based.
 */

export function calculateFocusScore(
  watchTimeSec: number,
  videoDurationSec: number,
  replayCount: number,
  emojiReaction: EmojiReaction['reaction'] | null
): number {
  const completionComponent = Math.min(watchTimeSec / videoDurationSec, 1.0) * 0.6;
  const replayComponent = (Math.min(replayCount, 5) / 5) * 0.3;
  const emojiComponent = (emojiReaction ? EMOJI_SCORE[emojiReaction] : 0.5) * 0.1;
  return completionComponent + replayComponent + emojiComponent;
}

export function calculateStyleScore(
  completionRate: number,
  replayCount: number,
  emojiReaction: EmojiReaction['reaction'] | null
): number {
  const completionComponent = completionRate * 0.5;
  const replayComponent = (Math.min(replayCount, 5) / 5) * 0.3;
  const emojiComponent = (emojiReaction ? EMOJI_SCORE[emojiReaction] : 0.5) * 0.2;
  return completionComponent + replayComponent + emojiComponent;
}

export function calculateWordWeight(
  avgFocusScore: number,
  avgCompletionRate: number,
  avgQuizScore: number
): number {
  return avgFocusScore * 0.4 + avgCompletionRate * 0.3 + avgQuizScore * 0.3;
}

interface VideoStats {
  videoId: string;
  adjectives: string[];
  focusScore: number;
  completionRate: number;
  quizScore: number;
}

export function buildWordProfile(videoStats: VideoStats[]): WordProfile {
  const wordScores: Record<string, { total: number; count: number }> = {};

  for (const stat of videoStats) {
    const weight = calculateWordWeight(stat.focusScore, stat.completionRate, stat.quizScore);
    for (const adj of stat.adjectives) {
      if (!wordScores[adj]) wordScores[adj] = { total: 0, count: 0 };
      wordScores[adj].total += weight;
      wordScores[adj].count += 1;
    }
  }

  const weights: Record<string, number> = {};
  for (const [word, { total, count }] of Object.entries(wordScores)) {
    weights[word] = total / count;
  }

  const sorted = Object.entries(weights).sort(([, a], [, b]) => b - a);
  const preferred = sorted.filter(([, w]) => w >= 0.7).map(([word]) => word);
  const avoid = sorted.filter(([, w]) => w <= 0.3).map(([word]) => word);

  return {
    child_id: '',
    preferred_adjectives: preferred.slice(0, 10),
    avoid_adjectives: avoid.slice(0, 10),
    weights,
    updated_at: new Date().toISOString(),
  };
}

export function getSegmentReplays(events: ViewEvent[]): Array<{ start: number; end: number; count: number }> {
  const replays = events.filter(e => e.event_type === 'segment_replay');
  const segmentMap = new Map<string, number>();

  for (const event of replays) {
    if (event.segment_start !== undefined && event.segment_end !== undefined) {
      const key = `${event.segment_start}-${event.segment_end}`;
      segmentMap.set(key, (segmentMap.get(key) || 0) + 1);
    }
  }

  return Array.from(segmentMap.entries())
    .map(([key, count]) => {
      const [start, end] = key.split('-').map(Number);
      return { start, end, count };
    })
    .sort((a, b) => b.count - a.count);
}
