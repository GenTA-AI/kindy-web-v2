import { createHash, type KeyObject } from 'node:crypto';

import { z } from 'zod';

import {
  CONTENT_RELEASE_AUDIENCE,
  CONTENT_RELEASE_ISSUER,
  canonicalizeReleaseJson,
  type ContentRelease,
} from '@/contracts/content-release.v1';
import type { ExperienceGraph } from '@/contracts/experience-graph.v1';
import type { StoryChatRoomRecord } from '@/types/story-chat-api';
import type { ApprovedStoryGraphProvider } from '@/lib/story-chat/authored-runtime';
import {
  verifyContentReleaseGraph,
  type TrustedReleaseKey,
} from './verify-content-release';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_GRAPH_BYTES = 8 * 1024 * 1024;
export const CONTENT_RELEASE_OBJECT_DEADLINE_MS = 4_000;

const StorageKeySchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^releases\/[a-zA-Z0-9._\/-]+$/)
  .refine(
    (value) =>
      !value.includes('..')
      && !value.includes('//')
      && !value.includes('/./')
      && !value.endsWith('/'),
    'invalid private release storage key',
  );

const PositiveSafeIntegerSchema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);

const RuntimeContentReleaseRecordSchema = z.object({
  releaseId: z.string().min(1).max(120),
  experienceId: z.string().min(1).max(96),
  releaseVersion: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
  channel: z.enum(['staging', 'production']),
  manifestSha256: z.string().regex(SHA256_PATTERN),
  manifestObjectSha256: z.string().regex(SHA256_PATTERN),
  manifestSizeBytes: PositiveSafeIntegerSchema.max(MAX_MANIFEST_BYTES),
  manifestStorageKey: StorageKeySchema,
  graphSha256: z.string().regex(SHA256_PATTERN),
  graphSizeBytes: PositiveSafeIntegerSchema.max(MAX_GRAPH_BYTES),
  graphStorageKey: StorageKeySchema,
  signatureKeyId: z.string().min(1).max(120),
  assetsVerifiedAt: z.string().datetime({ offset: true }),
  activationSequence: PositiveSafeIntegerSchema,
}).strict();

const RuntimeTrustedReleaseKeyMetadataSchema = z.object({
  keyId: z.string().min(1).max(120),
  issuer: z.literal(CONTENT_RELEASE_ISSUER),
  audience: z.literal(CONTENT_RELEASE_AUDIENCE),
  allowedChannels: z.array(z.enum(['staging', 'production'])).min(1).max(2),
  validFrom: z.string().datetime({ offset: true }),
  validUntil: z.string().datetime({ offset: true }),
  revokedAt: z.string().datetime({ offset: true }).optional(),
}).strict();

export type RuntimeReleaseChannel = ContentRelease['channel'];

export type RuntimeContentReleasePin = Pick<
  StoryChatRoomRecord,
  'releaseId' | 'experienceId' | 'releaseVersion' | 'releaseManifestSha256'
>;

export type RuntimeContentReleaseRecord = z.infer<
  typeof RuntimeContentReleaseRecordSchema
>;

export type RuntimeTrustedReleaseKeyRecord = TrustedReleaseKey & {
  issuer: typeof CONTENT_RELEASE_ISSUER;
  audience: typeof CONTENT_RELEASE_AUDIENCE;
};

export interface ContentReleaseRuntimeRegistry {
  /** Returns only fully verified, activated, non-revoked release records. */
  findEligibleRelease(input: {
    pin: RuntimeContentReleasePin;
    channel: RuntimeReleaseChannel;
  }): Promise<RuntimeContentReleaseRecord | null>;

  /** Returns one administratively allowlisted Ed25519 public key. */
  findTrustedKey(keyId: string): Promise<RuntimeTrustedReleaseKeyRecord | null>;

  /** Re-checks release/head/key revocation after object I/O and crypto work. */
  confirmEligibility(input: {
    record: RuntimeContentReleaseRecord;
    checkedAt: string;
  }): Promise<boolean>;
}

export interface PrivateReleaseObjectStore {
  /**
   * Streams private bytes through strict declared and actual byte bounds.
   * Implementations must never return or persist a signed URL.
   */
  readObject(input: {
    storageKey: string;
    expectedSizeBytes: number;
    maximumBytes: number;
  }): Promise<Uint8Array | null>;
}

