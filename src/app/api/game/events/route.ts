import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseServiceConfigured, supabase } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import {
  C6_AXIS_IDS,
  THINKING_TOOLS,
  type C6AxisId,
  type ThinkingTool,
} from '@/lib/c6/axes';
import { processRoundGrowth } from '@/lib/c6/diagnosis-agent';
import { LOCAL_PREVIEW_CHILD_ID } from '@/lib/local-preview-child';
import {
  LOCAL_PREVIEW_GAME_COOKIE,
  LOCAL_PREVIEW_GAME_COOKIE_MAX_AGE,
  appendLocalPreviewRound,
  completeLocalPreviewGame,
  emptyLocalPreviewGameState,
  parseLocalPreviewGameCookie,
  serializeLocalPreviewGameState,
} from '@/lib/local-preview-game';
import type { GameEvent, GameRoundResult, GameType, RewardDelta } from '@/types/game';

export const runtime = 'nodejs';

const ALLOWED_EVENTS = new Set<GameEvent['type']>([
  'game_started',
  'game_round_completed',
  'game_completed',
  'collection_progress',
]);

const ALLOWED_GAME_TYPES = new Set<GameType>([
  'G1_match',
  'G2_sort',
  'G3_sequence',
  'G4_listen',
  'G5_find',
  'Q_quiz',
  'emotion_expression',
  'hidden_friend',
  'decorate',
]);

const MAX_DIFFICULTY = 10;
const MAX_SCORE = 100000;
const MAX_LATENCY_MS = 60 * 60 * 1000;
const MAX_ROUND_ELAPSED_MS = 60 * 60 * 1000;
const MAX_ROUND_COUNT_SIGNAL = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_C6_AXIS_IDS = new Set<string>(C6_AXIS_IDS);
const ALLOWED_THINKING_TOOLS = new Set<string>(THINKING_TOOLS);

type GameEventBody = {
  event?: unknown;
  type?: unknown;
  round_index?: unknown;
  result?: unknown;
  payload?: unknown;
  child_id?: unknown;
  context?: unknown;
  topic?: unknown;
  game_session_id?: unknown;
};

type GameSessionRef = {
  id: string;
  child_id: string;
  rounds_completed: number | null;
  child_age: number | null;
};

type OwnedChildRef = {
  id: string;
  age: number | null;
};

function unauthorized() {
  return NextResponse.json({ error: '보호자 로그인이 필요해요.' }, { status: 401 });
}

function badGameEvent() {
  return NextResponse.json({ error: '놀이 기록을 다시 확인해 주세요.' }, { status: 400 });
}

function childNotFound() {
  return NextResponse.json({ error: '아이 정보를 찾지 못했어요.' }, { status: 404 });
}

function gameSessionNotFound() {
  return NextResponse.json({ error: '놀이 기록을 찾지 못했어요.' }, { status: 404 });
}

function gameSaveError() {
  return NextResponse.json({ error: '놀이 기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function int(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
}

function boundedInt(v: unknown, min: number, max: number): number | null {
  const n = int(v);
  return n !== null && n >= min && n <= max ? n : null;
}

function nullableScore(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  return boundedInt(v, 0, MAX_SCORE);
}

function nullableLatency(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  return boundedInt(v, 0, MAX_LATENCY_MS);
}

function jsonObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function optionalBoundedInt(v: unknown, min: number, max: number): number | null | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  return boundedInt(v, min, max);
}

function optionalBoolean(v: unknown): boolean | null | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  return typeof v === 'boolean' ? v : null;
}

function optionalJsonObject(v: unknown): Record<string, unknown> | null | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  return jsonObject(v);
}

function optionalString(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  return str(v);
}

function optionalAxisId(v: unknown): C6AxisId | null | undefined {
  const value = optionalString(v);
  if (value === undefined || value === null) return value;
  return ALLOWED_C6_AXIS_IDS.has(value) ? (value as C6AxisId) : null;
}

function optionalThinkingTool(v: unknown): ThinkingTool | null | undefined {
  const value = optionalString(v);
  if (value === undefined || value === null) return value;
  return ALLOWED_THINKING_TOOLS.has(value) ? (value as ThinkingTool) : null;
}

