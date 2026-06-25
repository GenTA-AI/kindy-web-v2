'use client';

import { FormEvent, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase-browser';

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard';
  }

  return value;
}

function getCallbackUrl(next: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  const url = new URL('/auth/callback', siteUrl);
  url.searchParams.set('next', next);
  return url.toString();
}

function LoginContent() {
  const searchParams = useSearchParams();
  const next = useMemo(() => safeNextPath(searchParams.get('next')), [searchParams]);
  const callbackError = searchParams.get('error');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [pending, setPending] = useState<'kakao' | 'email' | 'verify' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    callbackError ? '로그인 처리 중 문제가 생겼어요. 코드로 다시 시도해주세요.' : null
  );

  const signInWithKakao = async () => {
    setPending('kakao');
    setError(null);
    setMessage(null);

    const supabase = createBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: getCallbackUrl(next),
      },
    });

    if (signInError) {
      setError(signInError.message);
      setPending(null);
    }
  };

  const sendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;

    setPending('email');
    setError(null);
    setMessage(null);

    const supabase = createBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: getCallbackUrl(next),
      },
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      setCodeSent(true);
      setMessage('메일함에서 6자리 코드를 확인해 입력해주세요.');
    }

    setPending(null);
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = code.trim();
    if (token.length < 6) return;

    setPending('verify');
    setError(null);

    const supabase = createBrowserClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'email',
    });

    if (verifyError) {
      setError('코드가 올바르지 않거나 만료됐어요. 새 코드를 받아주세요.');
      setPending(null);
      return;
    }

    // 세션 쿠키가 설정됨 — 전체 페이지 이동으로 서버가 세션을 인식하게 함
    window.location.assign(next);
  };

  return (
    <main
      className="min-h-screen bg-gradient-to-b from-violet-50 to-white px-6 py-10 text-gray-900"
      style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-[375px] flex-col justify-center">
        <div className="mb-8">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-violet-500">Kindy 로그인</div>
          <h1 className="text-[26px] font-extrabold leading-[1.3] text-gray-900">
            부모 계정으로
            <br />
            계속하기
          </h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-gray-600">
            카카오 또는 이메일 코드로 안전하게 로그인해요.
          </p>
        </div>

        <button
          type="button"
          onClick={signInWithKakao}
          disabled={pending !== null}
          className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-violet-500 px-6 py-4 text-base font-bold text-white shadow-lg shadow-violet-200/60 transition hover:bg-violet-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === 'kakao' ? '연결 중...' : '카카오로 계속하기'}
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">또는</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={sendCode} className="space-y-3">
          <label className="block">
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-gray-500">이메일</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="parent@example.com"
              autoComplete="email"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-base font-semibold text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-violet-300"
            />
          </label>
          <button
            type="submit"
            disabled={pending !== null || !email.trim()}
            className="w-full rounded-xl border border-violet-100 bg-violet-50 px-6 py-3 text-sm font-bold text-violet-600 transition hover:bg-violet-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending === 'email' ? '코드 보내는 중...' : codeSent ? '코드 다시 받기' : '이메일로 코드 받기'}
          </button>
        </form>

        {codeSent && (
          <form onSubmit={verifyCode} className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-gray-500">6자리 코드</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-center text-2xl font-extrabold tracking-[0.4em] text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-transparent focus:ring-2 focus:ring-violet-300"
              />
            </label>
            <button
              type="submit"
              disabled={pending !== null || code.trim().length < 6}
              className="w-full rounded-2xl bg-violet-500 px-6 py-4 text-base font-bold text-white shadow-lg shadow-violet-200/60 transition hover:bg-violet-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending === 'verify' ? '확인 중...' : '로그인'}
            </button>
            <p className="text-center text-xs font-medium text-gray-400">
              메일의 링크를 눌러도 로그인됩니다.
            </p>
          </form>
        )}

        {(message || error) && (
          <div
            className={`mt-5 rounded-2xl border p-4 text-sm font-semibold leading-relaxed ${
              error
                ? 'border-red-100 bg-red-50 text-red-500'
                : 'border-violet-100 bg-violet-50 text-violet-600'
            }`}
          >
            {error ?? message}
          </div>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-violet-50" />}>
      <LoginContent />
    </Suspense>
  );
}
