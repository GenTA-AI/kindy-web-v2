import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseServiceConfigured, supabase } from '@/lib/supabase';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import {
  LOCAL_PREVIEW_CHILD_COOKIE,
  LOCAL_PREVIEW_CHILD_COOKIE_MAX_AGE,
  normalizeLocalPreviewChild,
  parseLocalPreviewChildCookie,
  serializeLocalPreviewChild,
} from '@/lib/local-preview-child';

const TERMS_VERSION = '2026-06-30';
// 2026-07-02: §5 국외이전 표 추가(PIPA §28-8) — privacy.md 개정과 함께 bump.
const PRIVACY_VERSION = '2026-07-02';
const CHILD_CONSENT_VERSION = '2026-06-30';

function unauthorized() {
  return NextResponse.json({ error: '보호자 로그인이 필요해요.' }, { status: 401 });
}

function childWriteError() {
  return NextResponse.json({ error: '아이 이름표를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
}

function childReadError() {
  return NextResponse.json({ error: '아이 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
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

async function recordParentConsent(input: {
  parentId: string;
  childId: string;
}) {
  return supabase
    .from('parent_consents')
    .insert({
      parent_id: input.parentId,
      child_id: input.childId,
      consent_scope: 'child_profile_activity',
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      child_consent_version: CHILD_CONSENT_VERSION,
      consent_method: 'onboarding_checkbox',
    });
}

export async function POST(request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    throw error;
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: '아이 정보를 다시 확인해 주세요.' }, { status: 400 });
  }

  const name = cleanName(body.name);
  const age = cleanAge(body.age);
  const styles = cleanStringList(body.styles);
  const topics = cleanStringList(body.topics);
  const parentConsent = body.parent_consent === true;

  if (!name) {
    return NextResponse.json({ error: '아이 이름을 입력해 주세요.' }, { status: 400 });
  }
  if (age === null) {
    return NextResponse.json({ error: '나이는 3-8세로 선택해 주세요.' }, { status: 400 });
  }
  if (!styles) {
    return NextResponse.json({ error: '좋아하는 숲길을 하나 골라 주세요.' }, { status: 400 });
  }
  if (!topics) {
    return NextResponse.json({ error: '첫 이야기 주제를 다시 확인해 주세요.' }, { status: 400 });
  }
  if (!parentConsent) {
    return NextResponse.json({ error: '보호자 동의를 확인해 주세요.' }, { status: 400 });
  }

  if (!isSupabaseServiceConfigured()) {
    const child = normalizeLocalPreviewChild({
      name,
      age,
      styles,
      topics,
      parent_id: parentId,
    });
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
    console.error('[children:create]', error);
    return childWriteError();
  }

  const { error: consentError } = await recordParentConsent({
    parentId,
    childId: data.id as string,
  });

  if (consentError) {
    console.error('[children:create-consent]', consentError);
    await supabase.from('children').delete().eq('id', data.id);
    return childWriteError();
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

  if (!isSupabaseServiceConfigured()) {
    const child = parseLocalPreviewChildCookie(request.cookies.get(LOCAL_PREVIEW_CHILD_COOKIE)?.value);
    if (childId) return NextResponse.json({ ...child, id: childId, parent_id: parentId });
    return NextResponse.json([{ ...child, parent_id: parentId }]);
  }

  if (childId) {
    const { data, error } = await supabase
      .from('children')
      .select('*')
      .eq('id', childId)
      .eq('parent_id', parentId)
      .maybeSingle();

    if (error) {
      console.error('[children:get-one]', error);
      return childReadError();
    }
    if (!data) return childNotFound();
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[children:list]', error);
    return childReadError();
  }
  return NextResponse.json(data);
}
