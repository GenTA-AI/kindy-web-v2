import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NARRATIVE_ACTION_JSON_SCHEMA,
  NARRATIVE_ACTION_SCHEMA_VERSION,
  NARRATIVE_POLICY_VERSION,
  NARRATIVE_PROMPT_VERSION,
  parseNarrativeActionPlan,
  type NarrativeAction,
  type NarrativeActionPlan,
} from '@/lib/ai/narrative-action-contract';
import {
  DEFAULT_NARRATIVE_MODEL_CONFIG,
  NARRATIVE_CHILD_PROMPT_REDACTION,
  SensitiveNarrativePrompt,
  parseNarrativeGeneratorResult,
  type NarrativeActionGenerator,
  type NarrativeGeneratorInput,
  type NarrativeGeneratorResult,
} from '@/lib/ai/narrative-generator';
import { validExperienceGraphFixture } from '@/contracts/fixtures/experience-graph.v1.fixtures';
import { parseExperienceGraph } from '@/contracts/experience-graph.v1';
import { getStoryChatRuntimeConfig } from './runtime-config';
import {
  NARRATIVE_DIRECTOR_RUNTIME_READY,
  NarrativeDirector,
  buildNarrativeUserPrompt,
  buildSafeNarrativeGraphContext,
  validateNarrativePlanAgainstGraph,
} from './narrative-director';

const graph = parseExperienceGraph(validExperienceGraphFixture);
const usage = {
  inputTokens: 120,
  outputTokens: 18,
  cacheReadInputTokens: 20,
  cacheWriteInputTokens: 0,
};

test('closed action contract permits only the six versioned action variants', () => {
  const parsed = parseNarrativeActionPlan(plan([
    { type: 'node', nodeId: 'n.choice' },
    { type: 'reply', nodeId: 'n.intro' },
    { type: 'choice', nodeId: 'n.reply', optionId: 'option.watch' },
    { type: 'cinematic', nodeId: 'n.cinematic' },
  ]));
  assert.equal(parsed.actions.length, 4);

  assert.doesNotThrow(() => parseNarrativeActionPlan(plan([
    { type: 'imageRecipe', nodeId: 'n.image', recipeId: 'recipe.child-river' },
  ])));
  assert.doesNotThrow(() => parseNarrativeActionPlan(plan([
    {
      type: 'safetyAction',
      action: 'ask_trusted_adult',
      reasonCode: 'distress_or_bullying',
    },
  ])));
});

test('closed action contract rejects generated copy, URLs, extra keys, and version drift', () => {
  assert.throws(() => parseNarrativeActionPlan({
    ...plan([{ type: 'reply', nodeId: 'n.intro' }]),
    rawChildText: 'do not echo this',
  }));
  assert.throws(() => parseNarrativeActionPlan(plan([{
    type: 'reply',
    nodeId: 'n.intro',
    text: 'model-authored text is forbidden',
  } as unknown as NarrativeAction])));
  assert.throws(() => parseNarrativeActionPlan(plan([{
    type: 'cinematic',
    nodeId: 'n.cinematic',
    url: 'https://attacker.invalid/video.mp4',
  } as unknown as NarrativeAction])));
  assert.throws(() => parseNarrativeActionPlan({
    ...plan([{ type: 'node', nodeId: 'n.choice' }]),
    promptVersion: 'narrative-director-latest',
  }));
  assert.throws(() => parseNarrativeActionPlan(plan([
    { type: 'tool', nodeId: 'n.choice' } as unknown as NarrativeAction,
  ])));
});

