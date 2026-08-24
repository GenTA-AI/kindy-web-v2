import type {
  StoryChatRenderActor,
  StoryChatRenderAsset,
  StoryChatRenderedMessage,
} from '@/types/story-chat-render';

export type RenderedStoryAssetView = {
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type RenderedStoryActorView = {
  id: string;
  displayName: string;
  avatar: RenderedStoryAssetView | null;
};

type RenderedStoryMessageViewBase = {
  id: string;
  sequenceNo: number;
  actor: 'child' | 'character' | 'system';
  createdAt: string;
};

type RenderedStoryOptionView = {
  id: string;
  label: string;
};

/**
 * Deliberately small UI view model. The adapter copies only fields a rendered
 * message needs, so a structurally wider object cannot accidentally leak quiz
 * answers, game solutions, release metadata, or signed-asset internals into a
 * component prop or client-side diagnostic.
 */
export type RenderedStoryMessageView =
  | (RenderedStoryMessageViewBase & {
      kind: 'child_choice';
      sourceNodeId: string;
      optionId: string;
      label: string;
    })
  | (RenderedStoryMessageViewBase & {
      kind: 'character_text';
      nodeId: string;
      character: RenderedStoryActorView;
      text: string;
    })
  | (RenderedStoryMessageViewBase & {
      kind: 'child_prompt';
      nodeId: string;
      prompt: string;
      inputMode: 'authored_only';
    })
  | (RenderedStoryMessageViewBase & {
      kind: 'choice' | 'quick_reply' | 'quiz';
      nodeId: string;
      prompt: string;
      options: RenderedStoryOptionView[];
    })
  | (RenderedStoryMessageViewBase & {
      kind: 'cinematic';
      nodeId: string;
      title: string;
      description: string;
      video: RenderedStoryAssetView;
      poster: RenderedStoryAssetView;
      subtitles: RenderedStoryAssetView;
      autoplay: false;
      subtitlesDefaultOn: true;
      canReplay: true;
    })
  | (RenderedStoryMessageViewBase & {
      kind: 'generated_image';
      nodeId: string;
      status: 'not_generated';
      altText: string;
      aspectRatio: '4:5' | '9:16';
    })
  | (RenderedStoryMessageViewBase & {
      kind: 'minigame';
      nodeId: string;
      template: 'single_select' | 'sequence' | 'matching';
      prompt: string;
      items: Array<{
        id: string;
        label: string;
        media: RenderedStoryAssetView | null;
      }>;
    })
  | (RenderedStoryMessageViewBase & {
      kind: 'system_transition';
      nodeId: string;
      transitionKind: 'chapter' | 'safety_check' | 'session_break' | 'world_return';
      message: string;
    })
  | (RenderedStoryMessageViewBase & {
      kind: 'ending';
      nodeId: string;
      endingKind: 'complete' | 'alternate' | 'return_later';
      summary: string;
    });

export type RenderedStoryMessageAction = {
  messageId: string;
  nodeId: string;
  kind: 'choice' | 'quick_reply' | 'quiz' | 'minigame';
  selectionId: string;
};

type ActionableRenderedStoryMessageView = Extract<
  RenderedStoryMessageView,
  { kind: 'choice' | 'quick_reply' | 'quiz' | 'minigame' }
>;

export function adaptRenderedStoryMessage(
  message: StoryChatRenderedMessage,
): RenderedStoryMessageView {
  const base: RenderedStoryMessageViewBase = {
    id: message.id,
    sequenceNo: message.sequence_no,
    actor: message.actor,
    createdAt: message.created_at,
  };

  switch (message.type) {
    case 'child_choice':
      return {
        ...base,
        kind: message.type,
        sourceNodeId: message.source_node_id,
        optionId: message.option_id,
        label: message.label,
      };
    case 'character_text':
      return {
        ...base,
        kind: message.type,
        nodeId: message.node_id,
        character: adaptActor(message.character),
        text: message.text,
      };
    case 'child_prompt':
      return {
        ...base,
        kind: message.type,
        nodeId: message.node_id,
        prompt: message.prompt,
        inputMode: 'authored_only',
      };
    case 'choice':
    case 'quick_reply':
    case 'quiz':
      return {
        ...base,
        kind: message.type,
        nodeId: message.node_id,
        prompt: message.prompt,
        options: message.options.map((option) => ({
          id: option.id,
          label: option.label,
        })),
      };
    case 'cinematic':
      return {
        ...base,
        kind: message.type,
        nodeId: message.node_id,
        title: message.title,
        description: message.description,
        video: adaptAsset(message.video),
        poster: adaptAsset(message.poster),
        subtitles: adaptAsset(message.subtitles),
        autoplay: false,
        subtitlesDefaultOn: true,
        canReplay: true,
      };
    case 'generated_image':
      return {
        ...base,
        kind: message.type,
        nodeId: message.node_id,
        status: 'not_generated',
        altText: message.alt_text,
        aspectRatio: message.aspect_ratio,
      };
    case 'minigame':
      return {
        ...base,
        kind: message.type,
        nodeId: message.node_id,
        template: message.template,
        prompt: message.prompt,
        items: message.items.map((item) => ({
          id: item.id,
          label: item.label,
          media: item.media ? adaptAsset(item.media) : null,
        })),
      };
    case 'system_transition':
      return {
        ...base,
        kind: message.type,
        nodeId: message.node_id,
        transitionKind: message.transition_kind,
        message: message.message,
      };
    case 'ending':
      return {
        ...base,
        kind: message.type,
        nodeId: message.node_id,
        endingKind: message.ending_kind,
        summary: message.summary,
      };
    default:
      return assertNever(message);
  }
}

export function adaptRenderedStoryMessages(
  messages: readonly StoryChatRenderedMessage[],
): RenderedStoryMessageView[] {
  return messages.map(adaptRenderedStoryMessage);
}

export function createRenderedStoryMessageAction(
  view: ActionableRenderedStoryMessageView,
  selectionId: string,
): RenderedStoryMessageAction {
  const availableSelections = view.kind === 'minigame' ? view.items : view.options;
  if (!availableSelections.some((selection) => selection.id === selectionId)) {
    throw new Error('Unknown rendered story selection');
  }

  return {
    messageId: view.id,
    nodeId: view.nodeId,
    kind: view.kind,
    selectionId,
  };
}

function adaptActor(actor: StoryChatRenderActor): RenderedStoryActorView {
  return {
    id: actor.id,
    displayName: actor.display_name,
    avatar: actor.avatar ? adaptAsset(actor.avatar) : null,
  };
}

function adaptAsset(asset: StoryChatRenderAsset): RenderedStoryAssetView {
  return {
    url: asset.url,
    mimeType: asset.mime_type,
    width: asset.width,
    height: asset.height,
    durationMs: asset.duration_ms,
  };
}

function assertNever(value: never): never {
  throw new Error(`Unsupported rendered story message: ${String(value)}`);
}
