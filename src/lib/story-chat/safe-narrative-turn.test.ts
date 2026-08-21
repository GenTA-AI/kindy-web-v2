import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NARRATIVE_ACTION_SCHEMA_VERSION,
  NARRATIVE_POLICY_VERSION,
  NARRATIVE_PROMPT_VERSION,
  type NarrativeActionPlan,
} from '@/lib/ai/narrative-action-contract';
import { validExperienceGraphFixture } from '@/contracts/fixtures/experience-graph.v1.fixtures';
import type {
  WenitModerationResult,
  WenitSafeAuditMetadata,
} from '@/lib/safety/wenit';
import type {
  NarrativeDirectorMetadata,
  NarrativeDirectorOutcome,
} from './narrative-director';
import {
  SafeNarrativeTurnOrchestrator,
  projectNarrativePlanForModeration,
  projectSafeNarrativeTurnForClient,
  type NarrativeTextModerator,
  type NarrativeTurnDirector,
} from './safe-narrative-turn';

const directorMetadata: NarrativeDirectorMetadata = {
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  schemaVersion: NARRATIVE_ACTION_SCHEMA_VERSION,
  promptVersion: NARRATIVE_PROMPT_VERSION,
  policyVersion: NARRATIVE_POLICY_VERSION,
  latencyMs: 320,
  requestId: 'msg_synthetic',
  usage: {
    inputTokens: 100,
    outputTokens: 12,
    cacheReadInputTokens: 0,
    cacheWriteInputTokens: 0,
  },
};

const audit: WenitSafeAuditMetadata = {
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
  ageConfidence: 99,
  matchedRules: [],
  thresholds: {
    version: 'threshold-observed-v1',
    reviewRiskScoreThreshold: 45,
    blockRiskScoreThreshold: 85,
    minorRiskBlockEnabled: true,
  },
  tokensConsumed: 8,
  pricingVersion: 'pricing-observed-v1',
  createdAt: '2026-08-21T00:00:00.000Z',
  completedAt: '2026-08-21T00:00:01.000Z',
};

const approvedPlan: NarrativeActionPlan = {
  schemaVersion: NARRATIVE_ACTION_SCHEMA_VERSION,
  promptVersion: NARRATIVE_PROMPT_VERSION,
  policyVersion: NARRATIVE_POLICY_VERSION,
  actions: [{
    type: 'choice',
    nodeId: 'n.reply',
    optionId: 'option.watch',
  }],
};

test('allows a plan only after local precheck and two explicit Wenit allows', async () => {
  const observed: string[] = [];
  const moderator = moderatorFrom(async (text) => {
    observed.push(text);
    return allowed();
  });
  let directedInput = '';
  const director = directorFrom(async (input) => {
    directedInput = input.childInput;
    return directorSuccess(approvedPlan);
  });
  const orchestrator = new SafeNarrativeTurnOrchestrator({ moderator, director });

  const result = await orchestrator.run({
    childInput: '  빛을   더 볼래  ',
    currentNodeId: 'n.reply',
    graph: validExperienceGraphFixture,
  });

  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.plan, approvedPlan);
  assert.equal(directedInput, '빛을   더 볼래');
  assert.deepEqual(observed, [
    '빛을   더 볼래',
    '[child_input]\n빛을   더 볼래\n[assistant_candidate]\n다음에는 어떻게 살펴볼까?\n빛을 자세히 본다',
  ]);
  assert.equal(JSON.stringify(result).includes('빛을   더 볼래'), false);
});

