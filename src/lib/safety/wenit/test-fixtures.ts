import type { WenitKnownContract } from './types';

export const WENIT_TEST_CONTRACT: WenitKnownContract = {
  thresholdVersions: ['threshold-observed-v1'],
  pricingVersions: ['pricing-observed-v1'],
  ageGroups: ['general', 'infant_child'],
  categoryShape: 'array',
  pendingStatuses: ['processing'],
  matchedRules: ['minor_risk_block_enabled'],
};

export function makeWenitCompletedPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    success: true,
    data: {
      status: 'completed',
      result: 'safe',
      server_recommended_result: 'safe',
      minor_risk: false,
      decision_source: 'api_key_thresholds',
      input_type: 'text',
      analysis: {
        reason: 'SYNTHETIC_REASON_MUST_BE_STRIPPED',
        evidence: ['SYNTHETIC_EVIDENCE_MUST_BE_STRIPPED'],
        scores: {
          violence: 0,
          sexual: 0,
          hate: 0,
          illegal: 0,
          self_harm: 0,
          harassment: 0,
        },
        category: [],
        age_group: 'general',
        age_confidence: 99.5,
        risk_score: 0,
        minor_risk_yn: false,
      },
      threshold_snapshot: {
        version: 'threshold-observed-v1',
        review_risk_score_threshold: 45,
        block_risk_score_threshold: 85,
        minor_risk_block_enabled: true,
      },
      matched_rules: [],
      tokens_consumed: 12,
      pricing_version: 'pricing-observed-v1',
      created_at: '2026-08-21T00:00:00.000Z',
      completed_at: '2026-08-21T00:00:01.431Z',
      task_id: 'SYNTHETIC_TASK_ID_MUST_BE_STRIPPED',
      ...overrides,
    },
  };
}
