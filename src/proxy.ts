import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { isLaunchSurfaceClosed } from '@/lib/launch-surface';

const AUTH_PROTECTED_PAGE_PREFIXES = [
  '/dashboard',
  '/play',
  '/player',
  '/settings',
  '/library',
] as const;

const AUTH_PROTECTED_API_PREFIXES = [
  '/api/children',
  '/api/credits',
  '/api/purchases',
  '/api/videos',
  '/api/events',
  '/api/reactions',
  '/api/quiz',
  '/api/attention-quiz',
  '/api/library',
  '/api/game',
] as const;

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isAuthProtectedPath(pathname: string) {
  return (
    AUTH_PROTECTED_PAGE_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix)) ||
    AUTH_PROTECTED_API_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix))
  );
}

function launchNotFound(pathname: string) {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  return new NextResponse(null, {
    status: 404,
    headers: { 'X-Robots-Tag': 'noindex, nofollow' },
  });
}

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

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isLaunchSurfaceClosed(pathname, process.env)) {
    return launchNotFound(pathname);
  }

  // The expanded matcher sees all pages so unknown future pages fail closed in
  // production. Preserve the pre-existing auth gate only on its original paths.
  if (!isAuthProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // 로컬 개발(또는 명시적 프리뷰)에서만 인증 미들웨어를 통과시킨다.
    const localPreviewAllowed =
      process.env.NODE_ENV !== 'production' || process.env.KINDY_LOCAL_PREVIEW === '1';
    if (localPreviewAllowed) {
      return NextResponse.next();
    }
    // 프로덕션 오설정: 보호 라우트(matcher 한정)를 가짜 통과시키지 않는다.
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Auth backend not configured' }, { status: 503 });
    }
    return NextResponse.redirect(loginRedirectUrl(request));
  }

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
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|.*\\.[^/]+$).*)',
    '/api/kiosk/events',
    '/dashboard/:path*',
    '/play/:path*',
    '/player/:path*',
    '/settings/:path*',
    '/library/:path*',
    '/api/(children|credits|purchases|videos|events|reactions|quiz|attention-quiz|library|game)/:path*',
  ],
};