test('PII and hard-risk text never reaches Wenit or the model and is never echoed', async (t) => {
  for (const [name, childInput, expected] of [
    ['pii', '내 번호는 010-1234-5678이야', 'privacy_redirect'],
    ['danger', '나는 지금 죽고 싶어', 'safety_redirect'],
  ] as const) {
    await t.test(name, async () => {
      let moderatorCalls = 0;
      let directorCalls = 0;
      const orchestrator = new SafeNarrativeTurnOrchestrator({
        moderator: moderatorFrom(async () => {
          moderatorCalls += 1;
          return allowed();
        }),
        director: directorFrom(async () => {
          directorCalls += 1;
          return directorSuccess(approvedPlan);
        }),
      });

      const result = await orchestrator.run({
        childInput,
        currentNodeId: 'n.reply',
        graph: validExperienceGraphFixture,
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.errorCode, expected);
      assert.equal(moderatorCalls, 0);
      assert.equal(directorCalls, 0);
      assert.equal(JSON.stringify(result).includes(childInput), false);
      assert.equal(JSON.stringify(result).includes('010-1234'), false);
    });
  }
});

test('input deny prevents the model call; output deny discards the whole candidate plan', async (t) => {
  await t.test('input', async () => {
    let directorCalls = 0;
    const orchestrator = new SafeNarrativeTurnOrchestrator({
      moderator: moderatorFrom(async () => denied('block')),
      director: directorFrom(async () => {
        directorCalls += 1;
        return directorSuccess(approvedPlan);
      }),
    });
    const result = await orchestrator.run(safeInput());
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errorCode, 'input_moderation_denied');
    assert.equal(directorCalls, 0);
  });

  await t.test('output', async () => {
    let calls = 0;
    const orchestrator = new SafeNarrativeTurnOrchestrator({
      moderator: moderatorFrom(async () => {
        calls += 1;
        return calls === 1 ? allowed() : denied('review');
      }),
      director: directorFrom(async () => directorSuccess(approvedPlan)),
    });
    const result = await orchestrator.run(safeInput());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.errorCode, 'output_moderation_denied');
      assert.equal(Object.hasOwn(result, 'plan'), false);
    }
    assert.equal(calls, 2);
  });
});

test('unknown moderation, director safety actions, and stalled dependencies fail closed', async (t) => {
  await t.test('unknown moderation', async () => {
    const orchestrator = new SafeNarrativeTurnOrchestrator({
      moderator: moderatorFrom(async () => ({
        decision: 'unavailable',
        allowsExposure: false,
        reason: 'contract_mismatch',
      })),
      director: directorFrom(async () => directorSuccess(approvedPlan)),
    });
    const result = await orchestrator.run(safeInput());
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errorCode, 'input_moderation_unavailable');
  });

  await t.test('director safety plan', async () => {
    const safetyPlan: NarrativeActionPlan = {
      schemaVersion: NARRATIVE_ACTION_SCHEMA_VERSION,
      promptVersion: NARRATIVE_PROMPT_VERSION,
      policyVersion: NARRATIVE_POLICY_VERSION,
      actions: [{
        type: 'safetyAction',
        action: 'pause_session',
        reasonCode: 'policy_uncertain',
      }],
    };
    const orchestrator = new SafeNarrativeTurnOrchestrator({
      moderator: moderatorFrom(async () => allowed()),
      director: directorFrom(async () => directorSuccess(safetyPlan)),
    });
    const result = await orchestrator.run(safeInput());
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errorCode, 'director_safety_redirect');
  });

  await t.test('orchestrator independently revalidates the graph plan', async () => {
    let moderationCalls = 0;
    const invalidPlan: NarrativeActionPlan = {
      ...approvedPlan,
      actions: [{ type: 'node', nodeId: 'n.cinematic' }],
    };
    const orchestrator = new SafeNarrativeTurnOrchestrator({
      moderator: moderatorFrom(async () => {
        moderationCalls += 1;
        return allowed();
      }),
      director: directorFrom(async () => directorSuccess(invalidPlan)),
    });
    const result = await orchestrator.run(safeInput());
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errorCode, 'invalid_output_projection');
    assert.equal(moderationCalls, 1);
  });

  await t.test('deadline', async () => {
    const orchestrator = new SafeNarrativeTurnOrchestrator({
      deadlineMs: 50,
      moderator: moderatorFrom(async () => new Promise<WenitModerationResult>(
        () => undefined,
      )),
      director: directorFrom(async () => directorSuccess(approvedPlan)),
    });
    const result = await orchestrator.run(safeInput());
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errorCode, 'timeout');
  });
});

