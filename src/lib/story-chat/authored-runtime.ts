import { createHash } from 'node:crypto';

import {
  canonicalizeReleaseJson,
} from '@/contracts/content-release.v1';
import {
  parseExperienceGraph,
  resolveChoiceTransition,
  type ExperienceGraph,
  type ExperienceNode,
} from '@/contracts/experience-graph.v1';
import type {
  StoryChatApiMessage,
  StoryChatApiRoom,
  StoryChatCommittedTurnResponse,
  StoryChatFreeTextFallbackResponse,
  StoryChatMessageActor,
  StoryChatMessageKind,
  StoryChatMessageRecord,
  StoryChatRoomRecord,
  StoryChatReleaseChannel,
  StoryChatSessionRecord,
  StoryChatTurnRecord,
  StoryChatTurnRequest,
} from '@/types/story-chat-api';
import {
  toStoryChatApiMessage,
  toStoryChatApiRoom,
} from '@/types/story-chat-api';
import type { StoryChatRuntimeConfig } from './runtime-config';
import {
  enforceStoryChatRateLimit,
  type StoryChatRateLimiter,
} from './rate-limit';

export const STORY_CHAT_ACTIVITY_CONSENT_SCOPE = 'child_profile_activity' as const;
export const STORY_CHAT_FREE_TEXT_FALLBACK =
  '지금은 글로 답하는 대신 화면의 선택지를 골라 이야기를 이어가 주세요.';

export type StoryChatRuntimeErrorCode =
  | 'runtime_disabled'
  | 'storage_unavailable'
  | 'child_not_found'
  | 'consent_required'
  | 'room_not_found'
  | 'room_not_active'
  | 'session_not_open'
  | 'client_turn_conflict'
  | 'stale_revision'
  | 'current_node_mismatch'
  | 'invalid_transition'
  | 'release_unavailable';

export class StoryChatRuntimeError extends Error {
  readonly code: StoryChatRuntimeErrorCode;

  constructor(code: StoryChatRuntimeErrorCode, options?: { cause?: unknown }) {
    super(code, options);
    this.name = 'StoryChatRuntimeError';
    this.code = code;
  }
}

