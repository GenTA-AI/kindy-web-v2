import type { GameRoundResult } from '@/types/game';
import { LOCAL_PREVIEW_CHILD_ID } from '@/lib/local-preview-child';

export const LOCAL_PREVIEW_GAME_COOKIE = 'kindy_preview_game';
export const LOCAL_PREVIEW_GAME_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type LocalPreviewRoundRecord = {
  round_index: number;
  result: GameRoundResult;
};

export type LocalPreviewGameState = {
  session_id: string;
  child_id: string;
  rounds_total: number;
  completed_at: string | null;
  rounds: LocalPreviewRoundRecord[];
  updated_at: string;
};

const DEFAULT_SESSION_ID = 'local-preview-session-child';
const MAX_STORED_ROUNDS = 50;

function cleanString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 120)
    : fallback;
}

function cleanInt(value: unknown, fallback: number, min = 0, max = 1000): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(numberValue) && numberValue >= min && numberValue <= max
    ? numberValue
    : fallback;
}

function cleanBool(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false;
}

function cleanNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function cleanRoundResult(value: unknown): GameRoundResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<GameRoundResult>;
  if (typeof record.game_type !== 'string') return null;

  return {
    game_type: record.game_type as GameRoundResult['game_type'],
    difficulty: cleanInt(record.difficulty, 1, 1, 10),
    objective_code: typeof record.objective_code === 'string' ? record.objective_code.slice(0, 120) : null,
    standard_anchor: typeof record.standard_anchor === 'string' ? record.standard_anchor.slice(0, 120) : null,
    score: cleanNullableNumber(record.score),
    max_score: cleanNullableNumber(record.max_score),
    latency_ms: cleanNullableNumber(record.latency_ms),
    retried: cleanBool(record.retried),
    // 로컬 프리뷰는 쿠키 저장이라 크기 제한이 빡빡하다.
    // 리포트 집계에 필요한 관찰 필드만 남기고 보상 배열은 클라이언트 화면 상태로만 사용한다.
    reward_payload: null,
  };
}

function cleanRoundRecord(value: unknown): LocalPreviewRoundRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<LocalPreviewRoundRecord>;
  const result = cleanRoundResult(record.result);
  if (!result) return null;

  return {
    round_index: cleanInt(record.round_index, 0),
    result,
  };
}

export function emptyLocalPreviewGameState(input: {
  sessionId?: string | null;
  childId?: string | null;
  roundsTotal?: number | null;
} = {}): LocalPreviewGameState {
  return {
    session_id: cleanString(input.sessionId, DEFAULT_SESSION_ID),
    child_id: cleanString(input.childId, LOCAL_PREVIEW_CHILD_ID),
    rounds_total: cleanInt(input.roundsTotal, 0),
    completed_at: null,
    rounds: [],
    updated_at: new Date().toISOString(),
  };
}

export function normalizeLocalPreviewGameState(input: Partial<LocalPreviewGameState> = {}): LocalPreviewGameState {
  const rounds = Array.isArray(input.rounds)
    ? input.rounds
        .map(cleanRoundRecord)
        .filter((round): round is LocalPreviewRoundRecord => Boolean(round))
        .slice(-MAX_STORED_ROUNDS)
    : [];

  return {
    session_id: cleanString(input.session_id, DEFAULT_SESSION_ID),
    child_id: cleanString(input.child_id, LOCAL_PREVIEW_CHILD_ID),
    rounds_total: cleanInt(input.rounds_total, rounds.length),
    completed_at: typeof input.completed_at === 'string' ? input.completed_at : null,
    rounds,
    updated_at: cleanString(input.updated_at, new Date().toISOString()),
  };
}

export function parseLocalPreviewGameCookie(value?: string | null): LocalPreviewGameState | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<LocalPreviewGameState>;
    return normalizeLocalPreviewGameState(parsed);
  } catch {
    return null;
  }
}

export function serializeLocalPreviewGameState(state: LocalPreviewGameState): string {
  return encodeURIComponent(JSON.stringify(normalizeLocalPreviewGameState(state)));
}

export function appendLocalPreviewRound(
  state: LocalPreviewGameState,
  roundIndex: number,
  result: GameRoundResult,
): LocalPreviewGameState {
  const record = cleanRoundRecord({ round_index: roundIndex, result });
  if (!record) return state;

  const nextRounds = [
    ...state.rounds.filter((round) => round.round_index !== record.round_index),
    record,
  ]
    .sort((a, b) => a.round_index - b.round_index)
    .slice(-MAX_STORED_ROUNDS);

  return {
    ...state,
    rounds: nextRounds,
    rounds_total: Math.max(state.rounds_total, nextRounds.length),
    updated_at: new Date().toISOString(),
  };
}

export function completeLocalPreviewGame(
  state: LocalPreviewGameState,
  roundsTotal?: number | null,
): LocalPreviewGameState {
  return {
    ...state,
    rounds_total: cleanInt(roundsTotal, Math.max(state.rounds_total, state.rounds.length)),
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
