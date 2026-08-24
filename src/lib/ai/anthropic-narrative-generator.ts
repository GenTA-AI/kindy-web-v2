import {
  parseNarrativeModelConfig,
  type NarrativeActionGenerator,
  type NarrativeGeneratorInput,
  type NarrativeGeneratorResult,
  type NarrativeModelConfig,
  type NarrativeUsage,
} from './narrative-generator';

export type AnthropicNarrativeRequest = Readonly<{
  model: string;
  maxTokens: number;
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Readonly<Record<string, unknown>>;
  signal: AbortSignal;
  timeoutMs: number;
}>;

export type AnthropicNarrativeResponse = Readonly<{
  id: string;
  model: string;
  stopReason: string | null;
  content: ReadonlyArray<
    | Readonly<{ type: 'text'; text: string }>
    | Readonly<{ type: string }>
  >;
  usage: Readonly<{
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number | null;
    cacheWriteInputTokens: number | null;
  }>;
}>;

/**
 * The transport is deliberately narrower than the Anthropic SDK. It prevents
 * provider-native payloads and exception bodies from crossing into the story
 * runtime or its logs.
 */
export interface AnthropicNarrativeTransport {
  create(request: AnthropicNarrativeRequest): Promise<AnthropicNarrativeResponse>;
}

export type AnthropicNarrativeTransportErrorCode = 'timeout' | 'provider_error';

export class AnthropicNarrativeTransportError extends Error {
  readonly code: AnthropicNarrativeTransportErrorCode;

  constructor(code: AnthropicNarrativeTransportErrorCode) {
    super(code);
    this.name = 'AnthropicNarrativeTransportError';
    this.code = code;
  }
}

type AnthropicNarrativeGeneratorDependencies = Readonly<{
  config: NarrativeModelConfig;
  transport: AnthropicNarrativeTransport;
  now?: () => number;
}>;

export class AnthropicNarrativeGenerator implements NarrativeActionGenerator {
  readonly #config: NarrativeModelConfig;
  readonly #transport: AnthropicNarrativeTransport;
  readonly #now: () => number;

  constructor(dependencies: AnthropicNarrativeGeneratorDependencies) {
    const config = parseNarrativeModelConfig(dependencies.config);
    if (config.provider !== 'anthropic') {
      throw new Error('anthropic_narrative_provider_required');
    }
    this.#config = config;
    this.#transport = dependencies.transport;
    this.#now = dependencies.now ?? Date.now;
  }

  async generate(input: NarrativeGeneratorInput): Promise<NarrativeGeneratorResult> {
    const startedAt = this.#now();
    if (
      !Number.isSafeInteger(input.maxOutputTokens)
      || input.maxOutputTokens < 64
      || input.maxOutputTokens > this.#config.maxOutputTokens
      || input.signal.aborted
    ) {
      return this.#failure(
        input.signal.aborted ? 'timeout' : 'invalid_response',
        startedAt,
      );
    }

    try {
      // This is the only point in the provider-neutral runtime where the
      // sanitized child prompt is revealed. Do not retain or log `request`.
      const response = await this.#transport.create({
        model: this.#config.model,
        maxTokens: input.maxOutputTokens,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt.revealForProvider(),
        jsonSchema: input.jsonSchema,
        signal: input.signal,
        timeoutMs: this.#config.timeoutMs,
      });
      if (
        response.model !== this.#config.model
        || !isValidUsage(response.usage)
      ) {
        return this.#failure('invalid_response', startedAt);
      }
      const usage = normalizeUsage(response.usage);
      const metadata = {
        provider: 'anthropic' as const,
        model: response.model,
        requestId: boundedRequestId(response.id),
        usage,
        latencyMs: elapsedMs(startedAt, this.#now()),
      };

      if (response.stopReason === 'refusal') {
        return { ok: false, errorCode: 'refusal', ...metadata };
      }
      if (response.stopReason !== 'end_turn') {
        return { ok: false, errorCode: 'invalid_response', ...metadata };
      }

      const textBlocks = response.content.filter(
        (block): block is Readonly<{ type: 'text'; text: string }> =>
          block.type === 'text' && 'text' in block && typeof block.text === 'string',
      );
      if (textBlocks.length !== 1 || response.content.length !== 1) {
        return { ok: false, errorCode: 'invalid_response', ...metadata };
      }

      let value: unknown;
      try {
        value = JSON.parse(textBlocks[0].text);
      } catch {
        return { ok: false, errorCode: 'invalid_response', ...metadata };
      }

      return {
        ok: true,
        value,
        finishReason: 'stop',
        ...metadata,
      };
    } catch (error) {
      const timeout = input.signal.aborted
        || (error instanceof AnthropicNarrativeTransportError
          && error.code === 'timeout');
      return this.#failure(timeout ? 'timeout' : 'provider_error', startedAt);
    }
  }

  #failure(
    errorCode: 'timeout' | 'provider_error' | 'invalid_response',
    startedAt: number,
  ): NarrativeGeneratorResult {
    return {
      ok: false,
      errorCode,
      provider: 'anthropic',
      model: this.#config.model,
      latencyMs: elapsedMs(startedAt, this.#now()),
    };
  }
}

function normalizeUsage(
  usage: AnthropicNarrativeResponse['usage'],
): NarrativeUsage {
  return {
    inputTokens: boundedTokenCount(usage.inputTokens),
    outputTokens: boundedTokenCount(usage.outputTokens),
    cacheReadInputTokens: boundedTokenCount(usage.cacheReadInputTokens ?? 0),
    cacheWriteInputTokens: boundedTokenCount(usage.cacheWriteInputTokens ?? 0),
  };
}

function isValidUsage(usage: AnthropicNarrativeResponse['usage']): boolean {
  return [
    usage.inputTokens,
    usage.outputTokens,
    usage.cacheReadInputTokens ?? 0,
    usage.cacheWriteInputTokens ?? 0,
  ].every((value) => Number.isSafeInteger(value) && value >= 0);
}

function boundedTokenCount(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function boundedRequestId(value: string): string | undefined {
  return value.length > 0 && value.length <= 200 ? value : undefined;
}

function elapsedMs(startedAt: number, finishedAt: number): number {
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) return 0;
  return Math.min(60_000, Math.max(0, Math.round(finishedAt - startedAt)));
}
