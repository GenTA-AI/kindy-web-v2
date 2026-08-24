import { z } from 'zod';

const UuidSchema = z.string().uuid();
const AuthoredIdSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/);

export const StoryChatChildIdSchema = UuidSchema;
export const StoryChatRoomIdSchema = UuidSchema;

export const StoryChatMessagesQuerySchema = z.object({
  child_id: UuidSchema,
  after: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
}).strict();

const StoryChatTurnBaseSchema = z.object({
  child_id: UuidSchema,
  session_id: UuidSchema,
  client_turn_id: UuidSchema,
  expected_revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
});

const AuthoredSelectionSchema = z.object({
  node_id: AuthoredIdSchema,
  option_id: AuthoredIdSchema,
});

export const StoryChatTurnRequestSchema = z.discriminatedUnion('kind', [
  StoryChatTurnBaseSchema.extend({
    kind: z.literal('choice'),
    selection: AuthoredSelectionSchema,
  }).strict(),
  StoryChatTurnBaseSchema.extend({
    kind: z.literal('quick_reply'),
    selection: AuthoredSelectionSchema,
  }).strict(),
  StoryChatTurnBaseSchema.extend({
    kind: z.literal('free_text'),
    node_id: AuthoredIdSchema,
    text: z.string().trim().min(1).max(240),
  }).strict(),
]);

export type StoryChatTurnRequest = z.infer<typeof StoryChatTurnRequestSchema>;
export type StoryChatAuthoredTurnRequest = Extract<
  StoryChatTurnRequest,
  { kind: 'choice' | 'quick_reply' }
>;

export type StoryChatReleaseChannel = 'staging' | 'production';

export type StoryChatRoomRecord = {
  id: string;
  childId: string;
  experienceId: string;
  releaseId: string;
  releaseVersion: string;
  releaseChannel: StoryChatReleaseChannel;
  releaseManifestSha256: string;
  currentNodeId: string;
  status:
    | 'invited'
    | 'active'
    | 'awaiting_child'
    | 'cinematic_ready'
    | 'generating_art'
    | 'paused'
    | 'chapter_complete'
    | 'locked';
  revision: number;
  messageSequence: number;
  createdAt: string;
  updatedAt: string;
};

export type StoryChatMessageActor = 'child' | 'character' | 'system';

export type StoryChatMessageKind =
  | 'child_choice'
  | 'character_text'
  | 'child_prompt'
  | 'choice'
  | 'quick_reply'
  | 'cinematic'
  | 'generated_image'
  | 'quiz'
  | 'minigame'
  | 'system_transition'
  | 'ending';

export type StoryChatMessageRecord = {
  id: string;
  roomId: string;
  sessionId: string;
  turnId: string | null;
  sequenceNo: number;
  actor: StoryChatMessageActor;
  messageKind: StoryChatMessageKind;
  authoredContentId: string;
  authoredContextId: string | null;
  createdAt: string;
};

export type StoryChatSessionRecord = {
  id: string;
  roomId: string;
  openedRevision: number;
  closedRevision: number | null;
  startedAt: string;
  endedAt: string | null;
};

export type StoryChatTurnRecord = {
  id: string;
  roomId: string;
  sessionId: string;
  clientTurnId: string;
  requestSha256: string;
  sourceKind: 'choice' | 'quick_reply';
  authoredInputId: string;
  fromNodeId: string;
  toNodeId: string;
  expectedRevision: number;
  committedRevision: number;
  createdAt: string;
  messages: StoryChatMessageRecord[];
};

export type StoryChatCommittedTurnResponse = {
  kind: 'committed';
  turn_id: string;
  client_turn_id: string;
  committed_revision: number;
  from_node_id: string;
  current_node_id: string;
  last_message_sequence: number;
  idempotent_replay: boolean;
  messages: StoryChatApiMessage[];
};

export type StoryChatFreeTextFallbackResponse = {
  kind: 'authored_fallback';
  code: 'free_text_disabled';
  current_node_id: string;
  revision: number;
  message: string;
};

export type StoryChatApiRoom = {
  id: string;
  child_id: string;
  experience_id: string;
  release_id: string;
  release_version: string;
  release_manifest_sha256: string;
  current_node_id: string;
  status: StoryChatRoomRecord['status'];
  revision: number;
  message_sequence: number;
  created_at: string;
  updated_at: string;
};

export type StoryChatApiMessage = {
  id: string;
  room_id: string;
  session_id: string;
  turn_id: string | null;
  sequence_no: number;
  actor: StoryChatMessageActor;
  message_kind: StoryChatMessageKind;
  authored_content_id: string;
  authored_context_id: string | null;
  created_at: string;
};

export function toStoryChatApiRoom(room: StoryChatRoomRecord): StoryChatApiRoom {
  return {
    id: room.id,
    child_id: room.childId,
    experience_id: room.experienceId,
    release_id: room.releaseId,
    release_version: room.releaseVersion,
    release_manifest_sha256: room.releaseManifestSha256,
    current_node_id: room.currentNodeId,
    status: room.status,
    revision: room.revision,
    message_sequence: room.messageSequence,
    created_at: room.createdAt,
    updated_at: room.updatedAt,
  };
}

export function toStoryChatApiMessage(
  message: StoryChatMessageRecord,
): StoryChatApiMessage {
  return {
    id: message.id,
    room_id: message.roomId,
    session_id: message.sessionId,
    turn_id: message.turnId,
    sequence_no: message.sequenceNo,
    actor: message.actor,
    message_kind: message.messageKind,
    authored_content_id: message.authoredContentId,
    authored_context_id: message.authoredContextId,
    created_at: message.createdAt,
  };
}
