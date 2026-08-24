import { getStoryChatRuntimeConfig } from '@/lib/story-chat/runtime-config';

import type { WenitKnownContract } from './types';

const SAFE_TOKEN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/;
const CREDENTIAL_SCOPE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/;

export type WenitRuntimeEnvironment = Readonly<{
  KINDY_LAUNCH_MODE?: string;
  STORY_CHAT_RUNTIME_ENABLED?: string;
  STORY_CHAT_FREE_TEXT_ENABLED?: string;
  STORY_CONTENT_RELEASE_CHANNEL?: string;
  WENIT_SAFEGUARD_RUNTIME_ENABLED?: string;
  WENIT_SAFEGUARD_API_KEY?: string;
  NEXT_PUBLIC_WENIT_SAFEGUARD_API_KEY?: string;
  WENIT_SAFEGUARD_CREDENTIAL_SCOPE?: string;
  WENIT_SAFEGUARD_THRESHOLD_VERSIONS?: string;
  WENIT_SAFEGUARD_PRICING_VERSIONS?: string;
  WENIT_SAFEGUARD_AGE_GROUPS?: string;
  WENIT_SAFEGUARD_CATEGORY_SHAPE?: string;
  WENIT_SAFEGUARD_PENDING_STATUSES?: string;
  WENIT_SAFEGUARD_MATCHED_RULES?: string;
}>;

export type WenitRuntimeConfig = Readonly<{
  enabled: boolean;
  credentialConfigured: boolean;
  publicCredentialDetected: boolean;
  credentialScope: string | null;
  contract: WenitKnownContract;
}>;

/**
 * Flip only after the distributed key-scoped poll scheduler, PII/hard-risk
 * pre-router, dual input/output checks, and safety eval gate are all shipped.
 */
export const WENIT_SAFEGUARD_RUNTIME_READY = false as const;

function parseAllowlist(value: string | undefined): readonly string[] {
  if (!value) return [];
  const values = value.split(',').map((item) => item.trim());
  if (
    values.length === 0
    || values.some((item) => !SAFE_TOKEN_PATTERN.test(item))
    || new Set(values).size !== values.length
  ) {
    return [];
  }
  return values;
}

function credentialLooksUsable(value: string | undefined): boolean {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 512
    && value.trim() === value
    && !/[\u0000-\u001f\u007f]/.test(value);
}

export function getWenitRuntimeConfig(
  environment?: WenitRuntimeEnvironment,
): WenitRuntimeConfig {
  const source: WenitRuntimeEnvironment = environment ?? {
    KINDY_LAUNCH_MODE: process.env.KINDY_LAUNCH_MODE,
    STORY_CHAT_RUNTIME_ENABLED: process.env.STORY_CHAT_RUNTIME_ENABLED,
    STORY_CHAT_FREE_TEXT_ENABLED: process.env.STORY_CHAT_FREE_TEXT_ENABLED,
    STORY_CONTENT_RELEASE_CHANNEL: process.env.STORY_CONTENT_RELEASE_CHANNEL,
    WENIT_SAFEGUARD_RUNTIME_ENABLED:
      process.env.WENIT_SAFEGUARD_RUNTIME_ENABLED,
    WENIT_SAFEGUARD_API_KEY: process.env.WENIT_SAFEGUARD_API_KEY,
    NEXT_PUBLIC_WENIT_SAFEGUARD_API_KEY:
      process.env.NEXT_PUBLIC_WENIT_SAFEGUARD_API_KEY,
    WENIT_SAFEGUARD_CREDENTIAL_SCOPE:
      process.env.WENIT_SAFEGUARD_CREDENTIAL_SCOPE,
    WENIT_SAFEGUARD_THRESHOLD_VERSIONS:
      process.env.WENIT_SAFEGUARD_THRESHOLD_VERSIONS,
    WENIT_SAFEGUARD_PRICING_VERSIONS:
      process.env.WENIT_SAFEGUARD_PRICING_VERSIONS,
    WENIT_SAFEGUARD_AGE_GROUPS: process.env.WENIT_SAFEGUARD_AGE_GROUPS,
    WENIT_SAFEGUARD_CATEGORY_SHAPE:
      process.env.WENIT_SAFEGUARD_CATEGORY_SHAPE,
    WENIT_SAFEGUARD_PENDING_STATUSES:
      process.env.WENIT_SAFEGUARD_PENDING_STATUSES,
    WENIT_SAFEGUARD_MATCHED_RULES:
      process.env.WENIT_SAFEGUARD_MATCHED_RULES,
  };
  const thresholdVersions = parseAllowlist(
    source.WENIT_SAFEGUARD_THRESHOLD_VERSIONS,
  );
  const pricingVersions = parseAllowlist(
    source.WENIT_SAFEGUARD_PRICING_VERSIONS,
  );
  const ageGroups = parseAllowlist(source.WENIT_SAFEGUARD_AGE_GROUPS);
  const pendingStatuses = parseAllowlist(
    source.WENIT_SAFEGUARD_PENDING_STATUSES,
  );
  const matchedRules = parseAllowlist(source.WENIT_SAFEGUARD_MATCHED_RULES);
  const categoryShape = source.WENIT_SAFEGUARD_CATEGORY_SHAPE === 'array'
    || source.WENIT_SAFEGUARD_CATEGORY_SHAPE === 'single'
    ? source.WENIT_SAFEGUARD_CATEGORY_SHAPE
    : null;
  const credentialScope = source.WENIT_SAFEGUARD_CREDENTIAL_SCOPE;
  const safeCredentialScope = credentialScope
    && CREDENTIAL_SCOPE_PATTERN.test(credentialScope)
    ? credentialScope
    : null;
  const storyChat = getStoryChatRuntimeConfig(source);
  const publicCredentialDetected = credentialLooksUsable(
    source.NEXT_PUBLIC_WENIT_SAFEGUARD_API_KEY,
  );
  const credentialConfigured = credentialLooksUsable(
    source.WENIT_SAFEGUARD_API_KEY,
  );

  return {
    enabled:
      WENIT_SAFEGUARD_RUNTIME_READY
      && storyChat.runtimeEnabled
      && storyChat.freeTextEnabled
      && source.WENIT_SAFEGUARD_RUNTIME_ENABLED === '1'
      && credentialConfigured
      && !publicCredentialDetected
      && safeCredentialScope !== null
      && thresholdVersions.length > 0
      && pricingVersions.length > 0
      && ageGroups.length > 0
      && pendingStatuses.length > 0
      && categoryShape !== null,
    credentialConfigured,
    publicCredentialDetected,
    credentialScope: safeCredentialScope,
    contract: {
      thresholdVersions,
      pricingVersions,
      ageGroups,
      categoryShape,
      pendingStatuses,
      matchedRules,
    },
  };
}