function optionalUuid(v: unknown): string | null | undefined {
  const value = optionalString(v);
  if (value === undefined || value === null) return value;
  return UUID_PATTERN.test(value) ? value : null;
}

function parseContext(v: unknown): 'home' | 'kiosk' | null {
  if (v === undefined || v === null || v === '') return 'home';
  return v === 'home' || v === 'kiosk' ? v : null;
}

function parseEvent(body: GameEventBody): GameEvent | null {
  const event = jsonObject(body.event) ?? (body as Record<string, unknown>);
  const type = str(event?.type);
  if (!type || !ALLOWED_EVENTS.has(type as GameEvent['type'])) return null;

  return {
    type: type as GameEvent['type'],
    round_index: event?.round_index,
    result: event?.result,
    payload: jsonObject(event?.payload) ?? undefined,
  } as GameEvent;
}

function parseGameSessionId(body: GameEventBody, event: GameEvent): string | null {
  const payload = jsonObject(event.payload);
  return str(body.game_session_id) ?? str(payload?.game_session_id);
}

function parseRoundResult(v: unknown): GameRoundResult | { error: string } {
  const result = jsonObject(v);
  if (!result) return { error: 'result required' };

  const gameType = str(result.game_type);
  if (!gameType || !ALLOWED_GAME_TYPES.has(gameType as GameType)) {
    return { error: 'invalid game_type' };
  }

  const difficulty = boundedInt(result.difficulty, 1, MAX_DIFFICULTY);
  if (difficulty === null) return { error: 'invalid difficulty' };

  const score = nullableScore(result.score);
  const maxScore = nullableScore(result.max_score);
  if (result.score !== null && result.score !== undefined && score === null) {
    return { error: 'invalid score' };
  }
  if (result.max_score !== null && result.max_score !== undefined && maxScore === null) {
    return { error: 'invalid max_score' };
  }
  if (score !== null && maxScore !== null && score > maxScore) {
    return { error: 'score exceeds max_score' };
  }

  const latencyMs = nullableLatency(result.latency_ms);
  if (result.latency_ms !== null && result.latency_ms !== undefined && latencyMs === null) {
    return { error: 'invalid latency_ms' };
  }

  const rewardPayload = jsonObject(result.reward_payload) as RewardDelta | null;
  const axisId = optionalAxisId(result.axis_id);
  if (axisId === null) return { error: 'invalid axis_id' };

  const thinkingTool = optionalThinkingTool(result.thinking_tool);
  if (thinkingTool === null) return { error: 'invalid thinking_tool' };

  const storySeedId = optionalUuid(result.story_seed_id);
  if (storySeedId === null) return { error: 'invalid story_seed_id' };

  const worldRegion = optionalString(result.world_region);
  if (worldRegion === null) return { error: 'invalid world_region' };

  const elapsedMs = optionalBoundedInt(result.elapsed_ms, 0, MAX_ROUND_ELAPSED_MS);
  if (elapsedMs === null) return { error: 'invalid elapsed_ms' };

  const hintCount = optionalBoundedInt(result.hint_count, 0, MAX_ROUND_COUNT_SIGNAL);
  if (hintCount === null) return { error: 'invalid hint_count' };

  const retryCount = optionalBoundedInt(result.retry_count, 0, MAX_ROUND_COUNT_SIGNAL);
  if (retryCount === null) return { error: 'invalid retry_count' };

  const isCorrect = optionalBoolean(result.is_correct);
  if (isCorrect === null) return { error: 'invalid is_correct' };

  const responsePayload = optionalJsonObject(result.response_payload);
  if (responsePayload === null) return { error: 'invalid response_payload' };

  return {
    game_type: gameType as GameType,
    difficulty,
    objective_code: str(result.objective_code),
    standard_anchor: str(result.standard_anchor),
    score,
    max_score: maxScore,
    latency_ms: latencyMs,
    retried: typeof result.retried === 'boolean' ? result.retried : false,
    reward_payload: rewardPayload,
    ...(axisId !== undefined ? { axis_id: axisId } : {}),
    ...(thinkingTool !== undefined ? { thinking_tool: thinkingTool } : {}),
    ...(storySeedId !== undefined ? { story_seed_id: storySeedId } : {}),
    ...(worldRegion !== undefined ? { world_region: worldRegion } : {}),
    ...(elapsedMs !== undefined ? { elapsed_ms: elapsedMs } : {}),
    ...(hintCount !== undefined ? { hint_count: hintCount } : {}),
    ...(retryCount !== undefined ? { retry_count: retryCount } : {}),
    ...(isCorrect !== undefined ? { is_correct: isCorrect } : {}),
    ...(responsePayload !== undefined ? { response_payload: responsePayload } : {}),
  };
}

