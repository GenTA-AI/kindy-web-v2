import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { getSupabase, isSupabaseServiceConfigured } from '@/lib/supabase';
import { LOCAL_PREVIEW_LIBRARY_VIDEO } from '@/lib/library-preview';
import { FREE_TRIAL_SESSION_LIMIT, getMembershipGateState } from '@/lib/subscription';

const ALLOWED_EVENTS = new Set(['play', 'complete']);

function unauthorized() {
  return NextResponse.json({ error: '보호자 로그인이 필요해요.' }, { status: 401 });
}

function badViewEvent() {
  return NextResponse.json({ error: '시청 기록을 다시 확인해 주세요.' }, { status: 400 });
}

function forbiddenChild() {
  return NextResponse.json({ error: '아이 정보를 확인하지 못했어요.' }, { status: 403 });
}

function libraryNotFound() {
  return NextResponse.json({ error: '이야기를 찾지 못했어요.' }, { status: 404 });
}

function viewSaveError() {
  return NextResponse.json({ error: '시청 기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
}

function trialComplete(input: {
  completedTrialSessions: number;
  remainingTrialSessions: number;
}) {
  return NextResponse.json(
    {
      error: '무료 모리 체험을 마쳤어요. 보호자 기록을 확인하고 다음 이야기를 이어가세요.',
      code: 'trial_complete',
      completedTrialSessions: input.completedTrialSessions,
      remainingTrialSessions: input.remainingTrialSessions,
      trialLimit: FREE_TRIAL_SESSION_LIMIT,
    },
    { status: 402 },
  );
}

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
    const { id: libraryVideoId } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return badViewEvent();
    }

    const { child_id, event_type, timestamp_sec } = body as {
      child_id?: unknown;
      event_type?: unknown;
      timestamp_sec?: unknown;
    };

    if (typeof child_id !== 'string' || typeof event_type !== 'string') {
      return badViewEvent();
    }
    if (!ALLOWED_EVENTS.has(event_type)) {
      return badViewEvent();
    }

    if (libraryVideoId === LOCAL_PREVIEW_LIBRARY_VIDEO.id && child_id === 'local-preview-child') {
      return NextResponse.json({
        event: {
          id: 'local-preview-view-event',
          library_video_id: libraryVideoId,
          child_id,
          event_type,
          timestamp_sec: typeof timestamp_sec === 'number' && Number.isFinite(timestamp_sec) ? timestamp_sec : 0,
        },
      });
    }

    const parentId = await getCurrentParentId(request);

    if (!isSupabaseServiceConfigured()) {
      return libraryNotFound();
    }

    const gateState = await getMembershipGateState(parentId);
    if (!gateState.canUseMemberContent) {
      return trialComplete({
        completedTrialSessions: gateState.completedTrialSessions,
        remainingTrialSessions: gateState.remainingTrialSessions,
      });
    }

    const owns = await verifyChildOwner(parentId, child_id);
    if (!owns) {
      return forbiddenChild();
    }

    const supabase = getSupabase();
    const { data: video, error: videoError } = await supabase
      .from('library_videos')
      .select('id, published')
      .eq('id', libraryVideoId)
      .eq('published', true)
      .maybeSingle();

    if (videoError) {
      console.error('[library:view-video]', videoError);
      return viewSaveError();
    }
    if (!video) {
      return libraryNotFound();
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
      console.error('[library:view-save]', error);
      return viewSaveError();
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
      return unauthorized();
    }
    console.error('[library:view]', error);
    return viewSaveError();
  }
}
