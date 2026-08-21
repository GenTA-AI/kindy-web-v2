import { z } from 'zod';

import {
  WENIT_MINIMUM_POLL_START_SPACING_MS,
  type WenitPollScheduleRequest,
  type WenitPollScheduleResult,
  type WenitPollScheduler,
} from './poll-scheduler';

type PollSchedulerRpcResponse = Readonly<{
  data: unknown;
  error: unknown;
}>;

/** Minimal thenable surface implemented by SupabaseClient.rpc. */
export type PollSchedulerSupabaseClient = Readonly<{
  rpc: (
    functionName: string,
    parameters: Readonly<Record<string, unknown>>,
  ) => PromiseLike<PollSchedulerRpcResponse>;
}>;

const CREDENTIAL_SCOPE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAXIMUM_OUTSIDE_DATABASE_WAIT_MS = 15_000;
const MAXIMUM_TIMER_WAIT_ROUNDS = 3;
const MAXIMUM_CLAIM_ROUNDS = 16;
/** Must match the 1,350 ms DB claim slot minus 1,100 ms request spacing. */
const MAXIMUM_RESERVED_SLOT_LATENESS_MS = 250;

const ReservationResultSchema = z.object({
  acquired: z.boolean(),
  start_after: z.string().nullable(),
  reservation_replay: z.boolean(),
}).superRefine((value, context) => {
  if (value.acquired && value.start_after === null) {
    context.addIssue({ code: 'custom', message: 'acquired reservation has no start time' });
  }
  if (!value.acquired && value.start_after !== null) {
    context.addIssue({ code: 'custom', message: 'denied reservation has a start time' });
  }
  if (!value.acquired && value.reservation_replay) {
    context.addIssue({ code: 'custom', message: 'denied reservation cannot be a replay' });
  }
});

const ClaimResultSchema = z.object({
  claim_status: z.enum(['claimed', 'wait', 'deadline']),
  start_after: z.string().nullable(),
  claim_replay: z.boolean(),
}).superRefine((value, context) => {
  if (value.claim_status === 'deadline' && value.start_after !== null) {
    context.addIssue({ code: 'custom', message: 'deadline claim has a start time' });
  }
  if (value.claim_status !== 'deadline' && value.start_after === null) {
    context.addIssue({ code: 'custom', message: 'non-deadline claim has no start time' });
  }
  if (value.claim_status !== 'claimed' && value.claim_replay) {
    context.addIssue({ code: 'custom', message: 'only a claimed result can replay' });
  }
});

type SchedulerSleep = (durationMs: number) => Promise<void>;

export type SupabaseWenitPollSchedulerDependencies = Readonly<{
  now?: () => number;
  sleep?: SchedulerSleep;
  createReservationId?: () => string;
}>;

function defaultSleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function requestIsUsable(request: WenitPollScheduleRequest, nowMs: number): boolean {
  return CREDENTIAL_SCOPE_PATTERN.test(request.credentialScope)
    && Number.isSafeInteger(request.earliestStartAtMs)
    && Number.isSafeInteger(request.deadlineAtMs)
    && request.earliestStartAtMs < request.deadlineAtMs
    && request.deadlineAtMs > nowMs
    && request.deadlineAtMs - nowMs <= MAXIMUM_OUTSIDE_DATABASE_WAIT_MS
    && request.minimumStartSpacingMs === WENIT_MINIMUM_POLL_START_SPACING_MS;
}

/**
 * Date.parse truncates PostgreSQL microseconds. Round a positive fractional
 * remainder up so a poll can never start a fraction of a millisecond early.
 */
function parsePostgresTimestampCeilingMs(value: string): number | null {
  const parsedMs = Date.parse(value);
  if (!Number.isSafeInteger(parsedMs)) return null;

  const fractional = value.match(/\.([0-9]+)(?:Z|[+-][0-9]{2}(?::?[0-9]{2})?)$/)?.[1];
  if (!fractional || fractional.length <= 3) return parsedMs;
  return /[1-9]/.test(fractional.slice(3)) ? parsedMs + 1 : parsedMs;
}

function firstAndOnlyRow(data: unknown): unknown {
  return Array.isArray(data) && data.length === 1 ? data[0] : undefined;
}

/**
 * Reserves with PostgreSQL, then waits outside the database until the exact
 * globally serialized slot. It never receives or persists the Wenit API key.
 */
export class SupabaseWenitPollScheduler implements WenitPollScheduler {
  readonly #client: PollSchedulerSupabaseClient;
  private readonly now: () => number;
  private readonly sleep: SchedulerSleep;
  private readonly createReservationId: () => string;

  constructor(
    client: PollSchedulerSupabaseClient,
    dependencies: SupabaseWenitPollSchedulerDependencies = {},
  ) {
    if (typeof window !== 'undefined') {
      throw new Error('Wenit poll scheduler is server-only');
    }
    this.#client = client;
    this.now = dependencies.now ?? Date.now;
    this.sleep = dependencies.sleep ?? defaultSleep;
    this.createReservationId = dependencies.createReservationId
      ?? (() => crypto.randomUUID());
  }

