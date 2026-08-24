import 'server-only';

import Anthropic, {
  APIConnectionTimeoutError,
  APIUserAbortError,
} from '@anthropic-ai/sdk';

import {
  AnthropicNarrativeGenerator,
  AnthropicNarrativeTransportError,
  type AnthropicNarrativeRequest,
  type AnthropicNarrativeResponse,
  type AnthropicNarrativeTransport,
} from './anthropic-narrative-generator';
import type {
  NarrativeActionGenerator,
  NarrativeModelConfig,
} from './narrative-generator';

export type ServerAnthropicNarrativeEnvironment = Readonly<{
  ANTHROPIC_API_KEY?: string;
}>;

export function createServerAnthropicNarrativeGenerator(input: {
  config: NarrativeModelConfig;
  environment?: ServerAnthropicNarrativeEnvironment;
}): NarrativeActionGenerator {
  const apiKey = input.environment
    ? input.environment.ANTHROPIC_API_KEY
    : process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('anthropic_narrative_api_key_missing');

  // Anthropic's SDK can inherit ANTHROPIC_LOG from the process environment.
  // Force logging off at the child-prompt boundary so request bodies can never
  // be emitted by an operator or platform-level debug setting.
  const client = new Anthropic({ apiKey, logLevel: 'off' });
  return new AnthropicNarrativeGenerator({
    config: input.config,
    transport: new ServerAnthropicNarrativeTransport(client),
  });
}

class ServerAnthropicNarrativeTransport implements AnthropicNarrativeTransport {
  constructor(private readonly client: Anthropic) {}

  async create(
    request: AnthropicNarrativeRequest,
  ): Promise<AnthropicNarrativeResponse> {
    try {
      const response = await this.client.messages.create(
        {
          model: request.model,
          max_tokens: request.maxTokens,
          system: request.systemPrompt,
          messages: [{ role: 'user', content: request.userPrompt }],
          output_config: {
            format: {
              type: 'json_schema',
              schema: { ...request.jsonSchema },
            },
          },
          stream: false,
        },
        {
          signal: request.signal,
          timeout: request.timeoutMs,
          maxRetries: 0,
        },
      );

      return {
        id: response.id,
        model: response.model,
        stopReason: response.stop_reason,
        content: response.content.map((block) =>
          block.type === 'text'
            ? { type: 'text' as const, text: block.text }
            : { type: block.type },
        ),
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cacheReadInputTokens: response.usage.cache_read_input_tokens,
          cacheWriteInputTokens: response.usage.cache_creation_input_tokens,
        },
      };
    } catch (error) {
      if (
        request.signal.aborted
        || error instanceof APIConnectionTimeoutError
        || error instanceof APIUserAbortError
      ) {
        throw new AnthropicNarrativeTransportError('timeout');
      }
      // Provider errors often contain request bodies and must never become a
      // nested cause or log payload at the narrative boundary.
      throw new AnthropicNarrativeTransportError('provider_error');
    }
  }
}
