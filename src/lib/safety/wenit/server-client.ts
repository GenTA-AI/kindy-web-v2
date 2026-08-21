import 'server-only';

import { WenitSafeGuardClient } from './client';
import type { WenitPollScheduler } from './poll-scheduler';
import { getWenitRuntimeConfig } from './runtime-config';

/**
 * Server-only composition point. It returns null until all compile-time and
 * environment gates pass, so no browser bundle or disabled route receives the
 * credential.
 */
export function createWenitSafeGuardServerClient(
  scheduler: WenitPollScheduler,
): WenitSafeGuardClient | null {
  const config = getWenitRuntimeConfig();
  if (!config.enabled || !config.credentialScope) return null;
  const apiKey = process.env.WENIT_SAFEGUARD_API_KEY;
  if (!apiKey) return null;

  return new WenitSafeGuardClient({
    apiKey,
    credentialScope: config.credentialScope,
    contract: config.contract,
    scheduler,
  });
}
