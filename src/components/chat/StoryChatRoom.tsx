'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChatAvatar from '@/components/chat/ChatAvatar';
import ChatComposer from '@/components/chat/ChatComposer';
import StoryMessageRenderer from '@/components/chat/StoryMessageRenderer';
import type {
  StoryCharacterTextMessage,
  StoryChatMessage,
  StoryChatRoomData,
  StoryChoiceOption,
  StoryCinematicMessage,
  StoryQuickReply,
} from '@/types/story-chat';

interface StoryChatRoomProps {
  room: StoryChatRoomData;
  onBack?: () => void;
  backHref?: string;
  embedded?: boolean;
  onSendMessage?: (text: string) => void;
  onChoiceSelected?: (messageId: string, option: StoryChoiceOption) => void;
}

type StoryPhase = 'choice' | 'responding' | 'open' | 'complete';

interface DemoSafetyReview {
  text: string;
  submittedAt: number;
}

const CHOICE_CHILD_TEXT: Record<string, string> = {
  'follow-dog': '강아지를 따라가자. 내가 먼저 갈게.',
  'check-parasol': '양산부터 살펴보자. 색점이 숨어 있을지도 몰라.',
  'ask-mori': '모리야, 우리가 놓친 단서가 있는지 같이 생각해 보자.',
};

const CHOICE_MORI_TEXT: Record<string, string> = {
  'follow-dog': '좋아. 내가 바로 뒤를 지킬게. 잠깐, 강아지가 색점 폭풍 속으로 뛰어들었어!',
  'check-parasol': '양산 아래에 노란 발자국이 있어. 강아지가 그 길 끝의 색점 폭풍으로 달려가고 있어!',
  'ask-mori': '점들이 한쪽으로 흐르고 있어. 저 강아지도 같은 방향을 보고 있네. 색점 폭풍까지 함께 가 보자!',
};

const CHOICE_MEMORY_TEXT: Record<string, string> = {
  'follow-dog': '강아지를 따라가 노란 색점을 발견한 순간이에요.',
  'check-parasol': '양산 아래에서 노란 발자국과 색점의 흐름을 발견한 순간이에요.',
  'ask-mori': '모리와 점들의 방향을 비교해 색점 폭풍의 길을 찾아낸 순간이에요.',
};

function personalizeAuthoredTail(
  tail: readonly StoryChatMessage[],
  option: StoryChoiceOption,
): StoryChatMessage[] {
  return tail.map((message) => {
    if (message.type === 'generated_image' && message.id === 'first-memory') {
      return {
        ...message,
        title: `${option.label} — 서연이의 단서`,
        description: CHOICE_MEMORY_TEXT[option.id] ?? message.description,
      };
    }

    if (message.type === 'cinematic') {
      return {
        ...message,
        description: `${option.label} 선택으로 이어진 5초 장면이에요. 9:16 세로 화면 안에서 단서를 찾아보세요.`,
      };
    }

    return message;
  });
}

function BackIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ReplayIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6" />
      <path strokeLinecap="round" d="M5.5 15a7.5 7.5 0 1 0 .7-7.7L4 10" />
    </svg>
  );
}

