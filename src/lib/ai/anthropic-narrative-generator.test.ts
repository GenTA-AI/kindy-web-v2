import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AnthropicNarrativeGenerator,
  AnthropicNarrativeTransportError,
  type AnthropicNarrativeRequest,
  type AnthropicNarrativeResponse,
  type AnthropicNarrativeTransport,
} from './anthropic-narrative-generator';
import {
  DEFAULT_NARRATIVE_MODEL_CONFIG,
  SensitiveNarrativePrompt,
} from './narrative-generator';

const successResponse: AnthropicNarrativeResponse = {
  id: 'msg_test',
  model: 'claude-sonnet-5',
  stopReason: 'end_turn',
  content: [{ type: 'text', text: '{"reply":"좋아"}' }],
  usage: {
    inputTokens: 21,
    outputTokens: 7,
    cacheReadInputTokens: null,
    cacheWriteInputTokens: 3,
  },
};

function input(signal = new AbortController().signal) {
  return {
    systemPrompt: '허용된 스토리 노드만 선택한다.',
    userPrompt: SensitiveNarrativePrompt.from('나는 왼쪽 문을 열래.'),
    jsonSchema: {
      type: 'object',
      properties: { reply: { type: 'string' } },
      required: ['reply'],
      additionalProperties: false,
    },
    signal,
    maxOutputTokens: 256,
  };
}

test('sends one non-streaming structured request and returns normalized JSON', async () => {
  let observed: AnthropicNarrativeRequest | undefined;
  const generator = new AnthropicNarrativeGenerator({
    config: DEFAULT_NARRATIVE_MODEL_CONFIG,
    now: sequenceClock(100, 123),
    transport: transport(async (request) => {
      observed = request;
      return successResponse;
    }),
  });

  const result = await generator.generate(input());

  assert.deepEqual(result, {
    ok: true,
    value: { reply: '좋아' },
    finishReason: 'stop',
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    requestId: 'msg_test',
    usage: {
      inputTokens: 21,
      outputTokens: 7,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 3,
    },
    latencyMs: 23,
  });
  assert.equal(observed?.userPrompt, '나는 왼쪽 문을 열래.');
  assert.equal(observed?.timeoutMs, 4_000);
  assert.equal(observed?.maxTokens, 256);
  assert.deepEqual(observed?.jsonSchema, input().jsonSchema);
});

test('fails closed on refusal, truncation, non-text blocks, and malformed JSON', async (t) => {
  const cases: Array<{
    name: string;
    response: AnthropicNarrativeResponse;
    code: 'refusal' | 'invalid_response';
  }> = [
    {
      name: 'refusal',
      response: { ...successResponse, stopReason: 'refusal' },
      code: 'refusal',
    },
    {
      name: 'max tokens',
      response: { ...successResponse, stopReason: 'max_tokens' },
      code: 'invalid_response',
    },
    {
      name: 'non text',
      response: { ...successResponse, content: [{ type: 'tool_use' }] },
      code: 'invalid_response',
    },
    {
      name: 'malformed json',
      response: {
        ...successResponse,
        content: [{ type: 'text', text: 'not-json' }],
      },
      code: 'invalid_response',
    },
  ];

  for (const entry of cases) {
    await t.test(entry.name, async () => {
      const generator = new AnthropicNarrativeGenerator({
        config: DEFAULT_NARRATIVE_MODEL_CONFIG,
        transport: transport(async () => entry.response),
      });
      const result = await generator.generate(input());
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.errorCode, entry.code);
      assert.equal(JSON.stringify(result).includes('not-json'), false);
    });
  }
});

test('fails closed when provider model or usage does not match the pinned contract', async (t) => {
  const cases: AnthropicNarrativeResponse[] = [
    { ...successResponse, model: 'claude-other' },
    {
      ...successResponse,
      usage: { ...successResponse.usage, outputTokens: -1 },
    },
  ];

  for (const [index, response] of cases.entries()) {
    await t.test(`invalid metadata ${index + 1}`, async () => {
      const generator = new AnthropicNarrativeGenerator({
        config: DEFAULT_NARRATIVE_MODEL_CONFIG,
        transport: transport(async () => response),
      });
      const result = await generator.generate(input());
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.errorCode, 'invalid_response');
    });
  }
});

test('maps aborts and sanitized transport failures without leaking provider details', async () => {
  const timeoutGenerator = new AnthropicNarrativeGenerator({
    config: DEFAULT_NARRATIVE_MODEL_CONFIG,
    transport: transport(async () => {
      throw new AnthropicNarrativeTransportError('timeout');
    }),
  });
  const providerGenerator = new AnthropicNarrativeGenerator({
    config: DEFAULT_NARRATIVE_MODEL_CONFIG,
    transport: transport(async () => {
      throw new Error('provider echoed child text: 나는 왼쪽 문을 열래.');
    }),
  });

  const timeout = await timeoutGenerator.generate(input());
  const provider = await providerGenerator.generate(input());

  assert.equal(timeout.ok, false);
  if (!timeout.ok) assert.equal(timeout.errorCode, 'timeout');
  assert.equal(provider.ok, false);
  if (!provider.ok) assert.equal(provider.errorCode, 'provider_error');
  assert.equal(JSON.stringify(provider).includes('왼쪽 문'), false);
});

test('does not reveal a sensitive prompt when the request is already aborted', async () => {
  const controller = new AbortController();
  controller.abort();
  let called = false;
  const generator = new AnthropicNarrativeGenerator({
    config: DEFAULT_NARRATIVE_MODEL_CONFIG,
    transport: transport(async () => {
      called = true;
      return successResponse;
    }),
  });

  const result = await generator.generate(input(controller.signal));

  assert.equal(called, false);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errorCode, 'timeout');
});

function transport(
  create: (request: AnthropicNarrativeRequest) => Promise<AnthropicNarrativeResponse>,
): AnthropicNarrativeTransport {
  return { create };
}

function sequenceClock(...values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}
