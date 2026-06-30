'use client';

import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';

function getSupabasePublicEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and anon key required. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function createBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv();
  return createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);
}
