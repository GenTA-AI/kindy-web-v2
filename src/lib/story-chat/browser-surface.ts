import type { VerifiedContentReleaseGraphLoader } from '@/lib/releases/runtime-content-release';
import type {
  StoryChatApiMessage,
  StoryChatApiRoom,
  StoryChatFreeTextFallbackResponse,
  StoryChatMessageRecord,
  StoryChatReleaseChannel,
  StoryChatRoomRecord,
} from '@/types/story-chat-api';
import type {
  StoryChatRenderedMessage,
  StoryChatRenderedMessagesResponse,
  StoryChatRoomPresentation,
} from '@/types/story-chat-render';
import {
  StoryChatRuntimeError,
  type StoryChatRuntime,
} from './authored-runtime';
import {
  projectStoryChatRenderResponse,
  type StoryChatAssetSigner,
} from './render-projection';
import {
  enforceStoryChatReadRateLimit,
  type StoryChatReadRateLimiter,
} from './read-rate-limit';
import type {
  StoryChatOpenSessionApiResponse,
  StoryChatRoomLifecycle,
} from './room-lifecycle';

/**
 * A finite, reviewed alias is the only child display name used in this pilot.
 * Database names, environment strings, and browser values never reach the
 * post-moderation template substitution boundary.
 */
export const STORY_CHAT_SAFE_CHILD_ALIAS = '친구' as const;
export const STORY_CHAT_BROWSER_PAGE_LIMIT = 20 as const;

export type StoryChatRenderedRoomsResponse = Readonly<{
  rooms: StoryChatRoomPresentation[];
}>;

export type StoryChatRenderedSessionResponse = Readonly<{
  session: Readonly<{
    id: string;
    room_id: string;
    opened_revision: number;
    started_at: string;
    ended_at: null;
    resumed_existing: boolean;
    idempotent_replay: boolean;
  }>;
  room: StoryChatRoomPresentation;
}>;

export type StoryChatRenderedTurnResponse =
  | StoryChatFreeTextFallbackResponse
  | Readonly<{
      kind: 'committed';
      client_turn_id: string;
      committed_revision: number;
      last_message_sequence: number;
      idempotent_replay: boolean;
      room: StoryChatRoomPresentation;
      messages: StoryChatRenderedMessage[];
    }>;

type AuthoredRuntimeSurface = Pick<
  StoryChatRuntime,
  'listRooms' | 'getRoomMessages' | 'submitTurn'
>;

type RoomLifecycleSurface = Pick<StoryChatRoomLifecycle, 'openSession'>;

export type StoryChatBrowserSurfaceDependencies = Readonly<{
  authoredRuntime: AuthoredRuntimeSurface;
  roomLifecycle: RoomLifecycleSurface;
  releaseLoader: Pick<VerifiedContentReleaseGraphLoader, 'load'>;
  signAsset: StoryChatAssetSigner;
  readRateLimiter: StoryChatReadRateLimiter;
  releaseChannel: StoryChatReleaseChannel;
  assertActiveAccess(input: {
    parentId: string;
    childId: string;
  }): Promise<void>;
}>;

/**
 * The only service whose return values may be serialized by `/api/chat`.
 *
 * Production constructs this class in one server-only composition root. Raw
 * database/reference DTOs stay inside this class, and every successful browser
 * response is rebuilt from the exact server-loaded, signature-verified release
 * snapshot. There is no unsigned or raw fallback.
 */
export class StoryChatBrowserSurface {
  constructor(private readonly dependencies: StoryChatBrowserSurfaceDependencies) {}

