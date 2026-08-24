import { z } from 'zod';

import {
  WENIT_SAFE_GUARD_PROVIDER,
  WENIT_SAFETY_CATEGORIES,
  wenitUnavailable,
  type WenitKnownContract,
  type WenitModerationResult,
  type WenitPollMapping,
  type WenitProviderVerdict,
  type WenitSafeAuditMetadata,
  type WenitSafetyCategory,
} from './types';

const SAFE_TOKEN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/;
const TASK_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const VERSION_SCHEMA = z.string().regex(SAFE_TOKEN_PATTERN);
const SCORE_SCHEMA = z.number().finite().min(0).max(100);
const PROVIDER_VERDICT_SCHEMA = z.enum(['safe', 'review', 'block']);

const ScoresSchema = z.object({
  violence: SCORE_SCHEMA,
  sexual: SCORE_SCHEMA,
  hate: SCORE_SCHEMA,
  illegal: SCORE_SCHEMA,
  self_harm: SCORE_SCHEMA,
  harassment: SCORE_SCHEMA,
}).strict();

const CompletedPayloadSchema = z.object({
  status: z.literal('completed'),
  result: PROVIDER_VERDICT_SCHEMA,
  server_recommended_result: PROVIDER_VERDICT_SCHEMA,
  minor_risk: z.boolean(),
  decision_source: z.literal('api_key_thresholds'),
  input_type: z.enum(['text', 'image', 'video']),
  analysis: z.object({
    scores: ScoresSchema,
    category: z.union([
      z.array(z.enum(WENIT_SAFETY_CATEGORIES)).max(
        WENIT_SAFETY_CATEGORIES.length,
      ),
      z.enum(WENIT_SAFETY_CATEGORIES),
    ]),
    age_group: VERSION_SCHEMA,
    age_confidence: SCORE_SCHEMA,
    risk_score: SCORE_SCHEMA,
    minor_risk_yn: z.boolean(),
    // Observed explanatory fields are parsed only to make schema drift
    // explicit. They are deliberately discarded by `makeAudit`.
    reason: z.string().max(4_096).optional(),
    evidence: z.array(z.string().max(1_024)).max(32).optional(),
  }).strict(),
  threshold_snapshot: z.object({
    version: VERSION_SCHEMA,
    review_risk_score_threshold: SCORE_SCHEMA,
    block_risk_score_threshold: SCORE_SCHEMA,
    minor_risk_block_enabled: z.literal(true),
  }).strict(),
  matched_rules: z.array(VERSION_SCHEMA).max(32),
  tokens_consumed: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  pricing_version: VERSION_SCHEMA,
  created_at: z.string().datetime({ offset: true }),
  completed_at: z.string().datetime({ offset: true }),
  task_id: z.string().regex(TASK_ID_PATTERN).optional(),
}).strict();

type CompletedPayload = z.infer<typeof CompletedPayloadSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasProviderError(value: Record<string, unknown>): boolean {
  return Object.hasOwn(value, 'error')
    && value.error !== null
    && value.error !== undefined;
}

function unwrapProviderData(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload) || hasProviderError(payload)) return null;

  if (Object.hasOwn(payload, 'data')) {
    if (
      (Object.hasOwn(payload, 'success') && payload.success !== true)
      || !isRecord(payload.data)
    ) return null;
    if (hasProviderError(payload.data)) return null;
    return payload.data;
  }

  if (Object.hasOwn(payload, 'success') && payload.success !== true) return null;
  return payload;
}

function isKnownValue(value: string, allowlist: readonly string[]): boolean {
  return allowlist.length > 0 && allowlist.includes(value);
}

function contractIsUsable(contract: WenitKnownContract): boolean {
  return contract.thresholdVersions.length > 0
    && contract.pricingVersions.length > 0
    && contract.ageGroups.length > 0
    && contract.pendingStatuses.length > 0
    && contract.categoryShape !== null
    && [
      ...contract.thresholdVersions,
      ...contract.pricingVersions,
      ...contract.ageGroups,
      ...contract.pendingStatuses,
      ...contract.matchedRules,
    ]
      .every((value) => SAFE_TOKEN_PATTERN.test(value))
    && !contract.pendingStatuses.includes('completed')
    && !contract.pendingStatuses.includes('failed');
}

