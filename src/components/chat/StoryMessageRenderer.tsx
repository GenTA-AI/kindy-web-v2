'use client';

import ChatAvatar from '@/components/chat/ChatAvatar';
import type {
  StoryChatMessage,
  StoryChoiceOption,
  StoryCinematicMessage,
  StoryGeneratedImageMessage,
  StoryQuickReply,
} from '@/types/story-chat';

interface StoryMessageRendererProps {
  message: StoryChatMessage;
  onChoice?: (messageId: string, option: StoryChoiceOption) => void;
  onQuickReply?: (messageId: string, reply: StoryQuickReply) => void;
  onPlayCinematic?: (message: StoryCinematicMessage) => void;
  interactionDisabled?: boolean;
}

function CharacterMessage({ message }: { message: Extract<StoryChatMessage, { type: 'character_text' }> }) {
  return (
    <div className="flex items-start gap-2.5">
      <ChatAvatar actor={message.actor} size="md" decorative />
      <div className="max-w-[82%]">
        <p className="mb-1.5 text-[14px] font-semibold text-ink2">{message.actor.name}</p>
        <div className="rounded-[18px] rounded-tl-sm border border-line bg-white px-4 py-3 text-[16px] leading-[1.6] text-ink">
          {message.text}
        </div>
        {message.createdAtLabel && <time className="mt-1.5 block text-[14px] text-ink2">{message.createdAtLabel}</time>}
      </div>
    </div>
  );
}

function ChildMessage({ message }: { message: Extract<StoryChatMessage, { type: 'child_text' }> }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[82%] text-right">
        <div className="inline-block rounded-[18px] rounded-tr-sm bg-saged px-4 py-3 text-left text-[16px] font-medium leading-[1.6] text-white">
          {message.text}
        </div>
        <div className="mt-1.5 flex items-center justify-end gap-1 text-[14px] text-ink2">
          {message.delivery === 'failed' && <span className="text-clay">전송 실패</span>}
          {message.delivery === 'pending' && <span>보내는 중</span>}
          {message.createdAtLabel && <time>{message.createdAtLabel}</time>}
        </div>
      </div>
    </div>
  );
}

function NoticeMessage({ message }: { message: Extract<StoryChatMessage, { type: 'notice' }> }) {
  return (
    <div className="mx-auto max-w-[92%] py-1">
      {message.createdAtLabel && (
        <time className="mb-3 block text-center text-[14px] text-ink2">
          {message.createdAtLabel}
        </time>
      )}
      <div className="border-y border-line px-2 py-4 text-center">
        {message.eyebrow && <p className="text-[14px] font-semibold tracking-[0.04em] text-sage">{message.eyebrow}</p>}
        <p className="mt-1 text-[16px] font-bold leading-6 text-ink">{message.title}</p>
        <p className="mt-1 text-[15px] leading-6 text-ink2">{message.body}</p>
        {message.icon && (
          <span className="sr-only">{message.icon}</span>
        )}
      </div>
    </div>
  );
}

