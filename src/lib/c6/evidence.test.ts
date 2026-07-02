import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_AXIS_PROFILE_STATE,
  ageBandAdjustment,
  buildEvidence,
  evidenceFromRound,
  planSessionAxes,
  trendFrom,
  updateAxis,
} from './evidence';
import type { AxisEvidence, AxisProfileState, RoundEvidenceInput } from './evidence';

const DEFAULT_PREVIOUS: AxisProfileState = DEFAULT_AXIS_PROFILE_STATE;

function input(overrides: Partial<RoundEvidenceInput> = {}): RoundEvidenceInput {
  return {
    axis_id: 'C1_focus_flow',
    is_correct: true,
    completed: true,
    abandoned: false,
    elapsed_ms: 1_200,
    hint_count: 0,
    retried: false,
    retry_count: 0,
    preferred_character_match: false,
    activity_type_revisit: false,
    transfer_success: null,
    ...overrides,
  };
}

function baseOf(evidence: AxisEvidence): number {
  return (
    0.3 * evidence.performance +
    0.25 * evidence.process +
    0.2 * evidence.persistence +
    0.1 * evidence.preference +
    0.15 * evidence.transfer
  );
}

function assertNearlyEqual(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-12, `expected ${actual} to equal ${expected}`);
}

test('first observation applies the spec formula from the default profile', () => {
  const evidence = buildEvidence(input());
  const next = updateAxis(DEFAULT_PREVIOUS, evidence);

  assert.deepEqual(
    {
      performance: evidence.performance,
      process: evidence.process,
      persistence: evidence.persistence,
      preference: evidence.preference,
      transfer: evidence.transfer,
    },
    {
      performance: 1,
      process: 1,
      persistence: 0.7,
      preference: 0.5,
      transfer: 0.5,
    },
  );
  assertNearlyEqual(baseOf(evidence), 0.815);
  assert.equal(next.level, 55);
  assertNearlyEqual(next.confidence, 0.044);
  assert.equal(next.evidence_count, 1);
});

test('retry success has a higher base than no-retry success', () => {
  const noRetry = buildEvidence(input({ retried: false, retry_count: 0 }));
  const retrySuccess = buildEvidence(input({ retried: true, retry_count: 1 }));

  assert.equal(noRetry.persistence, 0.7);
  assert.equal(retrySuccess.persistence, 1);
  assert.ok(baseOf(retrySuccess) > baseOf(noRetry));
});

test('three hints lower process and the final level', () => {
  const noHints = buildEvidence(input({ hint_count: 0 }));
  const manyHints = buildEvidence(input({ hint_count: 3 }));

  assert.equal(noHints.process, 1);
  assertNearlyEqual(manyHints.process, 0.4);
  assert.ok(updateAxis(DEFAULT_PREVIOUS, manyHints).level < updateAxis(DEFAULT_PREVIOUS, noHints).level);
});

test('abandoned rounds zero performance and persistence and lower the level below 50', () => {
  const evidence = buildEvidence(
    input({
      is_correct: null,
      completed: false,
      abandoned: true,
    }),
  );
  const next = updateAxis(DEFAULT_PREVIOUS, evidence);

  assert.equal(evidence.performance, 0);
  assert.equal(evidence.persistence, 0);
  assert.ok(next.level < 50);
});

test('transfer success raises base above neutral transfer', () => {
  const neutralTransfer = buildEvidence(input({ transfer_success: null }));
  const successfulTransfer = buildEvidence(input({ transfer_success: true }));

  assert.equal(neutralTransfer.transfer, 0.5);
  assert.equal(successfulTransfer.transfer, 1);
  assert.ok(baseOf(successfulTransfer) > baseOf(neutralTransfer));
});

test('confidence gain is capped at 0.08 and confidence and level stay in bounds', () => {
  const evidence = buildEvidence(
    input({
      hint_count: 1,
      retried: true,
      retry_count: 1,
      preferred_character_match: true,
      transfer_success: true,
    }),
  );
  const next = updateAxis({ level: 100, confidence: 0.98, evidence_count: 7 }, evidence);

  assert.equal(evidence.quality, 1);
  assert.equal(next.confidence, 1);
  assert.ok(next.level >= 0 && next.level <= 100);
  assert.equal(next.evidence_count, 8);
});

test('evidenceFromRound normalizes round records with explicit correctness priority', () => {
  const normalized = evidenceFromRound(
    {
      game_type: 'hidden_friend',
      objective_code: 'creativity_observe',
      score: 1,
      max_score: 1,
      latency_ms: 2_300,
      retried: true,
      is_correct: false,
      hint_count: 2,
      retry_count: 3,
      abandoned: true,
    },
    {
      preferredCharacterMatch: true,
      activityTypeRevisit: false,
      transferSuccess: false,
      age: 5,
    },
  );

  assert.deepEqual(normalized, {
    axis_id: 'C2_observation_inquiry',
    is_correct: false,
    completed: false,
    abandoned: true,
    elapsed_ms: 2_300,
    hint_count: 2,
    retried: true,
    retry_count: 3,
    preferred_character_match: true,
    activity_type_revisit: false,
    transfer_success: false,
    age_band_adjustment: 0.05,
  });
});

test('age adjustment, session axis plan, and trend helpers follow v0.1 rules', () => {
  assert.equal(ageBandAdjustment(5), 0.05);
  assert.equal(ageBandAdjustment(6), 0);
  assert.equal(ageBandAdjustment(null), 0);

  assert.deepEqual(planSessionAxes('C3_pattern_problem'), [
    'C1_focus_flow',
    'C2_observation_inquiry',
    'C3_pattern_problem',
  ]);
  assert.deepEqual(planSessionAxes('C4_language_expression'), [
    'C1_focus_flow',
    'C5_imagination_analogy',
    'C6_social_emotional',
  ]);

  assert.equal(trendFrom(50, 52), 'up');
  assert.equal(trendFrom(50, 49), 'steady');
  assert.equal(trendFrom(50, 48), 'down');
});
