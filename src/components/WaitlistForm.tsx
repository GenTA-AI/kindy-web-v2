'use client';

import { FormEvent, useState } from 'react';

interface WaitlistFormProps {
  className?: string;
}

export default function WaitlistForm({ className = '' }: WaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || done) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (response.status === 400 || body?.error === 'invalid_email') {
          setError('잘못된 이메일 형식이에요.');
        } else {
          setError('가입 처리 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.');
        }
        return;
      }

      setDone(true);
      setEmail('');
    } catch {
      setError('가입 처리 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`mx-auto w-full max-w-[375px] rounded-2xl border border-violet-100 bg-white p-4 text-left shadow-sm ${className}`}
    >
      <label className="block">
        <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-gray-500">
          초대 받을 이메일
        </span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending || done}
          placeholder="parent@example.com"
          autoComplete="email"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-base font-semibold text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>

      <button
        type="submit"
        disabled={pending || done || !email.trim()}
        className="mt-3 w-full rounded-2xl bg-violet-500 px-6 py-4 text-base font-bold text-white shadow-lg shadow-violet-200/60 transition hover:bg-violet-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? '가입 중...' : '가입하기'}
      </button>

      {(done || error) && (
        <p
          className={`mt-3 text-center text-sm font-semibold ${
            error ? 'text-red-500' : 'text-violet-600'
          }`}
          aria-live="polite"
        >
          {error ?? '가입 완료. 초청 메일을 보내드릴게요.'}
        </p>
      )}
    </form>
  );
}
