'use client';

import { useState } from 'react';
import type { StoryChatComposerConfig } from '@/types/story-chat';

interface ChatComposerProps {
  config: StoryChatComposerConfig;
  onSend: (text: string) => void;
  pending?: boolean;
}

function SendIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 14-7-4.25 14-3.1-5.65L5 12Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m11.65 13.35 3.6-3.6" />
    </svg>
  );
}

export default function ChatComposer({ config, onSend, pending = false }: ChatComposerProps) {
  const [value, setValue] = useState('');
  const isReadOnly = config.mode === 'read_only';
  const trimmed = value.trim();

  if (isReadOnly) {
    return (
      <div className="border-t border-line bg-cream px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <div className="flex min-h-12 items-center justify-center gap-2 border border-line bg-mist px-4 text-[15px] font-semibold text-ink2">
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path strokeLinecap="round" d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          {config.placeholder}
        </div>
        {config.helperText && <p className="mt-2 text-center text-[13px] leading-5 text-ink3">{config.helperText}</p>}
      </div>
    );
  }

  const submit = () => {
    if (!trimmed || pending) return;
    onSend(trimmed);
    setValue('');
  };

  return (
    <form
      className="border-t border-line bg-cream px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-end gap-2 border border-ink/25 bg-white p-1.5 pl-4 focus-within:border-saged focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sages">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={config.maxLength ?? 240}
          placeholder={config.placeholder}
          aria-label="메시지 입력"
          autoComplete="off"
          enterKeyHint="send"
          className="max-h-24 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[16px] leading-6 text-ink outline-none placeholder:text-ink3"
        />
        <button
          type="submit"
          disabled={!trimmed || pending}
          className="flex h-12 w-12 shrink-0 items-center justify-center bg-saged text-white transition-colors hover:bg-ink active:bg-ink disabled:bg-line disabled:text-ink3"
          aria-label="메시지 보내기"
        >
          <SendIcon />
        </button>
      </div>
      {config.helperText && <p className="mt-2 px-1 text-[13px] leading-5 text-ink3">{config.helperText}</p>}
    </form>
  );
}
