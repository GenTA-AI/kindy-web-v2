'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import MoriCharacter from '@/components/MoriCharacter';
import { createBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase-browser';

const AUTH_PROMISES = [
  ['아이 화면 분리', '아이 플레이 화면에는 광고와 결제 버튼이 보이지 않아요.'],
  ['보호자 기록', '로그인한 보호자만 아이별 놀이 기록을 확인해요.'],
  ['언제든 관리', '아이 프로필과 멤버십은 보호자 화면에서 관리해요.'],
];

const SERVICE_FLOW = [
  ['1', '영상 한 편', '모리 이야기를 짧게 봐요.'],
  ['2', '질문·놀이', '방금 본 장면을 고르고 만들어봐요.'],
  ['3', '보호자 기록', '오늘 해낸 놀이가 남아요.'],
];

const PREVIEW_LINKS = [
  ['첫 이야기 보기', '/sample/library'],
  ['기록 예시 보기', '/sample/report'],
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTH_ERROR_MESSAGE = '로그인 연결이 잠시 매끄럽지 않아요. 다시 시도하거나 이메일 코드로 계속해 주세요.';
const EMAIL_EMPTY_MESSAGE = '이메일 주소를 입력해 주세요.';
const EMAIL_ERROR_MESSAGE = '이메일 주소를 다시 확인해 주세요. 예: parent@example.com';
const EMAIL_CODE_ERROR_MESSAGE = '코드를 보내지 못했어요. 이메일 주소를 확인하고 잠시 후 다시 시도해 주세요.';
const VERIFY_CODE_ERROR_MESSAGE = '코드가 올바르지 않거나 만료됐어요. 새 코드를 받아주세요.';

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

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
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
  const supabaseReady = isSupabaseBrowserConfigured();
  const normalizedEmail = normalizeEmail(email);
  const hasFeedback = Boolean(message || error);
  const emailFieldInvalid = error === EMAIL_EMPTY_MESSAGE || error === EMAIL_ERROR_MESSAGE || error === EMAIL_CODE_ERROR_MESSAGE;
  const codeFieldInvalid = error === VERIFY_CODE_ERROR_MESSAGE;

  const updateEmail = (value: string) => {
    setEmail(value);
    setError(null);
    setMessage(null);
    if (codeSent) {
      setCodeSent(false);
      setCode('');
    }
  };

  const signInWithKakao = async () => {
    if (!supabaseReady) {
      window.location.assign(next);
      return;
    }

    setPending('kakao');
    setError(null);
    setMessage(null);

    const supabase = createBrowserClient();
    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: getCallbackUrl(next),
        },
      });

      if (signInError) {
        setError(AUTH_ERROR_MESSAGE);
        setPending(null);
      }
    } catch {
      setError(AUTH_ERROR_MESSAGE);
      setPending(null);
    }
  };

  const sendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!normalizedEmail) {
      setError(EMAIL_EMPTY_MESSAGE);
      setMessage(null);
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setError(EMAIL_ERROR_MESSAGE);
      setMessage(null);
      return;
    }
    if (!supabaseReady) {
      window.location.assign(next);
      return;
    }

    setPending('email');
    setError(null);
    setMessage(null);

    const supabase = createBrowserClient();
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: getCallbackUrl(next),
        },
      });

      if (signInError) {
        setError(EMAIL_CODE_ERROR_MESSAGE);
      } else {
        setCodeSent(true);
        setMessage(`${normalizedEmail} 메일함에서 6자리 코드를 확인해 입력해주세요.`);
      }
    } catch {
      setError(EMAIL_CODE_ERROR_MESSAGE);
    } finally {
      setPending(null);
    }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = code.trim();
    if (token.length < 6) return;
    if (!isValidEmail(normalizedEmail)) {
      setError('코드를 받은 이메일 주소를 다시 확인해 주세요.');
      return;
    }
    if (!supabaseReady) {
      window.location.assign(next);
      return;
    }

    setPending('verify');
    setError(null);

    const supabase = createBrowserClient();
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token,
        type: 'email',
      });

      if (verifyError) {
        setError(VERIFY_CODE_ERROR_MESSAGE);
        setPending(null);
        return;
      }
    } catch {
      setError(VERIFY_CODE_ERROR_MESSAGE);
      setPending(null);
      return;
    }

    // 세션 쿠키가 설정됨 — 전체 페이지 이동으로 서버가 세션을 인식하게 함
    window.location.assign(next);
  };

  return (
    <main
      className="min-h-screen bg-cream px-5 py-8 text-ink [word-break:keep-all]"
      style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-[420px] flex-col justify-center">
        <div className="mb-7">
          <MoriCharacter className="mb-5 h-20 w-20 overflow-hidden rounded-[24px] border border-line bg-white shadow-sm" imageClassName="scale-125" label="모리" withGlow={false} />
          <div className="mb-3 text-[11px] font-black uppercase tracking-[.16em] text-sage">Kindy Mori</div>
          <h1 className="text-[30px] font-black leading-tight">
            보호자 계정으로
            <br />
            계속하기
          </h1>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-ink2">
            카카오 또는 이메일 코드로 안전하게 로그인해요.
          </p>
        </div>

        <section className="mb-5 rounded-3xl border border-line bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[.14em] text-sage">처음이라면</p>
          <div className="mt-3 grid gap-2">
            {SERVICE_FLOW.map(([num, title, body]) => (
              <div key={title} className="grid grid-cols-[32px_1fr] gap-3 rounded-2xl bg-mist px-3 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-black text-saged">
                  {num}
                </span>
                <span>
                  <span className="block text-sm font-black text-ink">{title}</span>
                  <span className="mt-0.5 block text-xs font-semibold leading-relaxed text-ink3">{body}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-5 grid gap-2">
          {AUTH_PROMISES.map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-line bg-white p-4">
              <p className="text-sm font-black text-ink">{title}</p>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-ink3">{body}</p>
            </div>
          ))}
        </section>

        {!supabaseReady && (
          <div className="mb-5 rounded-2xl border border-line bg-mist p-4 text-sm font-semibold leading-relaxed text-saged">
            지금은 체험 모드로 열려요. 로그인 없이 모리 흐름을 확인할 수 있어요.
          </div>
        )}

        <button
          type="button"
          onClick={signInWithKakao}
          disabled={pending !== null}
          className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-saged px-6 py-4 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === 'kakao' ? '연결 중...' : supabaseReady ? '카카오로 계속하기' : '바로 체험하기'}
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-[11px] font-black uppercase tracking-[.16em] text-ink3">또는</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={sendCode} className="space-y-3" noValidate>
          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[.14em] text-ink3">이메일</span>
            <input
              name="email"
              type="email"
              value={email}
              onChange={(event) => updateEmail(event.target.value)}
              placeholder="parent@example.com"
              autoComplete="email"
              aria-invalid={emailFieldInvalid}
              aria-describedby={hasFeedback ? 'login-feedback' : undefined}
              className="w-full rounded-2xl border border-line bg-white px-4 py-4 text-base font-bold text-ink outline-none transition placeholder:text-ink3 focus:border-sage focus:ring-4 focus:ring-sagebg"
            />
          </label>
          <button
            type="submit"
            disabled={pending !== null || !email.trim()}
            className="w-full rounded-2xl border border-line bg-white px-6 py-3.5 text-sm font-black text-saged transition hover:bg-mist active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending === 'email' ? '코드 보내는 중...' : codeSent ? '코드 다시 받기' : '이메일로 코드 받기'}
          </button>
        </form>

        {codeSent && (
          <form onSubmit={verifyCode} className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[.14em] text-ink3">6자리 코드</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                aria-invalid={codeFieldInvalid}
                aria-describedby={hasFeedback ? 'login-feedback' : undefined}
                className="w-full rounded-2xl border border-line bg-white px-4 py-4 text-center text-2xl font-black tracking-[0.4em] text-ink outline-none transition placeholder:text-line focus:border-sage focus:ring-4 focus:ring-sagebg"
              />
            </label>
            <button
              type="submit"
              disabled={pending !== null || code.trim().length < 6}
              className="w-full rounded-2xl bg-saged px-6 py-4 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending === 'verify' ? '확인 중...' : '로그인'}
            </button>
            <p className="text-center text-xs font-semibold text-ink3">
              메일의 링크를 눌러도 로그인됩니다.
            </p>
          </form>
        )}

        {(message || error) && (
          <div
            id="login-feedback"
            aria-live="polite"
            className={`mt-5 rounded-2xl border p-4 text-sm font-semibold leading-relaxed ${
              error
                ? 'border-clay/30 bg-white text-clay'
                : 'border-line bg-mist text-saged'
            }`}
          >
            {error ?? message}
          </div>
        )}

        <section className="mt-6 rounded-3xl border border-line bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[.14em] text-sage">가입 전 확인</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">
            아직 망설여진다면 모리의 첫 이야기와 보호자 기록 예시를 먼저 볼 수 있어요.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {PREVIEW_LINKS.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-mist px-3 text-center text-xs font-black text-saged transition hover:bg-sagebg active:scale-[0.98]"
              >
                {label}
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-bold text-ink3">
          <Link href="/legal/terms" className="underline underline-offset-[3px] hover:text-ink">
            이용약관
          </Link>
          <Link href="/legal/privacy" className="underline underline-offset-[3px] hover:text-ink">
            개인정보 처리방침
          </Link>
          <Link href="/legal/business" className="underline underline-offset-[3px] hover:text-ink">
            사업자 정보
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream" />}>
      <LoginContent />
    </Suspense>
  );
}
