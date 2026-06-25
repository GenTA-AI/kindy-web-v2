import type { GameEvent } from '@/types/game';

const HOME_INGEST_URL = '/api/game/events';
const KIOSK_INGEST_URL = '/api/kiosk/events';
const LAST_HOME_SESSION_KEY = 'eduvid:last_game_session_id';
const HOME_SESSION_PREFIX = 'eduvid:game_session_id:';

export type EmitGameEventContext = {
  context: 'home' | 'kiosk';
  childId?: string;
  kioskSessionId?: string;
  locationCode?: string;
  topic?: string;
};

export type EmitGameEventResult = {
  ok: boolean;
  accepted: number;
  endpoint: typeof HOME_INGEST_URL | typeof KIOSK_INGEST_URL;
  status?: number;
  game_session_id?: string;
  sessionId?: string;
  qrToken?: string | null;
  error?: string;
};

function payloadObject(event: GameEvent): Record<string, unknown> {
  return event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
    ? event.payload
    : {};
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function homeSessionKey(childId?: string): string {
  return childId ? `${HOME_SESSION_PREFIX}${childId}` : LAST_HOME_SESSION_KEY;
}

function readHomeSessionId(childId?: string): string | undefined {
  const store = storage();
  return store?.getItem(homeSessionKey(childId)) || store?.getItem(LAST_HOME_SESSION_KEY) || undefined;
}

function writeHomeSessionId(gameSessionId: string, childId?: string): void {
  const store = storage();
  if (!store) return;
  store.setItem(LAST_HOME_SESSION_KEY, gameSessionId);
  if (childId) store.setItem(homeSessionKey(childId), gameSessionId);
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const data = await res.json();
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function failure(
  endpoint: EmitGameEventResult['endpoint'],
  error: string,
  status?: number,
): EmitGameEventResult {
  return { ok: false, accepted: 0, endpoint, status, error };
}

function toResult(
  endpoint: EmitGameEventResult['endpoint'],
  res: Response,
  data: Record<string, unknown>,
): EmitGameEventResult {
  return {
    ok: res.ok,
    accepted: num(data.accepted) ?? 0,
    endpoint,
    status: res.status,
    game_session_id: str(data.game_session_id),
    sessionId: str(data.sessionId),
    qrToken: data.qrToken === null ? null : str(data.qrToken),
    error: str(data.error),
  };
}

function buildHomeBody(event: GameEvent, ctx: EmitGameEventContext): Record<string, unknown> {
  const payload = payloadObject(event);
  const body: Record<string, unknown> = {
    event,
    context: 'home',
  };

  if (ctx.childId) body.child_id = ctx.childId;
  if (ctx.topic) body.topic = ctx.topic;

  const gameSessionId = str(payload.game_session_id) ?? readHomeSessionId(ctx.childId);
  if (gameSessionId && event.type !== 'game_started') {
    body.game_session_id = gameSessionId;
  }

  return body;
}

function buildKioskBody(event: GameEvent, ctx: EmitGameEventContext): Record<string, unknown> {
  const payload = payloadObject(event);
  const result = event.result;
  const eventPayload = {
    ...payload,
    round_index: event.round_index,
    game_type: result?.game_type,
    difficulty: result?.difficulty,
    score: result?.score,
    max_score: result?.max_score,
    latency_ms: result?.latency_ms,
    retried: result?.retried,
    reward_payload: result?.reward_payload,
  };

  return {
    sessionId: ctx.kioskSessionId,
    locationCode: ctx.locationCode,
    topic: ctx.topic,
    event: {
      eventType: event.type,
      quizScore: result?.score,
      payload: eventPayload,
    },
  };
}

async function emitHome(event: GameEvent, ctx: EmitGameEventContext): Promise<EmitGameEventResult> {
  if (event.type === 'game_started' && !ctx.childId) {
    return failure(HOME_INGEST_URL, 'childId required');
  }

  try {
    const res = await fetch(HOME_INGEST_URL, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildHomeBody(event, ctx)),
    });
    const data = await readJson(res);
    const result = toResult(HOME_INGEST_URL, res, data);

    if (res.ok && result.game_session_id) {
      writeHomeSessionId(result.game_session_id, ctx.childId);
    }

    return result;
  } catch (caught) {
    return failure(HOME_INGEST_URL, caught instanceof Error ? caught.message : 'home emit failed');
  }
}

async function emitKiosk(event: GameEvent, ctx: EmitGameEventContext): Promise<EmitGameEventResult> {
  try {
    const res = await fetch(KIOSK_INGEST_URL, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildKioskBody(event, ctx)),
    });
    const data = await readJson(res);
    return toResult(KIOSK_INGEST_URL, res, data);
  } catch (caught) {
    return failure(KIOSK_INGEST_URL, caught instanceof Error ? caught.message : 'kiosk emit failed');
  }
}

export async function emitGameEvent(
  event: GameEvent,
  ctx: EmitGameEventContext,
): Promise<EmitGameEventResult> {
  return ctx.context === 'home' ? emitHome(event, ctx) : emitKiosk(event, ctx);
}
