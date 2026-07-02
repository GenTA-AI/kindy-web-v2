import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRecommendation } from './recommendation';
import type { ChildGrowthProfileInput, StorySeedInput } from './recommendation';

function profile(overrides: Partial<ChildGrowthProfileInput> = {}): ChildGrowthProfileInput {
  return {
    axis_id: 'C2_observation_inquiry',
    current_level: 50,
    confidence: 0.5,
    evidence_count: 3,
    ...overrides,
  };
}

function seed(overrides: Partial<StorySeedInput> = {}): StorySeedInput {
  return {
    id: 'seed-default',
    title: 'Default seed',
    target_axis: 'C2_observation_inquiry',
    difficulty: 1,
    approval_status: 'approved',
    published: true,
    ...overrides,
  };
}

test('selects growth from sufficient evidence lowest level and strength from confident highest level', () => {
  const result = buildRecommendation({
    c6: [
      profile({ axis_id: 'C1_focus_flow', current_level: 72, confidence: 0.9, evidence_count: 3 }),
      profile({ axis_id: 'C2_observation_inquiry', current_level: 35, confidence: 0.2, evidence_count: 1 }),
      profile({ axis_id: 'C3_pattern_problem', current_level: 30, confidence: 0.5, evidence_count: 1 }),
      profile({ axis_id: 'C4_language_expression', current_level: 48, confidence: 0.7, evidence_count: 3 }),
    ],
    recent: [],
    pool: [
      seed({ id: 'growth', target_axis: 'C4_language_expression' }),
      seed({ id: 'bridge', target_axis: 'C1_focus_flow' }),
    ],
  });

  assert.ok(result);
  assert.equal(result.growth_axis, 'C4_language_expression');
  assert.equal(result.strength_axis, 'C1_focus_flow');
  assert.deepEqual(result.story_seeds.map((item) => item.id), ['growth', 'bridge']);
});

test('filters out unpublished, unapproved, and off-axis story seeds', () => {
  const result = buildRecommendation({
    c6: [
      profile({ axis_id: 'C2_observation_inquiry', current_level: 40, confidence: 0.4, evidence_count: 3 }),
      profile({ axis_id: 'C5_imagination_analogy', current_level: 80, confidence: 0.8, evidence_count: 3 }),
    ],
    recent: [],
    pool: [
      seed({ id: 'approved-growth', target_axis: 'C2_observation_inquiry' }),
      seed({ id: 'draft-growth', target_axis: 'C2_observation_inquiry', approval_status: 'draft' }),
      seed({ id: 'unpublished-bridge', target_axis: 'C5_imagination_analogy', published: false }),
      seed({ id: 'off-axis', target_axis: 'C1_focus_flow' }),
    ],
  });

  assert.ok(result);
  assert.deepEqual(result.story_seeds.map((item) => item.id), ['approved-growth']);
});

test('ranks activity match first, then novelty before lower-difficulty recent seeds, and returns top two', () => {
  const result = buildRecommendation({
    c6: [
      profile({
        axis_id: 'C2_observation_inquiry',
        current_level: 40,
        confidence: 0.4,
        evidence_count: 3,
        preferred_activity_type: 'build',
      }),
      profile({ axis_id: 'C5_imagination_analogy', current_level: 80, confidence: 0.8, evidence_count: 3 }),
    ],
    recent: [{ recommended_story_seed_id: 'recent-low-difficulty' }],
    pool: [
      seed({
        id: 'activity-match-recent',
        target_axis: 'C2_observation_inquiry',
        activity_type: 'build',
        difficulty: 9,
      }),
      seed({
        id: 'recent-low-difficulty',
        target_axis: 'C2_observation_inquiry',
        activity_type: 'listen',
        difficulty: 1,
      }),
      seed({
        id: 'novel-higher-difficulty',
        target_axis: 'C5_imagination_analogy',
        activity_type: 'listen',
        difficulty: 5,
      }),
      seed({
        id: 'novel-highest-difficulty',
        target_axis: 'C5_imagination_analogy',
        activity_type: 'listen',
        difficulty: 6,
      }),
    ],
  });

  assert.ok(result);
  assert.deepEqual(result.story_seeds.map((item) => item.id), [
    'activity-match-recent',
    'novel-higher-difficulty',
  ]);
});

test('returns null for empty profiles or zero approved seeds', () => {
  assert.equal(
    buildRecommendation({
      c6: [],
      recent: [],
      pool: [seed()],
    }),
    null,
  );

  assert.equal(
    buildRecommendation({
      c6: [profile()],
      recent: [],
      pool: [seed({ approval_status: 'draft' })],
    }),
    null,
  );
});

test('parent reason avoids forbidden report words', () => {
  const result = buildRecommendation({
    c6: [
      profile({ axis_id: 'C2_observation_inquiry', current_level: 40, confidence: 0.4, evidence_count: 3 }),
      profile({ axis_id: 'C5_imagination_analogy', current_level: 80, confidence: 0.8, evidence_count: 3 }),
    ],
    recent: [],
    pool: [seed({ id: 'approved-growth', target_axis: 'C2_observation_inquiry' })],
  });

  assert.ok(result);
  assert.doesNotMatch(result.parent_reason_summary, /점수|등급|부족|진단|또래/);
});
