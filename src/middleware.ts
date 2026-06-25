import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

function getSupabasePublicEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and anon key required. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  }

  return { supabaseUrl, supabaseAnonKey };
}

function loginRedirectUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  url.pathname = '/auth/login';
  url.search = '';
  url.searchParams.set('next', next);
  return url;
}

export async function middleware(request: NextRequest) {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv();
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.redirect(loginRedirectUrl(request));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/play/:path*',
    '/player/:path*',
    '/settings/:path*',
    '/library/:path*',
    '/api/(children|credits|purchases|videos|events|reactions|quiz|attention-quiz|library|game)/:path*',
  ],
};
