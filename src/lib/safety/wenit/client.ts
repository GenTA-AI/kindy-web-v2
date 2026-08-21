import { mapWenitPollPayload, parseWenitSubmitTaskId } from './canonical';
import {
  WENIT_MINIMUM_POLL_START_SPACING_MS,
  WENIT_POLL_JITTER_MAXIMUM_MS,
  type WenitPollScheduler,
} from './poll-scheduler';
import {
  wenitUnavailable,
  type WenitKnownContract,
  type WenitModerationResult,
  type WenitUnavailableReason,
} from './types';

export const WENIT_MODERATION_ENDPOINT =
  'https://safeguard-api.wenit.ai/api/portal/moderation/check';
export const WENIT_TOTAL_DEADLINE_MS = 15_000;
export const WENIT_REQUEST_TIMEOUT_MS = 4_000;
export const WENIT_MAXIMUM_RESPONSE_BYTES = 64 * 1024;
export const WENIT_MAXIMUM_TEXT_BYTES = 4 * 1024;

const CREDENTIAL_SCOPE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/;
const RATE_LIMIT_BACKOFF_MS = [2_000, 4_000, 8_000] as const;

export type WenitFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type WenitSafeGuardClientDependencies = Readonly<{
  apiKey: string;
  /** Non-secret identifier shared by every process using this API key. */
  credentialScope: string;
  contract: WenitKnownContract;
  scheduler: WenitPollScheduler;
  fetch?: WenitFetch;
  now?: () => number;
  random?: () => number;
  totalDeadlineMs?: number;
  requestTimeoutMs?: number;
}>;

export type WenitModerateTextOptions = Readonly<{
  signal?: AbortSignal;
}>;

type BoundedJsonResult =
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{ ok: false }>;

type FetchResult =
  | Readonly<{ ok: true; response: Response }>
  | Readonly<{
      ok: false;
      reason: 'aborted' | 'timeout' | 'transport_error';
    }>;

function validApiKey(apiKey: string): boolean {
  return apiKey.length > 0
    && apiKey.length <= 512
    && apiKey.trim() === apiKey
    && !/[\u0000-\u001f\u007f]/.test(apiKey);
}

function positiveSafeDuration(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

async function readBoundedJson(
  response: Response,
  maximumBytes: number,
): Promise<BoundedJsonResult> {
  const contentType = response.headers.get('content-type');
  if (!contentType?.toLowerCase().startsWith('application/json')) {
    return { ok: false };
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) return { ok: false };
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength > maximumBytes) {
      return { ok: false };
    }
  }

  if (!response.body) return { ok: false };
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytesRead = 0;
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maximumBytes) {
        await reader.cancel('Wenit response exceeded byte limit').catch(() => undefined);
        return { ok: false };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    return { ok: false };
  } finally {
    reader.releaseLock();
  }

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

function requestHeaders(apiKey: string): Record<string, string> {
  return {
    Accept: 'application/json',
    'X-API-Key': apiKey,
  };
}

export class WenitSafeGuardClient {
  readonly #apiKey: string;
  readonly #credentialScope: string;
  readonly #contract: WenitKnownContract;
  readonly #scheduler: WenitPollScheduler;
  private readonly fetchImplementation: WenitFetch;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly totalDeadlineMs: number;
  private readonly requestTimeoutMs: number;

  constructor(dependencies: WenitSafeGuardClientDependencies) {
    if (typeof window !== 'undefined') {
      throw new Error('Wenit Safe Guard client is server-only');
    }
    // Keep credentials and quota identity in true ECMAScript private slots.
    // TypeScript `private` parameter properties are enumerable at runtime and
    // can leak through accidental serialization or inspection.
    this.#apiKey = dependencies.apiKey;
    this.#credentialScope = dependencies.credentialScope;
    this.#contract = dependencies.contract;
    this.#scheduler = dependencies.scheduler;
    this.fetchImplementation = dependencies.fetch ?? fetch.bind(globalThis);
    this.now = dependencies.now ?? Date.now;
    this.random = dependencies.random ?? Math.random;
    this.totalDeadlineMs = dependencies.totalDeadlineMs ?? WENIT_TOTAL_DEADLINE_MS;
    this.requestTimeoutMs = dependencies.requestTimeoutMs ?? WENIT_REQUEST_TIMEOUT_MS;
  }

