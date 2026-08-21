import { z } from 'zod';

export const WENIT_SAFE_GUARD_PROVIDER = 'wenit-safe-guard' as const;

export const WENIT_SAFETY_CATEGORIES = [
  'violence',
  'sexual',
  'hate',
  'illegal',
  'self_harm',
  'harassment',
] as const;

export type WenitSafetyCategory = (typeof WENIT_SAFETY_CATEGORIES)[number];
export type WenitProviderVerdict = 'safe' | 'review' | 'block';
export type WenitInputType = 'text' | 'image' | 'video';

/**
 * Provider contract values that must be copied from an observed, approved
 * Wenit response. Unknown or missing versions are deliberately not guessed.
 */
export type WenitKnownContract = Readonly<{
  thresholdVersions: readonly string[];
  pricingVersions: readonly string[];
  ageGroups: readonly string[];
  /** Explicitly configured because the supplied guides disagree on this shape. */
  categoryShape: 'array' | 'single' | null;
  /** Exact non-terminal status values observed for the deployed vendor schema. */
  pendingStatuses: readonly string[];
  /** Provider rule identifiers approved for sanitized audit output. */
  matchedRules: readonly string[];
}>;

export type WenitThresholdSnapshot = Readonly<{
  version: string;
  reviewRiskScoreThreshold: number;
  blockRiskScoreThreshold: number;
  minorRiskBlockEnabled: true;
}>;

/**
 * Deliberately safe audit projection. It cannot carry the submitted content,
 * credential, provider reason, provider evidence, task id, or raw payload.
 */
export type WenitSafeAuditMetadata = Readonly<{
  provider: typeof WENIT_SAFE_GUARD_PROVIDER;
  inputType: WenitInputType;
  decisionSource: 'api_key_thresholds';
  providerResult: WenitProviderVerdict;
  serverRecommendedResult: WenitProviderVerdict;
  minorRisk: boolean;
  categories: readonly WenitSafetyCategory[];
  categoryScores: Readonly<Record<WenitSafetyCategory, number>>;
  riskScore: number;
  ageGroup: string;
  ageConfidence: number;
  matchedRules: readonly string[];
  thresholds: WenitThresholdSnapshot;
  tokensConsumed: number;
  pricingVersion: string;
  createdAt: string;
  completedAt: string;
}>;

export type WenitUnavailableReason =
  | 'aborted'
  | 'invalid_input'
  | 'invalid_configuration'
  | 'submit_rejected'
  | 'rate_limited'
  | 'transport_error'
  | 'timeout'
  | 'malformed_response'
  | 'unknown_response'
  | 'provider_failed'
  | 'scheduler_unavailable'
  | 'contract_mismatch';

export const WENIT_UNAVAILABLE_REASONS = [
  'aborted',
  'invalid_input',
  'invalid_configuration',
  'submit_rejected',
  'rate_limited',
  'transport_error',
  'timeout',
  'malformed_response',
  'unknown_response',
  'provider_failed',
  'scheduler_unavailable',
  'contract_mismatch',
] as const satisfies readonly WenitUnavailableReason[];

export type WenitModerationResult =
  | Readonly<{
      decision: 'allow';
      allowsExposure: true;
      audit: WenitSafeAuditMetadata;
    }>
  | Readonly<{
      decision: 'review' | 'block';
      allowsExposure: false;
      audit: WenitSafeAuditMetadata;
    }>
  | Readonly<{
      decision: 'unavailable';
      allowsExposure: false;
      reason: WenitUnavailableReason;
    }>;

export type WenitPollMapping =
  | Readonly<{ state: 'pending' }>
  | Readonly<{ state: 'terminal'; result: WenitModerationResult }>;

const WenitScoreSchema = z.number().finite().min(0).max(100);
const WenitSafeTokenSchema = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/);
const WenitAuditSchema = z
  .object({
    provider: z.literal(WENIT_SAFE_GUARD_PROVIDER),
    inputType: z.enum(['text', 'image', 'video']),
    decisionSource: z.literal('api_key_thresholds'),
    providerResult: z.enum(['safe', 'review', 'block']),
    serverRecommendedResult: z.enum(['safe', 'review', 'block']),
    minorRisk: z.boolean(),
    categories: z.array(z.enum(WENIT_SAFETY_CATEGORIES)).max(
      WENIT_SAFETY_CATEGORIES.length,
    ),
    categoryScores: z
      .object({
        violence: WenitScoreSchema,
        sexual: WenitScoreSchema,
        hate: WenitScoreSchema,
        illegal: WenitScoreSchema,
        self_harm: WenitScoreSchema,
        harassment: WenitScoreSchema,
      })
      .strict(),
    riskScore: WenitScoreSchema,
    ageGroup: WenitSafeTokenSchema,
    ageConfidence: WenitScoreSchema,
    matchedRules: z.array(WenitSafeTokenSchema).max(32),
    thresholds: z
      .object({
        version: WenitSafeTokenSchema,
        reviewRiskScoreThreshold: WenitScoreSchema,
        blockRiskScoreThreshold: WenitScoreSchema,
        minorRiskBlockEnabled: z.literal(true),
      })
      .strict(),
    tokensConsumed: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    pricingVersion: WenitSafeTokenSchema,
    createdAt: z.string().datetime({ offset: true }),
    completedAt: z.string().datetime({ offset: true }),
  })
  .strict();

const WenitModerationResultSchema = z.discriminatedUnion('decision', [
  z
    .object({
      decision: z.literal('allow'),
      allowsExposure: z.literal(true),
      audit: WenitAuditSchema,
    })
    .strict(),
  z
    .object({
      decision: z.literal('review'),
      allowsExposure: z.literal(false),
      audit: WenitAuditSchema,
    })
    .strict(),
  z
    .object({
      decision: z.literal('block'),
      allowsExposure: z.literal(false),
      audit: WenitAuditSchema,
    })
    .strict(),
  z
    .object({
      decision: z.literal('unavailable'),
      allowsExposure: z.literal(false),
      reason: z.enum(WENIT_UNAVAILABLE_REASONS),
    })
    .strict(),
]).superRefine((result, context) => {
  if (result.decision === 'unavailable') return;
  const audit = result.audit;
  const hasBlock = audit.providerResult === 'block'
    || audit.serverRecommendedResult === 'block';
  const hasReview = audit.providerResult === 'review'
    || audit.serverRecommendedResult === 'review';
  if (
    result.decision === 'allow'
    && (
      audit.providerResult !== 'safe'
      || audit.serverRecommendedResult !== 'safe'
      || audit.minorRisk
    )
  ) {
    context.addIssue({ code: 'custom', message: 'contradictory Wenit allow' });
  }
  if (
    result.decision === 'block'
    && !audit.minorRisk
    && !hasBlock
  ) {
    context.addIssue({ code: 'custom', message: 'contradictory Wenit block' });
  }
  if (
    result.decision === 'review'
    && (audit.minorRisk || hasBlock || !hasReview)
  ) {
    context.addIssue({ code: 'custom', message: 'contradictory Wenit review' });
  }
});

/** Revalidates injected/runtime values and rejects contradictory exposure flags. */
export function parseWenitModerationResult(
  input: unknown,
): WenitModerationResult {
  return WenitModerationResultSchema.parse(input);
}

export function wenitUnavailable(
  reason: WenitUnavailableReason,
): WenitModerationResult {
  return { decision: 'unavailable', allowsExposure: false, reason };
}
