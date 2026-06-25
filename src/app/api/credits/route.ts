import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * GET /api/credits
 *
 * credits row 가 없으면 balance=0, lifetime_* =0 기본값 반환.
 * 신규 parent 는 children 생성 시 trigger 로 자동 row 생성됨 (0004 migration).
 */
export async function GET(_request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    throw error;
  }

  const { data, error } = await supabase
    .from('credits')
    .select('*')
    .eq('parent_id', parentId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data) {
    return NextResponse.json({
      parent_id: parentId,
      balance: 0,
      lifetime_granted: 0,
      lifetime_purchased: 0,
      lifetime_consumed: 0,
    });
  }

  return NextResponse.json(data);
}
