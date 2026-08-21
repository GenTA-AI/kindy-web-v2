import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type {
  StoryChatReleaseChannel,
  StoryChatRoomRecord,
} from '@/types/story-chat-api';
import {
  mapOpenSessionDatabaseError,
  StoryChatRoomLifecycleError,
  type StoryChatOpenSessionResult,
  type StoryChatRoomLifecycleRepository,
} from './room-lifecycle';

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
const RoomStatusSchema = z.enum([
  'invited',
  'active',
  'awaiting_child',
  'cinematic_ready',
  'generating_art',
  'paused',
  'chapter_complete',
  'locked',
]);

const RoomRowSchema = z.object({
  id: z.string().uuid(),
  child_id: z.string().uuid(),
  experience_id: z.string().min(1).max(96),
  release_id: z.string().min(1).max(120),
  release_version: z.string().min(1).max(50),
  release_channel: z.enum(['staging', 'production']),
  release_manifest_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  current_node_id: z.string().min(1).max(96),
  status: RoomStatusSchema,
  revision: SafeIntegerSchema,
  message_sequence: SafeIntegerSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});

const OpenSessionResultSchema = z.object({
  session_id: z.string().uuid(),
  session_client_id: z.string().uuid(),
  session_opened_revision: SafeIntegerSchema,
  session_started_at: TimestampSchema,
  session_ended_at: z.null(),
  resumed_existing: z.boolean(),
  idempotent_replay: z.boolean(),
  room_child_id: z.string().uuid(),
  room_experience_id: z.string().min(1).max(96),
  room_release_id: z.string().min(1).max(120),
  room_release_version: z.string().min(1).max(50),
  room_release_channel: z.enum(['staging', 'production']),
  room_release_manifest_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  room_current_node_id: z.string().min(1).max(96),
  room_status: RoomStatusSchema,
  room_revision: SafeIntegerSchema,
  room_message_sequence: SafeIntegerSchema,
  room_created_at: TimestampSchema,
  room_updated_at: TimestampSchema,
});

export class SupabaseStoryChatRoomLifecycleRepository
implements StoryChatRoomLifecycleRepository {
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

  async openSession(input: {
    parentId: string;
    childId: string;
    roomId: string;
    clientSessionId: string;
    expectedReleaseChannel: StoryChatReleaseChannel;
  }): Promise<StoryChatOpenSessionResult> {
    const { data, error } = await this.client.rpc('open_world_chat_session', {
      p_parent_id: input.parentId,
      p_child_id: input.childId,
      p_room_id: input.roomId,
      p_client_session_id: input.clientSessionId,
      p_expected_release_channel: input.expectedReleaseChannel,
    });
    if (error) throw mapOpenSessionDatabaseError(error);

    const first = Array.isArray(data) ? data[0] : data;
    const result = parseRow(OpenSessionResultSchema, first);
    return {
      session: {
        id: result.session_id,
        clientSessionId: result.session_client_id,
        roomId: input.roomId,
        openedRevision: result.session_opened_revision,
        startedAt: result.session_started_at,
        endedAt: result.session_ended_at,
        resumedExisting: result.resumed_existing,
        idempotentReplay: result.idempotent_replay,
      },
      room: {
        id: input.roomId,
        childId: result.room_child_id,
        experienceId: result.room_experience_id,
        releaseId: result.room_release_id,
        releaseVersion: result.room_release_version,
        releaseChannel: result.room_release_channel,
        releaseManifestSha256: result.room_release_manifest_sha256,
        currentNodeId: result.room_current_node_id,
        status: result.room_status,
        revision: result.room_revision,
        messageSequence: result.room_message_sequence,
        createdAt: result.room_created_at,
        updatedAt: result.room_updated_at,
      },
    };
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

function parseRow<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new StoryChatRoomLifecycleError('storage_unavailable', {
      cause: result.error,
    });
  }
  return result.data;
}

function assertDatabaseResult(error: unknown): void {
  if (error) {
    throw new StoryChatRoomLifecycleError('storage_unavailable', { cause: error });
  }
}
