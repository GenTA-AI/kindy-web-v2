'use client';

import { useEffect, useRef, useState } from 'react';
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composingRef = useRef(false);
  const isReadOnly = config.mode === 'read_only';
  const trimmed = value.trim();

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
  }, [value]);

  if (isReadOnly) {
    return (
      <div className="border-t border-line bg-cream px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <div className="flex min-h-12 items-center justify-center gap-2 border border-line bg-mist px-4 text-[16px] font-semibold text-ink2">
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path strokeLinecap="round" d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          {config.placeholder}
        </div>
        {config.helperText && <p className="mt-2 text-center text-[14px] leading-5 text-ink2">{config.helperText}</p>}
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
      className="border-t border-line bg-cream px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3"
      data-chat-composer
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-end gap-2 border border-ink/25 bg-white p-1.5 pl-4 focus-within:border-saged focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-sages">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter'
              && !event.shiftKey
              && !composingRef.current
              && !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              submit();
            }
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          rows={1}
          maxLength={config.maxLength ?? 240}
          placeholder={config.placeholder}
          aria-label="메시지 입력"
          disabled={pending}
          autoComplete="off"
          enterKeyHint="send"
          className="max-h-28 min-h-12 flex-1 resize-none overflow-y-auto bg-transparent py-3 text-[16px] leading-6 text-ink outline-none placeholder:text-ink2 disabled:cursor-wait disabled:text-ink2"
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
      <p className="mt-2 min-h-5 px-1 text-[14px] leading-5 text-ink2" aria-live="polite">
        {pending ? '모리가 다음 장면을 준비하고 있어요.' : config.helperText}
      </p>
    </form>
  );
}
