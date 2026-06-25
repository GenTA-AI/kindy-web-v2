import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

async function verifyChildVideoOwner(childId: string, videoId: string, parentId: string) {
  const { data: child, error: childError } = await supabase
    .from('children')
    .select('id')
    .eq('id', childId)
    .eq('parent_id', parentId)
    .maybeSingle();

  if (childError) throw childError;
  if (!child) return false;

  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('id')
    .eq('id', videoId)
    .eq('child_id', childId)
    .maybeSingle();

  if (videoError) throw videoError;
  return Boolean(video);
}

export async function POST(request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    throw error;
  }

  const body = await request.json();
  const { video_id, child_id, event_type, timestamp_sec, segment_start, segment_end } = body;

  if (!video_id || !child_id || !event_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const owned = await verifyChildVideoOwner(child_id, video_id, parentId);
  if (!owned) {
    return NextResponse.json({ error: 'video not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('view_events')
    .insert({
      video_id,
      child_id,
      event_type,
      timestamp_sec: timestamp_sec || 0,
      segment_start,
      segment_end,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// Batch insert for buffered events
export async function PUT(request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    throw error;
  }

  const { events } = await request.json();

  if (!events?.length) {
    return NextResponse.json({ error: 'No events' }, { status: 400 });
  }

  if (!Array.isArray(events)) {
    return NextResponse.json({ error: 'events must be an array' }, { status: 400 });
  }

  for (const event of events) {
    if (!event?.video_id || !event?.child_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const owned = await verifyChildVideoOwner(event.child_id, event.video_id, parentId);
    if (!owned) {
      return NextResponse.json({ error: 'video not found' }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from('view_events')
    .insert(events)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: data?.length || 0 });
}
