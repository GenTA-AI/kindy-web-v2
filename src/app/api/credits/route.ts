import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, isSupabaseServiceConfigured } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';

function unauthorized() {
  return NextResponse.json({ error: '보호자 로그인이 필요해요.' }, { status: 401 });
}

function creditReadError() {
  return NextResponse.json({ error: '이용 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
}

function emptyCredits(parentId: string) {
  return {
    parent_id: parentId,
    balance: 0,
    lifetime_granted: 0,
    lifetime_purchased: 0,
    lifetime_consumed: 0,
  };
}

/**
 * GET /api/credits
 *
 * credits row 가 없으면 balance=0, lifetime_* =0 기본값 반환.
 * 신규 parent 는 children 생성 시 trigger 로 자동 row 생성됨 (0004 migration).
 */
export async function GET(request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId(request);
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    console.error('[credits:auth]', error);
    return creditReadError();
  }

  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json(emptyCredits(parentId));
  }

  const { data, error } = await getSupabase()
    .from('credits')
    .select('*')
    .eq('parent_id', parentId)
    .maybeSingle();

  if (error) {
    console.error('[credits:read]', error);
    return creditReadError();
  }

  if (!data) {
    return NextResponse.json(emptyCredits(parentId));
  }

  return NextResponse.json(data);
}
