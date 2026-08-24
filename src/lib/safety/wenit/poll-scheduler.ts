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

export type WenitPollRunResult<T> =
  | Readonly<{ started: true; startedAtMs: number; value: T }>
  | Readonly<{ started: false; reason: 'deadline' | 'unavailable' }>;

export type WenitPollStartOperation<T> = () => Promise<T>;

/**
 * Production implementations must serialize poll starts across every Cloud Run
 * instance that shares a Wenit key. An in-memory limiter is intentionally not
 * provided because it cannot enforce the vendor quota across instances.
 */
export interface WenitPollScheduler {
  /**
   * Owns the operation start after the distributed claim. A future lease must
   * never escape to application code because a paused process could use it late.
   */
  run<T>(
    request: WenitPollScheduleRequest,
    startOperation: WenitPollStartOperation<T>,
  ): Promise<WenitPollRunResult<T>>;
}

/** Safe default used until the distributed scheduler is provisioned. */
export class UnavailableWenitPollScheduler implements WenitPollScheduler {
  async run<T>(): Promise<WenitPollRunResult<T>> {
    return { started: false, reason: 'unavailable' };
  }
}
