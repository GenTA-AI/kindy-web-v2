// 키오스크 데모(AI 책 놀이) 퍼널 이벤트 클라이언트 — eduvid 내부(same-origin).
// POST /api/kiosk/events 로 kiosk_sessions/kiosk_events 적재. 설계: KIOSK_KINDY_퍼널추적_설계.md.
// 식별정보 미수집(세션 토큰 + 선택값·행동만). 절대 UI 를 막거나 throw 하지 않음.

const INGEST_URL = '/api/kiosk/events';
const LOCATION_CODE = 'asan-kkumsaem';

export type KioskEventType =
  | 'demo_started'
  | 'step_select'
  | 'video_started'
  | 'video_progress'
  | 'video_completed'
  | 'quiz_started'
  | 'quiz_completed'
  | 'quiz_skipped'
  | 'game_started'
  | 'game_round_completed'
  | 'game_completed'
  | 'qr_shown';

export type KioskSession = { sessionId: string; qrToken: string | null };

type EventExtra = {
  demoVideoId?: string;
  positionSec?: number;
  durationSec?: number;
  quizScore?: number;
  payload?: Record<string, unknown>;
};

type EventInput = { eventType: KioskEventType } & EventExtra;

/** 데모 진입 시 1회 호출 — 세션 생성 + demo_started 적재 + qr_token 수령. */
export async function createKioskSession(
  seed?: { character?: string; topic?: string; mood?: string },
): Promise<KioskSession | null> {
  try {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationCode: LOCATION_CODE,
        ...seed,
        events: [{ eventType: 'demo_started' }],
      }),
    });
    const data = (await res.json()) as { sessionId?: string; qrToken?: string | null };
    return data?.sessionId ? { sessionId: data.sessionId, qrToken: data.qrToken ?? null } : null;
  } catch (caught) {
    console.debug('kiosk session create failed:', caught);
    return null;
  }
}

/** 이벤트 1개 적재. fire-and-forget(keepalive). 세션 없으면 조용히 스킵. */
export function trackKiosk(sessionId: string | null, event: EventInput): void {
  if (!sessionId) return;
  try {
    void fetch(INGEST_URL, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, events: [event] }),
    }).catch((caught) => console.debug('kiosk track failed:', caught));
  } catch (caught) {
    console.debug('kiosk track failed:', caught);
  }
}

/** QR 목적지 URL. kindy.kr DNS 미연결 상태 → 임시 베이스는 env 로 덮어쓸 수 있음. */
export function kioskStartUrl(qrToken: string | null): string {
  const base = process.env.NEXT_PUBLIC_KINDY_START_BASE || 'https://kindy.kr';
  return `${base}/start?ks=${qrToken ?? ''}`;
}
