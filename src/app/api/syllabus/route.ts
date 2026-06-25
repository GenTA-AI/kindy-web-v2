import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import type { Syllabus } from '@/types/syllabus';

export async function GET(request: NextRequest) {
  try {
    await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw error;
  }

  const { searchParams } = new URL(request.url);
  const subject = searchParams.get('subject');
  const ageBandRaw = searchParams.get('age_band');
  const ageBand = ageBandRaw ? Number.parseInt(ageBandRaw, 10) : null;

  let query = getSupabase()
    .from('syllabuses')
    .select('*')
    .eq('published', true);

  if (subject) query = query.eq('subject', subject);
  if (ageBand && Number.isFinite(ageBand)) query = query.eq('age_band', ageBand);

  query = query
    .order('subject')
    .order('age_band')
    .order('sort_order');

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ syllabuses: (data ?? []) as Syllabus[] });
}