test('graph validation accepts only exact authored transitions and specialized node IDs', () => {
  const cinematicPath = plan([
    { type: 'choice', nodeId: 'n.reply', optionId: 'option.watch' },
    { type: 'cinematic', nodeId: 'n.cinematic' },
    { type: 'node', nodeId: 'n.choice' },
  ]);
  assert.doesNotThrow(() => validateNarrativePlanAgainstGraph(
    cinematicPath,
    graph,
    'n.reply',
  ));

  const imagePath = plan([
    { type: 'choice', nodeId: 'n.choice', optionId: 'option.create' },
    { type: 'imageRecipe', nodeId: 'n.image', recipeId: 'recipe.child-river' },
    { type: 'node', nodeId: 'n.quiz' },
  ]);
  assert.doesNotThrow(() => validateNarrativePlanAgainstGraph(
    imagePath,
    graph,
    'n.choice',
  ));

  assert.throws(() => validateNarrativePlanAgainstGraph(plan([
    { type: 'node', nodeId: 'n.cinematic' },
  ]), graph, 'n.reply'));
  assert.throws(() => validateNarrativePlanAgainstGraph(plan([
    { type: 'choice', nodeId: 'n.reply', optionId: 'option.missing' },
  ]), graph, 'n.reply'));
  assert.throws(() => validateNarrativePlanAgainstGraph(plan([
    { type: 'choice', nodeId: 'n.choice', optionId: 'option.create' },
    { type: 'imageRecipe', nodeId: 'n.image', recipeId: 'recipe.unapproved' },
  ]), graph, 'n.choice'));
  assert.throws(() => validateNarrativePlanAgainstGraph(plan([
    { type: 'safetyAction', action: 'pause_session', reasonCode: 'policy_uncertain' },
    { type: 'node', nodeId: 'n.choice' },
  ]), graph, 'n.reply'));
});

test('safe prompt projection excludes release internals, answers, and solutions', () => {
  const safeContext = buildSafeNarrativeGraphContext(graph, 'n.reply');
  const serialized = JSON.stringify(safeContext);
  for (const forbidden of [
    'storageKey',
    'sha256',
    'sourceRefs',
    'correctOptionId',
    'feedback',
    'solution',
    'orderedItemIds',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }

  const sensitive = buildNarrativeUserPrompt({
    childInput: '내 비밀 답변 7391',
    currentNodeId: 'n.reply',
    graph,
  });
  assert.equal(JSON.stringify({ sensitive }).includes('내 비밀 답변 7391'), false);
  assert.equal(JSON.stringify({ sensitive }), JSON.stringify({
    sensitive: NARRATIVE_CHILD_PROMPT_REDACTION,
  }));
  assert.match(sensitive.revealForProvider(), /내 비밀 답변 7391/);
});

test('director returns a fully validated plan with bounded usage metadata', async () => {
  const secret = '아이가 입력한 비밀 문장 4482';
  let observedInput: NarrativeGeneratorInput | undefined;
  const generator: NarrativeActionGenerator = {
    async generate(input) {
      observedInput = input;
      return success(plan([
        { type: 'choice', nodeId: 'n.reply', optionId: 'option.watch' },
      ]));
    },
  };

  const outcome = await new NarrativeDirector({ generator }).generate({
    childInput: secret,
    currentNodeId: 'n.reply',
    graph,
  });

  assert.equal(outcome.ok, true);
  assert.ok(observedInput);
  assert.equal(observedInput.maxOutputTokens, 512);
  assert.equal(observedInput.jsonSchema, NARRATIVE_ACTION_JSON_SCHEMA);
  assert.match(observedInput.userPrompt.revealForProvider(), new RegExp(secret));
  assert.equal(JSON.stringify(observedInput).includes(secret), false);
  assert.equal(JSON.stringify(outcome).includes(secret), false);
  assert.deepEqual(outcome.metadata.usage, usage);
  assert.equal(outcome.metadata.promptVersion, NARRATIVE_PROMPT_VERSION);
  assert.equal(outcome.metadata.policyVersion, NARRATIVE_POLICY_VERSION);
});

test('provider errors and invalid output fail closed without echoing child input', async (t) => {
  const secret = '절대로 오류에 넣지 말 것 90210';

  await t.test('thrown provider error is discarded', async () => {
    const generator: NarrativeActionGenerator = {
      async generate(input) {
        throw new Error(`upstream echoed ${input.userPrompt.revealForProvider()}`);
      },
    };
    const outcome = await new NarrativeDirector({ generator }).generate({
      childInput: secret,
      currentNodeId: 'n.reply',
      graph,
    });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.errorCode, 'provider_error');
    assert.equal(JSON.stringify(outcome).includes(secret), false);
    assert.equal(outcome.safetyPlan.actions[0]?.type, 'safetyAction');
  });

  await t.test('unapproved generated text is discarded as one whole plan', async () => {
    const generator: NarrativeActionGenerator = {
      async generate() {
        return success({
          ...plan([{ type: 'reply', nodeId: 'n.intro' }]),
          actions: [{
            type: 'reply',
            nodeId: 'n.intro',
            text: secret,
          }],
        });
      },
    };
    const outcome = await new NarrativeDirector({ generator }).generate({
      childInput: secret,
      currentNodeId: 'n.reply',
      graph,
    });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.errorCode, 'invalid_action_plan');
    assert.equal(JSON.stringify(outcome).includes(secret), false);
  });

  await t.test('provider identity drift is rejected', async () => {
    const generator: NarrativeActionGenerator = {
      async generate() {
        return { ...success(plan([
          { type: 'choice', nodeId: 'n.reply', optionId: 'option.watch' },
        ])), model: 'claude-sonnet-latest' };
      },
    };
    const outcome = await new NarrativeDirector({ generator }).generate({
      childInput: secret,
      currentNodeId: 'n.reply',
      graph,
    });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.errorCode, 'provider_identity_mismatch');
  });
});

