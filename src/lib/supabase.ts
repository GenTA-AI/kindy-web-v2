import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client.
 *
 * API routes (Next.js server) 에서만 import 해야 함 — service_role 키 를 사용하므로
 * 클라이언트 번들에 포함되면 절대 안 됨 ('@/lib/supabase' import 는 server code 전용).
 *
 * RLS 는 service_role 이 자동 우회.
 * browser/server client 는 supabase-browser.ts / supabase-server.ts 로 분리됨.
 * 이 파일은 server-only service_role 클라이언트 (RLS bypass) 전용.
 *
 * 기존 parent_id='demo-parent' 데이터 마이그레이션은 db-rls-waitlist 패키지에서 정리한다.
 * 이 패키지는 신규 가입자 데이터가 session.user.id parent_id 로 생성되도록만 보장한다.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let _supabase: SupabaseClient | null = null;

export function isSupabaseServiceConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseServiceKey);
}

export function getSupabase(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL and SERVICE_ROLE key required. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return Reflect.get(getSupabase(), prop);
  },
});
