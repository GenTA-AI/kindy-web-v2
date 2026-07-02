import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseServiceConfigured, supabase } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';

/**
 * POST /api/subscription/consent — 정기결제 사전 명시 동의 기록.
 *
 * 카드 등록(빌링키 발급) 직전, 부모가 '매월 자동결제' 체크박스에 동의했을 때 호출.
 * 전자상거래법·여신전문금융업법상 정기과금 사전 동의의 서버-side evidence를 남긴다.
 * (parent_consents 재사용 — consent_scope='recurring_billing'.)
 */
const TERMS_VERSION = '2026-06-30';
// 2026-07-02: §5 국외이전 표 추가(PIPA §28-8) — privacy.md 개정과 함께 bump.
const PRIVACY_VERSION = '2026-07-02';

export async function POST(request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId(request);
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: '보호자 로그인이 필요해요.' }, { status: 401 });
    }
    console.error('[subscription-consent:auth]', error);
    return NextResponse.json({ error: '동의를 기록하지 못했어요.' }, { status: 500 });
  }

  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json({ ok: true, recorded: false });
  }

  const { error } = await supabase.from('parent_consents').insert({
    parent_id: parentId,
    consent_scope: 'recurring_billing',
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    // child_consent_version 은 NOT NULL — 정기결제 동의엔 무관하나 제약 충족용으로 약관 버전 사용.
    child_consent_version: TERMS_VERSION,
    consent_method: 'subscribe_checkbox',
  });

  if (error) {
    console.error('[subscription-consent:insert]', error.message);
    return NextResponse.json({ error: '동의 기록에 실패했어요.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recorded: true });
}
