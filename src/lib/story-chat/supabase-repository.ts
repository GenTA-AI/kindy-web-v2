import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type {
  StoryChatMessageRecord,
  StoryChatRoomRecord,
  StoryChatSessionRecord,
  StoryChatTurnRecord,
} from '@/types/story-chat-api';
import {
  mapAuthoredCommitDatabaseError,
  StoryChatRuntimeError,
  type ApprovedStoryGraphProvider,
  type StoryChatCommitInput,
  type StoryChatCommitResult,
  type StoryChatRepository,
} from './authored-runtime';

type StoryChatSupabaseClient = Pick<SupabaseClient, 'from' | 'rpc'>;

const SafeIntegerSchema = z.union([
  z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  z.string().regex(/^\d+$/).transform((value, context) => {
    const number = Number(value);
    if (!Number.isSafeInteger(number)) {
      context.addIssue({ code: 'custom', message: 'integer exceeds JavaScript safe range' });
      return z.NEVER;
    }
    return number;
  }),
]);

const TimestampSchema = z.string().datetime({ offset: true });

const RoomRowSchema = z.object({
  id: z.string().uuid(),
  child_id: z.string().uuid(),
  experience_id: z.string().min(1).max(96),
  release_id: z.string().min(1).max(120),
  release_version: z.string().min(1).max(50),
  release_channel: z.enum(['staging', 'production']),
  release_manifest_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  current_node_id: z.string().min(1).max(96),
  status: z.enum([
    'invited',
    'active',
    'awaiting_child',
    'cinematic_ready',
    'generating_art',
    'paused',
    'chapter_complete',
    'locked',
  ]),
  revision: SafeIntegerSchema,
  message_sequence: SafeIntegerSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

const SessionRowSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid(),
  opened_revision: SafeIntegerSchema,
  closed_revision: SafeIntegerSchema.nullable(),
  started_at: TimestampSchema,
  ended_at: TimestampSchema.nullable(),
});

const MessageRowSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid(),
  session_id: z.string().uuid(),
  turn_id: z.string().uuid().nullable(),
  sequence_no: SafeIntegerSchema,
  actor: z.enum(['child', 'character', 'system']),
  message_kind: z.enum([
    'character_text',
    'child_choice',
    'child_prompt',
    'quick_reply',
    'choice',
    'cinematic',
    'generated_image',
    'quiz',
    'minigame',
    'system_transition',
    'ending',
  ]),
  authored_content_id: z.string().min(1).max(96),
  authored_context_id: z.string().min(1).max(96).nullable(),
  created_at: TimestampSchema,
});

const TurnRowSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid(),
  session_id: z.string().uuid(),
  client_turn_id: z.string().uuid(),
  request_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  source_kind: z.enum(['choice', 'quick_reply']),
  authored_input_id: z.string().min(1).max(96),
  from_node_id: z.string().min(1).max(96),
  to_node_id: z.string().min(1).max(96),
  expected_revision: SafeIntegerSchema,
  committed_revision: SafeIntegerSchema,
  created_at: TimestampSchema,
});

const CommitResultSchema = z.object({
  turn_id: z.string().uuid(),
  committed_revision: SafeIntegerSchema,
  last_message_sequence: SafeIntegerSchema,
  committed_node_id: z.string().min(1).max(96),
  idempotent_replay: z.boolean(),
});

export class SupabaseStoryChatRepository implements StoryChatRepository {
  constructor(private readonly client: StoryChatSupabaseClient) {}

  async findOwnedChild(parentId: string, childId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('children')
      .select('id')
      .eq('id', childId)
      .eq('parent_id', parentId)
      .maybeSingle();
    assertDatabaseResult(error);
    return Boolean(data);
  }

  async hasActiveConsent(input: {
    parentId: string;
    childId: string;
    scope: 'child_profile_activity';
  }): Promise<boolean> {
    const { data, error } = await this.client
      .from('parent_consents')
      .select('id')
      .eq('parent_id', input.parentId)
      .eq('child_id', input.childId)
      .eq('consent_scope', input.scope)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    assertDatabaseResult(error);
    return Boolean(data);
  }

  async listRooms(childId: string): Promise<StoryChatRoomRecord[]> {
    const { data, error } = await this.client
      .from('world_chat_rooms')
      .select('*')
      .eq('child_id', childId)
      .order('updated_at', { ascending: false })
      .limit(100);
    assertDatabaseResult(error);
    return parseRows(RoomRowSchema, data).map(toRoomRecord);
  }

  async findRoom(childId: string, roomId: string): Promise<StoryChatRoomRecord | null> {
    const { data, error } = await this.client
      .from('world_chat_rooms')
      .select('*')
      .eq('id', roomId)
      .eq('child_id', childId)
      .maybeSingle();
    assertDatabaseResult(error);
    return data ? toRoomRecord(parseRow(RoomRowSchema, data)) : null;
  }

  async listMessages(input: {
    roomId: string;
    afterSequence: number;
    upToSequence: number;
    limit: number;
  }): Promise<StoryChatMessageRecord[]> {
    const { data, error } = await this.client
      .from('world_chat_messages')
      .select('*')
      .eq('room_id', input.roomId)
      .gt('sequence_no', input.afterSequence)
      .lte('sequence_no', input.upToSequence)
      .order('sequence_no', { ascending: true })
      .limit(input.limit);
    assertDatabaseResult(error);
    return parseRows(MessageRowSchema, data).map(toMessageRecord);
  }