export function mapAuthoredCommitDatabaseError(error: unknown): StoryChatRuntimeError {
  const record = error && typeof error === 'object'
    ? error as Record<string, unknown>
    : {};
  const marker = [record.code, record.message, record.details, record.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
  const mappings: ReadonlyArray<[
    databaseMarker: string,
    code: StoryChatRuntimeErrorCode,
  ]> = [
    ['CHAT_CLIENT_TURN_CONFLICT', 'client_turn_conflict'],
    ['CHAT_STALE_REVISION', 'stale_revision'],
    ['CHAT_CURRENT_NODE_MISMATCH', 'current_node_mismatch'],
    ['CHAT_SESSION_NOT_OPEN', 'session_not_open'],
    ['CHAT_ROOM_NOT_FOUND', 'room_not_found'],
    ['CHAT_CHILD_ACCESS_DENIED', 'child_not_found'],
    ['CHAT_CONSENT_REQUIRED', 'consent_required'],
    ['CHAT_RELEASE_UNAVAILABLE', 'release_unavailable'],
    ['CHAT_ROOM_NOT_ACTIVE', 'room_not_active'],
    ['CHAT_INVALID_TURN_REQUEST', 'invalid_transition'],
  ];
  const match = mappings.find(([databaseMarker]) => marker.includes(databaseMarker));
  return new StoryChatRuntimeError(match?.[1] ?? 'storage_unavailable', {
    cause: error,
  });
}

export type StoryChatAuthoredMessageDescriptor = {
  actor: StoryChatMessageActor;
  messageKind: StoryChatMessageKind;
  authoredContentId: string;
};

export type StoryChatCommitInput = {
  parentId: string;
  expectedReleaseChannel: StoryChatReleaseChannel;
  expectedReleaseId: string;
  expectedReleaseVersion: string;
  expectedReleaseManifestSha256: string;
  roomId: string;
  sessionId: string;
  clientTurnId: string;
  requestSha256: string;
  expectedRevision: number;
  fromNodeId: string;
  toNodeId: string;
  targetStatus: 'awaiting_child' | 'chapter_complete';
  sourceKind: 'choice' | 'quick_reply';
  authoredInputId: string;
  messages: StoryChatAuthoredMessageDescriptor[];
};

export type StoryChatCommitResult = {
  turnId: string;
  committedRevision: number;
  lastMessageSequence: number;
  committedNodeId: string;
  idempotentReplay: boolean;
};

export interface StoryChatRepository {
  findOwnedChild(parentId: string, childId: string): Promise<boolean>;
  hasActiveConsent(input: {
    parentId: string;
    childId: string;
    scope: typeof STORY_CHAT_ACTIVITY_CONSENT_SCOPE;
  }): Promise<boolean>;
  listRooms(childId: string): Promise<StoryChatRoomRecord[]>;
  findRoom(childId: string, roomId: string): Promise<StoryChatRoomRecord | null>;
  listMessages(input: {
    roomId: string;
    afterSequence: number;
    upToSequence: number;
    limit: number;
  }): Promise<StoryChatMessageRecord[]>;
  findOpenSession(roomId: string, sessionId: string): Promise<StoryChatSessionRecord | null>;
  findTurnByClientId(roomId: string, clientTurnId: string): Promise<StoryChatTurnRecord | null>;
  commitAuthoredTurn(input: StoryChatCommitInput): Promise<StoryChatCommitResult>;
}

/**
 * Implementations must return only a graph from a signature-verified, immutable
 * ContentRelease matching the supplied room identity. The server default stays
 * unavailable until that loader is wired; tests inject a synthetic provider.
 */
export interface ApprovedStoryGraphProvider {
  loadApprovedGraph(room: StoryChatRoomRecord): Promise<{
    releaseId: string;
    releaseManifestSha256: string;
    graph: unknown;
  } | null>;
}

export type StoryChatRuntimeDependencies = {
  config: StoryChatRuntimeConfig;
  repository: StoryChatRepository;
  graphProvider: ApprovedStoryGraphProvider;
  rateLimiter: StoryChatRateLimiter;
};

export type StoryChatRoomMessagesResponse = {
  room: StoryChatApiRoom;
  messages: StoryChatApiMessage[];
  next_after: number;
};

export type StoryChatTurnOutcome =
  | StoryChatCommittedTurnResponse
  | StoryChatFreeTextFallbackResponse;

// The atomic RPC accepts at most eight descriptors, including the child's
// authored selection. Longer compiler output must be split at an interaction.
const MAX_AUTHORED_MESSAGES_PER_TURN = 8;

export class StoryChatRuntime {
  constructor(private readonly dependencies: StoryChatRuntimeDependencies) {}

  async listRooms(input: {
    parentId: string;
    childId: string;
  }): Promise<{ rooms: StoryChatApiRoom[] }> {
    this.assertRuntimeEnabled();
    await this.assertChildAccess(input);
    const releaseChannel = this.requireReleaseChannel();
    const rooms = await this.dependencies.repository.listRooms(input.childId);
    return {
      rooms: rooms
        .filter((room) => room.releaseChannel === releaseChannel)
        .map(toStoryChatApiRoom),
    };
  }

  async getRoomMessages(input: {
    parentId: string;
    childId: string;
    roomId: string;
    afterSequence: number;
    limit?: number;
  }): Promise<StoryChatRoomMessagesResponse> {
    this.assertRuntimeEnabled();
    await this.assertChildAccess(input);
    const releaseChannel = this.requireReleaseChannel();
    const room = await this.requireRoom(input.childId, input.roomId, releaseChannel);
    const messages = await this.dependencies.repository.listMessages({
      roomId: room.id,
      afterSequence: input.afterSequence,
      upToSequence: room.messageSequence,
      limit: Math.min(Math.max(input.limit ?? 100, 1), 100),
    });
    const nextAfter = messages.at(-1)?.sequenceNo ?? input.afterSequence;

    return {
      room: toStoryChatApiRoom(room),
      messages: messages.map(toStoryChatApiMessage),
      next_after: nextAfter,
    };
  }

  async submitTurn(input: {
    parentId: string;
    roomId: string;
    request: StoryChatTurnRequest;
  }): Promise<StoryChatTurnOutcome> {
    this.assertRuntimeEnabled();
    await this.assertChildAccess({
      parentId: input.parentId,
      childId: input.request.child_id,
    });
    const releaseChannel = this.requireReleaseChannel();
    const room = await this.requireRoom(
      input.request.child_id,
      input.roomId,
      releaseChannel,
    );
    const requestSha256 = hashTurnRequest(room, input.request);
    const rateLimitInput = {
      parentId: input.parentId,
      childId: input.request.child_id,
      roomId: room.id,
      action: 'authored_turn' as const,
      idempotencyKey: input.request.client_turn_id,
    };

    // A committed retry must succeed even when the room/session has advanced.
    const previous = await this.dependencies.repository.findTurnByClientId(
      room.id,
      input.request.client_turn_id,
    );
    if (previous) {
      if (previous.requestSha256 !== requestSha256) {
        // A conflicting reuse is not an idempotent replay. It still reaches the
        // parent-global abuse axis, while its UUID receipt avoids another
        // logical room-action charge.
        await enforceStoryChatRateLimit(
          this.dependencies.rateLimiter,
          rateLimitInput,
        );
        throw new StoryChatRuntimeError('client_turn_conflict');
      }
      return committedTurnResponse(previous, true);
    }

    await enforceStoryChatRateLimit(this.dependencies.rateLimiter, rateLimitInput);

    if (room.status !== 'active' && room.status !== 'awaiting_child') {
      throw new StoryChatRuntimeError('room_not_active');
    }
    if (room.revision !== input.request.expected_revision) {
      throw new StoryChatRuntimeError('stale_revision');
    }

    const requestedNodeId = input.request.kind === 'free_text'
      ? input.request.node_id
      : input.request.selection.node_id;
    if (room.currentNodeId !== requestedNodeId) {
      throw new StoryChatRuntimeError('current_node_mismatch');
    }

    const session = await this.dependencies.repository.findOpenSession(
      room.id,
      input.request.session_id,
    );
    if (!session) throw new StoryChatRuntimeError('session_not_open');

    if (input.request.kind === 'free_text') {
      // Do not persist, log, hash, moderate, or forward the raw text in this milestone.
      return {
        kind: 'authored_fallback',
        code: 'free_text_disabled',
        current_node_id: room.currentNodeId,
        revision: room.revision,
        message: STORY_CHAT_FREE_TEXT_FALLBACK,
      };
    }

    const graph = await this.loadMatchingGraph(room);
    const resolved = resolveAuthoredSelection(graph, room.currentNodeId, {
      kind: input.request.kind,
      optionId: input.request.selection.option_id,
    });

    let commitResult: StoryChatCommitResult;
    try {
      commitResult = await this.dependencies.repository.commitAuthoredTurn({
        parentId: input.parentId,
        expectedReleaseChannel: releaseChannel,
        expectedReleaseId: room.releaseId,
        expectedReleaseVersion: room.releaseVersion,
        expectedReleaseManifestSha256: room.releaseManifestSha256,
        roomId: room.id,
        sessionId: session.id,
        clientTurnId: input.request.client_turn_id,
        requestSha256,
        expectedRevision: input.request.expected_revision,
        fromNodeId: room.currentNodeId,
        toNodeId: resolved.toNodeId,
        targetStatus: resolved.targetStatus,
        sourceKind: input.request.kind,
        authoredInputId: input.request.selection.option_id,
        messages: resolved.messages,
      });
    } catch (error) {
      if (error instanceof StoryChatRuntimeError) throw error;
      throw new StoryChatRuntimeError('storage_unavailable', { cause: error });
    }

    const committed = await this.dependencies.repository.findTurnByClientId(
      room.id,
      input.request.client_turn_id,
    );
    if (!committed || committed.requestSha256 !== requestSha256) {
      throw new StoryChatRuntimeError('storage_unavailable');
    }
    const observedLastSequence = committed.messages.at(-1)?.sequenceNo ?? 0;
    if (
      committed.id !== commitResult.turnId
      || committed.committedRevision !== commitResult.committedRevision
      || committed.toNodeId !== commitResult.committedNodeId
      || observedLastSequence !== commitResult.lastMessageSequence
    ) {
      throw new StoryChatRuntimeError('storage_unavailable');
    }
    return committedTurnResponse(committed, commitResult.idempotentReplay);
  }

  private assertRuntimeEnabled(): void {
    if (!this.dependencies.config.runtimeEnabled) {
      throw new StoryChatRuntimeError('runtime_disabled');
    }
  }

  private requireReleaseChannel(): StoryChatReleaseChannel {
    const channel = this.dependencies.config.releaseChannel;
    if (!channel) throw new StoryChatRuntimeError('release_unavailable');
    return channel;
  }

  private async assertChildAccess(input: {
    parentId: string;
    childId: string;
  }): Promise<void> {
    if (!await this.dependencies.repository.findOwnedChild(input.parentId, input.childId)) {
      throw new StoryChatRuntimeError('child_not_found');
    }
    if (!await this.dependencies.repository.hasActiveConsent({
      ...input,
      scope: STORY_CHAT_ACTIVITY_CONSENT_SCOPE,
    })) {
      throw new StoryChatRuntimeError('consent_required');
    }
  }

  private async requireRoom(
    childId: string,
    roomId: string,
    releaseChannel: StoryChatReleaseChannel,
  ): Promise<StoryChatRoomRecord> {
    const room = await this.dependencies.repository.findRoom(childId, roomId);
    if (!room) throw new StoryChatRuntimeError('room_not_found');
    if (room.releaseChannel !== releaseChannel) {
      throw new StoryChatRuntimeError('release_unavailable');
    }
    return room;
  }

  private async loadMatchingGraph(room: StoryChatRoomRecord): Promise<ExperienceGraph> {
    const snapshot = await this.dependencies.graphProvider.loadApprovedGraph(room);
    if (
      !snapshot
      || snapshot.releaseId !== room.releaseId
      || snapshot.releaseManifestSha256 !== room.releaseManifestSha256
    ) {
      throw new StoryChatRuntimeError('release_unavailable');
    }

    try {
      const graph = parseExperienceGraph(snapshot.graph);
      if (
        graph.experienceId !== room.experienceId
        || graph.releaseVersion !== room.releaseVersion
      ) {
        throw new StoryChatRuntimeError('release_unavailable');
      }
      return graph;
    } catch (error) {
      if (error instanceof StoryChatRuntimeError) throw error;
      throw new StoryChatRuntimeError('release_unavailable', { cause: error });
    }
  }
}

export function hashTurnRequest(
  room: Pick<
    StoryChatRoomRecord,
    | 'id'
    | 'releaseId'
    | 'releaseVersion'
    | 'releaseChannel'
    | 'releaseManifestSha256'
  >,
  request: StoryChatTurnRequest,
): string {
  const action = request.kind === 'free_text'
    ? {
        kind: request.kind,
        nodeId: request.node_id,
      }
    : {
        kind: request.kind,
        nodeId: request.selection.node_id,
        optionId: request.selection.option_id,
      };

  // Free-text bytes are intentionally absent from both this hash and persistence.
  const canonical = canonicalizeReleaseJson({
    schemaVersion: 'story-chat-turn/v1',
    roomId: room.id,
    releasePin: {
      releaseId: room.releaseId,
      releaseVersion: room.releaseVersion,
      releaseChannel: room.releaseChannel,
      releaseManifestSha256: room.releaseManifestSha256,
    },
    sessionId: request.session_id,
    clientTurnId: request.client_turn_id,
    expectedRevision: request.expected_revision,
    action,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function resolveAuthoredSelection(
  graph: ExperienceGraph,
  currentNodeId: string,
  selection: { kind: 'choice' | 'quick_reply'; optionId: string },
): {
  toNodeId: string;
  targetStatus: 'awaiting_child' | 'chapter_complete';
  messages: StoryChatAuthoredMessageDescriptor[];
} {
  const source = graph.chatGraph.nodes.find((node) => node.id === currentNodeId);
  if (!source || source.type !== selection.kind) {
    throw new StoryChatRuntimeError('invalid_transition');
  }

  let nextNodeId: string;
  try {
    nextNodeId = resolveChoiceTransition(graph, currentNodeId, selection.optionId);
  } catch (cause) {
    throw new StoryChatRuntimeError('invalid_transition', { cause });
  }

  const nodes = new Map(graph.chatGraph.nodes.map((node) => [node.id, node] as const));
  const messages: StoryChatAuthoredMessageDescriptor[] = [
    {
      actor: 'child',
      messageKind: 'child_choice',
      authoredContentId: selection.optionId,
    },
  ];
  const visited = new Set<string>();
  let current = nodes.get(nextNodeId);

  for (let walked = 1; walked < MAX_AUTHORED_MESSAGES_PER_TURN; walked += 1) {
    if (!current || visited.has(current.id)) {
      throw new StoryChatRuntimeError('invalid_transition');
    }
    visited.add(current.id);
    messages.push(descriptorForNode(current));

    if (isInteractionBoundary(current)) {
      return {
        toNodeId: current.id,
        targetStatus: current.type === 'ending' ? 'chapter_complete' : 'awaiting_child',
        messages,
      };
    }

    if (current.allowedNextNodeIds.length !== 1) {
      throw new StoryChatRuntimeError('invalid_transition');
    }
    current = nodes.get(current.allowedNextNodeIds[0]);
  }

  throw new StoryChatRuntimeError('invalid_transition');
}

function descriptorForNode(node: ExperienceNode): StoryChatAuthoredMessageDescriptor {
  const actor: StoryChatMessageActor = node.type === 'character_text'
    ? 'character'
    : 'system';
  const messageKind: StoryChatMessageKind = node.type === 'generated_image_recipe'
    ? 'generated_image'
    : node.type;

  return {
    actor,
    messageKind,
    authoredContentId: node.id,
  };
}

function isInteractionBoundary(node: ExperienceNode): boolean {
  return node.type === 'choice'
    || node.type === 'quick_reply'
    || node.type === 'quiz'
    || node.type === 'minigame'
    || node.type === 'ending';
}

function committedTurnResponse(
  turn: StoryChatTurnRecord,
  idempotentReplay: boolean,
): StoryChatCommittedTurnResponse {
  return {
    kind: 'committed',
    turn_id: turn.id,
    client_turn_id: turn.clientTurnId,
    committed_revision: turn.committedRevision,
    from_node_id: turn.fromNodeId,
    current_node_id: turn.toNodeId,
    last_message_sequence: turn.messages.at(-1)?.sequenceNo ?? 0,
    idempotent_replay: idempotentReplay,
    messages: turn.messages.map(toStoryChatApiMessage),
  };
}
