/** Wenit documents one poll per second and 60 polls per minute per key. */
export const WENIT_MINIMUM_POLL_START_SPACING_MS = 1_100;
export const WENIT_POLL_JITTER_MAXIMUM_MS = 250;

export type WenitPollScheduleRequest = Readonly<{
  /**
   * Non-secret credential identity/key-version label, never the raw key or its
   * hash. All processes/environments sharing one raw key must share this scope.
   */
  credentialScope: string;
  earliestStartAtMs: number;
  deadlineAtMs: number;
  minimumStartSpacingMs: typeof WENIT_MINIMUM_POLL_START_SPACING_MS;
}>;

export type WenitPollScheduleResult =
  | Readonly<{ acquired: true; startedAtMs: number }>
  | Readonly<{ acquired: false; reason: 'deadline' | 'unavailable' }>;

/**
 * Production implementations must serialize poll starts across every Cloud Run
 * instance that shares a Wenit key. An in-memory limiter is intentionally not
 * provided because it cannot enforce the vendor quota across instances.
 */
export interface WenitPollScheduler {
  /** Resolves only after the acquired start instant; never returns a future lease. */
  acquire(request: WenitPollScheduleRequest): Promise<WenitPollScheduleResult>;
}

/** Safe default used until the distributed scheduler is provisioned. */
export class UnavailableWenitPollScheduler implements WenitPollScheduler {
  async acquire(): Promise<WenitPollScheduleResult> {
    return { acquired: false, reason: 'unavailable' };
  }
}
