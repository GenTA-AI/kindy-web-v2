import 'server-only';

import { createHash } from 'node:crypto';

import type { PrivateReleaseObjectStore } from './runtime-content-release';
import {
  CONTENT_RELEASE_OBJECT_DEADLINE_MS,
  readBoundedReleaseResponse,
} from './runtime-content-release';

const GCS_ORIGIN = 'https://storage.googleapis.com';
const IAM_CREDENTIALS_ORIGIN = 'https://iamcredentials.googleapis.com';
const CLOUD_RUN_METADATA_ORIGIN = 'http://metadata.google.internal';
const MAX_IAM_RESPONSE_BYTES = 64 * 1024;
const MAX_METADATA_RESPONSE_BYTES = 16 * 1024;
const MAX_BROWSER_ASSET_TTL_SECONDS = 15 * 60;

const RELEASE_STORAGE_KEY_PATTERN = /^releases\/[a-zA-Z0-9._\/-]+$/;
const RELEASE_ASSET_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const RELEASE_SHA256_PATTERN = /^[a-f0-9]{64}$/;
const RELEASE_MIME_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;
const SERVICE_ACCOUNT_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$/;
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9._~+\/-]{16,8192}={0,2}$/;

export interface GoogleCloudAccessTokenProvider {
  getAccessToken(signal: AbortSignal): Promise<string | null | undefined>;
}

/**
 * Uses only the Cloud Run metadata credential source behind ADC and requests
 * the exact attached service-account email. It never consults a key file,
 * GOOGLE_APPLICATION_CREDENTIALS, gcloud user credentials, or a private key.
 */
export class GoogleCloudRunWorkloadAccessTokenProvider
implements GoogleCloudAccessTokenProvider {
  constructor(
    private readonly serviceAccount: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    assertValidServiceAccount(serviceAccount);
  }

  async getAccessToken(signal: AbortSignal): Promise<string | null | undefined> {
    if (signal.aborted) return null;
    try {
      const metadataBase =
        `${CLOUD_RUN_METADATA_ORIGIN}/computeMetadata/v1/instance/`
          + 'service-accounts/default';
      const emailResponse = await this.fetchMetadata(
        new URL(`${metadataBase}/email`),
        signal,
      );
      if (!emailResponse) return null;
      const observedServiceAccount = (
        await readBoundedTextResponse(emailResponse, signal, 256)
      ).trim();
      if (observedServiceAccount !== this.serviceAccount) return null;

      const tokenResponse = await this.fetchMetadata(
        new URL(`${metadataBase}/token`),
        signal,
      );
      if (!tokenResponse) return null;
      return parseMetadataAccessToken(await readBoundedJsonResponse(
        tokenResponse,
        signal,
        MAX_METADATA_RESPONSE_BYTES,
      ));
    } catch {
      return null;
    }
  }

  private async fetchMetadata(
    url: URL,
    signal: AbortSignal,
  ): Promise<Response | null> {
    const response = await this.fetcher(url, {
      method: 'GET',
      headers: {
        accept: '*/*',
        'accept-encoding': 'identity',
        'metadata-flavor': 'Google',
      },
      redirect: 'error',
      cache: 'no-store',
      signal,
    });
    return response.headers.get('metadata-flavor') === 'Google'
      ? response
      : null;
  }
}

type GcsObjectStoreOptions = Readonly<{
  workloadServiceAccount?: string;
  accessTokenProvider?: GoogleCloudAccessTokenProvider;
  fetcher?: typeof fetch;
  deadlineMs?: number;
}>;

/**
 * Reads one exact object name from one constructor-bound private GCS bucket.
 * The JSON API media request cannot redirect and bytes are streamed through
 * the loader's declared size plus absolute maximum before being returned.
 */
export class GcsPrivateReleaseObjectStore implements PrivateReleaseObjectStore {
  private readonly accessTokenProvider: GoogleCloudAccessTokenProvider;
  private readonly fetcher: typeof fetch;
  private readonly deadlineMs: number;