  async acquire(request: WenitPollScheduleRequest): Promise<WenitPollScheduleResult> {
    const requestStartedAtMs = this.now();
    if (!requestIsUsable(request, requestStartedAtMs)) {
      return request.deadlineAtMs <= requestStartedAtMs
        ? { acquired: false, reason: 'deadline' }
        : { acquired: false, reason: 'unavailable' };
    }

    const reservationId = this.createReservationId();
    if (!UUID_PATTERN.test(reservationId)) {
      return { acquired: false, reason: 'unavailable' };
    }

    let response;
    try {
      response = await this.#client.rpc('reserve_wenit_poll_start', {
        p_credential_scope: request.credentialScope,
        p_reservation_id: reservationId,
        p_earliest_start_at: new Date(request.earliestStartAtMs).toISOString(),
        p_deadline_at: new Date(request.deadlineAtMs).toISOString(),
      });
    } catch {
      return { acquired: false, reason: 'unavailable' };
    }

    if (response.error) return { acquired: false, reason: 'unavailable' };
    const parsed = ReservationResultSchema.safeParse(firstAndOnlyRow(response.data));
    if (!parsed.success) return { acquired: false, reason: 'unavailable' };
    if (!parsed.data.acquired) return { acquired: false, reason: 'deadline' };
    if (parsed.data.reservation_replay) {
      return { acquired: false, reason: 'unavailable' };
    }

    const scheduledAtMs = parsePostgresTimestampCeilingMs(parsed.data.start_after!);
    if (
      scheduledAtMs === null
      || scheduledAtMs < request.earliestStartAtMs
      || scheduledAtMs >= request.deadlineAtMs
    ) {
      return { acquired: false, reason: 'unavailable' };
    }

    const initialWait = await this.waitUntil(scheduledAtMs, request.deadlineAtMs);
    if (initialWait !== 'ready') {
      return { acquired: false, reason: initialWait };
    }

    // The initial reservation is only queue admission. Re-check the DB clock
    // immediately before resolving acquire so a late old timer moves newer
    // contenders instead of issuing a poll beside them.
    for (let claimRound = 0; claimRound < MAXIMUM_CLAIM_ROUNDS; claimRound += 1) {
      const claimRequestedAtMs = this.now();
      if (claimRequestedAtMs >= request.deadlineAtMs) {
        return { acquired: false, reason: 'deadline' };
      }

      let claimResponse;
      try {
        claimResponse = await this.#client.rpc('claim_wenit_poll_start', {
          p_credential_scope: request.credentialScope,
          p_reservation_id: reservationId,
          p_deadline_at: new Date(request.deadlineAtMs).toISOString(),
        });
      } catch {
        return { acquired: false, reason: 'unavailable' };
      }
      const claimReturnedAtMs = this.now();
      if (claimResponse.error) return { acquired: false, reason: 'unavailable' };
      const claim = ClaimResultSchema.safeParse(firstAndOnlyRow(claimResponse.data));
      if (!claim.success) return { acquired: false, reason: 'unavailable' };
      if (claim.data.claim_status === 'deadline') {
        return { acquired: false, reason: 'deadline' };
      }

      const claimStartAtMs = parsePostgresTimestampCeilingMs(
        claim.data.start_after!,
      );
      if (
        claimStartAtMs === null
        || claimStartAtMs < scheduledAtMs
        || claimStartAtMs >= request.deadlineAtMs
      ) {
        return { acquired: false, reason: 'unavailable' };
      }

      if (claim.data.claim_status === 'wait') {
        const claimWait = await this.waitUntil(
          claimStartAtMs,
          request.deadlineAtMs,
        );
        if (claimWait !== 'ready') {
          return { acquired: false, reason: claimWait };
        }
        continue;
      }

      // We intentionally do not replay an ambiguous claimed response. Losing a
      // slot is safe; issuing the same claim twice could duplicate a vendor GET.
      if (claim.data.claim_replay) {
        return { acquired: false, reason: 'unavailable' };
      }
      const claimRoundTripMs = claimReturnedAtMs - claimRequestedAtMs;
      if (
        claimRoundTripMs < 0
        || claimRoundTripMs > MAXIMUM_RESERVED_SLOT_LATENESS_MS
        || claimReturnedAtMs >= request.deadlineAtMs
      ) {
        return claimReturnedAtMs >= request.deadlineAtMs
          ? { acquired: false, reason: 'deadline' }
          : { acquired: false, reason: 'unavailable' };
      }
      return { acquired: true, startedAtMs: claimReturnedAtMs };
    }

    return { acquired: false, reason: 'unavailable' };
  }

  private async waitUntil(
    scheduledAtMs: number,
    deadlineAtMs: number,
  ): Promise<'ready' | 'deadline' | 'unavailable'> {
    for (let round = 0; round < MAXIMUM_TIMER_WAIT_ROUNDS; round += 1) {
      const beforeWaitMs = this.now();
      if (beforeWaitMs >= deadlineAtMs) return 'deadline';
      if (beforeWaitMs >= scheduledAtMs) return 'ready';

      const waitMs = scheduledAtMs - beforeWaitMs;
      if (waitMs <= 0 || waitMs > MAXIMUM_OUTSIDE_DATABASE_WAIT_MS) {
        return 'unavailable';
      }
      try {
        await this.sleep(waitMs);
      } catch {
        return 'unavailable';
      }
    }

    const afterWaitMs = this.now();
    if (afterWaitMs >= deadlineAtMs) return 'deadline';
    return afterWaitMs >= scheduledAtMs ? 'ready' : 'unavailable';
  }
}
