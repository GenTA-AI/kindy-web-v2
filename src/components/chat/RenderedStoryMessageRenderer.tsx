'use client';

import { useId, useRef, useState } from 'react';

import {
  rewindCinematic,
  toggleCinematicPlayback,
} from '@/lib/story-chat/cinematic-controls';
import {
  adaptRenderedStoryMessage,
  createRenderedStoryMessageAction,
  type RenderedStoryActorView,
  type RenderedStoryMessageAction,
  type RenderedStoryMessageView,
} from '@/lib/story-chat/rendered-message-ui';
import type { StoryChatRenderedMessage } from '@/types/story-chat-render';

export type RenderedStoryMessageRendererProps = {
  message: StoryChatRenderedMessage;
  onAction?: (action: RenderedStoryMessageAction) => void;
  interactionDisabled?: boolean;
};

const SELECTION_COPY = {
  choice: { eyebrow: '다음 행동', label: '이야기 선택' },
  quick_reply: { eyebrow: '바로 답하기', label: '빠른 답장' },
  quiz: { eyebrow: '생각 퀴즈', label: '퀴즈 답 선택' },
} as const;

const GAME_COPY = {
  single_select: '하나를 골라 보세요',
  sequence: '어떤 순서가 좋을지 하나씩 골라 보세요',
  matching: '서로 어울리는 단서를 찾아보세요',
} as const;

const TRANSITION_COPY = {
  chapter: '새 장으로 이동',
  safety_check: '잠깐, 안전 확인',
  session_break: '쉬어 갈 시간',
  world_return: '이야기 세계로 돌아옴',
} as const;

const ENDING_COPY = {
  complete: '오늘의 이야기 완료',
  alternate: '또 하나의 결말',
  return_later: '다음에 이어서',
} as const;