  /**
   * Submits one text task exactly once and resumes only its GET task handle.
   * Every returned shape is sanitized; callers never receive a raw payload.
   */
  async moderateText(
    text: string,
    options: WenitModerateTextOptions = {},
  ): Promise<WenitModerationResult> {
    if (!this.configurationIsUsable()) {
      return wenitUnavailable('invalid_configuration');
    }
    if (
      text.length === 0
      || text.trim().length === 0
      || utf8ByteLength(text) > WENIT_MAXIMUM_TEXT_BYTES
    ) {
      return wenitUnavailable('invalid_input');
    }
    if (options.signal?.aborted) return wenitUnavailable('aborted');

    const deadlineAtMs = this.now() + this.totalDeadlineMs;
    const form = new FormData();
    form.append('prompt', text);
    const submitted = await this.fetchWithinDeadline(
      WENIT_MODERATION_ENDPOINT,
      {
        method: 'POST',
        headers: requestHeaders(this.#apiKey),
        body: form,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
      },
      deadlineAtMs,
      options.signal,
    );
    if (!submitted.ok) return wenitUnavailable(submitted.reason);
    if (submitted.response.status === 429) {
      return wenitUnavailable('rate_limited');
    }
    if (!submitted.response.ok) return wenitUnavailable('submit_rejected');

    const submitPayload = await readBoundedJson(
      submitted.response,
      WENIT_MAXIMUM_RESPONSE_BYTES,
    );
    if (!submitPayload.ok) return wenitUnavailable('malformed_response');
    const taskId = parseWenitSubmitTaskId(submitPayload.value);
    if (!taskId) return wenitUnavailable('malformed_response');

    return this.pollTask(taskId, deadlineAtMs, options.signal);
  }

  private configurationIsUsable(): boolean {
    return validApiKey(this.#apiKey)
      && CREDENTIAL_SCOPE_PATTERN.test(this.#credentialScope)
      && positiveSafeDuration(this.totalDeadlineMs)
      && positiveSafeDuration(this.requestTimeoutMs)
      && this.totalDeadlineMs <= WENIT_TOTAL_DEADLINE_MS
      && this.requestTimeoutMs <= WENIT_REQUEST_TIMEOUT_MS
      && this.requestTimeoutMs <= this.totalDeadlineMs;
  }

  private async pollTask(
    taskId: string,
    deadlineAtMs: number,
    signal?: AbortSignal,
  ): Promise<WenitModerationResult> {
    let earliestStartAtMs = this.nextNormalPollAt();
    let rateLimitCount = 0;

    while (this.now() < deadlineAtMs) {
      if (signal?.aborted) return wenitUnavailable('aborted');

      let lease;
      try {
        lease = await this.#scheduler.acquire({
          credentialScope: this.#credentialScope,
          earliestStartAtMs,
          deadlineAtMs,
          minimumStartSpacingMs: WENIT_MINIMUM_POLL_START_SPACING_MS,
        });
      } catch {
        return wenitUnavailable('scheduler_unavailable');
      }
      if (!lease.acquired) {
        return wenitUnavailable(
          lease.reason === 'deadline' ? 'timeout' : 'scheduler_unavailable',
        );
      }
      if (
        !Number.isFinite(lease.startedAtMs)
        || lease.startedAtMs < earliestStartAtMs
        || lease.startedAtMs >= deadlineAtMs
      ) {
        return wenitUnavailable('scheduler_unavailable');
      }

      const polled = await this.fetchWithinDeadline(
        `${WENIT_MODERATION_ENDPOINT}/${encodeURIComponent(taskId)}`,
        {
          method: 'GET',
          headers: requestHeaders(this.#apiKey),
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error',
          referrerPolicy: 'no-referrer',
        },
        deadlineAtMs,
        signal,
      );
      if (!polled.ok) return wenitUnavailable(polled.reason);

      if (polled.response.status === 429) {
        if (rateLimitCount >= RATE_LIMIT_BACKOFF_MS.length) {
          return wenitUnavailable('rate_limited');
        }
        earliestStartAtMs = this.now() + RATE_LIMIT_BACKOFF_MS[rateLimitCount];
        rateLimitCount += 1;
        continue;
      }
      if (!polled.response.ok) return wenitUnavailable('transport_error');

      const pollPayload = await readBoundedJson(
        polled.response,
        WENIT_MAXIMUM_RESPONSE_BYTES,
      );
      if (!pollPayload.ok) return wenitUnavailable('malformed_response');
      const mapped = mapWenitPollPayload(
        pollPayload.value,
        this.#contract,
      );
      if (mapped.state === 'terminal') {
        if (
          mapped.result.decision !== 'unavailable'
          && mapped.result.audit.inputType !== 'text'
        ) {
          return wenitUnavailable('contract_mismatch');
        }
        return mapped.result;
      }

      rateLimitCount = 0;
      earliestStartAtMs = this.nextNormalPollAt();
    }

    return wenitUnavailable('timeout');
  }

  private nextNormalPollAt(): number {
    const boundedRandom = Math.min(1, Math.max(0, this.random()));
    const jitterMs = Math.floor(boundedRandom * WENIT_POLL_JITTER_MAXIMUM_MS);
    return this.now() + WENIT_MINIMUM_POLL_START_SPACING_MS + jitterMs;
  }

  private async fetchWithinDeadline(
    input: string,
    init: RequestInit,
    deadlineAtMs: number,
    outerSignal?: AbortSignal,
  ): Promise<FetchResult> {
    if (outerSignal?.aborted) return { ok: false, reason: 'aborted' };
    const remainingMs = deadlineAtMs - this.now();
    if (remainingMs <= 0) return { ok: false, reason: 'timeout' };

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, Math.min(this.requestTimeoutMs, remainingMs));
    const abortFromOuter = () => controller.abort();
    outerSignal?.addEventListener('abort', abortFromOuter, { once: true });

    try {
      const response = await this.fetchImplementation(input, {
        ...init,
        signal: controller.signal,
      });
      return { ok: true, response };
    } catch {
      const reason: WenitUnavailableReason = outerSignal?.aborted
        ? 'aborted'
        : timedOut || this.now() >= deadlineAtMs
          ? 'timeout'
          : 'transport_error';
      return { ok: false, reason };
    } finally {
      clearTimeout(timeout);
      outerSignal?.removeEventListener('abort', abortFromOuter);
    }
  }
}