function makeAudit(payload: CompletedPayload): WenitSafeAuditMetadata {
  const categories = Array.isArray(payload.analysis.category)
    ? payload.analysis.category
    : [payload.analysis.category];
  return {
    provider: WENIT_SAFE_GUARD_PROVIDER,
    inputType: payload.input_type,
    decisionSource: payload.decision_source,
    providerResult: payload.result,
    serverRecommendedResult: payload.server_recommended_result,
    minorRisk: payload.minor_risk,
    categories: [...categories],
    categoryScores: {
      violence: payload.analysis.scores.violence,
      sexual: payload.analysis.scores.sexual,
      hate: payload.analysis.scores.hate,
      illegal: payload.analysis.scores.illegal,
      self_harm: payload.analysis.scores.self_harm,
      harassment: payload.analysis.scores.harassment,
    },
    riskScore: payload.analysis.risk_score,
    ageGroup: payload.analysis.age_group,
    ageConfidence: payload.analysis.age_confidence,
    matchedRules: [...payload.matched_rules],
    thresholds: {
      version: payload.threshold_snapshot.version,
      reviewRiskScoreThreshold:
        payload.threshold_snapshot.review_risk_score_threshold,
      blockRiskScoreThreshold:
        payload.threshold_snapshot.block_risk_score_threshold,
      minorRiskBlockEnabled:
        payload.threshold_snapshot.minor_risk_block_enabled,
    },
    tokensConsumed: payload.tokens_consumed,
    pricingVersion: payload.pricing_version,
    createdAt: payload.created_at,
    completedAt: payload.completed_at,
  };
}

function denyDecision(
  payload: CompletedPayload,
  audit: WenitSafeAuditMetadata,
): WenitModerationResult {
  const verdicts: readonly WenitProviderVerdict[] = [
    payload.result,
    payload.server_recommended_result,
  ];
  if (payload.minor_risk || verdicts.includes('block')) {
    return { decision: 'block', allowsExposure: false, audit };
  }
  return { decision: 'review', allowsExposure: false, audit };
}

/**
 * Converts a Wenit poll response into the only representation callers may
 * retain. Zod strips analysis.reason/evidence and every other unknown field.
 */
export function mapWenitPollPayload(
  rawPayload: unknown,
  contract: WenitKnownContract,
): WenitPollMapping {
  if (!contractIsUsable(contract)) {
    return {
      state: 'terminal',
      result: wenitUnavailable('invalid_configuration'),
    };
  }

  const payload = unwrapProviderData(rawPayload);
  if (!payload || typeof payload.status !== 'string') {
    return {
      state: 'terminal',
      result: wenitUnavailable('malformed_response'),
    };
  }

  if (contract.pendingStatuses.includes(payload.status)) return { state: 'pending' };
  if (payload.status === 'failed') {
    return {
      state: 'terminal',
      result: wenitUnavailable('provider_failed'),
    };
  }
  if (payload.status !== 'completed') {
    return {
      state: 'terminal',
      result: wenitUnavailable('unknown_response'),
    };
  }

  const parsed = CompletedPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      state: 'terminal',
      result: wenitUnavailable('malformed_response'),
    };
  }

  const completed = parsed.data;
  const nestedMinorRisk = completed.analysis.minor_risk_yn;
  if (completed.minor_risk !== nestedMinorRisk) {
    return {
      state: 'terminal',
      result: wenitUnavailable('contract_mismatch'),
    };
  }
  const observedCategoryShape = Array.isArray(completed.analysis.category)
    ? 'array'
    : 'single';
  if (
    observedCategoryShape !== contract.categoryShape
    || completed.threshold_snapshot.review_risk_score_threshold
      > completed.threshold_snapshot.block_risk_score_threshold
    || !isKnownValue(
      completed.threshold_snapshot.version,
      contract.thresholdVersions,
    )
    || !isKnownValue(completed.pricing_version, contract.pricingVersions)
    || !isKnownValue(completed.analysis.age_group, contract.ageGroups)
    || completed.matched_rules.some(
      (matchedRule) => !contract.matchedRules.includes(matchedRule),
    )
  ) {
    return {
      state: 'terminal',
      result: wenitUnavailable('contract_mismatch'),
    };
  }

  const audit = makeAudit(completed);
  if (
    completed.result === 'safe'
    && completed.server_recommended_result === 'safe'
    && completed.minor_risk === false
  ) {
    return {
      state: 'terminal',
      result: { decision: 'allow', allowsExposure: true, audit },
    };
  }

  return { state: 'terminal', result: denyDecision(completed, audit) };
}

/** Parse only the task handle; no response envelope or task id is retained. */
export function parseWenitSubmitTaskId(rawPayload: unknown): string | null {
  const payload = unwrapProviderData(rawPayload);
  if (!payload || typeof payload.task_id !== 'string') return null;
  return TASK_ID_PATTERN.test(payload.task_id) ? payload.task_id : null;
}

export function isWenitSafetyCategory(
  value: string,
): value is WenitSafetyCategory {
  return (WENIT_SAFETY_CATEGORIES as readonly string[]).includes(value);
}
