import assert from 'node:assert/strict';
import test from 'node:test';

import { mapWenitPollPayload, parseWenitSubmitTaskId } from './canonical';
import {
  makeWenitCompletedPayload,
  WENIT_TEST_CONTRACT,
} from './test-fixtures';

test('safe 실측 계약을 raw 필드 없는 canonical golden 값으로 투영한다', () => {
  const mapped = mapWenitPollPayload(
    makeWenitCompletedPayload(),
    WENIT_TEST_CONTRACT,
  );

  assert.deepEqual(mapped, {
    state: 'terminal',
    result: {
      decision: 'allow',
      allowsExposure: true,
      audit: {
        provider: 'wenit-safe-guard',
        inputType: 'text',
        decisionSource: 'api_key_thresholds',
        providerResult: 'safe',
        serverRecommendedResult: 'safe',
        minorRisk: false,
        categories: [],
        categoryScores: {
          violence: 0,
          sexual: 0,
          hate: 0,
          illegal: 0,
          self_harm: 0,
          harassment: 0,
        },
        riskScore: 0,
        ageGroup: 'general',
        ageConfidence: 99.5,
        matchedRules: [],
        thresholds: {
          version: 'threshold-observed-v1',
          reviewRiskScoreThreshold: 45,
          blockRiskScoreThreshold: 85,
          minorRiskBlockEnabled: true,
        },
        tokensConsumed: 12,
        pricingVersion: 'pricing-observed-v1',
        createdAt: '2026-08-21T00:00:00.000Z',
        completedAt: '2026-08-21T00:00:01.431Z',
      },
    },
  });

  const serialized = JSON.stringify(mapped);
  for (const forbidden of [
    'SYNTHETIC_REASON_MUST_BE_STRIPPED',
    'SYNTHETIC_EVIDENCE_MUST_BE_STRIPPED',
    'SYNTHETIC_TASK_ID_MUST_BE_STRIPPED',
    'reason',
    'evidence',
    'task_id',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('block과 review는 모두 노출 불가로 투영한다', () => {
  const blocked = mapWenitPollPayload(
    makeWenitCompletedPayload({
      result: 'block',
      server_recommended_result: 'block',
      minor_risk: true,
      analysis: {
        scores: {
          violence: 45,
          sexual: 0,
          hate: 0,
          illegal: 0,
          self_harm: 0,
          harassment: 0,
        },
        category: ['violence'],
        age_group: 'infant_child',
        age_confidence: 98,
        risk_score: 45,
        minor_risk_yn: true,
      },
      matched_rules: ['minor_risk_block_enabled'],
    }),
    WENIT_TEST_CONTRACT,
  );
  assert.equal(blocked.state, 'terminal');
  if (blocked.state === 'terminal') {
    assert.equal(blocked.result.decision, 'block');
    assert.equal(blocked.result.allowsExposure, false);
  }

  const review = mapWenitPollPayload(
    makeWenitCompletedPayload({ result: 'review' }),
    WENIT_TEST_CONTRACT,
  );
  assert.equal(review.state, 'terminal');
  if (review.state === 'terminal') {
    assert.equal(review.result.decision, 'review');
    assert.equal(review.result.allowsExposure, false);
  }
});

test('top-level과 analysis의 minor risk 불일치는 unavailable이다', () => {
  const mapped = mapWenitPollPayload(
    makeWenitCompletedPayload({ minor_risk: true }),
    WENIT_TEST_CONTRACT,
  );
  assert.deepEqual(mapped, {
    state: 'terminal',
    result: {
      decision: 'unavailable',
      allowsExposure: false,
      reason: 'contract_mismatch',
    },
  });
});

test('미확인 버전, enum, status, error, malformed schema는 모두 fail closed다', async (t) => {
  const cases: readonly [string, unknown, string][] = [
    [
      'threshold version',
      makeWenitCompletedPayload({
        threshold_snapshot: {
          version: 'unobserved-v9',
          review_risk_score_threshold: 45,
          block_risk_score_threshold: 85,
          minor_risk_block_enabled: true,
        },
      }),
      'contract_mismatch',
    ],
    [
      'decision source',
      makeWenitCompletedPayload({ decision_source: 'unknown_source' }),
      'malformed_response',
    ],
    [
      'status',
      { success: true, data: { status: 'waiting_forever' } },
      'unknown_response',
    ],
    [
      'provider error',
      { success: true, error: { message: 'do not retain me' }, data: {} },
      'malformed_response',
    ],
    [
      'missing server verdict',
      makeWenitCompletedPayload({ server_recommended_result: undefined }),
      'malformed_response',
    ],
    [
      'legacy string minor flag',
      makeWenitCompletedPayload({
        analysis: {
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
          age_confidence: 99,
          risk_score: 0,
          minor_risk_yn: 'n',
        },
      }),
      'malformed_response',
    ],
    [
      'unapproved category shape',
      makeWenitCompletedPayload({
        analysis: {
          scores: {
            violence: 0,
            sexual: 0,
            hate: 0,
            illegal: 0,
            self_harm: 0,
            harassment: 0,
          },
          category: 'violence',
          age_group: 'general',
          age_confidence: 99,
          risk_score: 0,
          minor_risk_yn: false,
        },
      }),
      'contract_mismatch',
    ],
    [
      'unapproved matched rule',
      makeWenitCompletedPayload({ matched_rules: ['unobserved_rule'] }),
      'contract_mismatch',
    ],
    [
      'unknown behavior-affecting field',
      makeWenitCompletedPayload({ policy_version: 'unobserved-policy-v2' }),
      'malformed_response',
    ],
  ];

  for (const [name, payload, expectedReason] of cases) {
    await t.test(name, () => {
      const mapped = mapWenitPollPayload(payload, WENIT_TEST_CONTRACT);
      assert.equal(mapped.state, 'terminal');
      if (mapped.state === 'terminal') {
        assert.equal(mapped.result.decision, 'unavailable');
        if (mapped.result.decision === 'unavailable') {
          assert.equal(mapped.result.reason, expectedReason);
        }
      }
    });
  }
});

test('미설정 allowlist는 safe 응답도 unavailable로 닫는다', () => {
  const mapped = mapWenitPollPayload(makeWenitCompletedPayload(), {
    thresholdVersions: [],
    pricingVersions: [],
    ageGroups: [],
    categoryShape: null,
    pendingStatuses: [],
    matchedRules: [],
  });
  assert.deepEqual(mapped, {
    state: 'terminal',
    result: {
      decision: 'unavailable',
      allowsExposure: false,
      reason: 'invalid_configuration',
    },
  });
});

test('submit parser는 bounded opaque task id만 허용한다', () => {
  assert.equal(
    parseWenitSubmitTaskId({ success: true, data: { task_id: 'task_123-ABC' } }),
    'task_123-ABC',
  );
  assert.equal(
    parseWenitSubmitTaskId({ data: { task_id: 'documented_without_success' } }),
    'documented_without_success',
  );
  assert.equal(
    parseWenitSubmitTaskId({
      success: false,
      data: { task_id: 'must_not_accept' },
    }),
    null,
  );
  for (const taskId of ['', '../task', 'task/id', 'task?leak=1', 'a'.repeat(129)]) {
    assert.equal(
      parseWenitSubmitTaskId({ success: true, data: { task_id: taskId } }),
      null,
      taskId,
    );
  }
});
