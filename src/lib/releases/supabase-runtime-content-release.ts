import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import {
  CONTENT_RELEASE_AUDIENCE,
  CONTENT_RELEASE_ISSUER,
} from '@/contracts/content-release.v1';
import {
  CONTENT_RELEASE_OBJECT_DEADLINE_MS,
  isAllowedPrivateReleaseSignedUrl,
  readBoundedReleaseResponse,
  type ContentReleaseRuntimeRegistry,
  type PrivateReleaseObjectStore,
  type RuntimeContentReleasePin,
  type RuntimeContentReleaseRecord,
  type RuntimeReleaseChannel,
  type RuntimeTrustedReleaseKeyRecord,
} from './runtime-content-release';

type RuntimeReleaseSupabaseClient = Pick<SupabaseClient, 'from' | 'rpc'>;
type RuntimeReleaseStorageClient = Pick<SupabaseClient, 'storage'>;

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

const PositiveSafeIntegerSchema = SafeIntegerSchema.refine((value) => value > 0);
const TimestampSchema = z.string().datetime({ offset: true });

const ReleaseRowSchema = z.object({
  release_id: z.string().min(1).max(120),
  experience_id: z.string().min(1).max(96),
  release_version: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
  version_major: SafeIntegerSchema,
  version_minor: SafeIntegerSchema,
  version_patch: SafeIntegerSchema,
  channel: z.enum(['staging', 'production']),
  manifest_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  manifest_object_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  manifest_size_bytes: PositiveSafeIntegerSchema,
  manifest_storage_key: z.string().min(1).max(512),
  graph_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  graph_size_bytes: PositiveSafeIntegerSchema,
  graph_storage_key: z.string().min(1).max(512),
  signature_key_id: z.string().min(1).max(120),
  assets_verified_at: TimestampSchema,
  activation_sequence: PositiveSafeIntegerSchema,
  status: z.literal('verified'),
}).strict();

const ChannelHeadRowSchema = z.object({
  experience_id: z.string().min(1).max(96),
  channel: z.enum(['staging', 'production']),
  head_release_id: z.string().min(1).max(120),
  head_activation_sequence: PositiveSafeIntegerSchema,
  head_version_major: SafeIntegerSchema,
  head_version_minor: SafeIntegerSchema,
  head_version_patch: SafeIntegerSchema,
  minimum_version_major: SafeIntegerSchema,
  minimum_version_minor: SafeIntegerSchema,
  minimum_version_patch: SafeIntegerSchema,
}).strict();

const TrustedKeyRowSchema = z.object({
  key_id: z.string().min(1).max(120),
  algorithm: z.literal('ed25519'),
  issuer: z.literal(CONTENT_RELEASE_ISSUER),
  audience: z.literal(CONTENT_RELEASE_AUDIENCE),
  public_key_spki_pem: z.string().min(1).max(2_048),
  allowed_channels: z.array(z.enum(['staging', 'production'])).min(1).max(2),
  valid_from: TimestampSchema,
  valid_until: TimestampSchema,
  revoked_at: TimestampSchema.nullable(),
}).strict();

type ReleaseRow = z.infer<typeof ReleaseRowSchema>;
type ChannelHeadRow = z.infer<typeof ChannelHeadRowSchema>;

export class SupabaseContentReleaseRuntimeRegistry
implements ContentReleaseRuntimeRegistry {
  constructor(private readonly client: RuntimeReleaseSupabaseClient) {}

  async findEligibleRelease(input: {
    pin: RuntimeContentReleasePin;
    channel: RuntimeReleaseChannel;
  }): Promise<RuntimeContentReleaseRecord | null> {
    const { data: releaseData, error: releaseError } = await this.client
      .from('content_release_registry')
      .select([
        'release_id',
        'experience_id',
        'release_version',
        'version_major',
        'version_minor',
        'version_patch',
        'channel',
        'manifest_sha256',
        'manifest_object_sha256',
        'manifest_size_bytes',
        'manifest_storage_key',
        'graph_sha256',
        'graph_size_bytes',
        'graph_storage_key',
        'signature_key_id',
        'assets_verified_at',
        'activation_sequence',
        'status',
      ].join(','))
      .eq('release_id', input.pin.releaseId)
      .eq('experience_id', input.pin.experienceId)
      .eq('release_version', input.pin.releaseVersion)
      .eq('manifest_sha256', input.pin.releaseManifestSha256)
      .eq('channel', input.channel)
      .eq('status', 'verified')
      .maybeSingle();
    assertDatabaseResult(releaseError);
    if (!releaseData) return null;
    const release = ReleaseRowSchema.parse(releaseData);

    const { data: headData, error: headError } = await this.client
      .from('content_release_channel_heads')
      .select([
        'experience_id',
        'channel',
        'head_release_id',
        'head_activation_sequence',
        'head_version_major',
        'head_version_minor',
        'head_version_patch',
        'minimum_version_major',
        'minimum_version_minor',
        'minimum_version_patch',
      ].join(','))
      .eq('experience_id', input.pin.experienceId)
      .eq('channel', input.channel)
      .maybeSingle();
    assertDatabaseResult(headError);
    if (!headData) return null;
    const head = ChannelHeadRowSchema.parse(headData);

    if (!isReleaseInsideActivatedWindow(release, head)) return null;
    return toRuntimeRecord(release);
  }

  async findTrustedKey(keyId: string): Promise<RuntimeTrustedReleaseKeyRecord | null> {
    const { data, error } = await this.client
      .from('content_release_trusted_keys')
      .select([
        'key_id',
        'algorithm',
        'issuer',
        'audience',
        'public_key_spki_pem',
        'allowed_channels',
        'valid_from',
        'valid_until',
        'revoked_at',
      ].join(','))
      .eq('key_id', keyId)
      .eq('algorithm', 'ed25519')
      .eq('issuer', CONTENT_RELEASE_ISSUER)
      .eq('audience', CONTENT_RELEASE_AUDIENCE)
      .maybeSingle();
    assertDatabaseResult(error);
    if (!data) return null;
    const key = TrustedKeyRowSchema.parse(data);
    return {
      keyId: key.key_id,
      issuer: key.issuer,
      audience: key.audience,
      publicKey: key.public_key_spki_pem,
      allowedChannels: key.allowed_channels,
      validFrom: key.valid_from,
      validUntil: key.valid_until,
      ...(key.revoked_at === null ? {} : { revokedAt: key.revoked_at }),
    };
  }

  async confirmEligibility(input: {
    record: RuntimeContentReleaseRecord;
    checkedAt: string;
  }): Promise<boolean> {
    const { data, error } = await this.client.rpc(
      'confirm_content_release_runtime_eligibility',
      {
        p_release_id: input.record.releaseId,
        p_experience_id: input.record.experienceId,
        p_release_version: input.record.releaseVersion,
        p_manifest_sha256: input.record.manifestSha256,
        p_channel: input.record.channel,
        p_activation_sequence: input.record.activationSequence,
        p_signature_key_id: input.record.signatureKeyId,
        p_checked_at: input.checkedAt,
      },
    );
    assertDatabaseResult(error);
    return data === true;
  }
}

