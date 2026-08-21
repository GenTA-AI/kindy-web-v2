import { z } from 'zod';

export const NARRATIVE_ACTION_SCHEMA_VERSION = 'narrative-action/v1' as const;
export const NARRATIVE_PROMPT_VERSION = 'narrative-director-v1' as const;
export const NARRATIVE_POLICY_VERSION = 'minor-chat-v1' as const;
export const MAX_NARRATIVE_ACTIONS = 4;

const IdSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/);

const NodeActionSchema = z
  .object({
    type: z.literal('node'),
    nodeId: IdSchema,
  })
  .strict();

/** A reply always points at human-approved character_text; it has no text field. */
const ReplyActionSchema = z
  .object({
    type: z.literal('reply'),
    nodeId: IdSchema,
  })
  .strict();

const ChoiceActionSchema = z
  .object({
    type: z.literal('choice'),
    nodeId: IdSchema,
    optionId: IdSchema,
  })
  .strict();

const CinematicActionSchema = z
  .object({
    type: z.literal('cinematic'),
    nodeId: IdSchema,
  })
  .strict();

/** The recipe and all variable bindings remain authored in ExperienceGraph. */
const ImageRecipeActionSchema = z
  .object({
    type: z.literal('imageRecipe'),
    nodeId: IdSchema,
    recipeId: IdSchema,
  })
  .strict();

export const NARRATIVE_SAFETY_ACTIONS = [
  'redirect_to_authored_choices',
  'pause_session',
  'ask_trusted_adult',
  'end_session',
] as const;

export const NARRATIVE_SAFETY_REASONS = [
  'unsafe_content',
  'personal_data',
  'external_contact',
  'danger_or_self_harm',
  'distress_or_bullying',
  'policy_uncertain',
] as const;

const SafetyActionSchema = z
  .object({
    type: z.literal('safetyAction'),
    action: z.enum(NARRATIVE_SAFETY_ACTIONS),
    reasonCode: z.enum(NARRATIVE_SAFETY_REASONS),
  })
  .strict();

export const NarrativeActionSchema = z.discriminatedUnion('type', [
  NodeActionSchema,
  ReplyActionSchema,
  ChoiceActionSchema,
  CinematicActionSchema,
  ImageRecipeActionSchema,
  SafetyActionSchema,
]);

export type NarrativeAction = z.infer<typeof NarrativeActionSchema>;
export type NarrativeSafetyAction = z.infer<typeof SafetyActionSchema>;

const NarrativeActionPlanSchema = z
  .object({
    schemaVersion: z.literal(NARRATIVE_ACTION_SCHEMA_VERSION),
    promptVersion: z.literal(NARRATIVE_PROMPT_VERSION),
    policyVersion: z.literal(NARRATIVE_POLICY_VERSION),
    actions: z.array(NarrativeActionSchema).min(1).max(MAX_NARRATIVE_ACTIONS),
  })
  .strict();

export type NarrativeActionPlan = z.infer<typeof NarrativeActionPlanSchema>;

const idJsonSchema = {
  type: 'string',
} as const;

const nodeReferenceJsonSchema = (type: 'node' | 'reply' | 'cinematic') => ({
  type: 'object',
  additionalProperties: false,
  required: ['type', 'nodeId'],
  properties: {
    type: { const: type },
    nodeId: idJsonSchema,
  },
});

/**
 * Provider-facing strict JSON schema. It intentionally has no generated-text,
 * URL, media-key, tool, or arbitrary-argument field.
 */
export const NARRATIVE_ACTION_JSON_SCHEMA: Readonly<Record<string, unknown>> =
  Object.freeze({
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'promptVersion', 'policyVersion', 'actions'],
    properties: {
      schemaVersion: { const: NARRATIVE_ACTION_SCHEMA_VERSION },
      promptVersion: { const: NARRATIVE_PROMPT_VERSION },
      policyVersion: { const: NARRATIVE_POLICY_VERSION },
      actions: {
        type: 'array',
        items: {
          // `anyOf` is supported by Anthropic structured outputs. Bounds and
          // identifier patterns are deliberately enforced again by Zod after
          // the complete response because raw output_config schemas do not
          // support every JSON Schema constraint.
          anyOf: [
            nodeReferenceJsonSchema('node'),
            nodeReferenceJsonSchema('reply'),
            {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'nodeId', 'optionId'],
              properties: {
                type: { const: 'choice' },
                nodeId: idJsonSchema,
                optionId: idJsonSchema,
              },
            },
            nodeReferenceJsonSchema('cinematic'),
            {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'nodeId', 'recipeId'],
              properties: {
                type: { const: 'imageRecipe' },
                nodeId: idJsonSchema,
                recipeId: idJsonSchema,
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'action', 'reasonCode'],
              properties: {
                type: { const: 'safetyAction' },
                action: { enum: NARRATIVE_SAFETY_ACTIONS },
                reasonCode: { enum: NARRATIVE_SAFETY_REASONS },
              },
            },
          ],
        },
      },
    },
  });

export class NarrativeActionContractError extends Error {
  readonly code = 'invalid_action_contract' as const;

  constructor() {
    super('invalid_action_contract');
    this.name = 'NarrativeActionContractError';
  }
}

export function parseNarrativeActionPlan(input: unknown): NarrativeActionPlan {
  const parsed = NarrativeActionPlanSchema.safeParse(input);
  if (!parsed.success) {
    // Do not retain or surface the invalid provider payload.
    throw new NarrativeActionContractError();
  }
  return parsed.data;
}

export function createFailClosedNarrativePlan(
  reasonCode: NarrativeSafetyAction['reasonCode'] = 'policy_uncertain',
): NarrativeActionPlan {
  return {
    schemaVersion: NARRATIVE_ACTION_SCHEMA_VERSION,
    promptVersion: NARRATIVE_PROMPT_VERSION,
    policyVersion: NARRATIVE_POLICY_VERSION,
    actions: [{
      type: 'safetyAction',
      action: 'pause_session',
      reasonCode,
    }],
  };
}