  constructor(
    private readonly bucket: string,
    options: GcsObjectStoreOptions = {},
  ) {
    assertValidBucket(bucket);
    this.fetcher = options.fetcher ?? fetch;
    if (options.accessTokenProvider) {
      this.accessTokenProvider = options.accessTokenProvider;
    } else {
      if (!options.workloadServiceAccount) {
        throw new Error('missing GCS release workload identity');
      }
      this.accessTokenProvider = new GoogleCloudRunWorkloadAccessTokenProvider(
        options.workloadServiceAccount,
        this.fetcher,
      );
    }
    this.deadlineMs = options.deadlineMs ?? CONTENT_RELEASE_OBJECT_DEADLINE_MS;
    assertValidDeadline(this.deadlineMs);
  }

  async readObject(input: {
    storageKey: string;
    expectedSizeBytes: number;
    maximumBytes: number;
  }): Promise<Uint8Array | null> {
    if (
      !isValidReleaseStorageKey(input.storageKey)
      || !Number.isSafeInteger(input.expectedSizeBytes)
      || input.expectedSizeBytes < 1
      || !Number.isSafeInteger(input.maximumBytes)
      || input.maximumBytes < 1
      || input.expectedSizeBytes > input.maximumBytes
    ) {
      return null;
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        controller.abort(new Error('GCS release object deadline exceeded'));
        resolve(null);
      }, this.deadlineMs);
    });

    const operation = this.readBeforeDeadline(input, controller);
    try {
      return await Promise.race([operation, deadline]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private async readBeforeDeadline(
    input: {
      storageKey: string;
      expectedSizeBytes: number;
      maximumBytes: number;
    },
    controller: AbortController,
  ): Promise<Uint8Array | null> {
    try {
      const accessToken = await this.accessTokenProvider.getAccessToken(
        controller.signal,
      );
      if (controller.signal.aborted || !isValidAccessToken(accessToken)) return null;

      const objectUrl = createGcsObjectMediaUrl(this.bucket, input.storageKey);
      const response = await this.fetcher(objectUrl, {
        method: 'GET',
        headers: {
          accept: 'application/octet-stream',
          'accept-encoding': 'identity',
          authorization: `Bearer ${accessToken}`,
        },
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

type GcsAssetSignerOptions = Readonly<{
  bucket: string;
  signerServiceAccount: string;
  accessTokenProvider?: GoogleCloudAccessTokenProvider;
  fetcher?: typeof fetch;
  deadlineMs?: number;
  now?: () => Date;
}>;

/**
 * Produces a GCS V4 RSA signed URL by asking IAM Credentials to sign only the
 * canonical request payload. The Cloud Run workload identity needs
 * `iam.serviceAccounts.signBlob`; no private key enters the process.
 */
export class GcsPrivateReleaseAssetSigner {
  private readonly bucket: string;
  private readonly signerServiceAccount: string;
  private readonly accessTokenProvider: GoogleCloudAccessTokenProvider;
  private readonly fetcher: typeof fetch;
  private readonly deadlineMs: number;
  private readonly now: () => Date;

  constructor(options: GcsAssetSignerOptions) {
    assertValidBucket(options.bucket);
    assertValidServiceAccount(options.signerServiceAccount);
    this.bucket = options.bucket;
    this.signerServiceAccount = options.signerServiceAccount;
    this.fetcher = options.fetcher ?? fetch;
    this.accessTokenProvider = options.accessTokenProvider
      ?? new GoogleCloudRunWorkloadAccessTokenProvider(
        options.signerServiceAccount,
        this.fetcher,
      );
    this.deadlineMs = options.deadlineMs ?? CONTENT_RELEASE_OBJECT_DEADLINE_MS;
    this.now = options.now ?? (() => new Date());
    assertValidDeadline(this.deadlineMs);
  }

  async sign(input: {
    assetId: string;
    storageKey: string;
    sha256: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<{ url: string; expiresAt: string }> {
    if (!isValidAssetSigningInput(input)) {
      throw new Error('release asset signing unavailable');
    }

    const observedNow = this.now();
    if (!Number.isFinite(observedNow.getTime())) {
      throw new Error('release asset signing unavailable');
    }
    const issuedAt = new Date(Math.floor(observedNow.getTime() / 1_000) * 1_000);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort(new Error('GCS release signing deadline exceeded'));
        reject(new Error('release asset signing unavailable'));
      }, this.deadlineMs);
    });

    try {
      return await Promise.race([
        this.signBeforeDeadline(input, issuedAt, controller),
        deadline,
      ]);
    } catch {
      controller.abort();
      throw new Error('release asset signing unavailable');
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private async signBeforeDeadline(
    input: {
      assetId: string;
      storageKey: string;
      sha256: string;
      mimeType: string;
      expiresInSeconds: number;
    },
    issuedAt: Date,
    controller: AbortController,
  ): Promise<{ url: string; expiresAt: string }> {
    const accessToken = await this.accessTokenProvider.getAccessToken(
      controller.signal,
    );
    if (controller.signal.aborted || !isValidAccessToken(accessToken)) {
      throw new Error('release asset signing unavailable');
    }

    const signingMaterial = createV4SigningMaterial({
      bucket: this.bucket,
      storageKey: input.storageKey,
      signerServiceAccount: this.signerServiceAccount,
      issuedAt,
      expiresInSeconds: input.expiresInSeconds,
    });
    const signBlobUrl = createIamSignBlobUrl(this.signerServiceAccount);
    const response = await this.fetcher(signBlobUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'accept-encoding': 'identity',
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        payload: Buffer.from(signingMaterial.stringToSign, 'utf8').toString('base64'),
      }),
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
    });
    const responseBody = await readBoundedJsonResponse(
      response,
      controller.signal,
      MAX_IAM_RESPONSE_BYTES,
    );
    const signature = parseIamSignature(responseBody);
    const url = `${GCS_ORIGIN}${signingMaterial.canonicalPath}`
      + `?${signingMaterial.canonicalQuery}`
      + `&X-Goog-Signature=${signature.toString('hex')}`;

    if (!isAllowedGcsReleaseAssetSignedUrl(url, {
      bucket: this.bucket,
      storageKey: input.storageKey,
      signerServiceAccount: this.signerServiceAccount,
      issuedAt,
      expiresInSeconds: input.expiresInSeconds,
    })) {
      throw new Error('release asset signing unavailable');
    }

    return {
      url,
      expiresAt: new Date(
        issuedAt.getTime() + input.expiresInSeconds * 1_000,
      ).toISOString(),
    };
  }
}

/** Exact post-sign validation for the only browser-visible GCS URL shape. */
export function isAllowedGcsReleaseAssetSignedUrl(
  value: string,
  input: {
    bucket: string;
    storageKey: string;
    signerServiceAccount: string;
    issuedAt: Date;
    expiresInSeconds: number;
  },
): boolean {
  try {
    assertValidBucket(input.bucket);
    assertValidServiceAccount(input.signerServiceAccount);
    if (
      !isValidReleaseStorageKey(input.storageKey)
      || !Number.isFinite(input.issuedAt.getTime())
      || !isValidAssetTtl(input.expiresInSeconds)
      || value.length > 4_096
    ) return false;

    const parsed = new URL(value);
    const timestamp = formatV4Timestamp(input.issuedAt);
    const datestamp = timestamp.slice(0, 8);
    const expectedKeys = [
      'X-Goog-Algorithm',
      'X-Goog-Credential',
      'X-Goog-Date',
      'X-Goog-Expires',
      'X-Goog-Signature',
      'X-Goog-SignedHeaders',
    ] as const;
    const actualKeys = [...parsed.searchParams.keys()].sort();

    return (
      parsed.origin === GCS_ORIGIN
      && parsed.protocol === 'https:'
      && parsed.port === ''
      && !parsed.username
      && !parsed.password
      && !parsed.hash
      && parsed.pathname === createSignedAssetPath(input.bucket, input.storageKey)
      && parsed.searchParams.size === expectedKeys.length
      && actualKeys.every((key, index) => key === [...expectedKeys].sort()[index])
      && expectedKeys.every((key) => parsed.searchParams.getAll(key).length === 1)
      && parsed.searchParams.get('X-Goog-Algorithm') === 'GOOG4-RSA-SHA256'
      && parsed.searchParams.get('X-Goog-Credential')
        === `${input.signerServiceAccount}/${datestamp}/auto/storage/goog4_request`
      && parsed.searchParams.get('X-Goog-Date') === timestamp
      && parsed.searchParams.get('X-Goog-Expires') === String(input.expiresInSeconds)
      && parsed.searchParams.get('X-Goog-SignedHeaders') === 'host'
      && /^[a-f0-9]{256,2048}$/.test(
        parsed.searchParams.get('X-Goog-Signature') ?? '',
      )
    );
  } catch {
    return false;
  }
}

function createGcsObjectMediaUrl(bucket: string, storageKey: string): URL {
  return new URL(
    `${GCS_ORIGIN}/storage/v1/b/${encodeRfc3986(bucket)}`
      + `/o/${encodeRfc3986(storageKey)}?alt=media`,
  );
}

function createIamSignBlobUrl(serviceAccount: string): URL {
  return new URL(
    `${IAM_CREDENTIALS_ORIGIN}/v1/projects/-/serviceAccounts/`
      + `${encodeRfc3986(serviceAccount)}:signBlob`,
  );
}

function createV4SigningMaterial(input: {
  bucket: string;
  storageKey: string;
  signerServiceAccount: string;
  issuedAt: Date;
  expiresInSeconds: number;
}): {
  canonicalPath: string;
  canonicalQuery: string;
  stringToSign: string;
} {
  const timestamp = formatV4Timestamp(input.issuedAt);
  const datestamp = timestamp.slice(0, 8);
  const scope = `${datestamp}/auto/storage/goog4_request`;
  const canonicalPath = createSignedAssetPath(input.bucket, input.storageKey);
  const canonicalQuery = canonicalizeQuery([
    ['X-Goog-Algorithm', 'GOOG4-RSA-SHA256'],
    ['X-Goog-Credential', `${input.signerServiceAccount}/${scope}`],
    ['X-Goog-Date', timestamp],
    ['X-Goog-Expires', String(input.expiresInSeconds)],
    ['X-Goog-SignedHeaders', 'host'],
  ]);
  const canonicalRequest = [
    'GET',
    canonicalPath,
    canonicalQuery,
    'host:storage.googleapis.com\n',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'GOOG4-RSA-SHA256',
    timestamp,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  return { canonicalPath, canonicalQuery, stringToSign };
}

function canonicalizeQuery(entries: ReadonlyArray<readonly [string, string]>): string {
  return entries
    .map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey !== rightKey) return leftKey < rightKey ? -1 : 1;
      if (leftValue === rightValue) return 0;
      return leftValue < rightValue ? -1 : 1;
    })
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

function createSignedAssetPath(bucket: string, storageKey: string): string {
  return `/${encodeRfc3986(bucket)}/${storageKey
    .split('/')
    .map(encodeRfc3986)
    .join('/')}`;
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => (
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  ));
}

function formatV4Timestamp(value: Date): string {
  return value.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

async function readBoundedJsonResponse(
  response: Response,
  signal: AbortSignal,
  maximumBytes: number,
): Promise<unknown> {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(
    await readBoundedResponseBytes(response, signal, maximumBytes),
  );
  return JSON.parse(source) as unknown;
}

async function readBoundedTextResponse(
  response: Response,
  signal: AbortSignal,
  maximumBytes: number,
): Promise<string> {
  return new TextDecoder('utf-8', { fatal: true }).decode(
    await readBoundedResponseBytes(response, signal, maximumBytes),
  );
}

async function readBoundedResponseBytes(
  response: Response,
  signal: AbortSignal,
  maximumBytes: number,
): Promise<Uint8Array> {
  if (!response.ok || !response.body || signal.aborted) {
    throw new Error('bounded Google response unavailable');
  }
  const contentEncoding = response.headers.get('content-encoding');
  const contentLengthText = response.headers.get('content-length');
  if (contentEncoding !== null && contentEncoding !== 'identity') {
    throw new Error('bounded Google response unavailable');
  }
  if (contentLengthText !== null) {
    if (!/^(0|[1-9]\d*)$/.test(contentLengthText)) {
      throw new Error('bounded Google response unavailable');
    }
    const declaredSize = Number(contentLengthText);
    if (
      !Number.isSafeInteger(declaredSize)
      || declaredSize < 1
      || declaredSize > maximumBytes
    ) {
      throw new Error('bounded Google response unavailable');
    }
  }

  const reader = response.body.getReader();
  const cancelOnAbort = () => {
    void reader.cancel(signal.reason).catch(() => undefined);
  };
  signal.addEventListener('abort', cancelOnAbort, { once: true });
  const bytes = new Uint8Array(maximumBytes);
  let offset = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (
        !(value instanceof Uint8Array)
        || value.byteLength < 1
        || offset + value.byteLength > maximumBytes
      ) {
        throw new Error('bounded Google response unavailable');
      }
      bytes.set(value, offset);
      offset += value.byteLength;
    }
  } finally {
    signal.removeEventListener('abort', cancelOnAbort);
  }
  if (signal.aborted || offset < 1) {
    throw new Error('bounded Google response unavailable');
  }
  return bytes.slice(0, offset);
}

