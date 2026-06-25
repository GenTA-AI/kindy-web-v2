import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { ATTRIBUTION_COOKIE } from '@/lib/attribution';

/**
 * POST /api/attribution/claim — 키오스크 QR 토큰 ↔ 부모 계정 연결 (first-touch).
 *
 * /start?ks=<qr_token> 방문 시 90일 쿠키(kindy_attr)에 토큰을 보관하고,
 * 로그인 후 이 라우트가 parent_attribution 1행을 service-role 로 삽입한다.
 * 멱등: parent_id PK 충돌 시 do-nothing (first-touch 보존).
 *
 * body: { ks?: string } — 없으면 kindy_attr 쿠키에서 읽음.
 */
export async function POST(request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId(request);
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }

  const body = (await request.json().catch(() => null)) as { ks?: string } | null;
  const token = (body?.ks ?? request.cookies.get(ATTRIBUTION_COOKIE)?.value ?? '').trim();

  if (!token) {
    return NextResponse.json({ claimed: false, reason: 'no token' });
  }

  // qr_token → 키오스크 세션 (만료 토큰 거부)
  const { data: session, error: sessionError } = await supabase
    .from('kiosk_sessions')
    .select('id, qr_token_expires_at')
    .eq('qr_token', token)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }
  if (!session || new Date(session.qr_token_expires_at) < new Date()) {
    return NextResponse.json({ claimed: false, reason: 'invalid or expired token' });
  }

  // first-touch 멱등 삽입 (이미 attribution 있으면 보존)
  const { error: insertError } = await supabase
    .from('parent_attribution')
    .upsert(
      {
        parent_id: parentId,
        kiosk_session_id: session.id,
        first_touch: true,
      },
      { onConflict: 'parent_id', ignoreDuplicates: true },
    );

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ claimed: true });
}