export type VerifiedContentReleaseGraphLoaderDependencies = {
  registry: ContentReleaseRuntimeRegistry;
  objectStore: PrivateReleaseObjectStore;
  channel: RuntimeReleaseChannel;
  now?: () => Date;
};

export type VerifiedContentReleaseGraphSnapshot = {
  release: ContentRelease;
  graph: ExperienceGraph;
};

/**
 * Loads authored chat graphs only through an activated registry pin and then
 * re-verifies the signed manifest and exact graph bytes on every cold load.
 * Any registry, storage, parsing, trust, or cryptographic failure is a closed
 * `null` result; there is intentionally no demo or unsigned fallback.
 */
export class VerifiedContentReleaseGraphLoader {
  constructor(
    private readonly dependencies: VerifiedContentReleaseGraphLoaderDependencies,
  ) {}

  async load(
    pin: RuntimeContentReleasePin,
  ): Promise<VerifiedContentReleaseGraphSnapshot | null> {
    try {
      return await this.loadVerifiedGraph(pin);
    } catch {
      return null;
    }
  }

  private async loadVerifiedGraph(
    pin: RuntimeContentReleasePin,
  ): Promise<VerifiedContentReleaseGraphSnapshot | null> {
    const recordInput = await this.dependencies.registry.findEligibleRelease({
      pin,
      channel: this.dependencies.channel,
    });
    if (!recordInput) return null;

    const record = RuntimeContentReleaseRecordSchema.parse(recordInput);
    assertRecordMatchesPin(record, pin, this.dependencies.channel);

    const expectedPrefix = `releases/${record.experienceId}/${record.releaseVersion}/`;
    if (
      record.manifestStorageKey !== `${expectedPrefix}content-release.json`
      || !record.graphStorageKey.startsWith(expectedPrefix)
    ) {
      return null;
    }

    const manifestBytes = await this.dependencies.objectStore.readObject({
      storageKey: record.manifestStorageKey,
      expectedSizeBytes: record.manifestSizeBytes,
      maximumBytes: MAX_MANIFEST_BYTES,
    });
    if (!matchesObservedObject(manifestBytes, {
      sha256: record.manifestObjectSha256,
      sizeBytes: record.manifestSizeBytes,
      maximumBytes: MAX_MANIFEST_BYTES,
    })) {
      return null;
    }

    const manifest = parseCanonicalJson(manifestBytes);
    if (!isRecord(manifest)) return null;
    const signature = manifest.signature;
    if (!isRecord(signature) || signature.keyId !== record.signatureKeyId) {
      return null;
    }

    const trustedKeyInput = await this.dependencies.registry.findTrustedKey(
      record.signatureKeyId,
    );
    if (!trustedKeyInput) return null;
    const trustedKey = parseTrustedKey(trustedKeyInput);

    const graphBytes = await this.dependencies.objectStore.readObject({
      storageKey: record.graphStorageKey,
      expectedSizeBytes: record.graphSizeBytes,
      maximumBytes: MAX_GRAPH_BYTES,
    });
    if (!matchesObservedObject(graphBytes, {
      sha256: record.graphSha256,
      sizeBytes: record.graphSizeBytes,
      maximumBytes: MAX_GRAPH_BYTES,
    })) {
      return null;
    }
    const verificationTime = (this.dependencies.now ?? (() => new Date()))().toISOString();
    const verified = verifyContentReleaseGraph({
      manifestBytes,
      experienceGraphBytes: graphBytes,
      expectedRelease: {
        releaseId: record.releaseId,
        experienceId: record.experienceId,
        releaseVersion: record.releaseVersion,
        channel: record.channel,
      },
      trustedKey,
      verificationTime,
    });

    if (
      verified.release.manifestSha256 !== record.manifestSha256
      || verified.release.graph.storageKey !== record.graphStorageKey
      || verified.release.graph.sha256 !== record.graphSha256
      || verified.release.graph.sizeBytes !== record.graphSizeBytes
    ) {
      return null;
    }

    const stillEligible = await this.dependencies.registry.confirmEligibility({
      record,
      checkedAt: (this.dependencies.now ?? (() => new Date()))().toISOString(),
    });
    if (!stillEligible) return null;

    return {
      release: verified.release,
      graph: verified.experienceGraph,
    };
  }
}

/** Story-chat adapter over the reusable, verification-branded graph loader. */
export class VerifiedStoryGraphProvider implements ApprovedStoryGraphProvider {
  constructor(private readonly loader: VerifiedContentReleaseGraphLoader) {}

