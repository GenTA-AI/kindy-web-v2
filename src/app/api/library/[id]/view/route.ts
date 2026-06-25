import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

const ALLOWED_EVENTS = new Set(['play', 'complete']);

async function verifyChildOwner(parentId: string, childId: string) {
  const { data, error } = await getSupabase()
    .from('children')
    .select('id')
    .eq('id', childId)
    .eq('parent_id', parentId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parentId = await getCurrentParentId();
    const { id: libraryVideoId } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    const { child_id, event_type, timestamp_sec } = body as {
      child_id?: unknown;
      event_type?: unknown;
      timestamp_sec?: unknown;
    };

    if (typeof child_id !== 'string' || typeof event_type !== 'string') {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    if (!ALLOWED_EVENTS.has(event_type)) {
      return NextResponse.json({ error: 'invalid_event_type' }, { status: 400 });
    }

    const owns = await verifyChildOwner(parentId, child_id);
    if (!owns) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const supabase = getSupabase();
    const { data: video, error: videoError } = await supabase
      .from('library_videos')
      .select('id, published')
      .eq('id', libraryVideoId)
      .eq('published', true)
      .maybeSingle();

    if (videoError) {
      return NextResponse.json({ error: videoError.message }, { status: 500 });
    }
    if (!video) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const timestampSec = typeof timestamp_sec === 'number' && Number.isFinite(timestamp_sec)
      ? timestamp_sec
      : 0;

    const { data, error } = await supabase
      .from('view_events')
      .insert({
        video_id: null,
        library_video_id: libraryVideoId,
        child_id,
        event_type,
        timestamp_sec: timestampSec,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Best-effort analytics counter; exact accuracy is not required for v0.
    const { data: countRow } = await supabase
      .from('library_videos')
      .select('view_count')
      .eq('id', libraryVideoId)
      .single();

    await supabase
      .from('library_videos')
      .update({ view_count: (countRow?.view_count ?? 0) + 1 })
      .eq('id', libraryVideoId);

    return NextResponse.json({ event: data });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw error;
  }
}
