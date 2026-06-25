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
  const { video_id, child_id, reaction } = body;

  if (!video_id || !child_id || !reaction) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!['happy', 'neutral', 'sad'].includes(reaction)) {
    return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });
  }

  const owned = await verifyChildVideoOwner(child_id, video_id, parentId);
  if (!owned) {
    return NextResponse.json({ error: 'video not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('emoji_reactions')
    .insert({ video_id, child_id, reaction })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