async function getOwnedChildRef(childId: string, parentId: string): Promise<OwnedChildRef | null> {
  const { data, error } = await supabase
    .from('children')
    .select('id, age')
    .eq('id', childId)
    .eq('parent_id', parentId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id as string,
    age: typeof data.age === 'number' ? data.age : null,
  };
}

async function verifyChildOwner(childId: string, parentId: string) {
  return Boolean(await getOwnedChildRef(childId, parentId));
}

async function getOwnedGameSession(gameSessionId: string, parentId: string): Promise<GameSessionRef | null> {
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('id, child_id, rounds_completed')
    .eq('id', gameSessionId)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!session?.child_id) return null;

  const child = await getOwnedChildRef(session.child_id as string, parentId);
  if (!child) return null;

  return {
    id: session.id as string,
    child_id: session.child_id as string,
    rounds_completed: typeof session.rounds_completed === 'number' ? session.rounds_completed : 0,
    child_age: child.age,
  };
}

async function handleGameStarted(body: GameEventBody, parentId: string) {
  const childId = str(body.child_id);
  if (!childId) {
    return badGameEvent();
  }

  const owned = await verifyChildOwner(childId, parentId);
  if (!owned) {
    return childNotFound();
  }

  const context = parseContext(body.context);
  if (!context) {
    return badGameEvent();
  }

  const { data, error } = await supabase
    .from('game_sessions')
    .insert({
      child_id: childId,
      context,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[game-events:start]', error);
    return gameSaveError();
  }

  return NextResponse.json({ game_session_id: data.id, accepted: 1 });
}

async function handleRoundCompleted(event: GameEvent, body: GameEventBody, parentId: string) {
  const gameSessionId = parseGameSessionId(body, event);
  if (!gameSessionId) {
    return badGameEvent();
  }

  const session = await getOwnedGameSession(gameSessionId, parentId);
  if (!session) {
    return gameSessionNotFound();
  }

  const roundIndex = boundedInt(event.round_index, 0, 1000);
  if (roundIndex === null) {
    return badGameEvent();
  }

  const result = parseRoundResult(event.result);
  if ('error' in result) {
    return badGameEvent();
  }

  const roundInsert: Record<string, unknown> = {
    game_session_id: session.id,
    child_id: session.child_id,
    round_index: roundIndex,
    game_type: result.game_type,
    difficulty: result.difficulty,
    objective_code: result.objective_code,
    standard_anchor: result.standard_anchor,
    score: result.score,
    max_score: result.max_score,
    latency_ms: result.latency_ms,
    retried: result.retried,
    reward_payload: result.reward_payload,
  };

  if (result.axis_id) roundInsert.axis_id = result.axis_id;
  if (result.thinking_tool) roundInsert.thinking_tool = result.thinking_tool;
  if (result.story_seed_id) roundInsert.story_seed_id = result.story_seed_id;
  if (result.world_region) roundInsert.world_region = result.world_region;
  if (typeof result.elapsed_ms === 'number') roundInsert.elapsed_ms = result.elapsed_ms;
  if (typeof result.hint_count === 'number') roundInsert.hint_count = result.hint_count;
  if (typeof result.retry_count === 'number') roundInsert.retry_count = result.retry_count;
  if (result.response_payload) roundInsert.response_payload = result.response_payload;

  const { data: roundData, error: roundError } = await supabase
    .from('game_rounds')
    .insert(roundInsert)
    .select('id')
    .single();

  if (roundError || !roundData) {
    console.error('[game-events:round-insert]', roundError);
    return gameSaveError();
  }

  try {
    await processRoundGrowth(supabase, {
      roundId: roundData.id as string,
      childId: session.child_id,
      round: result,
      age: session.child_age,
    });
  } catch (error) {
    console.error('[growth-agent]', error);
  }

  const { error: sessionError } = await supabase
    .from('game_sessions')
    .update({ rounds_completed: (session.rounds_completed ?? 0) + 1 })
    .eq('id', session.id);

  if (sessionError) {
    console.error('[game-events:round-session-update]', sessionError);
    return gameSaveError();
  }

  return NextResponse.json({ game_session_id: session.id, accepted: 1 });
}

async function handleGameCompleted(event: GameEvent, body: GameEventBody, parentId: string) {
  const gameSessionId = parseGameSessionId(body, event);
  if (!gameSessionId) {
    return badGameEvent();
  }

  const session = await getOwnedGameSession(gameSessionId, parentId);
  if (!session) {
    return gameSessionNotFound();
  }

  const payload = jsonObject(event.payload);
  const roundsTotal = boundedInt(payload?.rounds_total, 0, 1000);
  const update: Record<string, unknown> = { completed_at: new Date().toISOString() };
  if (roundsTotal !== null) update.rounds_total = roundsTotal;

  const { error } = await supabase
    .from('game_sessions')
    .update(update)
    .eq('id', session.id);

  if (error) {
    console.error('[game-events:complete]', error);
    return gameSaveError();
  }

  return NextResponse.json({ game_session_id: session.id, accepted: 1 });
}

async function handleCollectionProgress(event: GameEvent, body: GameEventBody, parentId: string) {
  const gameSessionId = parseGameSessionId(body, event);
  if (!gameSessionId) {
    return badGameEvent();
  }

  const session = await getOwnedGameSession(gameSessionId, parentId);
  if (!session) {
    return gameSessionNotFound();
  }

  // Collection progress is a UI/reward-state signal, not a learning round.
  // The same reward delta is already persisted on the completed round payload.
  return NextResponse.json({ game_session_id: session.id, accepted: 1, stored: 0 });
}

function localPreviewResponse(request: NextRequest, body: GameEventBody, event: GameEvent) {
  const payload = jsonObject(event.payload);
  const childId = str(body.child_id) ?? LOCAL_PREVIEW_CHILD_ID;
  const existingState = parseLocalPreviewGameCookie(request.cookies.get(LOCAL_PREVIEW_GAME_COOKIE)?.value);
  const existingSessionId = parseGameSessionId(body, event) ?? existingState?.session_id;
  const sessionId = existingSessionId ?? `local-preview-session-${childId}`;
  let state = existingState ?? emptyLocalPreviewGameState({ sessionId, childId });

  if (event.type === 'game_started') {
    state = emptyLocalPreviewGameState({
      sessionId,
      childId,
      roundsTotal: boundedInt(payload?.rounds_total, 0, 1000),
    });
  } else if (event.type === 'game_round_completed') {
    const roundIndex = boundedInt(event.round_index, 0, 1000);
    const result = parseRoundResult(event.result);
    if (roundIndex !== null && !('error' in result)) {
      state = appendLocalPreviewRound(state, roundIndex, result);
    }
  } else if (event.type === 'game_completed') {
    state = completeLocalPreviewGame(state, boundedInt(payload?.rounds_total, 0, 1000));
  }

  const response = NextResponse.json({ game_session_id: state.session_id, accepted: 1, preview: true });
  response.cookies.set(LOCAL_PREVIEW_GAME_COOKIE, serializeLocalPreviewGameState(state), {
    httpOnly: true,
    maxAge: LOCAL_PREVIEW_GAME_COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
  });
  return response;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as GameEventBody | null;
  if (!body || typeof body !== 'object') {
    return badGameEvent();
  }

  const event = parseEvent(body);
  if (!event) {
    return badGameEvent();
  }

  if (!isSupabaseServiceConfigured()) {
    return localPreviewResponse(request, body, event);
  }

  let parentId: string;
  try {
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    console.error('[game-events:auth]', error);
    return gameSaveError();
  }

  try {
    if (event.type === 'game_started') return await handleGameStarted(body, parentId);
    if (event.type === 'game_round_completed') return await handleRoundCompleted(event, body, parentId);
    if (event.type === 'game_completed') return await handleGameCompleted(event, body, parentId);
    return await handleCollectionProgress(event, body, parentId);
  } catch (error) {
    console.error('[game-events:save]', error);
    return gameSaveError();
  }
}
