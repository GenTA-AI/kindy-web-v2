import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    throw error;
  }

  const { searchParams } = new URL(request.url);
  const childId = searchParams.get('childId');

  if (!childId) {
    return NextResponse.json({ avgCompletion: null });
  }

  try {
    // service_role bypass — RLS 켜져도 정상 동작.
    const supabase = getSupabase();
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('id')
      .eq('id', childId)
      .eq('parent_id', parentId)
      .maybeSingle();

    if (childError || !child) {
      return NextResponse.json({ avgCompletion: null }, { status: 404 });
    }

    const { data: readyVideos, error: videosError } = await supabase
      .from('videos')
      .select('id')
      .eq('child_id', childId)
      .eq('status', 'ready');

    if (videosError || !readyVideos || readyVideos.length < 3) {
      return NextResponse.json({ avgCompletion: null });
    }

    const videoIds = readyVideos
      .map((video: { id?: string | null }) => video.id)
      .filter((id): id is string => Boolean(id));

    const { data, error } = await supabase
      .from('view_events')
      .select('video_id,event_type')
      .eq('child_id', childId)
      .in('video_id', videoIds)
      .in('event_type', ['play', 'complete']);

    if (error) {
      return NextResponse.json({ avgCompletion: null });
    }

    const watched = new Set<string>();
    const completed = new Set<string>();
    (data as Array<{ video_id?: string; event_type?: string }> | null ?? []).forEach((event) => {
      if (!event.video_id) return;
      watched.add(event.video_id);
      if (event.event_type === 'complete') completed.add(event.video_id);
    });

    if (watched.size < 3) {
      return NextResponse.json({ avgCompletion: null });
    }

    return NextResponse.json({ avgCompletion: Math.round((completed.size / watched.size) * 100) });
  } catch {
    return NextResponse.json({ avgCompletion: null });
  }
}