function ChoiceMessage({
  message,
  onChoice,
  disabled = false,
}: {
  message: Extract<StoryChatMessage, { type: 'choice' }>;
  onChoice?: StoryMessageRendererProps['onChoice'];
  disabled?: boolean;
}) {
  return (
    <section className="ml-0 overflow-hidden border border-ink/20 bg-white min-[390px]:ml-[54px]" aria-label="행동 선택">
      <div className="border-b border-line px-4 py-4">
        <p className="text-[14px] font-semibold tracking-[0.04em] text-sage">{message.eyebrow ?? '선택할 시간'}</p>
        <h3 className="mt-1 text-[17px] font-bold leading-7 text-ink">{message.prompt}</h3>
      </div>
      <div className="divide-y divide-line">
        {message.options.map((option, index) => {
          const selected = message.selectedOptionId === option.id;
          return (
            <button
              type="button"
              key={option.id}
              onClick={() => onChoice?.(message.id, option)}
              disabled={Boolean(message.selectedOptionId) || disabled}
              className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:cursor-default ${
                selected
                  ? 'bg-sagebg'
                  : message.selectedOptionId
                    ? 'bg-mist text-ink3'
                    : 'bg-white hover:bg-mist'
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center border text-[14px] font-bold ${selected ? 'border-saged bg-saged text-white' : 'border-line text-saged'}`}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold text-ink">{option.label}</span>
                {option.hint && <span className="mt-0.5 block text-[14px] leading-5 text-ink2">{option.hint}</span>}
              </span>
              {selected && <span className="text-[14px] font-semibold text-saged" aria-label="선택됨">선택</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function QuickRepliesMessage({
  message,
  onQuickReply,
  disabled = false,
}: {
  message: Extract<StoryChatMessage, { type: 'quick_replies' }>;
  onQuickReply?: StoryMessageRendererProps['onQuickReply'];
  disabled?: boolean;
}) {
  return (
    <section className="ml-0 min-[390px]:ml-[54px]" aria-label={message.label ?? '빠른 답장'}>
      {message.label && <p className="mb-2 text-[14px] font-semibold text-sage">{message.label}</p>}
      <div className="grid gap-2">
        {message.replies.map((reply) => (
          <button
            type="button"
            key={reply.id}
            onClick={() => onQuickReply?.(message.id, reply)}
            disabled={disabled}
            className="min-h-12 touch-manipulation border border-sages bg-white px-4 py-3 text-left text-[16px] font-semibold text-saged transition-colors hover:bg-sagebg disabled:border-line disabled:bg-mist disabled:text-ink2"
          >
            {reply.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function CinematicMessage({
  message,
  onPlay,
}: {
  message: StoryCinematicMessage;
  onPlay?: StoryMessageRendererProps['onPlayCinematic'];
}) {
  return (
    <article className="ml-0 overflow-hidden border border-ink/30 bg-ink text-white min-[390px]:ml-[54px]">
      <button
        type="button"
        onClick={() => onPlay?.(message)}
        className="group block min-h-12 w-full touch-manipulation bg-ink text-left"
        aria-label={`${message.title} 영상 재생`}
      >
        <span className="relative mx-auto block aspect-[9/16] w-full max-w-[280px] overflow-hidden bg-black">
          {message.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={message.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <span className="block h-full w-full bg-black" />
          )}
          <span className="absolute inset-0 bg-black/20" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center border border-white bg-black/70 text-base transition-colors group-hover:bg-black" aria-hidden="true">
              ▶
            </span>
          </span>
        </span>
        <span className="block border-t border-white/15 p-4">
          <span className="block text-[14px] font-semibold tracking-[0.04em] text-white/75">9:16 장면 · {message.durationLabel}</span>
          <span className="mt-1 block text-[17px] font-bold leading-6">{message.title}</span>
          <span className="mt-1 block text-[16px] leading-7 text-white/85">{message.description}</span>
        </span>
      </button>
    </article>
  );
}

const IMAGE_STATUS_LABEL: Record<StoryGeneratedImageMessage['status'], string> = {
  queued: '장면 대기 중',
  generating: '안전 확인 중',
  ready: '선택으로 만든 장면',
  failed: '장면을 보여줄 수 없어요',
};

function GeneratedImageMessage({ message }: { message: StoryGeneratedImageMessage }) {
  if (message.status === 'ready' && message.imageUrl) {
    return (
      <article className="ml-0 overflow-hidden border border-line bg-white min-[390px]:ml-[54px]">
        <div className="relative mx-auto aspect-[4/5] w-full max-w-[320px] overflow-hidden bg-mist">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={message.imageUrl} alt={message.imageAlt ?? message.title} className="h-full w-full object-cover" loading="lazy" decoding="async" />
        </div>
        <div className="border-t border-line p-4">
          <p className="text-[14px] font-semibold tracking-[0.04em] text-sage">{IMAGE_STATUS_LABEL.ready}</p>
          <h3 className="mt-1 text-[17px] font-bold leading-6 text-ink">{message.title}</h3>
          <p className="mt-1 text-[15px] leading-6 text-ink2">{message.description}</p>
        </div>
      </article>
    );
  }

  const isFailed = message.status === 'failed';

  return (
    <article
      className={`ml-0 border p-4 min-[390px]:ml-[54px] ${isFailed ? 'border-clay/40 bg-orange-50' : 'border-sages bg-white'}`}
      aria-live="polite"
    >
      <p className="text-[14px] font-semibold tracking-[0.04em] text-sage">{IMAGE_STATUS_LABEL[message.status]}</p>
      <h3 className="mt-1 text-[17px] font-bold text-ink">{message.title}</h3>
      <p className="mt-1 text-[15px] leading-6 text-ink2">{message.description}</p>
      {message.progressLabel && <p className="mt-2 text-[14px] leading-5 text-ink2">{message.progressLabel}</p>}
    </article>
  );
}

export default function StoryMessageRenderer({
  message,
  onChoice,
  onQuickReply,
  onPlayCinematic,
  interactionDisabled = false,
}: StoryMessageRendererProps) {
  switch (message.type) {
    case 'character_text':
      return <CharacterMessage message={message} />;
    case 'child_text':
      return <ChildMessage message={message} />;
    case 'notice':
      return <NoticeMessage message={message} />;
    case 'choice':
      return <ChoiceMessage message={message} onChoice={onChoice} disabled={interactionDisabled} />;
    case 'quick_replies':
      return <QuickRepliesMessage message={message} onQuickReply={onQuickReply} disabled={interactionDisabled} />;
    case 'cinematic':
      return <CinematicMessage message={message} onPlay={onPlayCinematic} />;
    case 'generated_image':
      return <GeneratedImageMessage message={message} />;
  }
}
