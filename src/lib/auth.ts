import { createServerClient } from '@/lib/supabase-server';

export class AuthRequiredError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export function isAuthError(error: unknown): error is AuthRequiredError {
  return error instanceof AuthRequiredError;
}

function getBearerToken(request?: Request): string | null {
  const header = request?.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * 인증 확인. 기본은 Supabase 세션 쿠키.
 * `request` 를 넘기면 `Authorization: Bearer <supabase access token>` 헤더도 허용 —
 * iPad 앱 등 쿠키 없는 클라이언트가 API 를 호출할 때 사용.
 */
export async function requireAuth(request?: Request): Promise<{ userId: string }> {
  const supabase = await createServerClient();

  // 1) Bearer 토큰 (iPad 앱 등 비-브라우저 클라이언트)
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
