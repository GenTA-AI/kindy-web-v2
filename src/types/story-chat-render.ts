export type StoryChatRenderActor = {
  id: string;
  display_name: string;
  avatar: StoryChatRenderAsset | null;
};

/**
 * Browser-safe, short-lived media reference. Storage keys, content hashes, and
 * release-signing metadata intentionally never cross this boundary.
 */
export type StoryChatRenderAsset = {
  asset_id: string;
  url: string;
  expires_at: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
};

export type StoryChatRoomPresentation = {
  id: string;
  status:
    | 'invited'
    | 'active'
    | 'awaiting_child'
    | 'cinematic_ready'
    | 'generating_art'
    | 'paused'
    | 'chapter_complete'
    | 'locked';
  title: string;
  subtitle: string;
  summary: string;
  cover_alt_text: string;
  cover: StoryChatRenderAsset;
  primary_character: StoryChatRenderActor;
  current_node_id: string;
  revision: number;
  message_sequence: number;
  created_at: string;
  updated_at: string;
};

type StoryChatRenderedMessageBase = {
  id: string;
  room_id: string;
  sequence_no: number;
  actor: 'child' | 'character' | 'system';
  created_at: string;
};

export type StoryChatRenderedMessage =
  | (StoryChatRenderedMessageBase & {
      type: 'child_choice';
      source_node_id: string;
      option_id: string;
      label: string;
    })
  | (StoryChatRenderedMessageBase & {
      type: 'character_text';
      node_id: string;
      character: StoryChatRenderActor;
      text: string;
    })
  | (StoryChatRenderedMessageBase & {
      type: 'child_prompt';
      node_id: string;
      prompt: string;
      input_mode: 'authored_only';
    })
  | (StoryChatRenderedMessageBase & {
      type: 'choice';
      node_id: string;
      prompt: string;
      options: Array<{ id: string; label: string }>;
    })
  | (StoryChatRenderedMessageBase & {
      type: 'quick_reply';
      node_id: string;
      prompt: string;
      options: Array<{ id: string; label: string }>;
    })
  | (StoryChatRenderedMessageBase & {
      type: 'cinematic';
      node_id: string;
      title: string;
      description: string;
      video: StoryChatRenderAsset;
      poster: StoryChatRenderAsset;
      subtitles: StoryChatRenderAsset;
      autoplay: false;
      subtitles_default_on: true;
      can_replay: true;
    })
  | (StoryChatRenderedMessageBase & {
      type: 'generated_image';
      node_id: string;
      status: 'not_generated';
      alt_text: string;
      aspect_ratio: '4:5' | '9:16';
    })
  | (StoryChatRenderedMessageBase & {
      type: 'quiz';
      node_id: string;
      prompt: string;
      options: Array<{ id: string; label: string }>;
    })
  | (StoryChatRenderedMessageBase & {
      type: 'minigame';
      node_id: string;
      template: 'single_select' | 'sequence' | 'matching';
      prompt: string;
      items: Array<{
        id: string;
        label: string;
        media: StoryChatRenderAsset | null;
      }>;
    })
  | (StoryChatRenderedMessageBase & {
      type: 'system_transition';
      node_id: string;
      transition_kind: 'chapter' | 'safety_check' | 'session_break' | 'world_return';
      message: string;
    })
  | (StoryChatRenderedMessageBase & {
      type: 'ending';
      node_id: string;
      ending_kind: 'complete' | 'alternate' | 'return_later';
      summary: string;
    });

export type StoryChatRenderedMessagesResponse = {
  room: StoryChatRoomPresentation;
  messages: StoryChatRenderedMessage[];
  next_after: number;
};
