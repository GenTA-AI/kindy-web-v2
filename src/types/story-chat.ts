export type StoryChatAccent = 'sage' | 'gold' | 'clay' | 'sky' | 'ink';

export type StoryChatActorRole = 'character' | 'child' | 'system';

export interface StoryChatActor {
  id: string;
  name: string;
  role: StoryChatActorRole;
  avatarUrl?: string;
  avatarFallback: string;
  accent: StoryChatAccent;
}

export type StoryChatRoomKind = 'world_invite' | 'notice';

export type StoryChatRoomState =
  | 'invited'
  | 'active'
  | 'awaiting_child'
  | 'cinematic_ready'
  | 'generating_art'
  | 'paused'
  | 'chapter_complete'
  | 'locked';

export interface StoryChatRoomPreview {
  id: string;
  kind: StoryChatRoomKind;
  state: StoryChatRoomState;
  title: string;
  subtitle: string;
  lastMessage: string;
  updatedLabel: string;
  href: string;
  badge?: string;
  coverUrl?: string;
  participants: StoryChatActor[];
}

interface StoryChatMessageBase {
  id: string;
  createdAtLabel?: string;
}

export interface StoryCharacterTextMessage extends StoryChatMessageBase {
  type: 'character_text';
  actor: StoryChatActor;
  text: string;
}

export interface StoryChildTextMessage extends StoryChatMessageBase {
  type: 'child_text';
  actor: StoryChatActor;
  text: string;
  delivery?: 'pending' | 'sent' | 'failed';
}

export interface StoryNoticeMessage extends StoryChatMessageBase {
  type: 'notice';
  eyebrow?: string;
  title: string;
  body: string;
  icon?: string;
}

export interface StoryChoiceOption {
  id: string;
  label: string;
  hint?: string;
  icon?: string;
}

export interface StoryChoiceMessage extends StoryChatMessageBase {
  type: 'choice';
  eyebrow?: string;
  prompt: string;
  options: StoryChoiceOption[];
  selectedOptionId?: string;
}

export interface StoryQuickReply {
  id: string;
  label: string;
}

export interface StoryQuickRepliesMessage extends StoryChatMessageBase {
  type: 'quick_replies';
  label?: string;
  replies: StoryQuickReply[];
}

export interface StoryCinematicMessage extends StoryChatMessageBase {
  type: 'cinematic';
  title: string;
  description: string;
  videoUrl: string;
  posterUrl?: string;
  subtitlesUrl?: string;
  durationLabel: string;
  watched?: boolean;
}

export type StoryGeneratedImageStatus = 'queued' | 'generating' | 'ready' | 'failed';

export interface StoryGeneratedImageMessage extends StoryChatMessageBase {
  type: 'generated_image';
  status: StoryGeneratedImageStatus;
  title: string;
  description: string;
  imageUrl?: string;
  imageAlt?: string;
  progressLabel?: string;
}

export type StoryChatMessage =
  | StoryCharacterTextMessage
  | StoryChildTextMessage
  | StoryNoticeMessage
  | StoryChoiceMessage
  | StoryQuickRepliesMessage
  | StoryCinematicMessage
  | StoryGeneratedImageMessage;

export interface StoryChatComposerConfig {
  mode: 'chat' | 'read_only';
  placeholder: string;
  maxLength?: number;
  helperText?: string;
}

export interface StoryChatRoomData {
  preview: StoryChatRoomPreview;
  child: StoryChatActor;
  messages: StoryChatMessage[];
  composer: StoryChatComposerConfig;
}
