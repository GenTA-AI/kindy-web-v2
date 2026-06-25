import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  const { name, age, styles, topics } = body;

  if (!name || !age || !styles?.length || !topics?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('children')
    .insert({
      name,
      age,
      styles,
      topics,
      parent_id: parentId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
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
  const childId = searchParams.get('id');

  if (childId) {
    const { data, error } = await supabase
      .from('children')
      .select('*')
      .eq('id', childId)
      .eq('parent_id', parentId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
