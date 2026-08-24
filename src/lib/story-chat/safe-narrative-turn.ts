import {
  NARRATIVE_ACTION_SCHEMA_VERSION,
  NARRATIVE_POLICY_VERSION,
  NARRATIVE_PROMPT_VERSION,
  createFailClosedNarrativePlan,
  parseNarrativeActionPlan,
  type NarrativeActionPlan,
} from '@/lib/ai/narrative-action-contract';
import type { NarrativeUsage } from '@/lib/ai/narrative-generator';
import {
  parseExperienceGraph,
  resolveChoiceTransition,
  type ExperienceGraph,
  type ExperienceNode,
} from '@/contracts/experience-graph.v1';
import {
  precheckChildInput,
  type ChildInputPrecheckResult,
} from '@/lib/safety/child-input-precheck';
import type {
  WenitModerationResult,
  WenitSafeAuditMetadata,
} from '@/lib/safety/wenit';
import { parseWenitModerationResult } from '@/lib/safety/wenit';
import {
  validateNarrativePlanAgainstGraph,
  type NarrativeDirectorMetadata,
  type NarrativeDirectorOutcome,
  type NarrativeDirectorErrorCode,
} from './narrative-director';

export const SAFE_NARRATIVE_TURN_RUNTIME_READY = false as const;
export const SAFE_NARRATIVE_TURN_DEADLINE_MS = 15_000;
const MAX_OUTPUT_MODERATION_BYTES = 4 * 1024;
const CONTEXTUAL_OUTPUT_PREFIX = '[child_input]\n';
const CONTEXTUAL_OUTPUT_SEPARATOR = '\n[assistant_candidate]\n';

export interface NarrativeTextModerator {
  moderateText(
    text: string,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<unknown>;
}

export interface NarrativeTurnDirector {
  generate(input: {
    childInput: string;
    currentNodeId: string;
    graph: unknown;
    signal?: AbortSignal;
  }): Promise<unknown>;
}

export type SafeNarrativeTurnFailureCode =
  | 'invalid_input'
  | 'privacy_redirect'
  | 'safety_redirect'
  | 'input_moderation_denied'
  | 'input_moderation_unavailable'
  | 'director_unavailable'
  | 'director_safety_redirect'
  | 'invalid_output_projection'
  | 'output_moderation_denied'
  | 'output_moderation_unavailable'
  | 'timeout'
  | 'cancelled';

/** Server-internal receipt: no provider-controlled identifiers or version strings. */
export type SafeNarrativeDirectorReceipt = Readonly<{
  provider: NarrativeDirectorMetadata['provider'];
  schemaVersion: typeof NARRATIVE_ACTION_SCHEMA_VERSION;
  promptVersion: typeof NARRATIVE_PROMPT_VERSION;
  policyVersion: typeof NARRATIVE_POLICY_VERSION;
  latencyMs: number;
  usage: NarrativeUsage | null;
}>;

/** Server-internal receipt. Full Wenit audit metadata stays in the adapter layer. */
export type SafeNarrativeModerationReceipt = Readonly<{
  provider: WenitSafeAuditMetadata['provider'];
  inputType: 'text';
  decisionSource: WenitSafeAuditMetadata['decisionSource'];
  providerResult: WenitSafeAuditMetadata['providerResult'];
  serverRecommendedResult: WenitSafeAuditMetadata['serverRecommendedResult'];
  minorRisk: boolean;
  categories: WenitSafeAuditMetadata['categories'];
  categoryScores: WenitSafeAuditMetadata['categoryScores'];
  riskScore: number;
  ageConfidence: number;
  thresholds: Readonly<{
    reviewRiskScoreThreshold: number;
    blockRiskScoreThreshold: number;
    minorRiskBlockEnabled: true;
  }>;
  tokensConsumed: number;
}>;

export type SafeNarrativeTurnOutcome =
  | Readonly<{
      ok: true;
      plan: NarrativeActionPlan;
      director: SafeNarrativeDirectorReceipt;
      inputModeration: SafeNarrativeModerationReceipt;
      outputModeration: SafeNarrativeModerationReceipt;
    }>
  | Readonly<{
      ok: false;
      errorCode: SafeNarrativeTurnFailureCode;
      safetyPlan: NarrativeActionPlan;
      inputModeration?: SafeNarrativeModerationReceipt;
      outputModeration?: SafeNarrativeModerationReceipt;
      director?: SafeNarrativeDirectorReceipt;
    }>;

export type SafeNarrativeTurnDependencies = Readonly<{
  moderator: NarrativeTextModerator;
  director: NarrativeTurnDirector;
  deadlineMs?: number;
}>;

const ABORTED = Symbol('safe_narrative_turn_aborted');
const THREW = Symbol('safe_narrative_turn_threw');
const DIRECTOR_ERROR_CODES = new Set<NarrativeDirectorErrorCode>([
  'invalid_input',
  'graph_mismatch',
  'timeout',
  'cancelled',
  'refusal',
  'content_filtered',
  'provider_error',
  'invalid_generator_result',
  'provider_identity_mismatch',
  'invalid_action_plan',
]);

/**
 * No candidate plan crosses this boundary unless the sanitized input and the
 * complete authored output projection both receive an explicit Wenit allow.
 * This service never returns child text or a provider-native response.
 */
export class SafeNarrativeTurnOrchestrator {
  readonly #deadlineMs: number;

