import { z } from 'zod';

import {
  parseExperienceGraph,
  type ExperienceGraph,
} from '@/contracts/experience-graph.v1';
import type { VerifiedContentReleaseGraphSnapshot } from '@/lib/releases/runtime-content-release';
import type {
  StoryChatMessageRecord,
  StoryChatRoomRecord,
} from '@/types/story-chat-api';
import type {
  StoryChatRenderActor,
  StoryChatRenderAsset,
  StoryChatRenderedMessage,
  StoryChatRenderedMessagesResponse,
  StoryChatRoomPresentation,
} from '@/types/story-chat-render';

const MAX_SIGNED_ASSET_TTL_SECONDS = 15 * 60;
const SIGNED_ASSET_CLOCK_SKEW_MS = 5_000;

const ChildDisplayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine((value) => !/[\u0000-\u001f\u007f{}]/u.test(value));

const SignedAssetResultSchema = z.object({
  url: z.string().url().max(4_096),
  expiresAt: z.string().datetime({ offset: true }),
}).strict();

type ApprovedMediaAsset = ExperienceGraph['mediaManifest']['assets'][number];

export type StoryChatAssetSigner = (input: {
  assetId: string;
  storageKey: string;
  sha256: string;
  mimeType: string;
  expiresInSeconds: number;
}) => Promise<{ url: string; expiresAt: string }>;

export type StoryChatRenderProjectionDependencies = {
  signAsset: StoryChatAssetSigner;
  now?: () => Date;
  signedAssetTtlSeconds?: number;
};

export type StoryChatRenderProjectionInput = {
  room: StoryChatRoomRecord;
  messages: StoryChatMessageRecord[];
  snapshot: VerifiedContentReleaseGraphSnapshot;
  childDisplayName: string;
  nextAfter: number;
};

export type StoryChatProjectionErrorCode =
  | 'release_mismatch'
  | 'invalid_child_name'
  | 'invalid_message_reference'
  | 'media_unavailable';

export class StoryChatProjectionError extends Error {
  constructor(readonly code: StoryChatProjectionErrorCode) {
    super(code);
    this.name = 'StoryChatProjectionError';
  }
}

/**
 * Projects a verified, private release into the only shape a story-chat browser
 * may receive. Correct answers, game solutions, evidence packets, graph edges,
 * storage keys, hashes, signatures, and model/policy pins are never copied.
 */
export async function projectStoryChatRenderResponse(
  input: StoryChatRenderProjectionInput,
  dependencies: StoryChatRenderProjectionDependencies,
): Promise<StoryChatRenderedMessagesResponse> {
  const graph = requireMatchingGraph(input.room, input.snapshot);
  const childNameResult = ChildDisplayNameSchema.safeParse(input.childDisplayName);
  if (!childNameResult.success) {
    throw new StoryChatProjectionError('invalid_child_name');
  }
  const now = (dependencies.now ?? (() => new Date()))();
  if (!Number.isFinite(now.getTime())) {
    throw new StoryChatProjectionError('media_unavailable');
  }
  const ttlSeconds = dependencies.signedAssetTtlSeconds ?? 10 * 60;
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > MAX_SIGNED_ASSET_TTL_SECONDS) {
    throw new StoryChatProjectionError('media_unavailable');
  }
  if (
    !Number.isSafeInteger(input.nextAfter)
    || input.nextAfter < 0
    || input.nextAfter > input.room.messageSequence
    || input.messages.some((message, index) => (
      message.roomId !== input.room.id
      || !Number.isSafeInteger(message.sequenceNo)
      || message.sequenceNo < 1
      || message.sequenceNo > input.room.messageSequence
      || (index > 0 && message.sequenceNo <= input.messages[index - 1].sequenceNo)
    ))
    || (
      input.messages.length > 0
      && input.messages[input.messages.length - 1].sequenceNo !== input.nextAfter
    )
  ) {
    throw new StoryChatProjectionError('invalid_message_reference');
  }

  const context = new ProjectionContext({
    graph,
    childDisplayName: childNameResult.data,
    signAsset: dependencies.signAsset,
    now,
    ttlSeconds,
  });
  const room = await context.projectRoom(input.room);
  const messages = await Promise.all(
    input.messages.map((message) => context.projectMessage(message)),
  );

  return { room, messages, next_after: input.nextAfter };
}

class ProjectionContext {
  private readonly assets: Map<string, ApprovedMediaAsset>;
  private readonly signedAssets = new Map<string, Promise<StoryChatRenderAsset>>();

  constructor(private readonly input: {
    graph: ExperienceGraph;
    childDisplayName: string;
    signAsset: StoryChatAssetSigner;
    now: Date;
    ttlSeconds: number;
  }) {
    this.assets = new Map(input.graph.mediaManifest.assets.map((asset) => [asset.id, asset]));
  }

