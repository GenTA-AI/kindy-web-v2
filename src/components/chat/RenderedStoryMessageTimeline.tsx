'use client';

import RenderedStoryMessageRenderer from '@/components/chat/RenderedStoryMessageRenderer';
import type { RenderedStoryMessageAction } from '@/lib/story-chat/rendered-message-ui';
import type { StoryChatRenderedMessage } from '@/types/story-chat-render';

export type RenderedStoryMessageTimelineProps = {
  messages: readonly StoryChatRenderedMessage[];
  onAction?: (action: RenderedStoryMessageAction) => void;
  interactionDisabled?: boolean;
  label?: string;
};

export default function RenderedStoryMessageTimeline({
  messages,
  onAction,
  interactionDisabled = false,
  label = '이야기 대화',
}: RenderedStoryMessageTimelineProps) {
  return (
    <ol
      className="mx-auto flex w-full max-w-[480px] flex-col gap-5 px-4 py-5"
      aria-label={label}
    >
      {messages.map((message) => (
        <li key={message.id}>
          <RenderedStoryMessageRenderer
            message={message}
            onAction={onAction}
            interactionDisabled={interactionDisabled}
          />
        </li>
      ))}
    </ol>
  );
}