export class SupabasePrivateReleaseObjectStore implements PrivateReleaseObjectStore {
  constructor(
    private readonly client: RuntimeReleaseStorageClient,
    private readonly bucket: string,
    private readonly allowedOrigin: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly deadlineMs: number = CONTENT_RELEASE_OBJECT_DEADLINE_MS,
  ) {
    if (!/^[a-z0-9][a-z0-9._-]{1,62}$/.test(bucket)) {
      throw new Error('invalid private release bucket');
    }
    const origin = new URL(allowedOrigin);
    if (origin.origin !== allowedOrigin || origin.username || origin.password) {
      throw new Error('invalid private release origin');
    }
    if (
      !Number.isSafeInteger(deadlineMs)
      || deadlineMs < 1
      || deadlineMs > 30_000
    ) {
      throw new Error('invalid private release deadline');
    }
  }

  async readObject(input: {
    storageKey: string;
    expectedSizeBytes: number;
    maximumBytes: number;
  }): Promise<Uint8Array | null> {
    if (
      !Number.isSafeInteger(input.expectedSizeBytes)
      || input.expectedSizeBytes < 1
      || !Number.isSafeInteger(input.maximumBytes)
      || input.maximumBytes < 1
      || input.expectedSizeBytes > input.maximumBytes
    ) return null;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<null>((resolve) => {
      timeout = setTimeout(() => {
        controller.abort(new Error('content release object deadline exceeded'));
        resolve(null);
      }, this.deadlineMs);
    });

    const operation = this.readObjectBeforeDeadline(input, controller);
    try {
      return await Promise.race([operation, deadline]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  private async readObjectBeforeDeadline(
    input: {
      storageKey: string;
      expectedSizeBytes: number;
      maximumBytes: number;
    },
    controller: AbortController,
  ): Promise<Uint8Array | null> {
    try {
      const { data, error } = await this.client.storage
        .from(this.bucket)
        .createSignedUrl(input.storageKey, 30);
      if (controller.signal.aborted || error || !data?.signedUrl) return null;

      if (!isAllowedPrivateReleaseSignedUrl(data.signedUrl, this.allowedOrigin)) {
        return null;
      }
      const signedUrl = new URL(data.signedUrl);

      const response = await this.fetcher(signedUrl, {
        method: 'GET',
        redirect: 'error',
        cache: 'no-store',
        signal: controller.signal,
      });
      return await readBoundedReleaseResponse(response, {
        expectedSizeBytes: input.expectedSizeBytes,
        maximumBytes: input.maximumBytes,
        abort: () => controller.abort(),
        signal: controller.signal,
      });
    } catch {
      controller.abort();
      return null;
    }
  }
}

export function isReleaseInsideActivatedWindow(
  release: ReleaseRow,
  head: ChannelHeadRow,
): boolean {
  if (
    release.experience_id !== head.experience_id
    || release.channel !== head.channel
    || release.activation_sequence > head.head_activation_sequence
  ) {
    return false;
  }
  const version = [
    release.version_major,
    release.version_minor,
    release.version_patch,
  ] as const;
  const minimum = [
    head.minimum_version_major,
    head.minimum_version_minor,
    head.minimum_version_patch,
  ] as const;
  const maximum = [
    head.head_version_major,
    head.head_version_minor,
    head.head_version_patch,
  ] as const;
  return compareSemver(version, minimum) >= 0 && compareSemver(version, maximum) <= 0;
}

function compareSemver(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function toRuntimeRecord(row: ReleaseRow): RuntimeContentReleaseRecord {
  return {
    releaseId: row.release_id,
    experienceId: row.experience_id,
    releaseVersion: row.release_version,
    channel: row.channel,
    manifestSha256: row.manifest_sha256,
    manifestObjectSha256: row.manifest_object_sha256,
    manifestSizeBytes: row.manifest_size_bytes,
    manifestStorageKey: row.manifest_storage_key,
    graphSha256: row.graph_sha256,
    graphSizeBytes: row.graph_size_bytes,
    graphStorageKey: row.graph_storage_key,
    signatureKeyId: row.signature_key_id,
    assetsVerifiedAt: row.assets_verified_at,
    activationSequence: row.activation_sequence,
  };
}

function assertDatabaseResult(error: unknown): void {
  if (error) throw new Error('content release registry unavailable', { cause: error });
}
