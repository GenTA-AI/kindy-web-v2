import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, isSupabaseServiceConfigured } from '@/lib/supabase';
import { inngest } from '@/inngest/client';
import type { VideoBrief } from '@/lib/video-providers/director.types';
import { getCurrentParentId, isAuthError } from '@/lib/auth';

function unauthorized() {
  return NextResponse.json({ error: '보호자 로그인이 필요해요.' }, { status: 401 });
}

function badVideoRequest() {
  return NextResponse.json({ error: '영상 요청 정보를 다시 확인해 주세요.' }, { status: 400 });
}

function childNotFound() {
  return NextResponse.json({ error: '아이 정보를 찾지 못했어요.' }, { status: 404 });
}

function videoListError() {
  return NextResponse.json({ error: '영상 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
}

function videoCreateError() {
  return NextResponse.json({ error: '영상 생성을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
}

function legacyGenerationUnavailable() {
  return NextResponse.json(
    { error: '개인 영상 생성은 지금 준비 중이에요. 모리 이야기 숲에서 바로 볼 수 있는 이야기를 먼저 이용해 주세요.' },
    { status: 503 },
  );
}

function creditsRequired() {
  return NextResponse.json(
    { error: '모리 이야기를 계속 이용하려면 보호자 화면에서 멤버십을 확인해 주세요.', code: 'membership_required' },
    { status: 402 },
  );
}

async function verifyChildOwner(childId: string, parentId: string) {
  const { data, error } = await getSupabase()
    .from('children')
    .select('id')
    .eq('id', childId)
    .eq('parent_id', parentId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function GET(request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId(request);
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    console.error('[videos:list-auth]', error);
    return videoListError();
  }

  const { searchParams } = new URL(request.url);
  const childId = searchParams.get('childId');

  if (!childId) {
    return badVideoRequest();
  }

  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json([]);
  }

  try {
    const childOwned = await verifyChildOwner(childId, parentId);
    if (!childOwned) {
      return childNotFound();
    }

    const { data, error } = await getSupabase()
      .from('videos')
      .select('*')
      .eq('child_id', childId)
      .order('episode_number', { ascending: false });

    if (error) {
      console.error('[videos:list]', error);
      return videoListError();
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[videos:list]', error);
    return videoListError();
  }
}

/**
 * POST /api/videos
 *
 * 두 가지 모드:
 *   1) `brief` 포함 → 파이프라인 트리거 (Inngest 비동기)
 *      - videos row 를 status=queued 로 insert
 *      - inngest.send('video/generate')
 *      - 202 Accepted + { id, request_id, status: 'queued' } 반환
 *
 *   2) 기존 stub 모드 (`video_url` 등 prefilled) → 단순 DB insert (백필/import 용)
 */
export async function POST(request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId(request);
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    console.error('[videos:create-auth]', error);
    return videoCreateError();
  }

  if (!isSupabaseServiceConfigured()) {
    return legacyGenerationUnavailable();
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return badVideoRequest();
  }

  const {
    child_id,
    title,
    topic,
    style_tags,
    prompt_used,
    adjectives_used,
    video_url,
    duration_sec,
    brief,                // ← 신규: VideoBrief 전달 시 파이프라인 트리거
    target_duration_sec,  // 옵션 (15 | 30 | ...), 기본 30
    seedance_tier,        // 옵션 ('standard' | 'fast')
  } = body as Record<string, unknown>;

  if (typeof child_id !== 'string' || typeof title !== 'string' || !child_id.trim() || !title.trim()) {
    return badVideoRequest();
  }

  const supabase = getSupabase();

  try {
    const childOwned = await verifyChildOwner(child_id, parentId);
    if (!childOwned) {
      return childNotFound();
    }
  } catch (error) {
    console.error('[videos:create-child]', error);
    return videoCreateError();
  }

  // 다음 에피소드 번호 계산
  const { count, error: countError } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('child_id', child_id);
  if (countError) {
    console.error('[videos:create-count]', countError);
    return videoCreateError();
  }

  const isPipelineTrigger = brief && typeof brief === 'object';
  const readyVideoUrl = typeof video_url === 'string' && video_url.trim() ? video_url.trim() : null;

  // 레거시 개인 영상 생성권 atomic 차감 — pipeline trigger 일 때만. 선차감 + 실패 시 refund.
  //   - stub 백필 (video_url 제공) 은 생성권 소비 없음.
  //   - children 트리거로 자동 +1 받은 parent 는 첫 호출에서 0 으로 감소.
  //   - balance=0 이면 consume_credit 이 false → 402 Payment Required.
  let parentIdForRefund: string | null = null;
  if (isPipelineTrigger) {
    const { data: consumed, error: consumeErr } = await supabase
      .rpc('consume_credit', { p_parent_id: parentId });
    if (consumeErr) {
      console.error('[videos:create-credit]', consumeErr);
      return videoCreateError();
    }
    if (!consumed) {
      return creditsRequired();
    }
    parentIdForRefund = parentId;
  }

  // 실패 시 credit refund 헬퍼 (read-modify-write, MVP race OK).
  const refundCredit = async () => {
    if (!parentIdForRefund) return;
    const { data: row } = await supabase
      .from('credits')
      .select('balance, lifetime_consumed')
      .eq('parent_id', parentIdForRefund)
      .single();
    if (!row) return;
    await supabase
      .from('credits')
      .update({
        balance: row.balance + 1,
        lifetime_consumed: Math.max(0, row.lifetime_consumed - 1),
      })
      .eq('parent_id', parentIdForRefund);
  };

  const { data, error } = await supabase
    .from('videos')
    .insert({
      child_id,
      title,
      topic: typeof topic === 'string' ? topic : '',
      style_tags: Array.isArray(style_tags) ? style_tags : [],
      prompt_used: typeof prompt_used === 'string' ? prompt_used : '',
      adjectives_used: Array.isArray(adjectives_used) ? adjectives_used : [],
      video_url: readyVideoUrl,
      duration_sec: typeof duration_sec === 'number' ? duration_sec : null,
      status: isPipelineTrigger ? 'queued' : (readyVideoUrl ? 'ready' : 'queued'),
      episode_number: (count || 0) + 1,
    })
    .select()
    .single();

  if (error) {
    await refundCredit();
    console.error('[videos:create-insert]', error);
    return videoCreateError();
  }

  // 파이프라인 트리거 모드 — Inngest 이벤트 발사
  if (isPipelineTrigger) {
    try {
      await inngest.send({
        name: 'video/generate',
        data: {
          videoId: data.id,
          brief: brief as VideoBrief,
          targetDurationSec: typeof target_duration_sec === 'number' ? target_duration_sec : 30,
          seedanceTier: seedance_tier === 'fast' ? 'fast' : 'standard',
        },
      });
    } catch (e) {
      // 이벤트 전송 실패 시 상태 롤백 + credit 환불
      const reason = e instanceof Error ? e.message : String(e);
      await supabase.from('videos').update({
        status: 'failed',
        error_reason: `inngest.send: ${reason}`.slice(0, 500),
      }).eq('id', data.id);
      await refundCredit();
      console.error('[videos:create-queue]', reason);
      return videoCreateError();
    }

    return NextResponse.json(
      {
        id: data.id,
        request_id: data.request_id,
        status: 'queued',
        message: '영상 생성이 접수됐어요. 완료되면 보호자 화면에서 확인할 수 있어요.',
      },
      { status: 202 }
    );
  }

  return NextResponse.json(data);
}