test('rejects contradictory moderator results and non-contract director fields', async (t) => {
  await t.test('block cannot claim exposure', async () => {
    let directorCalls = 0;
    const orchestrator = new SafeNarrativeTurnOrchestrator({
      moderator: moderatorFrom(async () => ({
        decision: 'block',
        allowsExposure: true,
        audit,
      })),
      director: directorFrom(async () => {
        directorCalls += 1;
        return directorSuccess(approvedPlan);
      }),
    });
    const result = await orchestrator.run(safeInput());
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errorCode, 'input_moderation_unavailable');
    assert.equal(directorCalls, 0);
  });

  await t.test('allow cannot carry a blocked audit', async () => {
    const orchestrator = new SafeNarrativeTurnOrchestrator({
      moderator: moderatorFrom(async () => ({
        decision: 'allow',
        allowsExposure: true,
        audit: {
          ...audit,
          providerResult: 'block',
          serverRecommendedResult: 'block',
          minorRisk: true,
        },
      })),
      director: directorFrom(async () => directorSuccess(approvedPlan)),
    });
    const result = await orchestrator.run(safeInput());
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errorCode, 'input_moderation_unavailable');
  });

  await t.test('extra generated text on a plan is never returned', async () => {
    const leakedText = '검수되지 않은 새 문장';
    const orchestrator = new SafeNarrativeTurnOrchestrator({
      moderator: moderatorFrom(async () => allowed()),
      director: directorFrom(async () => ({
        ...directorSuccess(approvedPlan),
        plan: { ...approvedPlan, generatedText: leakedText },
      })),
    });
    const result = await orchestrator.run(safeInput());
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes(leakedText), false);
  });

  await t.test('provider-controlled audit and request identifiers are projected out', async () => {
    const leakedToken = 'Alice-school';
    const orchestrator = new SafeNarrativeTurnOrchestrator({
      moderator: moderatorFrom(async () => ({
        decision: 'allow',
        allowsExposure: true,
        audit: {
          ...audit,
          ageGroup: leakedToken,
          matchedRules: [leakedToken],
          thresholds: { ...audit.thresholds, version: leakedToken },
          pricingVersion: leakedToken,
        },
      })),
      director: directorFrom(async () => ({
        ok: true,
        plan: approvedPlan,
        metadata: {
          ...directorMetadata,
          model: leakedToken,
          requestId: leakedToken,
        },
      })),
    });
    const result = await orchestrator.run({
      ...safeInput(),
      childInput: leakedToken,
    });
    assert.equal(result.ok, true);
    assert.equal(JSON.stringify(result).includes(leakedToken), false);
  });
});

test('output projection contains display copy but no storage, hash, answer, or solution data', () => {
  const plan: NarrativeActionPlan = {
    schemaVersion: NARRATIVE_ACTION_SCHEMA_VERSION,
    promptVersion: NARRATIVE_PROMPT_VERSION,
    policyVersion: NARRATIVE_POLICY_VERSION,
    actions: [
      { type: 'cinematic', nodeId: 'n.cinematic' },
      { type: 'node', nodeId: 'n.choice' },
    ],
  };
  const projected = projectNarrativePlanForModeration(
    plan,
    validExperienceGraphFixture,
  );
  assert.match(projected ?? '', /강물 위에서 춤추는 빛/);
  for (const forbidden of [
    'storageKey',
    'sha256',
    'correctOptionId',
    'solution',
    'river-light.mp4',
  ]) {
    assert.equal(projected?.includes(forbidden), false, forbidden);
  }
});

test('public projection strips every moderation, model, cost, latency, and failure detail', async () => {
  const orchestrator = new SafeNarrativeTurnOrchestrator({
    moderator: moderatorFrom(async () => allowed()),
    director: directorFrom(async () => directorSuccess(approvedPlan)),
  });
  const internal = await orchestrator.run(safeInput());
  const publicResult = projectSafeNarrativeTurnForClient(internal);
  assert.deepEqual(publicResult, { ok: true, plan: approvedPlan });
  for (const forbidden of [
    '"inputModeration":',
    '"outputModeration":',
    '"director":',
    '"tokensConsumed":',
    '"riskScore":',
    '"latencyMs":',
  ]) {
    assert.equal(JSON.stringify(publicResult).includes(forbidden), false);
  }

  const blockedInternal = await orchestrator.run({
    ...safeInput(),
    childInput: '010-1234-5678',
  });
  const blockedPublic = projectSafeNarrativeTurnForClient(blockedInternal);
  assert.equal(blockedPublic.ok, false);
  assert.equal(JSON.stringify(blockedPublic).includes('errorCode'), false);
  assert.equal(JSON.stringify(blockedPublic).includes('privacy_redirect'), false);
});

function safeInput() {
  return {
    childInput: '빛을 더 볼래',
    currentNodeId: 'n.reply',
    graph: validExperienceGraphFixture,
  };
}

function moderatorFrom(
  moderateText: NarrativeTextModerator['moderateText'],
): NarrativeTextModerator {
  return { moderateText };
}

function directorFrom(
  generate: NarrativeTurnDirector['generate'],
): NarrativeTurnDirector {
  return { generate };
}

function directorSuccess(plan: NarrativeActionPlan): NarrativeDirectorOutcome {
  return { ok: true, plan, metadata: directorMetadata };
}

function allowed(): WenitModerationResult {
  return { decision: 'allow', allowsExposure: true, audit };
}

function denied(decision: 'review' | 'block'): WenitModerationResult {
  return {
    decision,
    allowsExposure: false,
    audit: {
      ...audit,
      providerResult: decision,
      serverRecommendedResult: decision,
    },
  };
}
