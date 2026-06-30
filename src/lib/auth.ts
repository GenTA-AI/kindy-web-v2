import { createServerClient, isSupabaseServerConfigured } from '@/lib/supabase-server';

export class AuthRequiredError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export function isAuthError(error: unknown): error is AuthRequiredError {
  return error instanceof AuthRequiredError;
}

/**
 * Supabase 미설정 시 가짜 단일 사용자(local-preview-parent)로 동작하는 폴백은
 * 로컬 개발에서만 허용한다. 프로덕션에서 env가 빠지면 절대 가짜 사용자로 붙지 않고
 * hard-fail 시킨다 — 그래야 오설정 배포에서 부모끼리 데이터가 섞이지 않는다.
 */
export function isLocalPreviewAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.KINDY_LOCAL_PREVIEW === '1';
}

function getBearerToken(request?: Request): string | null {
  const header = request?.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * 인증 확인. 기본은 Supabase 세션 쿠키.
 * `request` 를 넘기면 `Authorization: Bearer <supabase access token>` 헤더도 허용 —
 * 쿠키 없는 클라이언트가 API 를 호출할 때 사용.
 */
export async function requireAuth(request?: Request): Promise<{ userId: string }> {
  if (!isSupabaseServerConfigured()) {
    if (isLocalPreviewAllowed()) {
      return { userId: 'local-preview-parent' };
    }
    // 프로덕션 오설정: 가짜 사용자로 붙지 않고 인증 실패 처리.
    throw new AuthRequiredError('Auth backend not configured');
  }

  const supabase = await createServerClient();

  // 1) Bearer 토큰 (쿠키 없는 클라이언트)
  const token = getBearerToken(request);
  if (token) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
      throw new AuthRequiredError();
    }
    return { userId: user.id };
  }

  // 2) 세션 쿠키 (웹)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthRequiredError();
  }

  return { userId: user.id };
}

export async function getCurrentParentId(request?: Request): Promise<string> {
  const { userId } = await requireAuth(request);
  return userId;
}
