import { NextResponse } from 'next/server';
import { isSupabaseServiceConfigured, supabase } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * GET /api/purchases — 인증된 parent 결제 내역 (최신순).
 */
export async function GET() {
  let parentId: string;
  try {
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    throw error;
  }

  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from('purchases')
    .select('id, bundle_type, credits_added, amount_krw, status, created_at, paid_at')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
