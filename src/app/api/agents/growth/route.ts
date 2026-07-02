import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { C6_AXES, C6_AXIS_BY_ID, type C6AxisId } from '@/lib/c6/axes';
import {
  pickGrowthAxis,
  pickStrengthAxis,
  toSeedState,
  type GrowthProfileSnapshot,
} from '@/lib/c6/growth-view';
import { isSupabaseServiceConfigured, supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

type GrowthProfileRow = {
  axis_id: string;
  current_level: number | string | null;
  confidence: number | string | null;
  evidence_count: number | null;
};

function unauthorized() {
  return NextResponse.json({ error: '보호자 로그인이 필요해요.' }, { status: 401 });
}

function badRequest() {
  return NextResponse.json({ error: '아이 정보를 다시 확인해 주세요.' }, { status: 400 });
}

function childNotFound() {
  return NextResponse.json({ error: '아이 정보를 찾지 못했어요.' }, { status: 404 });
}

function growthReadError() {
  return NextResponse.json({ error: '성장지도를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
}

function numberValue(value: number | string | null | undefined, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toAxisId(value: string): C6AxisId | null {
  return C6_AXIS_BY_ID.has(value as C6AxisId) ? (value as C6AxisId) : null;
}

function toProfileSnapshot(row: GrowthProfileRow): GrowthProfileSnapshot | null {
  const axisId = toAxisId(row.axis_id);
  if (!axisId) return null;

  return {
    axis_id: axisId,
    current_level: numberValue(row.current_level, 50),
    confidence: numberValue(row.confidence, 0),
    evidence_count: typeof row.evidence_count === 'number' ? row.evidence_count : 0,
  };
}

function overallLine(profiles: readonly GrowthProfileSnapshot[]): string {
  const strengthAxisId = pickStrengthAxis(profiles);
  const growthAxisId = pickGrowthAxis(profiles);
  const strength = strengthAxisId ? C6_AXIS_BY_ID.get(strengthAxisId) : null;
  const growth = growthAxisId ? C6_AXIS_BY_ID.get(growthAxisId) : null;

  if (strength && growth && strength.id !== growth.id) {
    return `${strength.child_label}이 놀이 속에서 자주 빛나요. ${growth.child_label}도 천천히 모습을 보여주고 있어요.`;
  }
  if (strength) {
    return `${strength.child_label}이 놀이 속에서 자주 빛나요.`;
  }
  if (profiles.some((profile) => profile.evidence_count > 0)) {
    return '성장지도가 더 선명해지는 중이에요. 여섯 씨앗의 모습을 차근차근 살피고 있어요.';
  }
  return '여섯 씨앗이 놀이 속에서 천천히 모습을 드러낼 준비를 하고 있어요.';
}

function buildGrowthResponse(childId: string, profiles: readonly GrowthProfileSnapshot[]) {
  const profileByAxis = new Map(profiles.map((profile) => [profile.axis_id, profile] as const));

  return {
    childId,
    overall_line: overallLine(profiles),
    seeds: C6_AXES.map((axis) => toSeedState(profileByAxis.get(axis.id) ?? null, axis)),
    strength_axis_id: pickStrengthAxis(profiles),
    growth_axis_id: pickGrowthAxis(profiles),
  };
}

export async function GET(request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId(request);
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    console.error('[growth-agent:auth]', error);
    return growthReadError();
  }

  const { searchParams } = new URL(request.url);
  const childId = searchParams.get('childId');
  if (!childId) return badRequest();

  if (!isSupabaseServiceConfigured()) {
    return NextResponse.json(buildGrowthResponse(childId, []));
  }

  try {
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('id')
      .eq('id', childId)
      .eq('parent_id', parentId)
      .maybeSingle();

    if (childError) {
      console.error('[growth-agent:child]', childError);
      return growthReadError();
    }
    if (!child) return childNotFound();

    const { data: profileRows, error: profileError } = await supabase
      .from('child_growth_profiles')
      .select('axis_id, current_level, confidence, evidence_count')
      .eq('child_id', childId);

    if (profileError) {
      console.error('[growth-agent:profiles]', profileError);
      return growthReadError();
    }

    const profiles = ((profileRows ?? []) as GrowthProfileRow[])
      .map(toProfileSnapshot)
      .filter((profile): profile is GrowthProfileSnapshot => Boolean(profile));

    return NextResponse.json(buildGrowthResponse(childId, profiles));
  } catch (error) {
    console.error('[growth-agent:read]', error);
    return growthReadError();
  }
}
