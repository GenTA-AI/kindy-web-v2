import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import type { LibraryVideo } from '@/types/library';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw error;
  }

  const { id } = await params;
  const { data, error } = await getSupabase()
    .from('library_videos')
    .select('*')
    .eq('id', id)
    .eq('published', true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ video: data as LibraryVideo });
}