  async projectRoom(room: StoryChatRoomRecord): Promise<StoryChatRoomPresentation> {
    const { graph } = this.input;
    const primary = graph.playerGraph.characters.find(
      (character) => character.id === graph.presentation.primaryCharacterId,
    );
    if (!primary?.avatarMediaId) {
      throw new StoryChatProjectionError('invalid_message_reference');
    }

    return {
      id: room.id,
      status: room.status,
      title: this.renderText(graph.presentation.title),
      subtitle: this.renderText(graph.presentation.subtitle),
      summary: this.renderText(graph.presentation.summary),
      cover_alt_text: this.renderText(graph.presentation.coverAltText),
      cover: await this.requireSignedAsset(graph.presentation.coverMediaId),
      primary_character: await this.projectCharacter(primary.id),
      current_node_id: room.currentNodeId,
      revision: room.revision,
      message_sequence: room.messageSequence,
      created_at: room.createdAt,
      updated_at: room.updatedAt,
    };
  }

  async projectMessage(message: StoryChatMessageRecord): Promise<StoryChatRenderedMessage> {
    if (message.actor === 'child') return this.projectChildChoice(message);

    const node = this.input.graph.chatGraph.nodes.find(
      (candidate) => candidate.id === message.authoredContentId,
    );
    if (!node || message.messageKind !== publicMessageKind(node.type)) {
      throw new StoryChatProjectionError('invalid_message_reference');
    }
    if (node.type !== 'character_text' && message.actor !== 'system') {
      throw new StoryChatProjectionError('invalid_message_reference');
    }

    const base = {
      id: message.id,
      room_id: message.roomId,
      sequence_no: message.sequenceNo,
      actor: message.actor,
      created_at: message.createdAt,
    } as const;

    switch (node.type) {
      case 'character_text': {
        if (message.actor !== 'character') {
          throw new StoryChatProjectionError('invalid_message_reference');
        }
        return {
          ...base,
          type: node.type,
          node_id: node.id,
          character: await this.projectCharacter(node.characterId),
          text: this.renderText(node.text),
        };
      }
      case 'child_prompt':
        return {
          ...base,
          type: node.type,
          node_id: node.id,
          prompt: this.renderText(node.prompt),
          input_mode: 'authored_only',
        };
      case 'choice':
      case 'quick_reply':
        return {
          ...base,
          type: node.type,
          node_id: node.id,
          prompt: this.renderText(node.prompt),
          options: node.options.map((option) => ({
            id: option.id,
            label: this.renderText(option.label),
          })),
        };
      case 'cinematic':
        return {
          ...base,
          type: node.type,
          node_id: node.id,
          title: this.renderText(node.title),
          description: this.renderText(node.description),
          video: await this.requireSignedAsset(node.mediaId),
          poster: await this.requireSignedAsset(node.posterMediaId),
          subtitles: await this.requireSignedAsset(node.subtitleMediaId),
          autoplay: false,
          subtitles_default_on: true,
          can_replay: true,
        };
      case 'generated_image_recipe': {
        const recipe = this.input.graph.mediaManifest.imageRecipes.find(
          (candidate) => candidate.id === node.mediaId,
        );
        if (!recipe) throw new StoryChatProjectionError('invalid_message_reference');
        return {
          ...base,
          type: 'generated_image',
          node_id: node.id,
          status: 'not_generated',
          alt_text: this.renderText(node.altText),
          aspect_ratio: recipe.aspectRatio,
        };
      }
      case 'quiz': {
        const quiz = this.input.graph.quizGraph.quizzes.find(
          (candidate) => candidate.id === node.quizId,
        );
        if (!quiz) throw new StoryChatProjectionError('invalid_message_reference');
        return {
          ...base,
          type: node.type,
          node_id: node.id,
          prompt: this.renderText(quiz.prompt),
          options: quiz.options.map((option) => ({
            id: option.id,
            label: this.renderText(option.label),
          })),
        };
      }
      case 'minigame': {
        const game = this.input.graph.gameGraph.games.find(
          (candidate) => candidate.id === node.gameId,
        );
        if (!game) throw new StoryChatProjectionError('invalid_message_reference');
        return {
          ...base,
          type: node.type,
          node_id: node.id,
          template: game.template,
          prompt: this.renderText(game.prompt),
          items: await Promise.all(game.items.map(async (item) => ({
            id: item.id,
            label: this.renderText(item.label),
            media: item.mediaId ? await this.requireSignedAsset(item.mediaId) : null,
          }))),
        };
      }
      case 'system_transition':
        return {
          ...base,
          type: node.type,
          node_id: node.id,
          transition_kind: node.transitionKind,
          message: this.renderText(node.message),
        };
      case 'ending':
        return {
          ...base,
          type: node.type,
          node_id: node.id,
          ending_kind: node.endingKind,
          summary: this.renderText(node.summary),
        };
    }
  }

