import { z } from 'zod';

import type {
  StoryChatApiRoom,
  StoryChatReleaseChannel,
  StoryChatRoomRecord,
} from '@/types/story-chat-api';
import { toStoryChatApiRoom } from '@/types/story-chat-api';
import type { StoryChatRuntimeConfig } from './runtime-config';
import {
  enforceStoryChatRateLimit,
  type StoryChatRateLimiter,
} from './rate-limit';

export const StoryChatOpenSessionRequestSchema = z.object({
  child_id: z.string().uuid(),
  client_session_id: z.string().uuid(),
}).strict();

export type StoryChatOpenSessionRequest = z.infer<
  typeof StoryChatOpenSessionRequestSchema
>;

export type StoryChatRoomLifecycleErrorCode =
  | 'runtime_disabled'
  | 'invalid_request'
  | 'storage_unavailable'
  | 'child_not_found'
  | 'consent_required'
  | 'room_not_found'
  | 'room_not_openable'
  | 'release_unavailable'
  | 'client_session_conflict';

export class StoryChatRoomLifecycleError extends Error {
  readonly code: StoryChatRoomLifecycleErrorCode;

  constructor(code: StoryChatRoomLifecycleErrorCode, options?: { cause?: unknown }) {
    super(code, options);
    this.name = 'StoryChatRoomLifecycleError';
    this.code = code;
  }
}

export type StoryChatOpenedSessionRecord = {
  id: string;
  clientSessionId: string;
  roomId: string;
  openedRevision: number;
  startedAt: string;
  endedAt: null;
  resumedExisting: boolean;
  idempotentReplay: boolean;
};

export type StoryChatOpenSessionResult = {
  session: StoryChatOpenedSessionRecord;
  room: StoryChatRoomRecord;
};

export type StoryChatOpenSessionApiResponse = {
  session: {
    id: string;
    client_session_id: string;
    room_id: string;
    opened_revision: number;
    started_at: string;
    ended_at: null;
    resumed_existing: boolean;
    idempotent_replay: boolean;
  };
  room: StoryChatApiRoom;
};

export interface StoryChatRoomLifecycleRepository {
  findOwnedChild(parentId: string, childId: string): Promise<boolean>;
  hasActiveConsent(input: {
    parentId: string;
    childId: string;
    scope: 'child_profile_activity';
  }): Promise<boolean>;
  findRoom(childId: string, roomId: string): Promise<StoryChatRoomRecord | null>;
  openSession(input: {
    parentId: string;
    childId: string;
    roomId: string;
    clientSessionId: string;
    expectedReleaseChannel: StoryChatReleaseChannel;
  }): Promise<StoryChatOpenSessionResult>;
}

const OPENABLE_ROOM_STATUSES = new Set<StoryChatRoomRecord['status']>([
  'invited',
  'active',
  'awaiting_child',
  'paused',
]);

export class StoryChatRoomLifecycle {
  constructor(private readonly dependencies: {
    config: StoryChatRuntimeConfig;
    repository: StoryChatRoomLifecycleRepository;
    rateLimiter: StoryChatRateLimiter;
  }) {}

  async openSession(input: {
    parentId: string;
    roomId: string;
    request: StoryChatOpenSessionRequest;
  }): Promise<StoryChatOpenSessionApiResponse> {
    if (!this.dependencies.config.runtimeEnabled) {
      throw new StoryChatRoomLifecycleError('runtime_disabled');
    }

    const access = {
      parentId: input.parentId,
      childId: input.request.child_id,
    };
    if (!await this.dependencies.repository.findOwnedChild(
      access.parentId,
      access.childId,
    )) {
      throw new StoryChatRoomLifecycleError('child_not_found');
    }
    if (!await this.dependencies.repository.hasActiveConsent({
      ...access,
      scope: 'child_profile_activity',
    })) {
      throw new StoryChatRoomLifecycleError('consent_required');
    }

    const releaseChannel = this.dependencies.config.releaseChannel;
    if (!releaseChannel) {
      throw new StoryChatRoomLifecycleError('release_unavailable');
    }

    const room = await this.dependencies.repository.findRoom(
      access.childId,
      input.roomId,
    );
    if (!room) throw new StoryChatRoomLifecycleError('room_not_found');
    if (room.releaseChannel !== releaseChannel) {
      throw new StoryChatRoomLifecycleError('release_unavailable');
    }
    if (!OPENABLE_ROOM_STATUSES.has(room.status)) {
      throw new StoryChatRoomLifecycleError('room_not_openable');
    }

    await enforceStoryChatRateLimit(this.dependencies.rateLimiter, {
      parentId: access.parentId,
      childId: access.childId,
      roomId: room.id,
      action: 'session_open',
      idempotencyKey: input.request.client_session_id,
    });

    let result: StoryChatOpenSessionResult;
    try {
      result = await this.dependencies.repository.openSession({
        ...access,
        roomId: room.id,
        clientSessionId: input.request.client_session_id,
        expectedReleaseChannel: releaseChannel,
      });
    } catch (error) {
      if (error instanceof StoryChatRoomLifecycleError) throw error;
      throw new StoryChatRoomLifecycleError('storage_unavailable', { cause: error });
    }

    return {
      session: {
        id: result.session.id,
        client_session_id: result.session.clientSessionId,
        room_id: result.session.roomId,
        opened_revision: result.session.openedRevision,
        started_at: result.session.startedAt,
        ended_at: result.session.endedAt,
        resumed_existing: result.session.resumedExisting,
        idempotent_replay: result.session.idempotentReplay,
      },
      room: toStoryChatApiRoom(result.room),
    };
  }
}

export function isStoryChatRoomLifecycleError(
  error: unknown,
): error is StoryChatRoomLifecycleError {
  return error instanceof StoryChatRoomLifecycleError;
}

export function mapOpenSessionDatabaseError(
  error: unknown,
): StoryChatRoomLifecycleError {
  const record = error && typeof error === 'object'
    ? error as Record<string, unknown>
    : {};
  const marker = [record.code, record.message, record.details, record.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');

  const mappings: ReadonlyArray<[
    marker: string,
    code: StoryChatRoomLifecycleErrorCode,
  ]> = [
    ['CHAT_INVALID_SESSION_REQUEST', 'invalid_request'],
    ['CHAT_CHILD_ACCESS_DENIED', 'child_not_found'],
    ['CHAT_CONSENT_REQUIRED', 'consent_required'],
    ['CHAT_ROOM_NOT_FOUND', 'room_not_found'],
    ['CHAT_ROOM_NOT_OPENABLE', 'room_not_openable'],
    ['CHAT_RELEASE_UNAVAILABLE', 'release_unavailable'],
    ['CHAT_CLIENT_SESSION_CONFLICT', 'client_session_conflict'],
  ];
  const match = mappings.find(([databaseMarker]) => marker.includes(databaseMarker));
  return new StoryChatRoomLifecycleError(match?.[1] ?? 'storage_unavailable', {
    cause: error,
  });
}