  async loadApprovedGraph(room: StoryChatRoomRecord): Promise<{
    releaseId: string;
    releaseManifestSha256: string;
    graph: unknown;
  } | null> {
    const verified = await this.loader.load(room);
    return verified && {
      releaseId: verified.release.releaseId,
      releaseManifestSha256: verified.release.manifestSha256,
      graph: verified.graph,
    };
  }
}

function assertRecordMatchesPin(
  record: RuntimeContentReleaseRecord,
  pin: RuntimeContentReleasePin,
  channel: RuntimeReleaseChannel,
): void {
  if (
    record.releaseId !== pin.releaseId
    || record.experienceId !== pin.experienceId
    || record.releaseVersion !== pin.releaseVersion
    || record.manifestSha256 !== pin.releaseManifestSha256
    || record.channel !== channel
  ) {
    throw new Error('content release registry pin mismatch');
  }
}

function parseTrustedKey(input: RuntimeTrustedReleaseKeyRecord): TrustedReleaseKey {
  const metadata = RuntimeTrustedReleaseKeyMetadataSchema.parse({
    keyId: input.keyId,
    issuer: input.issuer,
    audience: input.audience,
    allowedChannels: input.allowedChannels,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    ...(input.revokedAt === undefined ? {} : { revokedAt: input.revokedAt }),
  });
  if (!isPublicKeyInput(input.publicKey)) {
    throw new Error('invalid release public key input');
  }
  return {
    keyId: metadata.keyId,
    publicKey: input.publicKey,
    allowedChannels: metadata.allowedChannels,
    validFrom: metadata.validFrom,
    validUntil: metadata.validUntil,
    ...(metadata.revokedAt === undefined ? {} : { revokedAt: metadata.revokedAt }),
  };
}

function isPublicKeyInput(value: unknown): value is KeyObject | string | Buffer {
  return typeof value === 'string'
    || Buffer.isBuffer(value)
    || (value !== null && typeof value === 'object' && 'type' in value);
}

function matchesObservedObject(
  bytes: Uint8Array | null,
  expected: { sha256: string; sizeBytes: number; maximumBytes: number },
): bytes is Uint8Array {
  return Boolean(
    bytes
    && bytes.byteLength > 0
    && bytes.byteLength <= expected.maximumBytes
    && bytes.byteLength === expected.sizeBytes
    && sha256Bytes(bytes) === expected.sha256,
  );
}

function parseCanonicalJson(bytes: Uint8Array): unknown {
  const source = decodeUtf8(bytes);
  const parsed: unknown = JSON.parse(source);
  if (canonicalizeReleaseJson(parsed) !== source) {
    throw new Error('release manifest bytes are not canonical');
  }
  return parsed;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Reads a fetch response without ever asking the platform to materialize a
 * Blob/ArrayBuffer first. Content-Length is only a preflight; the streamed
 * byte counter is independently enforced and must end at the exact registry
 * size. Any mismatch cancels the reader and aborts the underlying request.
 */
export async function readBoundedReleaseResponse(
  response: Response,
  input: {
    expectedSizeBytes: number;
    maximumBytes: number;
    abort?: () => void;
    signal?: AbortSignal;
  },
): Promise<Uint8Array | null> {
  const reject = async (
    reader?: ReadableStreamDefaultReader<Uint8Array>,
  ): Promise<null> => {
    input.abort?.();
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // The request is already aborted; cancellation failure stays closed.
      }
    }
    return null;
  };

  if (
    !Number.isSafeInteger(input.expectedSizeBytes)
    || input.expectedSizeBytes < 1
    || !Number.isSafeInteger(input.maximumBytes)
    || input.maximumBytes < 1
    || input.expectedSizeBytes > input.maximumBytes
    || !response.ok
    || !response.body
  ) {
    return reject();
  }

  const contentEncoding = response.headers.get('content-encoding');
  const contentLengthText = response.headers.get('content-length');
  if (
    (contentEncoding !== null && contentEncoding !== 'identity')
    || contentLengthText === null
    || !/^(0|[1-9]\d*)$/.test(contentLengthText)
  ) {
    return reject(response.body.getReader());
  }
  const declaredSize = Number(contentLengthText);
  if (
    !Number.isSafeInteger(declaredSize)
    || declaredSize !== input.expectedSizeBytes
    || declaredSize > input.maximumBytes
  ) {
    return reject(response.body.getReader());
  }

  const reader = response.body.getReader();
  if (input.signal?.aborted) return reject(reader);
  const cancelOnAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  input.signal?.addEventListener('abort', cancelOnAbort, { once: true });
  const bytes = new Uint8Array(declaredSize);
  let offset = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (
        !(value instanceof Uint8Array)
        || value.byteLength < 1
        || offset + value.byteLength > declaredSize
        || offset + value.byteLength > input.maximumBytes
      ) {
        return reject(reader);
      }
      bytes.set(value, offset);
      offset += value.byteLength;
    }
  } catch {
    return reject(reader);
  } finally {
    input.signal?.removeEventListener('abort', cancelOnAbort);
  }
  if (offset !== declaredSize) return reject(reader);
  return bytes;
}

