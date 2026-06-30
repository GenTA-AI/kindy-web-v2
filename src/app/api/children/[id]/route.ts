import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { isSupabaseServiceConfigured, supabase } from '@/lib/supabase';
import {
  LOCAL_PREVIEW_CHILD_COOKIE,
  LOCAL_PREVIEW_CHILD_COOKIE_MAX_AGE,
  normalizeLocalPreviewChild,
  parseLocalPreviewChildCookie,
  serializeLocalPreviewChild,
} from '@/lib/local-preview-child';

export const runtime = 'nodejs';

type RouteParams = {
  params: Promise<{ id: string }>;
};

function unauthorized() {
  return NextResponse.json({ error: '보호자 로그인이 필요해요.' }, { status: 401 });
}

function childReadError() {
  return NextResponse.json({ error: '아이 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
}

function childSaveError() {
  return NextResponse.json({ error: '아이 정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
}

function childDeleteError() {
  return NextResponse.json({ error: '아이 정보를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
}

function childNotFound() {
  return NextResponse.json({ error: '아이 정보를 찾지 못했어요.' }, { status: 404 });
}

function cleanName(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 40) : null;
}

function cleanAge(value: unknown): number | null {
  const age = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(age) && age >= 3 && age <= 8 ? age : null;
}

function cleanStringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const list = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);

  return list.length > 0 ? list : null;
}

async function requireParentId(request: NextRequest) {
  try {
    return await getCurrentParentId(request);
  } catch (error) {
    if (isAuthError(error)) return null;
    throw error;
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const parentId = await requireParentId(request);
  if (!parentId) return unauthorized();

  const { id } = await params;
  if (!id) return NextResponse.json({ error: '아이 정보를 다시 확인해 주세요.' }, { status: 400 });

  if (!isSupabaseServiceConfigured()) {
    const child = parseLocalPreviewChildCookie(request.cookies.get(LOCAL_PREVIEW_CHILD_COOKIE)?.value);
    return NextResponse.json({ ...child, id, parent_id: parentId });
  }

  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('id', id)
    .eq('parent_id', parentId)
    .maybeSingle();

  if (error) {
    console.error('[children:get-detail]', error);
    return childReadError();
  }
  if (!data) return childNotFound();

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const parentId = await requireParentId(request);
  if (!parentId) return unauthorized();

  const { id } = await params;
  if (!id) return NextResponse.json({ error: '아이 정보를 다시 확인해 주세요.' }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: '수정할 아이 정보를 다시 확인해 주세요.' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ('name' in body) {
    const name = cleanName(body.name);
    if (!name) return NextResponse.json({ error: '아이 이름을 확인해주세요.' }, { status: 400 });
    patch.name = name;
  }
  if ('age' in body) {
    const age = cleanAge(body.age);
    if (age === null) return NextResponse.json({ error: '나이는 3-8세로 선택해주세요.' }, { status: 400 });
    patch.age = age;
  }
  if ('styles' in body) {
    const styles = cleanStringList(body.styles);
    if (!styles) return NextResponse.json({ error: '좋아하는 숲길을 하나 이상 선택해주세요.' }, { status: 400 });
    patch.styles = styles;
  }
  if ('topics' in body) {
    const topics = cleanStringList(body.topics);
    if (!topics) return NextResponse.json({ error: '이야기 주제를 하나 이상 선택해주세요.' }, { status: 400 });
    patch.topics = topics;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: '수정할 내용이 없어요.' }, { status: 400 });
  }

  if (!isSupabaseServiceConfigured()) {
    const current = parseLocalPreviewChildCookie(request.cookies.get(LOCAL_PREVIEW_CHILD_COOKIE)?.value);
    const child = normalizeLocalPreviewChild({ ...current, ...patch, id, parent_id: parentId });
    const response = NextResponse.json(child);
    response.cookies.set(LOCAL_PREVIEW_CHILD_COOKIE, serializeLocalPreviewChild(child), {
      httpOnly: true,
      maxAge: LOCAL_PREVIEW_CHILD_COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax',
    });
    return response;
  }

  const { data, error } = await supabase
    .from('children')
    .update(patch)
    .eq('id', id)
    .eq('parent_id', parentId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[children:update]', error);
    return childSaveError();
  }
  if (!data) return childNotFound();

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const parentId = await requireParentId(request);
  if (!parentId) return unauthorized();

  const { id } = await params;
  if (!id) return NextResponse.json({ error: '아이 정보를 다시 확인해 주세요.' }, { status: 400 });

  if (!isSupabaseServiceConfigured()) {
    const response = NextResponse.json({ deleted: true, id });
    response.cookies.delete(LOCAL_PREVIEW_CHILD_COOKIE);
    return response;
  }

  const { data, error } = await supabase
    .from('children')
    .delete()
    .eq('id', id)
    .eq('parent_id', parentId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[children:delete]', error);
    return childDeleteError();
  }
  if (!data) return childNotFound();

  return NextResponse.json({ deleted: true, id: data.id });
}
