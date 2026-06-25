import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';

interface ProfileRow {
  tag: string;
  score: number;
}

function scoreFromWeight(value: unknown): number | null {
  const raw = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(raw)) return null;
  return Math.round(Math.max(0, Math.min(100, raw <= 1 ? raw * 100 : raw)));
}

function profileRowsFromWeights(weights: Record<string, unknown> | null | undefined): ProfileRow[] {
  return Object.entries(weights ?? {})
    .map(([tag, value]) => {
      const score = scoreFromWeight(value);
      return score === null ? null : { tag, score };
    })
    .filter((row): row is ProfileRow => row !== null)
    .sort((a, b) => b.score - a.score);
}

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
    return NextResponse.json({ rows: null });
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
      return NextResponse.json({ rows: null }, { status: 404 });
    }

    const { count: readyCount, error: countError } = await supabase
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', childId)
      .eq('status', 'ready');

    if (countError || (readyCount ?? 0) < 3) {
      return NextResponse.json({ rows: null });
    }

    const { data, error } = await supabase
      .from('word_profiles')
      .select('weights')
      .eq('child_id', childId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ rows: null });
    }

    const weights = (data as { weights?: Record<string, unknown> | null } | null)?.weights;
    if (!weights || Object.keys(weights).length === 0) {
      return NextResponse.json({ rows: null });
    }

    return NextResponse.json({ rows: profileRowsFromWeights(weights) });
  } catch {
    return NextResponse.json({ rows: null });
  }
}
