import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_AXIS_PROFILE_STATE,
  ageBandAdjustment,
  buildEvidence,
  evidenceFromRound,
  isAssessableRound,
  planSessionAxes,
  trendFrom,
  updateAxis,
} from './evidence';
import type { AxisProfileState, RoundEvidenceInput } from './evidence';

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

// ── 로드맵 P0: 관찰되지 않은 요소는 중립값을 지어내지 않고 가중치에서 제외한다 ──

test('전이·선호 미관찰 시 관찰된 요소(performance/process)만으로 재정규화한다', () => {
  const evidence = buildEvidence(input());

  assert.deepEqual(evidence.observed, {
    performance: true,
    process: true,
    persistence: false,
    preference: false,
    transfer: false,
  });

  // base = (0.3*1 + 0.25*1) / (0.3 + 0.25) = 1 → level = 100*(0.85*0.5 + 0.15*1) = 57.49999...(부동소수점) → 57
  const next = updateAxis(DEFAULT_PREVIOUS, evidence);
  assert.equal(next.level, 57);
  assert.equal(next.evidence_count, 1);
});

test('정오답 없는 완료는 performance 0.6을 받지 않는다', () => {
  const evidence = buildEvidence(input({ is_correct: null }));
  assert.equal(evidence.performance, 0);
  assert.equal(evidence.observed.performance, false);
});

test('전이 신호가 없으면 transfer는 0.5 중립이 아니라 미관찰이다', () => {
  const neutral = buildEvidence(input({ transfer_success: null }));
  const success = buildEvidence(input({ transfer_success: true }));

  assert.equal(neutral.observed.transfer, false);
  assert.equal(success.observed.transfer, true);
  assert.equal(success.transfer, 1);
  assert.ok(updateAxis(DEFAULT_PREVIOUS, success).level >= updateAxis(DEFAULT_PREVIOUS, neutral).level);
});

test('아무 신호도 관찰되지 않으면 프로필을 바꾸지 않는다', () => {
  const evidence = buildEvidence(
    input({ is_correct: null, elapsed_ms: null, hint_count: 0 }),
  );
  const next = updateAxis(DEFAULT_PREVIOUS, evidence);

  assert.deepEqual(next, DEFAULT_PREVIOUS);
});

test('재시도 성공은 무재시도 성공보다 persistence가 높다', () => {
  const noRetry = buildEvidence(input({ retried: false, retry_count: 0 }));
  const retrySuccess = buildEvidence(input({ retried: true, retry_count: 1 }));

  assert.equal(noRetry.observed.persistence, false);
  assert.equal(retrySuccess.observed.persistence, true);
  assert.equal(retrySuccess.persistence, 1);
});

test('힌트 3회는 process를 낮추고 레벨도 낮춘다', () => {
  const noHints = buildEvidence(input({ hint_count: 0 }));
  const manyHints = buildEvidence(input({ hint_count: 3 }));

  assert.equal(noHints.process, 1);
  assert.ok(Math.abs(manyHints.process - 0.4) < 1e-12);
  assert.ok(updateAxis(DEFAULT_PREVIOUS, manyHints).level < updateAxis(DEFAULT_PREVIOUS, noHints).level);
});

test('confidence 증가는 0.08 상한, 레벨·confidence는 범위 안', () => {
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

// ── 로드맵 P0: 역량 갱신 대상 게이트 ──

test('isAssessableRound — 자동선택 라운드는 노출로만 남고 갱신 대상이 아니다', () => {
  assert.equal(
    isAssessableRound({
      game_type: 'Q_quiz',
      objective_code: null,
      score: 1,
      max_score: 1,
      latency_ms: 900,
      retried: false,
      auto_selected: true,
    }),
    false,
  );
});

test('isAssessableRound — 정오답 없는 라운드(분기 선택·감정 표현)는 갱신 대상이 아니다', () => {
  assert.equal(
    isAssessableRound({
      game_type: 'emotion_expression',
      objective_code: 'sel_empathy',
      score: null,
      max_score: null,
      latency_ms: 3_000,
      retried: false,
    }),
    false,
  );
});

test('isAssessableRound — 정오답이 있는 일반 라운드는 갱신 대상이다', () => {
  assert.equal(
    isAssessableRound({
      game_type: 'Q_quiz',
      objective_code: null,
      score: 1,
      max_score: 1,
      latency_ms: 900,
      retried: false,
    }),
    true,
  );
});

test('evidenceFromRound는 명시적 정오답을 점수 추론보다 우선한다', () => {
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

test('연령 보정·세션 축 계획·추세 헬퍼는 v0.1 규칙 유지', () => {
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