function RenderActorAvatar({ actor }: { actor: RenderedStoryActorView }) {
  const fallback = Array.from(actor.displayName.trim())[0] ?? '?';

  return (
    <span
      className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sages bg-sagebg text-[16px] font-bold text-saged"
      aria-hidden="true"
    >
      {actor.avatar ? (
        // Signed runtime media can use different hosts, so it intentionally bypasses next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={actor.avatar.url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : fallback}
    </span>
  );
}

function ChildChoiceBubble({ view }: {
  view: Extract<RenderedStoryMessageView, { kind: 'child_choice' }>;
}) {
  return (
    <div className="flex justify-end" data-message-kind={view.kind}>
      <div className="max-w-[82%] text-right">
        <div className="inline-block rounded-[18px] rounded-tr-sm bg-saged px-4 py-3 text-left text-[16px] font-medium leading-[1.6] text-white">
          {view.label}
        </div>
        <p className="mt-1.5 text-[12px] text-ink3">내가 고른 답</p>
      </div>
    </div>
  );
}

function CharacterBubble({ view }: {
  view: Extract<RenderedStoryMessageView, { kind: 'character_text' }>;
}) {
  return (
    <div className="flex items-start gap-2.5" data-message-kind={view.kind}>
      <RenderActorAvatar actor={view.character} />
      <div className="max-w-[82%]">
        <p className="mb-1.5 text-[13px] font-semibold text-ink2">
          {view.character.displayName}
        </p>
        <div className="rounded-[18px] rounded-tl-sm border border-line bg-white px-4 py-3 text-[16px] leading-[1.6] text-ink">
          {view.text}
        </div>
      </div>
    </div>
  );
}

function ChildPromptCard({ view }: {
  view: Extract<RenderedStoryMessageView, { kind: 'child_prompt' }>;
}) {
  return (
    <section
      className="ml-[54px] border border-sages bg-white px-4 py-4"
      aria-label="아이에게 건네는 질문"
      data-message-kind={view.kind}
    >
      <p className="text-[13px] font-semibold tracking-[0.06em] text-sage">네 생각은 어때?</p>
      <p className="mt-1 text-[17px] font-bold leading-7 text-ink">{view.prompt}</p>
      <p className="mt-2 text-[16px] leading-6 text-ink2">
        아래에 준비된 안전한 답을 골라 이야기해요.
      </p>
    </section>
  );
}

function SelectionCard({
  view,
  onAction,
  interactionDisabled,
}: {
  view: Extract<RenderedStoryMessageView, { kind: 'choice' | 'quick_reply' | 'quiz' }>;
  onAction?: RenderedStoryMessageRendererProps['onAction'];
  interactionDisabled: boolean;
}) {
  const copy = SELECTION_COPY[view.kind];
  const disabled = interactionDisabled || !onAction;

  return (
    <section
      className="ml-[54px] overflow-hidden border border-ink/20 bg-white"
      aria-label={copy.label}
      data-message-kind={view.kind}
    >
      <div className="border-b border-line px-4 py-4">
        <p className="text-[13px] font-semibold tracking-[0.06em] text-sage">{copy.eyebrow}</p>
        <h3 className="mt-1 text-[17px] font-bold leading-7 text-ink">{view.prompt}</h3>
      </div>
      <div className="divide-y divide-line">
        {view.options.map((option, index) => (
          <button
            type="button"
            key={option.id}
            disabled={disabled}
            onClick={() => onAction?.(createRenderedStoryMessageAction(view, option.id))}
            className="flex min-h-14 w-full items-center gap-3 bg-white px-4 py-3 text-left transition-colors hover:bg-mist disabled:cursor-default disabled:bg-mist disabled:text-ink3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-line text-[13px] font-bold text-saged" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="text-[16px] font-semibold leading-6 text-ink">{option.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function CinematicCard({ view }: {
  view: Extract<RenderedStoryMessageView, { kind: 'cinematic' }>;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const descriptionId = useId();
  const [playbackState, setPlaybackState] = useState<'ready' | 'playing' | 'paused' | 'ended'>('ready');
  const [playbackError, setPlaybackError] = useState(false);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;

    setPlaybackError(false);
    try {
      setPlaybackState(await toggleCinematicPlayback(video));
    } catch {
      setPlaybackError(true);
    }
  };

  const rewind = () => {
    const video = videoRef.current;
    if (!video) return;

    setPlaybackError(false);
    try {
      setPlaybackState(rewindCinematic(video));
    } catch {
      setPlaybackError(true);
    }
  };

  return (
    <article
      className="ml-[54px] overflow-hidden border border-ink/30 bg-ink text-white"
      data-message-kind={view.kind}
    >
      <div className="mx-auto aspect-[9/16] w-full max-w-[360px] bg-black">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          poster={view.poster.url}
          crossOrigin="anonymous"
          aria-label={`${view.title} 영상`}
          aria-describedby={descriptionId}
          onPlay={() => setPlaybackState('playing')}
          onPause={() => setPlaybackState((current) => current === 'ended' ? current : 'paused')}
          onEnded={() => setPlaybackState('ended')}
          onError={() => setPlaybackError(true)}
          className="h-full w-full object-contain"
        >
          <source src={view.video.url} type={view.video.mimeType} />
          <track
            src={view.subtitles.url}
            kind="subtitles"
            srcLang="ko"
            label="한국어"
            default
          />
          이 브라우저에서는 영상을 재생할 수 없어요.
        </video>
      </div>
      <div className="border-t border-white/15 px-4 py-4">
        <p className="text-[13px] font-semibold tracking-[0.06em] text-white/65">9:16 이야기 장면</p>
        <h3 className="mt-1 text-[18px] font-bold leading-7">{view.title}</h3>
        <p id={descriptionId} className="mt-1 text-[16px] leading-7 text-white/80">{view.description}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-white/15 p-4">
        <button
          type="button"
          onClick={togglePlayback}
          className="min-h-12 border border-white/45 px-3 text-[16px] font-bold transition-colors hover:bg-white/10"
        >
          {playbackState === 'playing' ? '일시정지' : '영상 재생'}
        </button>
        <button
          type="button"
          onClick={rewind}
          className="min-h-12 border border-white/45 px-3 text-[16px] font-bold transition-colors hover:bg-white/10"
        >
          처음으로 되감기
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {playbackError
          ? '영상을 재생할 수 없어요.'
          : playbackState === 'playing'
            ? '영상 재생 중'
            : playbackState === 'ended'
              ? '영상 재생 완료'
              : playbackState === 'paused'
                ? '영상 일시정지'
                : '영상 처음으로 이동'}
      </p>
    </article>
  );
}

function GeneratedImagePlaceholder({ view }: {
  view: Extract<RenderedStoryMessageView, { kind: 'generated_image' }>;
}) {
  const aspectClass = view.aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-[4/5]';

  return (
    <article
      className="ml-[54px] overflow-hidden border border-sages bg-white"
      data-message-kind={view.kind}
    >
      <div
        className={`mx-auto grid w-full max-w-[320px] place-items-center bg-sagebg ${aspectClass}`}
        role="img"
        aria-label={view.altText}
      >
        <div className="px-6 text-center">
          <span className="text-[28px]" aria-hidden="true">✦</span>
          <p className="mt-2 text-[16px] font-bold leading-6 text-saged">아직 만들지 않은 장면이에요</p>
        </div>
      </div>
      <div className="border-t border-line p-4">
        <p className="text-[13px] font-semibold tracking-[0.06em] text-sage">아이의 선택으로 만드는 이미지</p>
        <p className="mt-1 text-[16px] leading-7 text-ink2">{view.altText}</p>
      </div>
    </article>
  );
}

function MinigameCard({
  view,
  onAction,
  interactionDisabled,
}: {
  view: Extract<RenderedStoryMessageView, { kind: 'minigame' }>;
  onAction?: RenderedStoryMessageRendererProps['onAction'];
  interactionDisabled: boolean;
}) {
  const disabled = interactionDisabled || !onAction;

  return (
    <section
      className="ml-[54px] overflow-hidden border border-gold/60 bg-white"
      aria-label="이야기 미니게임"
      data-message-kind={view.kind}
    >
      <div className="border-b border-line bg-deep/60 px-4 py-4">
        <p className="text-[13px] font-semibold tracking-[0.06em] text-sage">이야기 미니게임</p>
        <h3 className="mt-1 text-[17px] font-bold leading-7 text-ink">{view.prompt}</h3>
        <p className="mt-1 text-[16px] leading-6 text-ink2">{GAME_COPY[view.template]}</p>
      </div>
      <div className="grid gap-2 p-3">
        {view.items.map((item) => (
          <button
            type="button"
            key={item.id}
            disabled={disabled}
            onClick={() => onAction?.(createRenderedStoryMessageAction(view, item.id))}
            className="flex min-h-14 w-full items-center gap-3 border border-line bg-white p-3 text-left transition-colors hover:bg-mist disabled:cursor-default disabled:bg-mist"
          >
            {item.media && item.media.mimeType.startsWith('image/') ? (
              // Signed runtime media can use different hosts, so it intentionally bypasses next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.media.url}
                alt=""
                className="h-12 w-12 shrink-0 object-contain"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center bg-sagebg text-[18px] text-saged" aria-hidden="true">?</span>
            )}
            <span className="text-[16px] font-semibold leading-6 text-ink">{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TransitionCard({ view }: {
  view: Extract<RenderedStoryMessageView, { kind: 'system_transition' }>;
}) {
  return (
    <section
      className="mx-auto max-w-[92%] border-y border-line px-3 py-4 text-center"
      role="status"
      data-message-kind={view.kind}
    >
      <p className="text-[13px] font-semibold tracking-[0.06em] text-sage">{TRANSITION_COPY[view.transitionKind]}</p>
      <p className="mt-1 text-[16px] font-semibold leading-7 text-ink">{view.message}</p>
    </section>
  );
}

function EndingCard({ view }: {
  view: Extract<RenderedStoryMessageView, { kind: 'ending' }>;
}) {
  return (
    <section
      className="ml-[54px] border border-sages bg-sagebg px-5 py-5"
      aria-label={ENDING_COPY[view.endingKind]}
      data-message-kind={view.kind}
    >
      <p className="text-[13px] font-semibold tracking-[0.06em] text-sage">{ENDING_COPY[view.endingKind]}</p>
      <h3 className="mt-1 text-[18px] font-bold leading-7 text-ink">이야기의 발자국</h3>
      <p className="mt-2 text-[16px] leading-7 text-ink2">{view.summary}</p>
    </section>
  );
}

export default function RenderedStoryMessageRenderer({
  message,
  onAction,
  interactionDisabled = false,
}: RenderedStoryMessageRendererProps) {
  const view = adaptRenderedStoryMessage(message);

  switch (view.kind) {
    case 'child_choice':
      return <ChildChoiceBubble view={view} />;
    case 'character_text':
      return <CharacterBubble view={view} />;
    case 'child_prompt':
      return <ChildPromptCard view={view} />;
    case 'choice':
    case 'quick_reply':
    case 'quiz':
      return (
        <SelectionCard
          view={view}
          onAction={onAction}
          interactionDisabled={interactionDisabled}
        />
      );
    case 'cinematic':
      return <CinematicCard view={view} />;
    case 'generated_image':
      return <GeneratedImagePlaceholder view={view} />;
    case 'minigame':
      return (
        <MinigameCard
          view={view}
          onAction={onAction}
          interactionDisabled={interactionDisabled}
        />
      );
    case 'system_transition':
      return <TransitionCard view={view} />;
    case 'ending':
      return <EndingCard view={view} />;
    default:
      return assertNever(view);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported rendered story message view: ${String(value)}`);
}
