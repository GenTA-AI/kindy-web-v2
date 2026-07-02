import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { getSupabase, isSupabaseServiceConfigured } from '@/lib/supabase';
import { LOCAL_PREVIEW_LIBRARY_VIDEO, localPreviewLibraryVideoForAge } from '@/lib/library-preview';
import { withFreshLibraryMediaUrls } from '@/lib/library-media';
import { LOCAL_PREVIEW_CHILD_COOKIE, parseLocalPreviewChildCookie } from '@/lib/local-preview-child';
import { FREE_TRIAL_SESSION_LIMIT, getMembershipGateState } from '@/lib/subscription';
import type { LibraryVideo } from '@/types/library';

function unauthorized() {
  return NextResponse.json({ error: '보호자 로그인이 필요해요.' }, { status: 401 });
}

function libraryReadError() {
  return NextResponse.json({ error: '이야기를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
}

function libraryNotFound() {
  return NextResponse.json({ error: '이야기를 찾지 못했어요.' }, { status: 404 });
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let parentId: string;

  try {
    parentId = await getCurrentParentId(request);
  } catch (error) {
    if (isAuthError(error)) {
      return unauthorized();
    }
    console.error('[library:detail-auth]', error);
    return libraryReadError();
  }

  const { id } = await params;
  if (!isSupabaseServiceConfigured()) {
    if (id === LOCAL_PREVIEW_LIBRARY_VIDEO.id) {
      const child = parseLocalPreviewChildCookie(request.cookies.get(LOCAL_PREVIEW_CHILD_COOKIE)?.value);
      return NextResponse.json({ video: localPreviewLibraryVideoForAge(child.age) });
    }
    return libraryNotFound();
  }

  const gateState = await getMembershipGateState(parentId);
  if (!gateState.canUseMemberContent) {
    return trialComplete({
      completedTrialSessions: gateState.completedTrialSessions,
      remainingTrialSessions: gateState.remainingTrialSessions,
    });
  }

  const { data, error } = await getSupabase()
    .from('library_videos')
    .select('*')
    .eq('id', id)
    .eq('published', true)
    .maybeSingle();

  if (error) {
    console.error('[library:detail]', error);
    return libraryReadError();
  }
  if (!data) {
    return libraryNotFound();
  }

  const [video] = await withFreshLibraryMediaUrls([data as LibraryVideo]);
  return NextResponse.json({ video });
}
