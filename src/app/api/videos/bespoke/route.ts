import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseServiceConfigured, supabase } from '@/lib/supabase';
import { inngest } from '@/inngest/client';
import { buildLearningProfile } from '@/lib/game/learning-profile';
import { c6NextStep, aggregateC6Profile, C6_TOOLS, type C6ToolKey } from '@/lib/game/c6-profile';
import { buildBespokeBrief } from '@/lib/game/bespoke-brief';
import type { GameRoundResult, GameType } from '@/types/game';

/**
 * POST /api/videos/bespoke — 아이 약점(C6) 겨냥 비스포크 영상 생성 (운영자 콘시어지).
 *
 * 20가구 검증 단계: 자동 생성·자동청구 아님. 대표가 운영자 키로 아이별로 트리거한다.
 * 흐름: 최근 라운드 → learning-profile 약점 진단 → bespoke 브리프 → videos 큐 + inngest 발사.
 *
 * 보안/비용: KINDY_OPERATOR_KEY 헤더 게이트(임의 호출로 fal.ai 비용 폭발 방지) +
 *   아이당 진행중(queued/generating) 영상 있으면 재큐 안 함(중복 생성 방지).
 *
 * header: x-operator-key: <KINDY_OPERATOR_KEY>
 * body:   { childId: string, targetDurationSec?: number }
 */
export const runtime = 'nodejs';

const VALID_GAME_TYPES = new Set<GameType>([
  'G1_match', 'G2_sort', 'G3_sequence', 'G4_listen', 'G5_find',
  'Q_quiz', 'emotion_expression', 'hidden_friend', 'decorate',
]);

function toRoundResult(row: Record<string, unknown>): GameRoundResult | null {
  const gameType = row.game_type as GameType;
  if (!VALID_GAME_TYPES.has(gameType)) return null;
  return {
    game_type: gameType,
    difficulty: typeof row.difficulty === 'number' ? row.difficulty : 1,
    objective_code: (row.objective_code as string | null) ?? null,
    standard_anchor: (row.standard_anchor as string | null) ?? null,
    score: (row.score as number | null) ?? null,
    max_score: (row.max_score as number | null) ?? null,
    latency_ms: (row.latency_ms as number | null) ?? null,
    retried: Boolean(row.retried),
    reward_payload:
      row.reward_payload && typeof row.reward_payload === 'object' && !Array.isArray(row.reward_payload)
        ? (row.reward_payload as GameRoundResult['reward_payload'])
        : null,
  };
}

export async function POST(request: NextRequest) {
  // 1) 운영자 게이트
  const operatorKey = process.env.KINDY_OPERATOR_KEY;
  if (!operatorKey) {
    return NextResponse.json({ error: '비스포크 생성이 아직 열려 있지 않아요.' }, { status: 503 });
  }
  if (request.headers.get('x-operator-key') !== operatorKey) {
    return NextResponse.json({ error: '권한이 없어요.' }, { status: 403 });
  }
  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json({ error: '백엔드가 설정되지 않았어요.' }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { childId?: string; targetDurationSec?: number } | null;
  const childId = body?.childId?.trim();
  if (!childId) {
    return NextResponse.json({ error: 'childId가 필요해요.' }, { status: 400 });
  }

  // 2) 아이 로드
  const { data: child, error: childErr } = await supabase
    .from('children')
    .select('id, name, age, styles, topics')
    .eq('id', childId)
    .maybeSingle();
  if (childErr) {
    console.error('[videos-bespoke:child]', childErr);
    return NextResponse.json({ error: '아이 정보를 불러오지 못했어요.' }, { status: 500 });
  }
  if (!child) {
    return NextResponse.json({ error: '아이를 찾지 못했어요.' }, { status: 404 });
  }

  // 3) 중복 생성 방지 — 진행중 영상 있으면 재큐 안 함
  const { data: inflight } = await supabase
    .from('videos')
    .select('id, status')
    .eq('child_id', childId)
    .in('status', ['queued', 'generating'])
    .limit(1);
  if (inflight && inflight.length > 0) {
    return NextResponse.json(
      { error: '이 아이의 영상이 이미 생성 대기/진행 중이에요.', videoId: inflight[0].id },
      { status: 409 },
    );
  }

  // 4) 약점 진단 (최근 7일 라운드)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: roundRows } = await supabase
    .from('game_rounds')
    .select('game_type, difficulty, objective_code, standard_anchor, score, max_score, latency_ms, retried, reward_payload')
    .eq('child_id', childId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(120);

  const rounds = ((roundRows ?? []) as Record<string, unknown>[])
    .map(toRoundResult)
    .filter((r): r is GameRoundResult => Boolean(r));

  const profile = buildLearningProfile(rounds);
  // 숙련 기반 '진짜 약점' 우선, 표본 부족 시 최소사용 도구로 폴백.
  const weakKey: C6ToolKey = profile.struggleTool?.toolKey ?? c6NextStep(aggregateC6Profile(rounds)).key;
  const weakTool = C6_TOOLS.find((t) => t.key === weakKey) ?? C6_TOOLS[0];

  const childName = typeof child.name === 'string' && child.name.trim() ? child.name.trim() : '아이';
  const age = typeof child.age === 'number' ? child.age : 5;
  const styles = Array.isArray(child.styles) ? (child.styles as string[]) : [];
  const topics = Array.isArray(child.topics) ? (child.topics as string[]) : [];
  const interestTheme = topics[0] ?? null;

  const brief = buildBespokeBrief({
    childName,
    age,
    toolKey: weakKey,
    interestTheme,
    targetDurationSec: typeof body?.targetDurationSec === 'number' ? body.targetDurationSec : 30,
  });

  // 5) videos 큐 삽입
  const { count } = await supabase
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('child_id', childId);

  const { data: video, error: insErr } = await supabase
    .from('videos')
    .insert({
      child_id: childId,
      title: `${childName} 맞춤 · ${weakTool.parentLabel}`,
      topic: 'animal-village',
      style_tags: styles,
      prompt_used: '',
      adjectives_used: [],
      video_url: null,
      duration_sec: null,
      status: 'queued',
      episode_number: (count ?? 0) + 1,
    })
    .select('id')
    .single();

  if (insErr || !video) {
    console.error('[videos-bespoke:insert]', insErr);
    return NextResponse.json({ error: '영상 생성 큐 등록에 실패했어요.' }, { status: 500 });
  }

  // 6) 생성 파이프라인 발사
  try {
    await inngest.send({
      name: 'video/generate',
      data: { videoId: video.id, brief, targetDurationSec: brief.targetDurationSec, seedanceTier: 'standard' },
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    await supabase.from('videos').update({ status: 'failed', error_reason: `inngest.send: ${reason}`.slice(0, 500) }).eq('id', video.id);
    return NextResponse.json({ error: '생성 이벤트 전송에 실패했어요.' }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    videoId: video.id,
    weakArea: { key: weakKey, label: weakTool.parentLabel },
    diagnosed: profile.enoughData ? 'mastery' : 'frequency_fallback',
    conditionInsight: profile.conditionInsight,
    briefSummary: brief.roughSynopsis,
  });
}
