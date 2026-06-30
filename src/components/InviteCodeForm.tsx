'use client';

import { FormEvent, useState } from 'react';

interface InviteCodeFormProps {
  onSuccess: () => void;
  onAuthRequired?: (code: string) => void;
  className?: string;
  title?: string;
  description?: string;
}

export default function InviteCodeForm({
  onSuccess,
  onAuthRequired,
  className = '',
  title = '초대 코드 입력',
  description = '초대받은 분만 클로즈드 베타를 시작할 수 있어요.',
}: InviteCodeFormProps) {
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const cleaned = code.trim();
    if (!cleaned) {
      setError('유효하지 않은 초대 코드');
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/invite/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleaned }),
      });

      if (response.ok) {
        onSuccess();
        return;
      }

      if (response.status === 401 && onAuthRequired) {
        onAuthRequired(cleaned);
        return;
      }

      setError('유효하지 않은 초대 코드');
    } catch {
      setError('유효하지 않은 초대 코드');
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`mx-auto w-full max-w-[375px] rounded-2xl border border-line bg-white p-4 text-left shadow-sm ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-base font-black text-ink">{title}</h3>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-ink2">{description}</p>
      </div>

      <label className="block">
        <span className="mb-2 block text-[11px] font-black uppercase tracking-[.14em] text-ink3">
          초대 코드
        </span>
        <input
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          disabled={pending}
          placeholder="초대 코드를 입력해주세요"
          autoCapitalize="characters"
          autoComplete="one-time-code"
          className="w-full rounded-2xl border border-line bg-cream px-4 py-3.5 text-base font-bold text-ink outline-none transition placeholder:text-ink3 focus:border-sage focus:ring-4 focus:ring-sagebg disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>

      <button
        type="submit"
        disabled={pending || !code.trim()}
        className="mt-3 w-full rounded-2xl bg-saged px-6 py-4 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? '확인 중...' : '초대 코드 입력'}
      </button>

      {error && (
        <p className="mt-3 text-center text-sm font-bold text-clay" aria-live="polite">
          {error}
        </p>
      )}
    </form>
  );
}