function parseMetadataAccessToken(value: unknown): string | null {
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
    || !('access_token' in value)
    || !('expires_in' in value)
    || !('token_type' in value)
    || typeof value.access_token !== 'string'
    || typeof value.expires_in !== 'number'
    || !isValidAccessToken(value.access_token)
    || !Number.isSafeInteger(value.expires_in)
    || value.expires_in < 1
    || value.expires_in > 3_600
    || value.token_type !== 'Bearer'
  ) return null;
  return value.access_token;
}

function parseIamSignature(value: unknown): Buffer {
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
    || !('signedBlob' in value)
    || typeof value.signedBlob !== 'string'
  ) {
    throw new Error('IAM signing unavailable');
  }
  const encoded = value.signedBlob;
  if (
    encoded.length > 2_048
    || encoded.length % 4 !== 0
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)
  ) {
    throw new Error('IAM signing unavailable');
  }
  const signature = Buffer.from(encoded, 'base64');
  if (
    signature.byteLength < 128
    || signature.byteLength > 1_024
    || signature.toString('base64') !== encoded
  ) {
    throw new Error('IAM signing unavailable');
  }
  return signature;
}

function isValidAssetSigningInput(input: {
  assetId: string;
  storageKey: string;
  sha256: string;
  mimeType: string;
  expiresInSeconds: number;
}): boolean {
  return (
    RELEASE_ASSET_ID_PATTERN.test(input.assetId)
    && isValidReleaseStorageKey(input.storageKey)
    && RELEASE_SHA256_PATTERN.test(input.sha256)
    && RELEASE_MIME_PATTERN.test(input.mimeType)
    && isValidAssetTtl(input.expiresInSeconds)
  );
}

function isValidAssetTtl(value: number): boolean {
  return Number.isSafeInteger(value)
    && value >= 1
    && value <= MAX_BROWSER_ASSET_TTL_SECONDS;
}

function isValidReleaseStorageKey(value: string): boolean {
  return (
    value.length <= 512
    && RELEASE_STORAGE_KEY_PATTERN.test(value)
    && !value.includes('..')
    && !value.includes('//')
    && !value.includes('/./')
    && !value.endsWith('/')
  );
}

function isValidAccessToken(value: string | null | undefined): value is string {
  return typeof value === 'string'
    && value === value.trim()
    && ACCESS_TOKEN_PATTERN.test(value);
}

function assertValidBucket(value: string): void {
  if (
    value.length < 3
    || value.length > 63
    || !/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(value)
    || value.includes('..')
    || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)
  ) {
    throw new Error('invalid private GCS release bucket');
  }
}

function assertValidServiceAccount(value: string): void {
  if (value.length > 128 || !SERVICE_ACCOUNT_PATTERN.test(value)) {
    throw new Error('invalid GCS release signer identity');
  }
}

function assertValidDeadline(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 30_000) {
    throw new Error('invalid GCS release deadline');
  }
}
