import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { getSupabase, isSupabaseServiceConfigured } from '@/lib/supabase';
import { LOCAL_PREVIEW_LIBRARY_VIDEO, localPreviewLibraryVideoForAge } from '@/lib/library-preview';
import { withFreshLibraryMediaUrls } from '@/lib/library-media';
import { FREE_TRIAL_SESSION_LIMIT, getMembershipGateState } from '@/lib/subscription';
import type { LibraryVideo } from '@/types/library';

function unauthorized() {
  return NextResponse.json({ error: '보호자 로그인이 필요해요.' }, { status: 401 });
}

function libraryReadError() {
  return NextResponse.json({ error: '이야기 숲을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
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

function matchesPreviewFilters(input: {
  topic: string | null;
  ageBand: number | null;
  styleTag: string | null;
  featured: boolean;
}) {
  if (input.topic && input.topic !== LOCAL_PREVIEW_LIBRARY_VIDEO.topic) return false;
  if (input.ageBand && (input.ageBand < 3 || input.ageBand > 8)) return false;
  if (input.styleTag && !LOCAL_PREVIEW_LIBRARY_VIDEO.style_tags.includes(input.styleTag)) return false;
  if (input.featured && !LOCAL_PREVIEW_LIBRARY_VIDEO.featured) return false;
  return true;
}

export async function GET(request: NextRequest) {
  let parentId: string;

  try {
    parentId = await getCurrentParentId(request);
  } catch (error) {
    if (isAuthError(error)) {
      return unauthorized();
    }
    console.error('[library:list-auth]', error);
    return libraryReadError();
  }

  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic');
  const ageBandRaw = searchParams.get('age_band');
  const ageBand = ageBandRaw ? Number.parseInt(ageBandRaw, 10) : null;
  const styleTag = searchParams.get('style_tag');
  const featured = searchParams.get('featured') === 'true';

  if (!isSupabaseServiceConfigured()) {
    const previewVideo = localPreviewLibraryVideoForAge(ageBand);
    return NextResponse.json({
      videos: matchesPreviewFilters({ topic, ageBand, styleTag, featured })
        ? [previewVideo]
        : [],
    });
  }

  const gateState = await getMembershipGateState(parentId);
  if (!gateState.canUseMemberContent) {
    return trialComplete({
      completedTrialSessions: gateState.completedTrialSessions,
      remainingTrialSessions: gateState.remainingTrialSessions,
    });
  }

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
    console.error('[library:list]', error);
    return libraryReadError();
  }

  return NextResponse.json({ videos: await withFreshLibraryMediaUrls((data ?? []) as LibraryVideo[]) });
}
