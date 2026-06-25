import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import type { LibraryVideo } from '@/types/library';

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
  const topic = searchParams.get('topic');
  const ageBandRaw = searchParams.get('age_band');
  const ageBand = ageBandRaw ? Number.parseInt(ageBandRaw, 10) : null;
  const styleTag = searchParams.get('style_tag');
  const featured = searchParams.get('featured') === 'true';

  let query = getSupabase()
    .from('library_videos')
    .select('*')
    .eq('published', true);

  if (topic) query = query.eq('topic', topic);
  if (ageBand && Number.isFinite(ageBand)) query = query.eq('age_band', ageBand);
  if (styleTag) query = query.contains('style_tags', [styleTag]);
  if (featured) query = query.eq('featured', true);

  query = query
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ videos: (data ?? []) as LibraryVideo[] });
}
