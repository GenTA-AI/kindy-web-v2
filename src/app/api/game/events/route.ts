import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
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
]);

const MAX_DIFFICULTY = 10;
const MAX_SCORE = 100000;
const MAX_LATENCY_MS = 60 * 60 * 1000;

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
};

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  };
}

async function verifyChildOwner(childId: string, parentId: string) {
  const { data, error } = await supabase
    .from('children')
    .select('id')
    .eq('id', childId)
    .eq('parent_id', parentId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function getOwnedGameSession(gameSessionId: string, parentId: string): Promise<GameSessionRef | null> {
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .select('id, child_id, rounds_completed')
    .eq('id', gameSessionId)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!session?.child_id) return null;

  const owned = await verifyChildOwner(session.child_id as string, parentId);
  if (!owned) return null;

  return {
    id: session.id as string,
    child_id: session.child_id as string,
    rounds_completed: typeof session.rounds_completed === 'number' ? session.rounds_completed : 0,
  };
}

async function handleGameStarted(body: GameEventBody, parentId: string) {
  const childId = str(body.child_id);
  if (!childId) {
    return NextResponse.json({ error: 'child_id required' }, { status: 400 });
  }

  const owned = await verifyChildOwner(childId, parentId);
  if (!owned) {
    return NextResponse.json({ error: 'child not found' }, { status: 404 });
  }

  const context = parseContext(body.context);
  if (!context) {
    return NextResponse.json({ error: 'invalid context' }, { status: 400 });
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
    return NextResponse.json({ error: error?.message || 'game session create failed' }, { status: 500 });
  }

  return NextResponse.json({ game_session_id: data.id, accepted: 1 });
}

async function handleRoundCompleted(event: GameEvent, body: GameEventBody, parentId: string) {
  const gameSessionId = parseGameSessionId(body, event);
  if (!gameSessionId) {
    return NextResponse.json({ error: 'game_session_id required' }, { status: 400 });
  }

  const session = await getOwnedGameSession(gameSessionId, parentId);
  if (!session) {
    return NextResponse.json({ error: 'game session not found' }, { status: 404 });
  }

  const roundIndex = boundedInt(event.round_index, 0, 1000);
  if (roundIndex === null) {
    return NextResponse.json({ error: 'invalid round_index' }, { status: 400 });
  }

  const result = parseRoundResult(event.result);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const { error: roundError } = await supabase
    .from('game_rounds')
    .insert({
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
    });

  if (roundError) {
    return NextResponse.json({ error: roundError.message }, { status: 500 });
  }

  const { error: sessionError } = await supabase
    .from('game_sessions')
    .update({ rounds_completed: (session.rounds_completed ?? 0) + 1 })
    .eq('id', session.id);

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  return NextResponse.json({ game_session_id: session.id, accepted: 1 });
}

async function handleGameCompleted(event: GameEvent, body: GameEventBody, parentId: string) {
  const gameSessionId = parseGameSessionId(body, event);
  if (!gameSessionId) {
    return NextResponse.json({ error: 'game_session_id required' }, { status: 400 });
  }

  const session = await getOwnedGameSession(gameSessionId, parentId);
  if (!session) {
    return NextResponse.json({ error: 'game session not found' }, { status: 404 });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ game_session_id: session.id, accepted: 1 });
}

async function handleCollectionProgress(event: GameEvent, body: GameEventBody, parentId: string) {
  const gameSessionId = parseGameSessionId(body, event);
  if (!gameSessionId) {
    return NextResponse.json({ error: 'game_session_id required' }, { status: 400 });
  }

  const session = await getOwnedGameSession(gameSessionId, parentId);
  if (!session) {
    return NextResponse.json({ error: 'game session not found' }, { status: 404 });
  }

  const roundIndex = boundedInt(event.round_index, 0, 1000) ?? 0;
  const payload = jsonObject(event.payload) ?? {};

  const { error } = await supabase
    .from('game_rounds')
    .insert({
      game_session_id: session.id,
      child_id: session.child_id,
      round_index: roundIndex,
      game_type: 'collection_progress',
      difficulty: 1,
      reward_payload: payload,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ game_session_id: session.id, accepted: 1 });
}

export async function POST(request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    throw error;
  }

  const body = await request.json().catch(() => null) as GameEventBody | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const event = parseEvent(body);
  if (!event) {
    return NextResponse.json({ error: 'invalid event' }, { status: 400 });
  }

  if (event.type === 'game_started') return handleGameStarted(body, parentId);
  if (event.type === 'game_round_completed') return handleRoundCompleted(event, body, parentId);
  if (event.type === 'game_completed') return handleGameCompleted(event, body, parentId);
  return handleCollectionProgress(event, body, parentId);
}
