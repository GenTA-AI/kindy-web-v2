import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { inngest } from '@/inngest/client';
import type { VideoBrief } from '@/lib/video-providers/director.types';
import { getCurrentParentId, isAuthError } from '@/lib/auth';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

async function verifyChildOwner(childId: string, parentId: string) {
  const { data, error } = await supabase
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
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    throw error;
  }

  const { searchParams } = new URL(request.url);
  const childId = searchParams.get('childId');

  if (!childId) {
    return NextResponse.json({ error: 'childId required' }, { status: 400 });
  }

  const childOwned = await verifyChildOwner(childId, parentId);
  if (!childOwned) {
    return NextResponse.json({ error: 'child not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('child_id', childId)
    .order('episode_number', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
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
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    throw error;
  }

  const body = await request.json();
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
  } = body;

  if (!child_id || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const childOwned = await verifyChildOwner(child_id, parentId);
  if (!childOwned) {
    return NextResponse.json({ error: 'child not found' }, { status: 404 });
  }

  // 다음 에피소드 번호 계산
  const { count } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('child_id', child_id);

  const isPipelineTrigger = brief && typeof brief === 'object';

  // 크레딧 atomic 차감 — pipeline trigger 일 때만. 선차감 + 실패 시 refund.
  //   - stub 백필 (video_url 제공) 은 크레딧 소비 없음.
  //   - children 트리거로 자동 +1 받은 parent 는 첫 호출에서 0 으로 감소.
  //   - balance=0 이면 consume_credit 이 false → 402 Payment Required.
  let parentIdForRefund: string | null = null;
  if (isPipelineTrigger) {
    const { data: consumed, error: consumeErr } = await supabase
      .rpc('consume_credit', { p_parent_id: parentId });
    if (consumeErr) {
      return NextResponse.json({ error: `credit check failed: ${consumeErr.message}` }, { status: 500 });
    }
    if (!consumed) {
      return NextResponse.json(
        { error: 'insufficient_credits', message: '크레딧이 부족해요. 결제 후 다시 시도해주세요.' },
        { status: 402 }
      );
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
      topic: topic || '',
      style_tags: style_tags || [],
      prompt_used: prompt_used || '',
      adjectives_used: adjectives_used || [],
      video_url: video_url || null,
      duration_sec: duration_sec || null,
      status: isPipelineTrigger ? 'queued' : (video_url ? 'ready' : 'queued'),
      episode_number: (count || 0) + 1,
    })
    .select()
    .single();

  if (error) {
    await refundCredit();
    return NextResponse.json({ error: error.message }, { status: 500 });
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
      return NextResponse.json({ error: `pipeline queue failed: ${reason}` }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: data.id,
        request_id: data.request_id,
        status: 'queued',
        message: 'Pipeline queued. Poll GET /api/videos?childId=... for updates.',
      },
      { status: 202 }
    );
  }

  return NextResponse.json(data);
}