  private projectChildChoice(
    message: StoryChatMessageRecord,
  ): StoryChatRenderedMessage {
    if (message.messageKind !== 'child_choice' || !message.authoredContextId) {
      throw new StoryChatProjectionError('invalid_message_reference');
    }
    const source = this.input.graph.chatGraph.nodes.find(
      (candidate) => candidate.id === message.authoredContextId,
    );
    if (source?.type !== 'choice' && source?.type !== 'quick_reply') {
      throw new StoryChatProjectionError('invalid_message_reference');
    }
    const option = source.options.find(
      (candidate) => candidate.id === message.authoredContentId,
    );
    if (!option) throw new StoryChatProjectionError('invalid_message_reference');

    return {
      id: message.id,
      room_id: message.roomId,
      sequence_no: message.sequenceNo,
      actor: 'child',
      created_at: message.createdAt,
      type: 'child_choice',
      source_node_id: source.id,
      option_id: option.id,
      label: this.renderText(option.label),
    };
  }

  private async projectCharacter(characterId: string): Promise<StoryChatRenderActor> {
    const character = this.input.graph.playerGraph.characters.find(
      (candidate) => candidate.id === characterId,
    );
    if (!character) throw new StoryChatProjectionError('invalid_message_reference');
    const isChild = character.id === this.input.graph.playerGraph.protagonistCharacterId;
    return {
      id: character.id,
      display_name: isChild
        ? this.input.childDisplayName
        : this.renderText(character.displayName),
      avatar: character.avatarMediaId
        ? await this.requireSignedAsset(character.avatarMediaId)
        : null,
    };
  }

  private requireSignedAsset(assetId: string): Promise<StoryChatRenderAsset> {
    const existing = this.signedAssets.get(assetId);
    if (existing) return existing;
    const pending = this.createSignedAsset(assetId);
    this.signedAssets.set(assetId, pending);
    return pending;
  }

  private async createSignedAsset(assetId: string): Promise<StoryChatRenderAsset> {
    const asset = this.assets.get(assetId);
    if (!asset || asset.safetyStatus !== 'approved') {
      throw new StoryChatProjectionError('media_unavailable');
    }

    let signedInput: unknown;
    try {
      signedInput = await this.input.signAsset({
        assetId: asset.id,
        storageKey: asset.storageKey,
        sha256: asset.sha256,
        mimeType: asset.mimeType,
        expiresInSeconds: this.input.ttlSeconds,
      });
    } catch {
      throw new StoryChatProjectionError('media_unavailable');
    }
    const result = SignedAssetResultSchema.safeParse(signedInput);
    if (!result.success || !isSafeSignedUrl(result.data.url)) {
      throw new StoryChatProjectionError('media_unavailable');
    }
    const expiresAt = Date.parse(result.data.expiresAt);
    const maximumExpiry = this.input.now.getTime()
      + this.input.ttlSeconds * 1_000
      + SIGNED_ASSET_CLOCK_SKEW_MS;
    if (expiresAt <= this.input.now.getTime() || expiresAt > maximumExpiry) {
      throw new StoryChatProjectionError('media_unavailable');
    }

    return {
      asset_id: asset.id,
      url: result.data.url,
      expires_at: result.data.expiresAt,
      mime_type: asset.mimeType,
      width: asset.width ?? null,
      height: asset.height ?? null,
      duration_ms: asset.durationMs ?? null,
    };
  }

  private renderText(value: string): string {
    return value.replaceAll('{{child_name}}', this.input.childDisplayName);
  }
}

function requireMatchingGraph(
  room: StoryChatRoomRecord,
  snapshot: VerifiedContentReleaseGraphSnapshot,
): ExperienceGraph {
  if (
    snapshot.release.releaseId !== room.releaseId
    || snapshot.release.experienceId !== room.experienceId
    || snapshot.release.releaseVersion !== room.releaseVersion
    || snapshot.release.manifestSha256 !== room.releaseManifestSha256
  ) {
    throw new StoryChatProjectionError('release_mismatch');
  }

  try {
    const graph = parseExperienceGraph(snapshot.graph);
    if (
      graph.experienceId !== room.experienceId
      || graph.releaseVersion !== room.releaseVersion
    ) {
      throw new StoryChatProjectionError('release_mismatch');
    }
    return graph;
  } catch (error) {
    if (error instanceof StoryChatProjectionError) throw error;
    throw new StoryChatProjectionError('release_mismatch');
  }
}

function publicMessageKind(
  nodeType: ExperienceGraph['chatGraph']['nodes'][number]['type'],
) {
  return nodeType === 'generated_image_recipe' ? 'generated_image' : nodeType;
}

function isSafeSignedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.username === ''
      && url.password === ''
      && url.hash === '';
  } catch {
    return false;
  }
}
