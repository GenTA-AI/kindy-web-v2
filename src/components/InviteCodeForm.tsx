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
      className={`mx-auto w-full max-w-[375px] rounded-2xl border border-violet-100 bg-white p-4 text-left shadow-sm ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm font-medium leading-relaxed text-gray-600">{description}</p>
      </div>

      <label className="block">
        <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Invite code
        </span>
        <input
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          disabled={pending}
          placeholder="초대 코드를 입력해주세요"
          autoCapitalize="characters"
          autoComplete="one-time-code"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-base font-semibold text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>

      <button
        type="submit"
        disabled={pending || !code.trim()}
        className="mt-3 w-full rounded-2xl bg-violet-500 px-6 py-4 text-base font-bold text-white shadow-lg shadow-violet-200/60 transition hover:bg-violet-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? '확인 중...' : '초대 코드 입력'}
      </button>

      {error && (
        <p className="mt-3 text-center text-sm font-semibold text-red-500" aria-live="polite">
          {error}
        </p>
      )}
    </form>
  );
}