test('director enforces its deadline and aborts a stalled generator', async () => {
  let aborted = false;
  const generator: NarrativeActionGenerator = {
    generate(input) {
      input.signal.addEventListener('abort', () => { aborted = true; }, { once: true });
      return new Promise<NarrativeGeneratorResult>(() => undefined);
    },
  };
  const director = new NarrativeDirector({
    generator,
    config: {
      model: { ...DEFAULT_NARRATIVE_MODEL_CONFIG, timeoutMs: 50 },
      promptVersion: NARRATIVE_PROMPT_VERSION,
      policyVersion: NARRATIVE_POLICY_VERSION,
    },
  });

  const outcome = await director.generate({
    childInput: '빛을 더 볼래',
    currentNodeId: 'n.reply',
    graph,
  });
  assert.equal(outcome.ok, false);
  assert.equal(outcome.errorCode, 'timeout');
  assert.equal(aborted, true);
});

test('caller cancellation does not wait for the four-second deadline', async () => {
  let releaseStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => { releaseStarted = resolve; });
  const generator: NarrativeActionGenerator = {
    generate() {
      releaseStarted?.();
      return new Promise<NarrativeGeneratorResult>(() => undefined);
    },
  };
  const controller = new AbortController();
  const pending = new NarrativeDirector({ generator }).generate({
    childInput: '다음에 다시 할래',
    currentNodeId: 'n.reply',
    graph,
    signal: controller.signal,
  });
  await started;
  controller.abort();

  const outcome = await pending;
  assert.equal(outcome.ok, false);
  assert.equal(outcome.errorCode, 'cancelled');
});

test('generator result metadata is strict and production runtime remains hard-disabled', () => {
  assert.throws(() => parseNarrativeGeneratorResult({
    ...success(plan([{ type: 'node', nodeId: 'n.choice' }])),
    rawResponse: 'must not cross the adapter boundary',
  }));
  assert.throws(() => parseNarrativeGeneratorResult({
    ...success(plan([{ type: 'node', nodeId: 'n.choice' }])),
    usage: { ...usage, outputTokens: Number.MAX_SAFE_INTEGER + 1 },
  }));
  assert.equal(NARRATIVE_DIRECTOR_RUNTIME_READY, false);
  assert.equal(getStoryChatRuntimeConfig({
    KINDY_LAUNCH_MODE: 'protected_chat_pilot',
    STORY_CHAT_RUNTIME_ENABLED: '1',
    STORY_CHAT_FREE_TEXT_ENABLED: '1',
    STORY_CONTENT_RELEASE_CHANNEL: 'production',
  }).runtimeEnabled, false);
});

test('sensitive prompt rejects blank and oversized values with fixed errors', () => {
  assert.throws(() => SensitiveNarrativePrompt.from(''));
  assert.throws(() => SensitiveNarrativePrompt.from('가'.repeat(11_000)));
  const error = assert.throws(() => SensitiveNarrativePrompt.from(''));
  assert.equal(String(error).includes('가'), false);
});

function plan(actions: NarrativeAction[]): NarrativeActionPlan {
  return {
    schemaVersion: NARRATIVE_ACTION_SCHEMA_VERSION,
    promptVersion: NARRATIVE_PROMPT_VERSION,
    policyVersion: NARRATIVE_POLICY_VERSION,
    actions,
  };
}

function success(value: unknown): NarrativeGeneratorResult {
  return {
    ok: true,
    provider: DEFAULT_NARRATIVE_MODEL_CONFIG.provider,
    model: DEFAULT_NARRATIVE_MODEL_CONFIG.model,
    requestId: 'msg_test_123',
    latencyMs: 320,
    finishReason: 'stop',
    usage,
    value,
  };
}