  async findOpenSession(
    roomId: string,
    sessionId: string,
  ): Promise<StoryChatSessionRecord | null> {
    const { data, error } = await this.client
      .from('world_chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('room_id', roomId)
      .is('ended_at', null)
      .maybeSingle();
    assertDatabaseResult(error);
    return data ? toSessionRecord(parseRow(SessionRowSchema, data)) : null;
  }

  async findTurnByClientId(
    roomId: string,
    clientTurnId: string,
  ): Promise<StoryChatTurnRecord | null> {
    const { data, error } = await this.client
      .from('world_chat_turns')
      .select('*')
      .eq('room_id', roomId)
      .eq('client_turn_id', clientTurnId)
      .maybeSingle();
    assertDatabaseResult(error);
    if (!data) return null;

    const turn = parseRow(TurnRowSchema, data);
    const { data: messageData, error: messageError } = await this.client
      .from('world_chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .eq('turn_id', turn.id)
      .order('sequence_no', { ascending: true });
    assertDatabaseResult(messageError);

    return {
      id: turn.id,
      roomId: turn.room_id,
      sessionId: turn.session_id,
      clientTurnId: turn.client_turn_id,
      requestSha256: turn.request_sha256,
      sourceKind: turn.source_kind,
      authoredInputId: turn.authored_input_id,
      fromNodeId: turn.from_node_id,
      toNodeId: turn.to_node_id,
      expectedRevision: turn.expected_revision,
      committedRevision: turn.committed_revision,
      createdAt: turn.created_at,
      messages: parseRows(MessageRowSchema, messageData).map(toMessageRecord),
    };
  }

  async commitAuthoredTurn(input: StoryChatCommitInput): Promise<StoryChatCommitResult> {
    const { data, error } = await this.client.rpc('commit_world_chat_authored_turn', {
      p_parent_id: input.parentId,
      p_expected_release_channel: input.expectedReleaseChannel,
      p_expected_release_id: input.expectedReleaseId,
      p_expected_release_version: input.expectedReleaseVersion,
      p_expected_release_manifest_sha256: input.expectedReleaseManifestSha256,
      p_room_id: input.roomId,
      p_session_id: input.sessionId,
      p_client_turn_id: input.clientTurnId,
      p_request_sha256: input.requestSha256,
      p_expected_revision: input.expectedRevision,
      p_from_node_id: input.fromNodeId,
      p_to_node_id: input.toNodeId,
      p_target_status: input.targetStatus,
      p_source_kind: input.sourceKind,
      p_authored_input_id: input.authoredInputId,
      p_message_actors: input.messages.map((message) => message.actor),
      p_message_kinds: input.messages.map((message) => message.messageKind),
      p_message_content_ids: input.messages.map((message) => message.authoredContentId),
    });
    if (error) throw mapAuthoredCommitDatabaseError(error);

    const first = Array.isArray(data) ? data[0] : data;
    const result = parseRow(CommitResultSchema, first);
    return {
      turnId: result.turn_id,
      committedRevision: result.committed_revision,
      lastMessageSequence: result.last_message_sequence,
      committedNodeId: result.committed_node_id,
      idempotentReplay: result.idempotent_replay,
    };
  }
}

/** Production intentionally has no unsigned/demo graph fallback. */
export class UnavailableStoryGraphProvider implements ApprovedStoryGraphProvider {
  async loadApprovedGraph(): Promise<null> {
    return null;
  }
}

function toRoomRecord(row: z.infer<typeof RoomRowSchema>): StoryChatRoomRecord {
  return {
    id: row.id,
    childId: row.child_id,
    experienceId: row.experience_id,
    releaseId: row.release_id,
    releaseVersion: row.release_version,
    releaseChannel: row.release_channel,
    releaseManifestSha256: row.release_manifest_sha256,
    currentNodeId: row.current_node_id,
    status: row.status,
    revision: row.revision,
    messageSequence: row.message_sequence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSessionRecord(row: z.infer<typeof SessionRowSchema>): StoryChatSessionRecord {
  return {
    id: row.id,
    roomId: row.room_id,
    openedRevision: row.opened_revision,
    closedRevision: row.closed_revision,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

function toMessageRecord(row: z.infer<typeof MessageRowSchema>): StoryChatMessageRecord {
  return {
    id: row.id,
    roomId: row.room_id,
    sessionId: row.session_id,
    turnId: row.turn_id,
    sequenceNo: row.sequence_no,
    actor: row.actor,
    messageKind: row.message_kind,
    authoredContentId: row.authored_content_id,
    authoredContextId: row.authored_context_id,
    createdAt: row.created_at,
  };
}

function parseRow<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new StoryChatRuntimeError('storage_unavailable', { cause: result.error });
  }
  return result.data;
}

function parseRows<T extends z.ZodType>(schema: T, input: unknown): z.infer<T>[] {
  if (!Array.isArray(input)) throw new StoryChatRuntimeError('storage_unavailable');
  return input.map((row) => parseRow(schema, row));
}

function assertDatabaseResult(error: unknown): void {
  if (error) throw new StoryChatRuntimeError('storage_unavailable', { cause: error });
}