/**
 * Wraps every Supabase Storage control-plane fetch in a hard wall-clock
 * deadline. This is used for signed-URL creation; the object GET has an
 * additional end-to-end deadline in the object-store adapter.
 */
export function createDeadlineFetch(
  deadlineMs: number = CONTENT_RELEASE_OBJECT_DEADLINE_MS,
  baseFetch: typeof fetch = fetch,
): typeof fetch {
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 30_000) {
    throw new Error('invalid release fetch deadline');
  }

  return (async (resource: URL | RequestInfo, init?: RequestInit) => {
    const controller = new AbortController();
    const upstreamSignal = init?.signal;
    const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
    if (upstreamSignal?.aborted) abortFromUpstream();
    else upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
    const timer = setTimeout(
      () => controller.abort(new Error('content release fetch deadline exceeded')),
      deadlineMs,
    );
    const cleanup = () => {
      clearTimeout(timer);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    };
    let response: Response;
    try {
      response = await baseFetch(resource, { ...init, signal: controller.signal });
    } catch (error) {
      cleanup();
      throw error;
    }

    // fetch() resolves at headers, while Supabase Storage still has to consume
    // the JSON response body. Keep the same deadline alive through body EOF so
    // a server that sends headers and then stalls cannot accumulate sockets.
    if (!response.body) {
      cleanup();
      return response;
    }
    const reader = response.body.getReader();
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    let settled = false;
    const settle = () => {
      if (settled) return false;
      settled = true;
      controller.signal.removeEventListener('abort', abortBody);
      cleanup();
      return true;
    };
    const abortBody = () => {
      if (!settle()) return;
      const reason = controller.signal.reason
        ?? new Error('content release fetch aborted');
      streamController?.error(reason);
      void reader.cancel(reason).catch(() => undefined);
    };
    const guardedBody = new ReadableStream<Uint8Array>({
      start(currentController) {
        streamController = currentController;
      },
      async pull(currentController) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            if (settle()) currentController.close();
            return;
          }
          if (!settled) currentController.enqueue(value);
        } catch (error) {
          if (settle()) currentController.error(error);
        }
      },
      async cancel(reason) {
        settle();
        await reader.cancel(reason);
      },
    });
    controller.signal.addEventListener('abort', abortBody, { once: true });
    if (controller.signal.aborted) abortBody();

    return new Response(guardedBody, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }) as typeof fetch;
}

export function isAllowedPrivateReleaseSignedUrl(
  value: string,
  allowedOrigin: string,
): boolean {
  try {
    const parsed = new URL(value);
    return (
      parsed.origin === allowedOrigin
      && !parsed.username
      && !parsed.password
      && !parsed.hash
      && parsed.pathname.startsWith('/storage/v1/object/sign/')
    );
  } catch {
    return false;
  }
}

/**
 * Browser asset URLs are stricter than the short-lived URLs used internally
 * to verify release bytes: the URL must name the exact approved object in the
 * fixed private bucket. A signer cannot ignore or replace the storage key it
 * was asked to sign.
 */
export function isAllowedPrivateReleaseAssetSignedUrl(
  value: string,
  input: {
    allowedOrigin: string;
    bucket: string;
    storageKey: string;
  },
): boolean {
  try {
    const parsed = new URL(value);
    const expectedPath = `/storage/v1/object/sign/${input.bucket}/${input.storageKey}`;
    return (
      isAllowedPrivateReleaseSignedUrl(value, input.allowedOrigin)
      && parsed.pathname === expectedPath
      && parsed.searchParams.size === 1
      && Boolean(parsed.searchParams.get('token'))
    );
  } catch {
    return false;
  }
}
