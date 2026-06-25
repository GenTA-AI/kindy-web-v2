import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function clientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (
    forwardedFor ||
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    ''
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const supabase = getSupabase();
  const since = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
  const ip = clientIp(request);
  const source = ip ? `ip:${ip.slice(0, 96)}` : null;

  // 0007 마이그레이션의 waitlist_insert_own RLS policy 가 anon insert 허용 — service_role 사용도 OK.
  const recentEmail = await supabase
    .from('waitlist')
    .select('id')
    .eq('email', email)
    .gte('created_at', since)
    .limit(1);

  if (recentEmail.error) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  if ((recentEmail.data?.length ?? 0) > 0) {
    return NextResponse.json({ ok: true });
  }

  if (source) {
    const recentIp = await supabase
      .from('waitlist')
      .select('id')
      .eq('source', source)
      .gte('created_at', since)
      .limit(1);

    if (recentIp.error) {
      return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }

    if ((recentIp.data?.length ?? 0) > 0) {
      return NextResponse.json({ ok: true });
    }
  }

  const { error } = await supabase
    .from('waitlist')
    .insert({
      email,
      source,
    });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
