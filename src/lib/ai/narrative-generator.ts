import { z } from 'zod';

export const NARRATIVE_CHILD_PROMPT_REDACTION = '[REDACTED_CHILD_PROMPT]' as const;
export const MAX_NARRATIVE_USER_PROMPT_BYTES = 32_768;

const NarrativeModelConfigSchema = z
  .object({
    provider: z.enum(['anthropic', 'openai']),
    model: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
    maxOutputTokens: z.number().int().min(64).max(2_048),
    timeoutMs: z.number().int().min(50).max(4_000),
  })
  .strict();

export type NarrativeModelConfig = z.infer<typeof NarrativeModelConfigSchema>;

/**
 * Initial production recommendation. The provider adapter remains injected, so
 * an evaluated OpenAI model can replace it without changing the director or its
 * closed action contract.
 */
export const DEFAULT_NARRATIVE_MODEL_CONFIG: NarrativeModelConfig =
  Object.freeze({
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    maxOutputTokens: 512,
    timeoutMs: 4_000,
  });

export function parseNarrativeModelConfig(input: unknown): NarrativeModelConfig {
  return NarrativeModelConfigSchema.parse(input);
}

/**
 * Raw child text is deliberately hidden from ordinary serialization. A server-
 * only provider adapter must reveal it only at the final API-call boundary and
 * must never log the revealed value or the complete provider request.
 */
export class SensitiveNarrativePrompt {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static from(value: string): SensitiveNarrativePrompt {
    const byteLength = new TextEncoder().encode(value).byteLength;
    if (byteLength === 0 || byteLength > MAX_NARRATIVE_USER_PROMPT_BYTES) {
      throw new NarrativeGeneratorContractError('invalid_sensitive_prompt');
    }
    return new SensitiveNarrativePrompt(value);
  }

  revealForProvider(): string {
    return this.#value;
  }

  toJSON(): typeof NARRATIVE_CHILD_PROMPT_REDACTION {
    return NARRATIVE_CHILD_PROMPT_REDACTION;
  }

  toString(): typeof NARRATIVE_CHILD_PROMPT_REDACTION {
    return NARRATIVE_CHILD_PROMPT_REDACTION;
  }
}

export type NarrativeGeneratorInput = Readonly<{
  systemPrompt: string;
  userPrompt: SensitiveNarrativePrompt;
  jsonSchema: Readonly<Record<string, unknown>>;
  signal: AbortSignal;
  maxOutputTokens: number;
}>;

const NarrativeUsageSchema = z
  .object({
    inputTokens: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    outputTokens: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    cacheReadInputTokens: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    cacheWriteInputTokens: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

export type NarrativeUsage = z.infer<typeof NarrativeUsageSchema>;

const GeneratorMetadataShape = {
  provider: z.enum(['anthropic', 'openai']),
  model: z.string().min(1).max(128),
  requestId: z.string().min(1).max(200).optional(),
  latencyMs: z.number().int().min(0).max(60_000),
};

const NarrativeGeneratorSuccessSchema = z
  .object({
    ok: z.literal(true),
    ...GeneratorMetadataShape,
    finishReason: z.literal('stop'),
    usage: NarrativeUsageSchema,
    value: z.unknown(),
  })
  .strict();

export const NARRATIVE_GENERATOR_ERROR_CODES = [
  'timeout',
  'refusal',
  'content_filtered',
  'provider_error',
  'invalid_response',
] as const;

export type NarrativeGeneratorErrorCode =
  (typeof NARRATIVE_GENERATOR_ERROR_CODES)[number];

const NarrativeGeneratorFailureSchema = z
  .object({
    ok: z.literal(false),
    ...GeneratorMetadataShape,
    errorCode: z.enum(NARRATIVE_GENERATOR_ERROR_CODES),
    usage: NarrativeUsageSchema.optional(),
  })
  .strict();

const NarrativeGeneratorResultSchema = z.discriminatedUnion('ok', [
  NarrativeGeneratorSuccessSchema,
  NarrativeGeneratorFailureSchema,
]);

export type NarrativeGeneratorSuccess = z.infer<
  typeof NarrativeGeneratorSuccessSchema
>;
export type NarrativeGeneratorFailure = z.infer<
  typeof NarrativeGeneratorFailureSchema
>;
export type NarrativeGeneratorResult =
  | NarrativeGeneratorSuccess
  | NarrativeGeneratorFailure;

/**
 * Deliberately one-shot and non-streaming. No provider-native response or raw
 * JSON is allowed across this boundary; adapters normalize a complete response
 * before returning it.
 */
export interface NarrativeActionGenerator {
  generate(input: NarrativeGeneratorInput): Promise<NarrativeGeneratorResult>;
}

export type NarrativeGeneratorContractErrorCode =
  | 'invalid_sensitive_prompt'
  | 'invalid_generator_result';

export class NarrativeGeneratorContractError extends Error {
  readonly code: NarrativeGeneratorContractErrorCode;

  constructor(code: NarrativeGeneratorContractErrorCode) {
    super(code);
    this.name = 'NarrativeGeneratorContractError';
    this.code = code;
  }
}

export function parseNarrativeGeneratorResult(
  input: unknown,
): NarrativeGeneratorResult {
  const parsed = NarrativeGeneratorResultSchema.safeParse(input);
  if (!parsed.success) {
    // Never attach the provider payload or error as a cause: either may contain
    // child text echoed by a failed upstream request.
    throw new NarrativeGeneratorContractError('invalid_generator_result');
  }
  return parsed.data;
}
