import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { getLaunchMode, isLaunchSurfaceClosed } from '@/lib/launch-surface';

const AUTH_PROTECTED_PAGE_PREFIXES = [
  '/onboarding',
  '/chats',
  '/dashboard',
  '/play',
  '/player',
  '/settings',
  '/library',
] as const;

const AUTH_PROTECTED_API_PREFIXES = [
  '/api/chat',
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

export function isAuthProtectedPath(pathname: string) {
  return (
    AUTH_PROTECTED_PAGE_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix)) ||
    AUTH_PROTECTED_API_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix))
  );
}

function launchNotFound(pathname: string) {
  if (pathname === '/api' || pathname.startsWith('/api/')) {
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

export function loginRedirectUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  url.pathname = '/auth/login';
  url.search = '';
  url.searchParams.set('next', next);
  return url;
}

export function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function acceptsBearerAuth(pathname: string): boolean {
  return matchesPathPrefix(pathname, '/api/chat');
}

function protectedPilotOnboardingUrl(request: NextRequest) {
  if (
    request.nextUrl.pathname !== '/onboarding' ||
    request.nextUrl.searchParams.has('next') ||
    getLaunchMode(process.env) !== 'protected_chat_pilot'
  ) {
    return null;
  }

  const url = request.nextUrl.clone();
  url.searchParams.set('next', '/chats');
  return url;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isLaunchSurfaceClosed(pathname, process.env)) {
    return launchNotFound(pathname);
  }

  const onboardingUrl = protectedPilotOnboardingUrl(request);
  if (onboardingUrl) {
    return NextResponse.redirect(onboardingUrl);
  }

  // The expanded matcher sees all pages and APIs so unknown future routes fail
  // closed in protected launch modes. Auth remains independent of launch scope.
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

  // Cookie-authenticated web requests and Bearer-authenticated mobile/API
  // requests share the same protected surface. Validate either credential with
  // Supabase here, then repeat the check in the Route Handler as defense in
  // depth. Never optimistically pass an unverified Authorization header.
  const bearerToken = acceptsBearerAuth(pathname) ? getBearerToken(request) : null;
  const {
    data: { user },
  } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser();

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
    '/onboarding/:path*',
    '/chats/:path*',
    '/api/:path*',
  ],
};
