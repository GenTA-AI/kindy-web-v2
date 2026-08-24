import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, isSupabaseServiceConfigured } from '@/lib/supabase';
import { isLaunchSurfaceClosed } from '@/lib/launch-surface';

// 아산 꿈샘 키오스크(Kindy 데모) 익명 이벤트 인제스트.
// 설계: KIOSK_KINDY_퍼널추적_설계.md §6. 무인증 + service-role 쓰기(RLS 우회).
// 키오스크 프론트(smart-did)는 cross-origin 으로 호출하므로 CORS 허용(익명·쿠키 없음 → '*').
// PIPA: 식별정보 미수집 — 세션 토큰 + 선택값·행동 이벤트만 저장.

export const runtime = 'nodejs';

const ALLOWED_LOCATIONS = new Set(['asan-kkumsaem']);
const ALLOWED_EVENTS = new Set([
  'demo_started',
  'step_select',
  'video_started',
  'video_progress',
  'video_completed',
  'quiz_started',
  'quiz_completed',
  'quiz_skipped',
  'game_started',
  'game_round_completed',
  'game_completed',
  'qr_shown',
]);
const MAX_EVENTS = 50;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const int = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;

type IncomingEvent = {
  eventType?: unknown;
  demoVideoId?: unknown;
  positionSec?: unknown;
  durationSec?: unknown;
  quizScore?: unknown;
  payload?: unknown;
};

export async function OPTIONS() {
  if (isLaunchSurfaceClosed('/api/kiosk/events', process.env)) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  if (isLaunchSurfaceClosed('/api/kiosk/events', process.env)) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  // sendBeacon 은 Content-Type 이 다양함(application/json | text/plain) → 방어적 파싱.
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    try {
      body = JSON.parse(await request.text());
    } catch {
      return json({ error: 'invalid json' }, 400);
    }
  }
  if (!body || typeof body !== 'object') return json({ error: 'invalid body' }, 400);

  const incoming: IncomingEvent[] = Array.isArray((body as { events?: unknown }).events)
    ? ((body as { events: IncomingEvent[] }).events)
    : (body as { event?: IncomingEvent }).event
      ? [(body as { event: IncomingEvent }).event]
      : [];

  const events = incoming
    .slice(0, MAX_EVENTS)
    .filter((e) => e && typeof e.eventType === 'string' && ALLOWED_EVENTS.has(e.eventType));

  let sessionId = str((body as { sessionId?: unknown }).sessionId);
  let qrToken: string | null = null;

  if (!isSupabaseServiceConfigured()) {
    const accepted = events.length;
    const localSessionId = sessionId ?? `local-kiosk-${crypto.randomUUID()}`;
    return json({
      sessionId: localSessionId,
      qrToken: 'local-preview-kiosk',
      accepted,
      preview: true,
    });
  }

  const db = getSupabase();

  // 세션 없으면 생성(첫 호출=demo_started). location_code 화이트리스트 검증.
  if (!sessionId) {
    const locationCode = str((body as { locationCode?: unknown }).locationCode);
    if (!locationCode || !ALLOWED_LOCATIONS.has(locationCode)) {
      return json({ error: 'invalid location_code' }, 400);
    }
    const { data: session, error: sessionError } = await db
      .from('kiosk_sessions')
      .insert({
        location_code: locationCode,
        character: str((body as { character?: unknown }).character),
        topic: str((body as { topic?: unknown }).topic),
        mood: str((body as { mood?: unknown }).mood),
        last_event_at: new Date().toISOString(),
      })
      .select('id, qr_token')
      .single();
    if (sessionError || !session) {
      return json({ error: sessionError?.message || 'session create failed' }, 500);
    }
    sessionId = session.id as string;
    qrToken = session.qr_token as string;
  }

  // step_select 취향 신호(캐릭터/주제/기분)는 세션 컬럼에 반영(GACS-3 입력).
  const tasteUpdate: Record<string, string> = {};
  for (const e of events) {
    if (e.eventType === 'step_select' && e.payload && typeof e.payload === 'object') {
      const p = e.payload as Record<string, unknown>;
      const c = str(p.character);
      const t = str(p.topic);
      const m = str(p.mood);
      if (c) tasteUpdate.character = c;
      if (t) tasteUpdate.topic = t;
      if (m) tasteUpdate.mood = m;
    }
  }

  // 이벤트 적재.
  if (events.length) {
    const rows = events.map((e) => ({
      session_id: sessionId,
      event_type: e.eventType as string,
      demo_video_id: str(e.demoVideoId),
      position_sec: num(e.positionSec),
      duration_sec: num(e.durationSec),
      quiz_score: int(e.quizScore),
      payload: e.payload && typeof e.payload === 'object' ? e.payload : null,
    }));
    const { error: eventsError } = await db.from('kiosk_events').insert(rows);
    if (eventsError) return json({ error: eventsError.message }, 500);
  }

  // 세션 last_event_at + 취향 업데이트(있으면).
  await db
    .from('kiosk_sessions')
    .update({ last_event_at: new Date().toISOString(), ...tasteUpdate })
    .eq('id', sessionId);

  return json({ sessionId, qrToken, accepted: events.length });
}