  constructor(private readonly dependencies: SafeNarrativeTurnDependencies) {
    const deadlineMs = dependencies.deadlineMs ?? SAFE_NARRATIVE_TURN_DEADLINE_MS;
    if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 50 || deadlineMs > 30_000) {
      throw new Error('invalid_safe_narrative_turn_deadline');
    }
    this.#deadlineMs = deadlineMs;
  }

  async run(input: {
    childInput: unknown;
    currentNodeId: string;
    graph: unknown;
    signal?: AbortSignal;
  }): Promise<SafeNarrativeTurnOutcome> {
    const controller = new AbortController();
    let deadlineExpired = false;
    const forwardAbort = () => controller.abort();
    input.signal?.addEventListener('abort', forwardAbort, { once: true });
    const deadline = setTimeout(() => {
      deadlineExpired = true;
      controller.abort();
    }, this.#deadlineMs);

    try {
      if (input.signal?.aborted) return this.cancelled(false);
      const precheck = precheckChildInput(input.childInput);
      if (precheck.kind !== 'allow_sanitized') {
        return precheckFailure(precheck);
      }

      const rawInputModeration = await runAbortable(
        () => this.dependencies.moderator.moderateText(
          precheck.sanitizedText,
          { signal: controller.signal },
        ),
        controller.signal,
      );
      if (rawInputModeration === ABORTED) {
        return this.cancelled(deadlineExpired);
      }
      if (rawInputModeration === THREW) {
        return genericFailure('input_moderation_unavailable');
      }
      let inputModeration;
      try {
        inputModeration = parseWenitModerationResult(rawInputModeration);
      } catch {
        return genericFailure('input_moderation_unavailable');
      }
      if (
        inputModeration.decision !== 'unavailable'
        && inputModeration.audit.inputType !== 'text'
      ) {
        return genericFailure('input_moderation_unavailable');
      }
      if (inputModeration.decision !== 'allow') {
        return moderationFailure('input', inputModeration);
      }
      if (inputModeration.allowsExposure !== true) {
        return genericFailure('input_moderation_unavailable');
      }
      const inputReceipt = projectModerationReceipt(inputModeration.audit);

      const rawDirected = await runAbortable(
        () => this.dependencies.director.generate({
          childInput: precheck.sanitizedText,
          currentNodeId: input.currentNodeId,
          graph: input.graph,
          signal: controller.signal,
        }),
        controller.signal,
      );
      if (rawDirected === ABORTED) return this.cancelled(deadlineExpired);
      if (rawDirected === THREW) {
        return genericFailure(
          'director_unavailable',
          inputReceipt,
        );
      }
      const directed = sanitizeDirectorOutcome(rawDirected);
      if (!directed) {
        return genericFailure(
          'director_unavailable',
          inputReceipt,
        );
      }
      if (!directed.ok) {
        return {
          ok: false,
          errorCode: 'director_unavailable',
          safetyPlan: createFailClosedNarrativePlan(),
          inputModeration: inputReceipt,
          director: projectDirectorReceipt(directed.metadata),
        };
      }
      if (directed.plan.actions.some((action) => action.type === 'safetyAction')) {
        return {
          ok: false,
          errorCode: 'director_safety_redirect',
          safetyPlan: directed.plan,
          inputModeration: inputReceipt,
          director: projectDirectorReceipt(directed.metadata),
        };
      }

      try {
        const graph = parseExperienceGraph(input.graph);
        validateNarrativePlanAgainstGraph(
          directed.plan,
          graph,
          input.currentNodeId,
        );
      } catch {
        return {
          ...genericFailure(
            'invalid_output_projection',
            inputReceipt,
          ),
          director: projectDirectorReceipt(directed.metadata),
        };
      }

      const candidateOutputText = projectNarrativePlanForModeration(
        directed.plan,
        input.graph,
      );
      const contextualOutputText = candidateOutputText
        ? buildContextualOutputModerationText(
            precheck.sanitizedText,
            candidateOutputText,
          )
        : null;
      if (!contextualOutputText) {
        return {
          ...genericFailure(
            'invalid_output_projection',
            inputReceipt,
          ),
          director: projectDirectorReceipt(directed.metadata),
        };
      }

      const rawOutputModeration = await runAbortable(
        () => this.dependencies.moderator.moderateText(
          contextualOutputText,
          { signal: controller.signal },
        ),
        controller.signal,
      );
      if (rawOutputModeration === ABORTED) return this.cancelled(deadlineExpired);
      if (rawOutputModeration === THREW) {
        return {
          ...genericFailure(
            'output_moderation_unavailable',
            inputReceipt,
          ),
          director: projectDirectorReceipt(directed.metadata),
        };
      }
      let outputModeration;
      try {
        outputModeration = parseWenitModerationResult(rawOutputModeration);
      } catch {
        return {
          ...genericFailure(
            'output_moderation_unavailable',
            inputReceipt,
          ),
          director: projectDirectorReceipt(directed.metadata),
        };
      }
      if (
        outputModeration.decision !== 'unavailable'
        && outputModeration.audit.inputType !== 'text'
      ) {
        return {
          ...genericFailure(
            'output_moderation_unavailable',
            inputReceipt,
          ),
          director: projectDirectorReceipt(directed.metadata),
        };
      }
      if (outputModeration.decision !== 'allow') {
        return {
          ...moderationFailure('output', outputModeration, inputReceipt),
          director: projectDirectorReceipt(directed.metadata),
        };
      }
      if (outputModeration.allowsExposure !== true) {
        return {
          ...genericFailure(
            'output_moderation_unavailable',
            inputReceipt,
          ),
          director: projectDirectorReceipt(directed.metadata),
        };
      }

      return {
        ok: true,
        plan: directed.plan,
        director: projectDirectorReceipt(directed.metadata),
        inputModeration: inputReceipt,
        outputModeration: projectModerationReceipt(outputModeration.audit),
      };
    } finally {
      clearTimeout(deadline);
      input.signal?.removeEventListener('abort', forwardAbort);
    }
  }

  private cancelled(deadlineExpired: boolean): SafeNarrativeTurnOutcome {
    return genericFailure(deadlineExpired ? 'timeout' : 'cancelled');
  }
}

function buildContextualOutputModerationText(
  childInput: string,
  candidateOutput: string,
): string | null {
  const contextual = `${CONTEXTUAL_OUTPUT_PREFIX}${childInput}${CONTEXTUAL_OUTPUT_SEPARATOR}${candidateOutput}`;
  return new TextEncoder().encode(contextual).byteLength
    <= MAX_OUTPUT_MODERATION_BYTES
    ? contextual
    : null;
}

function sanitizeDirectorOutcome(input: unknown): NarrativeDirectorOutcome | null {
  if (!isRecord(input) || typeof input.ok !== 'boolean') return null;
  const metadata = sanitizeDirectorMetadata(input.metadata);
  if (!metadata) return null;

  if (input.ok) {
    if (!hasExactKeys(input, ['ok', 'plan', 'metadata'])) return null;
    try {
      return {
        ok: true,
        plan: parseNarrativeActionPlan(input.plan),
        metadata,
      };
    } catch {
      return null;
    }
  }

  if (
    !hasExactKeys(input, ['ok', 'errorCode', 'safetyPlan', 'metadata'])
    || typeof input.errorCode !== 'string'
    || !DIRECTOR_ERROR_CODES.has(input.errorCode as NarrativeDirectorErrorCode)
  ) {
    return null;
  }
  try {
    const safetyPlan = parseNarrativeActionPlan(input.safetyPlan);
    if (
      safetyPlan.actions.length !== 1
      || safetyPlan.actions[0].type !== 'safetyAction'
    ) {
      return null;
    }
    return {
      ok: false,
      errorCode: input.errorCode as NarrativeDirectorErrorCode,
      safetyPlan,
      metadata,
    };
  } catch {
    return null;
  }
}

function projectDirectorReceipt(
  metadata: NarrativeDirectorMetadata,
): SafeNarrativeDirectorReceipt {
  return {
    provider: metadata.provider,
    schemaVersion: NARRATIVE_ACTION_SCHEMA_VERSION,
    promptVersion: NARRATIVE_PROMPT_VERSION,
    policyVersion: NARRATIVE_POLICY_VERSION,
    latencyMs: metadata.latencyMs,
    usage: metadata.usage
      ? {
          inputTokens: metadata.usage.inputTokens,
          outputTokens: metadata.usage.outputTokens,
          cacheReadInputTokens: metadata.usage.cacheReadInputTokens,
          cacheWriteInputTokens: metadata.usage.cacheWriteInputTokens,
        }
      : null,
  };
}

function projectModerationReceipt(
  audit: WenitSafeAuditMetadata,
): SafeNarrativeModerationReceipt {
  return {
    provider: audit.provider,
    inputType: 'text',
    decisionSource: audit.decisionSource,
    providerResult: audit.providerResult,
    serverRecommendedResult: audit.serverRecommendedResult,
    minorRisk: audit.minorRisk,
    categories: [...audit.categories],
    categoryScores: { ...audit.categoryScores },
    riskScore: audit.riskScore,
    ageConfidence: audit.ageConfidence,
    thresholds: {
      reviewRiskScoreThreshold: audit.thresholds.reviewRiskScoreThreshold,
      blockRiskScoreThreshold: audit.thresholds.blockRiskScoreThreshold,
      minorRiskBlockEnabled: true,
    },
    tokensConsumed: audit.tokensConsumed,
  };
}

function sanitizeDirectorMetadata(input: unknown): NarrativeDirectorMetadata | null {
  if (!isRecord(input)) return null;
  const requiredKeys = [
    'provider',
    'model',
    'schemaVersion',
    'promptVersion',
    'policyVersion',
    'latencyMs',
    'usage',
  ];
  const hasRequestId = Object.hasOwn(input, 'requestId');
  if (
    !hasExactKeys(input, hasRequestId ? [...requiredKeys, 'requestId'] : requiredKeys)
    || (input.provider !== 'anthropic' && input.provider !== 'openai')
    || typeof input.model !== 'string'
    || input.model.length < 1
    || input.model.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(input.model)
    || input.schemaVersion !== NARRATIVE_ACTION_SCHEMA_VERSION
    || input.promptVersion !== NARRATIVE_PROMPT_VERSION
    || input.policyVersion !== NARRATIVE_POLICY_VERSION
    || !Number.isSafeInteger(input.latencyMs)
    || (input.latencyMs as number) < 0
    || (input.latencyMs as number) > 60_000
    || (hasRequestId
      && (typeof input.requestId !== 'string'
        || input.requestId.length < 1
        || input.requestId.length > 200
        || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(input.requestId)))
  ) {
    return null;
  }
  // Keep this explicit clone even though `hasExactKeys` already checked it:
  // no injected object or getter is ever returned across the safe-turn boundary.
  const usage = sanitizeNarrativeUsage(input.usage);
  if (input.usage !== null && usage === null) return null;
  return {
    provider: input.provider,
    model: input.model,
    schemaVersion: NARRATIVE_ACTION_SCHEMA_VERSION,
    promptVersion: NARRATIVE_PROMPT_VERSION,
    policyVersion: NARRATIVE_POLICY_VERSION,
    latencyMs: input.latencyMs as number,
    ...(hasRequestId ? { requestId: input.requestId as string } : {}),
    usage,
  };
}

function sanitizeNarrativeUsage(input: unknown): NarrativeUsage | null {
  if (input === null) return null;
  if (
    !isRecord(input)
    || !hasExactKeys(input, [
      'inputTokens',
      'outputTokens',
      'cacheReadInputTokens',
      'cacheWriteInputTokens',
    ])
  ) {
    return null;
  }
  const values = [
    input.inputTokens,
    input.outputTokens,
    input.cacheReadInputTokens,
    input.cacheWriteInputTokens,
  ];
  if (!values.every(
    (value) => Number.isSafeInteger(value) && (value as number) >= 0,
  )) {
    return null;
  }
  return {
    inputTokens: input.inputTokens as number,
    outputTokens: input.outputTokens as number,
    cacheReadInputTokens: input.cacheReadInputTokens as number,
    cacheWriteInputTokens: input.cacheWriteInputTokens as number,
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function hasExactKeys(
  input: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(input).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return actualKeys.length === sortedExpectedKeys.length
    && actualKeys.every((key, index) => key === sortedExpectedKeys[index]);
}

export function projectNarrativePlanForModeration(
  plan: NarrativeActionPlan,
  untrustedGraph: unknown,
): string | null {
  let graph: ExperienceGraph;
  try {
    graph = parseExperienceGraph(untrustedGraph);
  } catch {
    return null;
  }
  const nodes = new Map(graph.chatGraph.nodes.map((node) => [node.id, node] as const));
  const chunks: string[] = [];

  for (const action of plan.actions) {
    if (action.type === 'safetyAction') return null;
    if (action.type === 'choice') {
      const source = nodes.get(action.nodeId);
      if (source?.type !== 'choice' && source?.type !== 'quick_reply') return null;
      const option = source.options.find(({ id }) => id === action.optionId);
      if (!option) return null;
      try {
        resolveChoiceTransition(graph, action.nodeId, action.optionId);
      } catch {
        return null;
      }
      chunks.push(source.prompt, option.label);
      continue;
    }

    const node = nodes.get(action.nodeId);
    if (!node || !actionMatchesNode(action.type, node)) return null;
    if (
      action.type === 'imageRecipe'
      && (node.type !== 'generated_image_recipe' || node.mediaId !== action.recipeId)
    ) {
      return null;
    }
    chunks.push(...visibleNodeText(graph, node));
  }

  const output = chunks.map((chunk) => chunk.trim()).filter(Boolean).join('\n');
  if (
    output.length === 0
    || new TextEncoder().encode(output).byteLength > MAX_OUTPUT_MODERATION_BYTES
  ) {
    return null;
  }
  return output;
}

function visibleNodeText(graph: ExperienceGraph, node: ExperienceNode): string[] {
  switch (node.type) {
    case 'character_text':
      return [node.text];
    case 'child_prompt':
      return [node.prompt];
    case 'quick_reply':
    case 'choice':
      return [node.prompt, ...node.options.map(({ label }) => label)];
    case 'cinematic':
      return [node.title, node.description];
    case 'generated_image_recipe':
      return [node.altText];
    case 'quiz': {
      const quiz = graph.quizGraph.quizzes.find(({ id }) => id === node.quizId);
      return quiz ? [quiz.prompt, ...quiz.options.map(({ label }) => label)] : [];
    }
    case 'minigame': {
      const game = graph.gameGraph.games.find(({ id }) => id === node.gameId);
      return game ? [game.prompt, ...game.items.map(({ label }) => label)] : [];
    }
    case 'system_transition':
      return [node.message];
    case 'ending':
      return [node.summary];
  }
}

function actionMatchesNode(
  actionType: 'node' | 'reply' | 'cinematic' | 'imageRecipe',
  node: ExperienceNode,
): boolean {
  if (actionType === 'reply') return node.type === 'character_text';
  if (actionType === 'cinematic') return node.type === 'cinematic';
  if (actionType === 'imageRecipe') return node.type === 'generated_image_recipe';
  return node.type !== 'character_text'
    && node.type !== 'cinematic'
    && node.type !== 'generated_image_recipe';
}

function precheckFailure(
  result: Exclude<ChildInputPrecheckResult, { kind: 'allow_sanitized' }>,
): SafeNarrativeTurnOutcome {
  if (result.kind === 'privacy_redirect') {
    return {
      ok: false,
      errorCode: 'privacy_redirect',
      safetyPlan: fixedSafetyPlan('redirect_to_authored_choices', 'personal_data'),
    };
  }
  if (result.kind === 'safety_redirect') {
    const reason = result.reasonCode === 'self_harm_imminent'
      || result.reasonCode === 'abuse_disclosure'
      ? 'danger_or_self_harm'
      : 'external_contact';
    return {
      ok: false,
      errorCode: 'safety_redirect',
      safetyPlan: fixedSafetyPlan('ask_trusted_adult', reason),
    };
  }
  return genericFailure('invalid_input');
}

function moderationFailure(
  direction: 'input' | 'output',
  result: Exclude<WenitModerationResult, { decision: 'allow' }>,
  inputAudit?: SafeNarrativeModerationReceipt,
): SafeNarrativeTurnOutcome {
  const unavailable = result.decision === 'unavailable';
  return {
    ok: false,
    errorCode: `${direction}_moderation_${unavailable ? 'unavailable' : 'denied'}`,
    safetyPlan: createFailClosedNarrativePlan(
      unavailable ? 'policy_uncertain' : 'unsafe_content',
    ),
    ...(inputAudit ? { inputModeration: inputAudit } : {}),
    ...(direction === 'input' && !unavailable
      ? { inputModeration: projectModerationReceipt(result.audit) }
      : {}),
    ...(direction === 'output' && !unavailable
      ? { outputModeration: projectModerationReceipt(result.audit) }
      : {}),
  };
}

function genericFailure(
  errorCode: SafeNarrativeTurnFailureCode,
  inputModeration?: SafeNarrativeModerationReceipt,
): SafeNarrativeTurnOutcome {
  return {
    ok: false,
    errorCode,
    safetyPlan: createFailClosedNarrativePlan(),
    ...(inputModeration ? { inputModeration } : {}),
  };
}

function fixedSafetyPlan(
  action: 'redirect_to_authored_choices' | 'ask_trusted_adult',
  reasonCode: 'personal_data' | 'external_contact' | 'danger_or_self_harm',
): NarrativeActionPlan {
  return {
    schemaVersion: NARRATIVE_ACTION_SCHEMA_VERSION,
    promptVersion: NARRATIVE_PROMPT_VERSION,
    policyVersion: NARRATIVE_POLICY_VERSION,
    actions: [{ type: 'safetyAction', action, reasonCode }],
  };
}

async function runAbortable<T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
): Promise<T | typeof ABORTED | typeof THREW> {
  if (signal.aborted) return ABORTED;
  let abortListener: (() => void) | undefined;
  const aborted = new Promise<typeof ABORTED>((resolve) => {
    abortListener = () => resolve(ABORTED);
    signal.addEventListener('abort', abortListener, { once: true });
  });
  const executed: Promise<T | typeof THREW> = Promise.resolve()
    .then(operation)
    .catch(() => THREW);
  try {
    return await Promise.race([executed, aborted]);
  } finally {
    if (abortListener) signal.removeEventListener('abort', abortListener);
  }
}