function CinematicStage({
  cinematic,
  onReturn,
  embedded = false,
}: {
  cinematic: StoryCinematicMessage;
  onReturn: () => void;
  embedded?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const returnButtonRef = useRef<HTMLButtonElement | null>(null);
  const [hasEnded, setHasEnded] = useState(false);

  useEffect(() => {
    const previousActiveElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    returnButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onReturn();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), video[controls], [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [onReturn]);

  const replay = () => {
    const video = videoRef.current;
    if (!video) return;

    setHasEnded(false);
    video.currentTime = 0;
    void video.play().catch(() => undefined);
  };

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[100] bg-[#101210]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cinematic-title"
      aria-describedby="cinematic-description"
    >
      <div className="mx-auto flex h-dvh w-full max-w-[480px] flex-col border-x border-white/10 bg-[#101210] text-white">
        <header className={`flex shrink-0 items-center justify-between gap-4 border-b border-white/15 px-5 pb-4 ${embedded ? 'pt-4' : 'pt-[max(18px,env(safe-area-inset-top))]'}`}>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold tracking-[0.04em] text-white/75">9:16 이야기 장면</p>
            <h2 id="cinematic-title" className="mt-1 truncate text-[18px] font-bold">{cinematic.title}</h2>
          </div>
          <button
            ref={returnButtonRef}
            type="button"
            onClick={onReturn}
            className="min-h-12 shrink-0 touch-manipulation border border-white/50 px-4 text-[16px] font-semibold text-white transition-colors hover:bg-white hover:text-ink"
          >
            대화로
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[390px] bg-black">
            <video
              ref={videoRef}
              src={cinematic.videoUrl}
              poster={cinematic.posterUrl}
              controls
              playsInline
              preload="metadata"
              onPlay={() => setHasEnded(false)}
              onEnded={() => setHasEnded(true)}
              className="h-full w-full object-contain"
            >
              {cinematic.subtitlesUrl && (
                <track
                  src={cinematic.subtitlesUrl}
                  kind="subtitles"
                  srcLang="ko"
                  label="한국어"
                  default
                />
              )}
              이 브라우저에서는 영상을 재생할 수 없어요.
            </video>
            {hasEnded && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/55" aria-live="polite">
                <p className="border border-white/50 bg-black/75 px-4 py-3 text-[16px] font-semibold">장면이 끝났어요</p>
              </div>
            )}
          </div>
          <div className="px-5 py-5">
            <p id="cinematic-description" className="text-[16px] leading-7 text-white/90">{cinematic.description}</p>
            <p className="mt-2 text-[14px] leading-6 text-white/75">재생 버튼을 직접 눌러 시작해요. 준비됐을 때 대화로 돌아가면 다음 장면이 이어져요.</p>
          </div>
        </div>

        <footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-white/15 px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-4">
          <button
            type="button"
            onClick={replay}
            className="flex min-h-12 touch-manipulation items-center justify-center gap-2 border border-white/50 text-[16px] font-semibold transition-colors hover:bg-white/10"
          >
            <ReplayIcon />
            다시 보기
          </button>
          <button
            type="button"
            onClick={onReturn}
            className="min-h-12 touch-manipulation bg-white px-4 text-[16px] font-bold text-ink transition-colors hover:bg-cream"
          >
            대화로 돌아가기
          </button>
        </footer>
      </div>
    </div>
  );
}

function SafetyReviewPanel({
  onContinue,
  onFinish,
}: {
  onContinue: () => void;
  onFinish: () => void;
}) {
  return (
    <section className="ml-0 border border-sages bg-white p-4 min-[390px]:ml-[54px]" role="status" aria-live="polite">
      <p className="text-[14px] font-semibold tracking-[0.04em] text-sage">안전 확인 단계</p>
      <h3 className="mt-1 text-[17px] font-bold leading-6 text-ink">답장을 만들기 전에 내용을 확인해요</h3>
      <p className="mt-2 text-[16px] leading-7 text-ink2">
        실제 서비스에서는 개인정보와 위험한 표현을 먼저 확인합니다. 이 시제품은 방금 쓴 말을 저장하거나 AI로 보내지 않았어요.
      </p>
      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="min-h-12 touch-manipulation bg-saged px-4 text-[16px] font-bold text-white transition-colors hover:bg-ink"
        >
          승인된 예시 답장으로 계속
        </button>
        <button
          type="button"
          onClick={onFinish}
          className="min-h-12 touch-manipulation border border-line px-4 text-[16px] font-semibold text-ink2 transition-colors hover:bg-mist"
        >
          오늘은 여기까지
        </button>
      </div>
    </section>
  );
}

function replyFor(text: string) {
  if (text.includes('보라') || text.includes('색')) {
    return '가까이서는 서로 다른 점인데, 조금 떨어져 보니 우리 눈에서 새 색처럼 섞여 보여. 쇠라가 실험했던 방식이야.';
  }

  if (text.includes('강물') || text.includes('비춰')) {
    return '강물에 비추니 떨어져 있던 색점이 하나의 빛처럼 보여. 가까이 볼 때와 멀리 볼 때 그림이 달라지는 게 오늘의 단서야.';
  }

  return '네 생각을 오늘의 단서로 남겨 둘게. 가까이서는 점이 보이고, 멀리서는 장면이 보인다는 걸 함께 찾아냈어.';
}

function makeEnding(timestamp: number): StoryChatMessage {
  return {
    id: `chapter-ending-${timestamp}`,
    type: 'notice',
    eyebrow: '오늘의 기록',
    title: '오늘은 여기까지',
    body: '서연이는 색점이 눈에서 섞여 보이는 비밀을 발견했어요. 다음에 이 방으로 돌아오면 탐정단의 두 번째 단서부터 이어집니다.',
  };
}

export default function StoryChatRoom({
  room,
  onBack,
  backHref = '/chats',
  embedded = false,
  onSendMessage,
  onChoiceSelected,
}: StoryChatRoomProps) {
  const initialChoiceIndex = room.messages.findIndex((message) => message.type === 'choice' && !message.selectedOptionId);
  const [messages, setMessages] = useState<StoryChatMessage[]>(() => (
    initialChoiceIndex >= 0
      ? room.messages.slice(0, initialChoiceIndex + 1)
      : [...room.messages]
  ));
  const [phase, setPhase] = useState<StoryPhase>(initialChoiceIndex >= 0 ? 'choice' : 'open');
  const [activeCinematic, setActiveCinematic] = useState<StoryCinematicMessage | null>(null);
  const [safetyReview, setSafetyReview] = useState<DemoSafetyReview | null>(null);
  const [resolvedQuickReplies, setResolvedQuickReplies] = useState<Set<string>>(() => new Set());
  const rootRef = useRef<HTMLElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const authoredTailRef = useRef<StoryChatMessage[]>(
    initialChoiceIndex >= 0 ? room.messages.slice(initialChoiceIndex + 1) : [],
  );
  const scheduledTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const choiceInFlightRef = useRef(false);
  const expandedCinematicsRef = useRef<Set<string>>(new Set());
  const primaryActor = room.preview.participants[0];
  const isNotice = room.preview.kind === 'notice';

  const scrollMessageIntoView = useCallback((messageId: string) => {
    requestAnimationFrame(() => {
      const messageElement = Array.from(
        timelineRef.current?.querySelectorAll<HTMLElement>('[data-story-message-id]') ?? [],
      ).find((element) => element.dataset.storyMessageId === messageId);

      messageElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, []);

  const scrollToLatest = useCallback(() => {
    requestAnimationFrame(() => {
      const timeline = timelineRef.current;
      timeline?.scrollTo({ top: timeline.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  const appendMessageOnce = useCallback((message: StoryChatMessage) => {
    setMessages((current) => (
      current.some((candidate) => candidate.id === message.id)
        ? current
        : [...current, message]
    ));
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const viewport = window.visualViewport;
    const previousBodyOverflow = document.body.style.overflow;
    const previousOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';

    const updateViewport = () => {
      if (!root) return;

      const visibleHeight = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const layoutHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
      const keyboardVisible = layoutHeight - visibleHeight - offsetTop > 120;

      if (!embedded) {
        root.style.setProperty('--chat-viewport-height', `${Math.round(visibleHeight)}px`);
        root.style.setProperty('--chat-viewport-offset-top', `${Math.round(offsetTop)}px`);
      }
      root.dataset.keyboardVisible = keyboardVisible ? 'true' : 'false';

      if (document.activeElement?.closest('[data-chat-composer]')) {
        const timeline = timelineRef.current;
        requestAnimationFrame(() => {
          timeline?.scrollTo({ top: timeline.scrollHeight });
        });
      }
    };

    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);

    return () => {
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousOverscroll;
    };
  }, [embedded]);

  useEffect(() => () => {
    scheduledTimersRef.current.forEach(clearTimeout);
  }, []);

  const roomStatus = useMemo(() => {
    if (isNotice) return '읽기 전용 안내방';
    if (phase === 'complete') return '오늘의 이야기 완료';
    if (phase === 'responding') return '모리가 다음 장면을 준비하는 중';
    return '모리와 이야기 중 · 체험판';
  }, [isNotice, phase]);

  const appendEnding = (text: string, timestamp = Date.now()) => {
    if (!primaryActor) return;

    scheduledTimersRef.current.forEach(clearTimeout);
    scheduledTimersRef.current = [];

    const reply: StoryCharacterTextMessage = {
      id: `authored-character-${timestamp}`,
      type: 'character_text',
      actor: primaryActor,
      text: replyFor(text),
      createdAtLabel: '지금',
    };

    const ending = makeEnding(timestamp);
    setMessages((current) => [...current, reply, ending]);
    setSafetyReview(null);
    setPhase('complete');
    scrollMessageIntoView(ending.id);
  };

  const continueAfterSafetyReview = () => {
    if (!safetyReview || !primaryActor) return;

    if (phase === 'choice') {
      const hint: StoryCharacterTextMessage = {
        id: `authored-hint-${safetyReview.submittedAt}`,
        type: 'character_text',
        actor: primaryActor,
        text: '그 생각도 단서가 될 수 있어. 먼저 세 가지 행동 중 하나를 골라서 확인해 보자.',
        createdAtLabel: '지금',
      };
      setMessages((current) => [...current, hint]);
      setSafetyReview(null);
      scrollMessageIntoView(hint.id);
      return;
    }

    appendEnding(safetyReview.text, safetyReview.submittedAt);
  };

  const sendMessage = (text: string) => {
    if (isNotice || phase === 'complete' || phase === 'responding' || safetyReview) return;

    const submittedAt = Date.now();
    const localMessage: StoryChatMessage = {
      id: `local-child-${submittedAt}`,
      type: 'child_text',
      actor: room.child,
      text,
      delivery: onSendMessage ? 'pending' : 'sent',
      createdAtLabel: '지금',
    };

    setMessages((current) => [...current, localMessage]);
    setSafetyReview({ text, submittedAt });
    scrollToLatest();
    onSendMessage?.(text);
  };

  const selectChoice = (messageId: string, option: StoryChoiceOption) => {
    if (phase !== 'choice' || choiceInFlightRef.current) return;
    choiceInFlightRef.current = true;

    const selectedAt = Date.now();
    const childMessage: StoryChatMessage = {
      id: `choice-child-${selectedAt}`,
      type: 'child_text',
      actor: room.child,
      text: CHOICE_CHILD_TEXT[option.id] ?? option.label,
      delivery: 'sent',
      createdAtLabel: '지금',
    };
    const characterMessage: StoryChatMessage | null = primaryActor ? {
      id: `choice-character-${selectedAt}`,
      type: 'character_text',
      actor: primaryActor,
      text: CHOICE_MORI_TEXT[option.id] ?? '좋아. 그 선택으로 다음 장면이 열렸어.',
      createdAtLabel: '지금',
    } : null;

    const personalizedTail = personalizeAuthoredTail(
      initialChoiceIndex >= 0 ? room.messages.slice(initialChoiceIndex + 1) : [],
      option,
    );
    authoredTailRef.current = personalizedTail;

    setMessages((current) => {
      const choiceIndex = current.findIndex((message) => message.id === messageId);
      if (choiceIndex < 0) return current;

      const selectedChoice = current[choiceIndex];
      if (selectedChoice.type !== 'choice' || selectedChoice.selectedOptionId) return current;

      const updatedChoice = { ...selectedChoice, selectedOptionId: option.id };
      return [
        ...current.slice(0, choiceIndex),
        updatedChoice,
        ...current.slice(choiceIndex + 1),
        childMessage,
      ];
    });
    setPhase('responding');
    scrollMessageIntoView(childMessage.id);

    if (characterMessage) {
      const characterTimer = setTimeout(() => {
        appendMessageOnce(characterMessage);
        scrollMessageIntoView(characterMessage.id);
      }, 450);
      scheduledTimersRef.current.push(characterTimer);
    }

    const cinematic = personalizedTail[0];
    const cinematicTimer = setTimeout(() => {
      if (cinematic) {
        appendMessageOnce(cinematic);
        scrollMessageIntoView(cinematic.id);
      }
      choiceInFlightRef.current = false;
      setPhase('open');
    }, 1050);
    scheduledTimersRef.current.push(cinematicTimer);
    onChoiceSelected?.(messageId, option);
  };

  const returnFromCinematic = useCallback(() => {
    const cinematicId = activeCinematic?.id;
    setActiveCinematic(null);
    if (!cinematicId) return;
    if (expandedCinematicsRef.current.has(cinematicId)) return;
    expandedCinematicsRef.current.add(cinematicId);

    const tail = authoredTailRef.current;
    const cinematicIndex = tail.findIndex((message) => message.id === cinematicId);
    if (cinematicIndex < 0) return;

    const remainingTail = tail.slice(cinematicIndex + 1);
    if (remainingTail.length === 0) return;

    setPhase('responding');
    remainingTail.forEach((message, index) => {
      const timer = setTimeout(() => {
        appendMessageOnce(message);
        scrollMessageIntoView(message.id);
        if (index === remainingTail.length - 1) {
          setPhase('open');
        }
      }, 250 + index * 450);
      scheduledTimersRef.current.push(timer);
    });
  }, [activeCinematic, appendMessageOnce, scrollMessageIntoView]);

  const selectQuickReply = (messageId: string, reply: StoryQuickReply) => {
    if (resolvedQuickReplies.has(messageId) || phase === 'complete' || safetyReview) return;

    const selectedAt = Date.now();
    const childMessage: StoryChatMessage = {
      id: `quick-child-${selectedAt}`,
      type: 'child_text',
      actor: room.child,
      text: reply.label,
      delivery: 'sent',
      createdAtLabel: '지금',
    };

    setResolvedQuickReplies((current) => new Set(current).add(messageId));
    setMessages((current) => [...current, childMessage]);
    appendEnding(reply.label, selectedAt);
  };

  const finishFromSafetyReview = () => {
    if (!safetyReview) return;
    scheduledTimersRef.current.forEach(clearTimeout);
    scheduledTimersRef.current = [];
    setSafetyReview(null);
    const ending = makeEnding(safetyReview.submittedAt);
    setMessages((current) => [...current, ending]);
    setPhase('complete');
    scrollMessageIntoView(ending.id);
  };

  const composerConfig = phase === 'complete'
    ? {
      mode: 'read_only' as const,
      placeholder: '오늘의 모험은 여기까지예요',
      helperText: '다음에 이 방으로 돌아오면 이어서 시작할 수 있어요.',
    }
    : room.composer;

  return (
    <>
      <main
        ref={rootRef}
        className={`${embedded
          ? 'relative h-full'
          : 'fixed inset-x-0 top-[var(--chat-viewport-offset-top,0px)] h-[var(--chat-viewport-height,100dvh)]'
        } overflow-hidden bg-[#F1EEE7] text-ink`}
        aria-hidden={activeCinematic ? true : undefined}
      >
        <div className="mx-auto flex h-full w-full max-w-[480px] flex-col bg-cream md:border-x md:border-line">
        <header className={`z-20 flex shrink-0 items-center gap-3 border-b border-line bg-cream px-3 pb-3 ${embedded ? 'pt-3' : 'pt-[max(12px,env(safe-area-inset-top))]'}`}>
          {onBack ? (
            <button type="button" onClick={onBack} className="flex h-12 w-12 shrink-0 touch-manipulation items-center justify-center text-ink transition-colors hover:bg-mist" aria-label="대화방 목록으로 돌아가기">
              <BackIcon />
            </button>
          ) : (
            <Link href={backHref} className="flex h-12 w-12 shrink-0 touch-manipulation items-center justify-center text-ink transition-colors hover:bg-mist" aria-label="대화방 목록으로 돌아가기">
              <BackIcon />
            </Link>
          )}

          {primaryActor && <ChatAvatar actor={primaryActor} size="md" decorative />}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-bold text-ink">{room.preview.title}</h1>
            <p className="mt-0.5 truncate text-[14px] text-ink2">{roomStatus}</p>
          </div>
        </header>

        <div
          ref={timelineRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#F3F0E9] px-4 py-5 [scrollbar-width:none] [scroll-padding-block:20px] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
          role="log"
          aria-label={`${room.preview.title} 대화 내용`}
          aria-live="polite"
          aria-relevant="additions text"
          aria-busy={phase === 'responding'}
        >
          <div className="space-y-5">
            {messages.map((message) => (
              <div
                key={message.id}
                data-story-message-id={message.id}
                className="scroll-m-5"
              >
                <StoryMessageRenderer
                  message={message}
                  interactionDisabled={
                    phase === 'complete'
                    || phase === 'responding'
                    || Boolean(safetyReview)
                    || (message.type === 'quick_replies' && resolvedQuickReplies.has(message.id))
                  }
                  onChoice={selectChoice}
                  onQuickReply={selectQuickReply}
                  onPlayCinematic={setActiveCinematic}
                />
              </div>
            ))}
            {safetyReview && (
              <SafetyReviewPanel
                onContinue={continueAfterSafetyReview}
                onFinish={finishFromSafetyReview}
              />
            )}
            <div className="h-px" aria-hidden="true" />
          </div>
        </div>

        <div className="z-20 shrink-0">
          <ChatComposer
            config={composerConfig}
            onSend={sendMessage}
            pending={Boolean(safetyReview) || phase === 'responding'}
          />
        </div>
        </div>
      </main>

      {activeCinematic && (
        <CinematicStage cinematic={activeCinematic} embedded={embedded} onReturn={returnFromCinematic} />
      )}
    </>
  );
}