  async listRooms(input: {
    parentId: string;
    childId: string;
  }): Promise<StoryChatRenderedRoomsResponse> {
    await enforceStoryChatReadRateLimit(this.dependencies.readRateLimiter, {
      ...input,
      action: 'rooms_read',
    });
    const result = await this.dependencies.authoredRuntime.listRooms(input);
    const rooms: StoryChatRoomPresentation[] = [];
    for (const rawRoom of result.rooms.slice(0, STORY_CHAT_BROWSER_PAGE_LIMIT)) {
      const room = toRoomRecord(rawRoom, this.dependencies.releaseChannel);
      const projected = await this.project(room, [], 0);
      rooms.push(projected.room);
    }
    await this.dependencies.assertActiveAccess(input);
    return { rooms };
  }

  async getRoomMessages(input: {
    parentId: string;
    childId: string;
    roomId: string;
    afterSequence: number;
    limit?: number;
  }): Promise<StoryChatRenderedMessagesResponse> {
    await enforceStoryChatReadRateLimit(this.dependencies.readRateLimiter, {
      parentId: input.parentId,
      childId: input.childId,
      action: 'messages_read',
    });
    const result = await this.dependencies.authoredRuntime.getRoomMessages({
      ...input,
      // The browser cannot raise storage/query/projection fan-out. Keep a
      // second slice below as a defense against an injected or regressed
      // runtime implementation ignoring this server-owned limit.
      limit: STORY_CHAT_BROWSER_PAGE_LIMIT,
    });
    const messages = result.messages.slice(0, STORY_CHAT_BROWSER_PAGE_LIMIT);
    const nextAfter = messages.at(-1)?.sequence_no ?? input.afterSequence;
    const projected = await this.project(
      toRoomRecord(result.room, this.dependencies.releaseChannel),
      messages.map(toMessageRecord),
      nextAfter,
    );
    await this.dependencies.assertActiveAccess(input);
    return projected;
  }

  async openSession(input: {
    parentId: string;
    roomId: string;
    request: { child_id: string; client_session_id: string };
  }): Promise<StoryChatRenderedSessionResponse> {
    const result = await this.dependencies.roomLifecycle.openSession(input);
    const projected = await this.project(
      toRoomRecord(result.room, this.dependencies.releaseChannel),
      [],
      0,
    );
    await this.dependencies.assertActiveAccess({
      parentId: input.parentId,
      childId: input.request.child_id,
    });
    return {
      session: projectSessionReceipt(result),
      room: projected.room,
    };
  }

  async submitTurn(input: {
    parentId: string;
    childId: string;
    roomId: string;
    request: Parameters<StoryChatRuntime['submitTurn']>[0]['request'];
  }): Promise<StoryChatRenderedTurnResponse> {
    const result = await this.dependencies.authoredRuntime.submitTurn({
      parentId: input.parentId,
      roomId: input.roomId,
      request: input.request,
    });
    if (result.kind === 'authored_fallback') {
      await this.dependencies.assertActiveAccess({
        parentId: input.parentId,
        childId: input.childId,
      });
      return {
        kind: 'authored_fallback',
        code: 'free_text_disabled',
        current_node_id: result.current_node_id,
        revision: result.revision,
        message: result.message,
      };
    }

    const firstSequence = result.messages.at(0)?.sequence_no;
    if (
      !Number.isSafeInteger(firstSequence)
      || (firstSequence as number) < 1
      || result.messages.at(-1)?.sequence_no !== result.last_message_sequence
    ) {
      throw new StoryChatRuntimeError('storage_unavailable');
    }

    // Read after commit. This confirms the immutable message records exist and
    // obtains the current room pin/state before any browser projection occurs.
    const observed = await this.dependencies.authoredRuntime.getRoomMessages({
      parentId: input.parentId,
      childId: input.childId,
      roomId: input.roomId,
      afterSequence: (firstSequence as number) - 1,
      limit: 100,
    });
    const expectedIds = result.messages.map((message) => message.id);
    if (new Set(expectedIds).size !== expectedIds.length) {
      throw new StoryChatRuntimeError('storage_unavailable');
    }
    const observedById = new Map(
      observed.messages.map((message) => [message.id, message] as const),
    );
    const committedMessages = expectedIds.map((id) => observedById.get(id));
    if (
      committedMessages.some((message) => !message)
      || committedMessages.some((message, index) => (
        !sameApiMessage(message, result.messages[index])
      ))
    ) {
      throw new StoryChatRuntimeError('storage_unavailable');
    }

    const room = toRoomRecord(observed.room, this.dependencies.releaseChannel);
    if (
      room.revision < result.committed_revision
      || room.messageSequence < result.last_message_sequence
    ) {
      throw new StoryChatRuntimeError('storage_unavailable');
    }
    const projected = await this.project(
      room,
      (committedMessages as StoryChatApiMessage[]).map(toMessageRecord),
      result.last_message_sequence,
    );
    await this.dependencies.assertActiveAccess({
      parentId: input.parentId,
      childId: input.childId,
    });
    return {
      kind: 'committed',
      client_turn_id: result.client_turn_id,
      committed_revision: result.committed_revision,
      last_message_sequence: result.last_message_sequence,
      idempotent_replay: result.idempotent_replay,
      room: projected.room,
      messages: projected.messages,
    };
  }

  private async project(
    room: StoryChatRoomRecord,
    messages: StoryChatMessageRecord[],
    nextAfter: number,
  ): Promise<StoryChatRenderedMessagesResponse> {
    const snapshot = await this.dependencies.releaseLoader.load(room);
    if (!snapshot) throw new StoryChatRuntimeError('release_unavailable');
    try {
      return await projectStoryChatRenderResponse(
        {
          room,
          messages,
          snapshot,
          childDisplayName: STORY_CHAT_SAFE_CHILD_ALIAS,
          nextAfter,
        },
        { signAsset: this.dependencies.signAsset },
      );
    } catch (error) {
      throw new StoryChatRuntimeError('release_unavailable', { cause: error });
    }
  }
}

function projectSessionReceipt(
  result: StoryChatOpenSessionApiResponse,
): StoryChatRenderedSessionResponse['session'] {
  return {
    id: result.session.id,
    room_id: result.session.room_id,
    opened_revision: result.session.opened_revision,
    started_at: result.session.started_at,
    ended_at: null,
    resumed_existing: result.session.resumed_existing,
    idempotent_replay: result.session.idempotent_replay,
  };
}

function toRoomRecord(
  room: StoryChatApiRoom,
  releaseChannel: StoryChatReleaseChannel,
): StoryChatRoomRecord {
  return {
    id: room.id,
    childId: room.child_id,
    experienceId: room.experience_id,
    releaseId: room.release_id,
    releaseVersion: room.release_version,
    releaseChannel,
    releaseManifestSha256: room.release_manifest_sha256,
    currentNodeId: room.current_node_id,
    status: room.status,
    revision: room.revision,
    messageSequence: room.message_sequence,
    createdAt: room.created_at,
    updatedAt: room.updated_at,
  };
}

function toMessageRecord(message: StoryChatApiMessage): StoryChatMessageRecord {
  return {
    id: message.id,
    roomId: message.room_id,
    sessionId: message.session_id,
    turnId: message.turn_id,
    sequenceNo: message.sequence_no,
    actor: message.actor,
    messageKind: message.message_kind,
    authoredContentId: message.authored_content_id,
    authoredContextId: message.authored_context_id,
    createdAt: message.created_at,
  };
}

function sameApiMessage(
  left: StoryChatApiMessage | undefined,
  right: StoryChatApiMessage | undefined,
): boolean {
  return Boolean(
    left
    && right
    && left.id === right.id
    && left.room_id === right.room_id
    && left.session_id === right.session_id
    && left.turn_id === right.turn_id
    && left.sequence_no === right.sequence_no
    && left.actor === right.actor
    && left.message_kind === right.message_kind
    && left.authored_content_id === right.authored_content_id
    && left.authored_context_id === right.authored_context_id
    && left.created_at === right.created_at,
  );
}
