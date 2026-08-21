import { z } from "zod";

/**
 * ExperienceGraph v1 is authored by Mori Studio and consumed by Kindy.
 * The two repositories carry a byte-identical copy so either can build alone;
 * Mori's parity test prevents the deployable mirror from drifting.
 */

export const EXPERIENCE_GRAPH_SCHEMA_VERSION = "experience-graph/v1" as const;

const IdSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/);

const ReleaseVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "releaseVersion must be semantic x.y.z");

export const SafetyTagSchema = z.enum([
  "age:5-6",
  "age:7-8",
  "content:conflict",
  "content:fantasy-peril",
  "content:loss",
  "input:free-text",
  "media:generated",
  "privacy:no-child-data",
  "safety:human-approved",
  "safety:no-external-contact",
  "safety:runtime-moderation",
  "support:trusted-adult",
]);

export type SafetyTag = z.infer<typeof SafetyTagSchema>;

const SafetyTagsSchema = z.array(SafetyTagSchema).min(1).max(12);
const IdListSchema = z.array(IdSchema).max(16);

const NodeCommonShape = {
  id: IdSchema,
  releaseVersion: ReleaseVersionSchema,
  allowedNextNodeIds: z.array(IdSchema).max(4),
  evidenceClaimIds: IdListSchema,
  safetyTags: SafetyTagsSchema,
};

export const CharacterTextNodeSchema = z
  .object({
    ...NodeCommonShape,
    type: z.literal("character_text"),
    characterId: IdSchema,
    text: z.string().min(1).max(600),
  })
  .strict();

export const ChildPromptNodeSchema = z
  .object({
    ...NodeCommonShape,
    type: z.literal("child_prompt"),
    prompt: z.string().min(1).max(300),
    responseMode: z.enum(["free_text", "choice_only"]),
    maxLength: z.number().int().min(1).max(240),
    moderationPolicyId: z.literal("minor-chat-v1"),
  })
  .strict();

export const NodeOptionSchema = z
  .object({
    id: IdSchema,
    label: z.string().min(1).max(80),
    nextNodeId: IdSchema,
  })
  .strict();

export type NodeOption = z.infer<typeof NodeOptionSchema>;

export const QuickReplyNodeSchema = z
  .object({
    ...NodeCommonShape,
    type: z.literal("quick_reply"),
    prompt: z.string().min(1).max(240),
    options: z.array(NodeOptionSchema).min(1).max(4),
  })
  .strict();

export const ChoiceNodeSchema = z
  .object({
    ...NodeCommonShape,
    type: z.literal("choice"),
    prompt: z.string().min(1).max(240),
    options: z.array(NodeOptionSchema).min(2).max(4),
  })
  .strict();

export const CinematicNodeSchema = z
  .object({
    ...NodeCommonShape,
    type: z.literal("cinematic"),
    mediaId: IdSchema,
    autoplay: z.literal(false),
    subtitlesDefaultOn: z.literal(true),
    canReplay: z.literal(true),
  })
  .strict();

export const ImageVariableBindingSchema = z
  .object({
    variableId: IdSchema,
    valueId: IdSchema,
  })
  .strict();

export const GeneratedImageRecipeNodeSchema = z
  .object({
    ...NodeCommonShape,
    type: z.literal("generated_image_recipe"),
    mediaId: IdSchema,
    variableBindings: z.array(ImageVariableBindingSchema).max(8),
    altText: z.string().min(1).max(240),
  })
  .strict();

export const QuizNodeSchema = z
  .object({
    ...NodeCommonShape,
    type: z.literal("quiz"),
    quizId: IdSchema,
  })
  .strict();

export const MinigameNodeSchema = z
  .object({
    ...NodeCommonShape,
    type: z.literal("minigame"),
    gameId: IdSchema,
  })
  .strict();

export const SystemTransitionNodeSchema = z
  .object({
    ...NodeCommonShape,
    type: z.literal("system_transition"),
    transitionKind: z.enum([
      "chapter",
      "safety_check",
      "session_break",
      "world_return",
    ]),
    message: z.string().min(1).max(240),
  })
  .strict();

export const EndingNodeSchema = z
  .object({
    ...NodeCommonShape,
    type: z.literal("ending"),
    endingKind: z.enum(["complete", "alternate", "return_later"]),
    summary: z.string().min(1).max(360),
  })
  .strict();

export const ExperienceNodeSchema = z.discriminatedUnion("type", [
  CharacterTextNodeSchema,
  ChildPromptNodeSchema,
  QuickReplyNodeSchema,
  ChoiceNodeSchema,
  CinematicNodeSchema,
  GeneratedImageRecipeNodeSchema,
  QuizNodeSchema,
  MinigameNodeSchema,
  SystemTransitionNodeSchema,
  EndingNodeSchema,
]);

export type ExperienceNode = z.infer<typeof ExperienceNodeSchema>;

export const ChatGraphSchema = z
  .object({
    releaseVersion: ReleaseVersionSchema,
    entryNodeId: IdSchema,
    nodes: z.array(ExperienceNodeSchema).min(1).max(500),
  })
  .strict();

export const PlayerCharacterSchema = z
  .object({
    id: IdSchema,
    displayName: z.string().min(1).max(80),
    avatarMediaId: IdSchema.optional(),
  })
  .strict();

export const MemorySlotSchema = z
  .object({
    id: IdSchema,
    scope: z.enum(["session", "world"]),
    allowedValueIds: z.array(IdSchema).min(1).max(32),
    initialValueId: IdSchema,
  })
  .strict();

export const PlayerGraphSchema = z
  .object({
    releaseVersion: ReleaseVersionSchema,
    protagonistCharacterId: IdSchema,
    displayNameToken: z.literal("{{child_name}}"),
    characters: z.array(PlayerCharacterSchema).min(1).max(32),
    memorySlots: z.array(MemorySlotSchema).max(32),
  })
  .strict();

export const MediaAssetSchema = z
  .object({
    id: IdSchema,
    releaseVersion: ReleaseVersionSchema,
    kind: z.enum(["image", "video", "audio", "subtitle", "avatar", "sprite"]),
    storageKey: z
      .string()
      .min(1)
      .max(512)
      .regex(/^releases\/[a-zA-Z0-9._\/-]+$/)
      .refine((value) => !value.includes(".."), "storageKey cannot contain .."),
    mimeType: z.string().min(1).max(100),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    durationMs: z.number().int().positive().optional(),
    safetyStatus: z.literal("approved"),
  })
  .strict();

export const ImageRecipeVariableSchema = z
  .object({
    id: IdSchema,
    allowedValueIds: z.array(IdSchema).min(1).max(32),
  })
  .strict();

export const ImageRecipeSchema = z
  .object({
    id: IdSchema,
    releaseVersion: ReleaseVersionSchema,
    templateId: IdSchema,
    aspectRatio: z.enum(["4:5", "9:16"]),
    outputMimeType: z.enum(["image/webp", "image/png"]),
    variables: z.array(ImageRecipeVariableSchema).max(8),
    safetyStatus: z.literal("approved"),
  })
  .strict();

export const MediaManifestSchema = z
  .object({
    releaseVersion: ReleaseVersionSchema,
    assets: z.array(MediaAssetSchema).max(1_000),
    imageRecipes: z.array(ImageRecipeSchema).max(100),
  })
  .strict();

export const QuizOptionSchema = z
  .object({
    id: IdSchema,
    label: z.string().min(1).max(120),
  })
  .strict();

export const QuizFeedbackSchema = z
  .object({
    optionId: IdSchema,
    text: z.string().min(1).max(240),
  })
  .strict();

export const QuizDefinitionSchema = z
  .object({
    id: IdSchema,
    releaseVersion: ReleaseVersionSchema,
    prompt: z.string().min(1).max(300),
    evidenceClaimIds: IdListSchema,
    options: z.array(QuizOptionSchema).min(2).max(4),
    correctOptionId: IdSchema,
    feedback: z.array(QuizFeedbackSchema).min(2).max(4),
  })
  .strict();

export const QuizGraphSchema = z
  .object({
    releaseVersion: ReleaseVersionSchema,
    quizzes: z.array(QuizDefinitionSchema).max(100),
  })
  .strict();

export const GameItemSchema = z
  .object({
    id: IdSchema,
    label: z.string().min(1).max(120),
    mediaId: IdSchema.optional(),
  })
  .strict();

const SingleSelectSolutionSchema = z
  .object({
    type: z.literal("single_select"),
    correctItemIds: z.array(IdSchema).min(1).max(4),
  })
  .strict();

const SequenceSolutionSchema = z
  .object({
    type: z.literal("sequence"),
    orderedItemIds: z.array(IdSchema).min(2).max(12),
  })
  .strict();

const MatchingPairSchema = z
  .object({
    leftItemId: IdSchema,
    rightItemId: IdSchema,
  })
  .strict();

const MatchingSolutionSchema = z
  .object({
    type: z.literal("matching"),
    pairs: z.array(MatchingPairSchema).min(2).max(8),
  })
  .strict();

export const GameSolutionSchema = z.discriminatedUnion("type", [
  SingleSelectSolutionSchema,
  SequenceSolutionSchema,
  MatchingSolutionSchema,
]);

export const GameDefinitionSchema = z
  .object({
    id: IdSchema,
    releaseVersion: ReleaseVersionSchema,
    template: z.enum(["single_select", "sequence", "matching"]),
    prompt: z.string().min(1).max(300),
    evidenceClaimIds: IdListSchema,
    items: z.array(GameItemSchema).min(2).max(16),
    solution: GameSolutionSchema,
  })
  .strict();

export const GameGraphSchema = z
  .object({
    releaseVersion: ReleaseVersionSchema,
    games: z.array(GameDefinitionSchema).max(100),
  })
  .strict();

export const EvidenceClaimSchema = z
  .object({
    id: IdSchema,
    statement: z.string().min(1).max(600),
    sourceRefs: z.array(z.string().min(1).max(300)).min(1).max(12),
    reviewStatus: z.literal("approved"),
  })
  .strict();

const ExperienceGraphShapeSchema = z
  .object({
    schemaVersion: z.literal(EXPERIENCE_GRAPH_SCHEMA_VERSION),
    experienceId: IdSchema,
    releaseVersion: ReleaseVersionSchema,
    chatGraph: ChatGraphSchema,
    playerGraph: PlayerGraphSchema,
    mediaManifest: MediaManifestSchema,
    quizGraph: QuizGraphSchema,
    gameGraph: GameGraphSchema,
    evidenceClaims: z.array(EvidenceClaimSchema).max(500),
  })
  .strict();

type ExperienceGraphShape = z.infer<typeof ExperienceGraphShapeSchema>;

type ContractProblem = {
  path: Array<string | number>;
  message: string;
};

export const ExperienceGraphSchema = ExperienceGraphShapeSchema.superRefine(
  (graph, ctx) => {
    for (const problem of collectContractProblems(graph)) {
      ctx.addIssue({
        code: "custom",
        path: problem.path,
        message: problem.message,
      });
    }
  },
);

export type ExperienceGraph = z.infer<typeof ExperienceGraphSchema>;

export function parseExperienceGraph(input: unknown): ExperienceGraph {
  return ExperienceGraphSchema.parse(input);
}

export function isAllowedTransition(
  graph: ExperienceGraph,
  fromNodeId: string,
  toNodeId: string,
): boolean {
  const node = graph.chatGraph.nodes.find((candidate) => candidate.id === fromNodeId);
  return node?.allowedNextNodeIds.includes(toNodeId) ?? false;
}

export function resolveChoiceTransition(
  graph: ExperienceGraph,
  nodeId: string,
  optionId: string,
): string {
  const node = graph.chatGraph.nodes.find((candidate) => candidate.id === nodeId);
  if (node?.type !== "choice" && node?.type !== "quick_reply") {
    throw new Error(`node ${nodeId} does not accept an allowlisted choice`);
  }

  const option = node.options.find((candidate) => candidate.id === optionId);
  if (option === undefined || !node.allowedNextNodeIds.includes(option.nextNodeId)) {
    throw new Error(`choice ${optionId} is not allowlisted on node ${nodeId}`);
  }

  return option.nextNodeId;
}

export function resolveApprovedMedia(
  graph: ExperienceGraph,
  mediaId: string,
): z.infer<typeof MediaAssetSchema> {
  const media = graph.mediaManifest.assets.find((candidate) => candidate.id === mediaId);
  if (media === undefined || media.safetyStatus !== "approved") {
    throw new Error(`media ${mediaId} is not in the approved manifest`);
  }
  return media;
}

function collectContractProblems(graph: ExperienceGraphShape): ContractProblem[] {
  const problems: ContractProblem[] = [];
  const releasePaths: Array<[Array<string | number>, string]> = [
    [["chatGraph", "releaseVersion"], graph.chatGraph.releaseVersion],
    [["playerGraph", "releaseVersion"], graph.playerGraph.releaseVersion],
    [["mediaManifest", "releaseVersion"], graph.mediaManifest.releaseVersion],
    [["quizGraph", "releaseVersion"], graph.quizGraph.releaseVersion],
    [["gameGraph", "releaseVersion"], graph.gameGraph.releaseVersion],
  ];

  graph.chatGraph.nodes.forEach((node, index) => {
    releasePaths.push([["chatGraph", "nodes", index, "releaseVersion"], node.releaseVersion]);
  });
  graph.mediaManifest.assets.forEach((asset, index) => {
    releasePaths.push([["mediaManifest", "assets", index, "releaseVersion"], asset.releaseVersion]);
  });
  graph.mediaManifest.imageRecipes.forEach((recipe, index) => {
    releasePaths.push([
      ["mediaManifest", "imageRecipes", index, "releaseVersion"],
      recipe.releaseVersion,
    ]);
  });
  graph.quizGraph.quizzes.forEach((quiz, index) => {
    releasePaths.push([["quizGraph", "quizzes", index, "releaseVersion"], quiz.releaseVersion]);
  });
  graph.gameGraph.games.forEach((game, index) => {
    releasePaths.push([["gameGraph", "games", index, "releaseVersion"], game.releaseVersion]);
  });

  for (const [path, version] of releasePaths) {
    if (version !== graph.releaseVersion) {
      problems.push({ path, message: `releaseVersion must equal root ${graph.releaseVersion}` });
    }
  }

  addDuplicateProblems(problems, graph.chatGraph.nodes, ["chatGraph", "nodes"], "node");
  addDuplicateProblems(problems, graph.playerGraph.characters, ["playerGraph", "characters"], "character");
  addDuplicateProblems(problems, graph.playerGraph.memorySlots, ["playerGraph", "memorySlots"], "memory slot");
  addDuplicateProblems(problems, graph.mediaManifest.assets, ["mediaManifest", "assets"], "media asset");
  addDuplicateProblems(problems, graph.mediaManifest.imageRecipes, ["mediaManifest", "imageRecipes"], "image recipe");
  addDuplicateProblems(problems, graph.quizGraph.quizzes, ["quizGraph", "quizzes"], "quiz");
  addDuplicateProblems(problems, graph.gameGraph.games, ["gameGraph", "games"], "game");
  addDuplicateProblems(problems, graph.evidenceClaims, ["evidenceClaims"], "evidence claim");

  const nodes = new Map(graph.chatGraph.nodes.map((node) => [node.id, node]));
  const characters = new Map(graph.playerGraph.characters.map((character) => [character.id, character]));
  const assets = new Map(graph.mediaManifest.assets.map((asset) => [asset.id, asset]));
  const recipes = new Map(graph.mediaManifest.imageRecipes.map((recipe) => [recipe.id, recipe]));
  const quizzes = new Set(graph.quizGraph.quizzes.map((quiz) => quiz.id));
  const games = new Set(graph.gameGraph.games.map((game) => game.id));
  const claims = new Set(graph.evidenceClaims.map((claim) => claim.id));

  if (!nodes.has(graph.chatGraph.entryNodeId)) {
    problems.push({
      path: ["chatGraph", "entryNodeId"],
      message: `entry node ${graph.chatGraph.entryNodeId} does not exist`,
    });
  }

  if (!characters.has(graph.playerGraph.protagonistCharacterId)) {
    problems.push({
      path: ["playerGraph", "protagonistCharacterId"],
      message: `protagonist character ${graph.playerGraph.protagonistCharacterId} does not exist`,
    });
  }

  graph.playerGraph.characters.forEach((character, index) => {
    if (character.avatarMediaId !== undefined && !assets.has(character.avatarMediaId)) {
      problems.push({
        path: ["playerGraph", "characters", index, "avatarMediaId"],
        message: `avatar media ${character.avatarMediaId} is not allowlisted`,
      });
    }
  });

  graph.playerGraph.memorySlots.forEach((slot, index) => {
    addStringDuplicateProblems(
      problems,
      slot.allowedValueIds,
      ["playerGraph", "memorySlots", index, "allowedValueIds"],
      "memory value",
    );
    if (!slot.allowedValueIds.includes(slot.initialValueId)) {
      problems.push({
        path: ["playerGraph", "memorySlots", index, "initialValueId"],
        message: `initial memory value ${slot.initialValueId} is not allowlisted`,
      });
    }
  });

  const mediaIds = new Set<string>();
  const mediaEntries = [
    ...graph.mediaManifest.assets.map((asset, index) => ({
      id: asset.id,
      path: ["mediaManifest", "assets", index, "id"] as Array<string | number>,
    })),
    ...graph.mediaManifest.imageRecipes.map((recipe, index) => ({
      id: recipe.id,
      path: ["mediaManifest", "imageRecipes", index, "id"] as Array<string | number>,
    })),
  ];
  for (const item of mediaEntries) {
    if (mediaIds.has(item.id)) {
      problems.push({
        path: item.path,
        message: `duplicate media id across manifest: ${item.id}`,
      });
    }
    mediaIds.add(item.id);
  }

  graph.chatGraph.nodes.forEach((node, index) => {
    addStringDuplicateProblems(
      problems,
      node.allowedNextNodeIds,
      ["chatGraph", "nodes", index, "allowedNextNodeIds"],
      "next node",
    );
    addStringDuplicateProblems(
      problems,
      node.evidenceClaimIds,
      ["chatGraph", "nodes", index, "evidenceClaimIds"],
      "evidence claim",
    );
    addStringDuplicateProblems(
      problems,
      node.safetyTags,
      ["chatGraph", "nodes", index, "safetyTags"],
      "safety tag",
    );

    for (const nextNodeId of node.allowedNextNodeIds) {
      if (!nodes.has(nextNodeId)) {
        problems.push({
          path: ["chatGraph", "nodes", index, "allowedNextNodeIds"],
          message: `node ${node.id} references missing node ${nextNodeId}`,
        });
      }
    }
    addMissingClaimProblems(problems, node.evidenceClaimIds, claims, ["chatGraph", "nodes", index, "evidenceClaimIds"]);

    if (node.type === "ending") {
      if (node.allowedNextNodeIds.length !== 0) {
        problems.push({
          path: ["chatGraph", "nodes", index, "allowedNextNodeIds"],
          message: `ending node ${node.id} must be terminal`,
        });
      }
    } else if (node.allowedNextNodeIds.length === 0) {
      problems.push({
        path: ["chatGraph", "nodes", index, "allowedNextNodeIds"],
        message: `non-ending node ${node.id} must have an allowed next node`,
      });
    }

    if (
      node.type !== "choice" &&
      node.type !== "quick_reply" &&
      node.allowedNextNodeIds.length > 1
    ) {
      problems.push({
        path: ["chatGraph", "nodes", index, "allowedNextNodeIds"],
        message: `node ${node.id} requires an explicit choice node before branching`,
      });
    }

    if (node.type === "choice" || node.type === "quick_reply") {
      addDuplicateProblems(
        problems,
        node.options,
        ["chatGraph", "nodes", index, "options"],
        "choice option",
      );
      const optionTargets = new Set(node.options.map((option) => option.nextNodeId));
      const allowlistTargets = new Set(node.allowedNextNodeIds);
      if (!sameSet(optionTargets, allowlistTargets)) {
        problems.push({
          path: ["chatGraph", "nodes", index, "options"],
          message: `choice targets on ${node.id} must exactly match allowedNextNodeIds`,
        });
      }
    }

    if (node.type === "character_text" && !characters.has(node.characterId)) {
      problems.push({
        path: ["chatGraph", "nodes", index, "characterId"],
        message: `character ${node.characterId} does not exist`,
      });
    }

    if (node.type === "cinematic") {
      const media = assets.get(node.mediaId);
      if (media?.kind !== "video") {
        problems.push({
          path: ["chatGraph", "nodes", index, "mediaId"],
          message: `cinematic media ${node.mediaId} is not an approved video asset`,
        });
      }
    }

    if (node.type === "generated_image_recipe") {
      const recipe = recipes.get(node.mediaId);
      if (recipe === undefined) {
        problems.push({
          path: ["chatGraph", "nodes", index, "mediaId"],
          message: `generated image recipe ${node.mediaId} is not allowlisted`,
        });
      } else {
        addDuplicateBindingProblems(problems, node, recipe, index);
      }
    }

    if (node.type === "quiz" && !quizzes.has(node.quizId)) {
      problems.push({
        path: ["chatGraph", "nodes", index, "quizId"],
        message: `quiz ${node.quizId} does not exist`,
      });
    }

    if (node.type === "minigame" && !games.has(node.gameId)) {
      problems.push({
        path: ["chatGraph", "nodes", index, "gameId"],
        message: `game ${node.gameId} does not exist`,
      });
    }
  });

  graph.quizGraph.quizzes.forEach((quiz, index) => {
    addDuplicateProblems(problems, quiz.options, ["quizGraph", "quizzes", index, "options"], "quiz option");
    addStringDuplicateProblems(
      problems,
      quiz.feedback.map((feedback) => feedback.optionId),
      ["quizGraph", "quizzes", index, "feedback"],
      "quiz feedback option",
    );
    const optionIds = new Set(quiz.options.map((option) => option.id));
    if (!optionIds.has(quiz.correctOptionId)) {
      problems.push({
        path: ["quizGraph", "quizzes", index, "correctOptionId"],
        message: `correct option ${quiz.correctOptionId} is not allowlisted`,
      });
    }
    const feedbackIds = new Set(quiz.feedback.map((feedback) => feedback.optionId));
    if (!sameSet(optionIds, feedbackIds)) {
      problems.push({
        path: ["quizGraph", "quizzes", index, "feedback"],
        message: `quiz ${quiz.id} feedback must cover each allowlisted option exactly once`,
      });
    }
    addMissingClaimProblems(problems, quiz.evidenceClaimIds, claims, ["quizGraph", "quizzes", index, "evidenceClaimIds"]);
  });

  graph.gameGraph.games.forEach((game, index) => {
    addDuplicateProblems(problems, game.items, ["gameGraph", "games", index, "items"], "game item");
    const itemIds = new Set(game.items.map((item) => item.id));
    if (game.template !== game.solution.type) {
      problems.push({
        path: ["gameGraph", "games", index, "solution", "type"],
        message: `game ${game.id} solution type must match template`,
      });
    }
    for (const solutionId of getGameSolutionIds(game.solution)) {
      if (!itemIds.has(solutionId)) {
        problems.push({
          path: ["gameGraph", "games", index, "solution"],
          message: `game solution item ${solutionId} is not allowlisted`,
        });
      }
    }
    game.items.forEach((item, itemIndex) => {
      if (item.mediaId !== undefined && !assets.has(item.mediaId)) {
        problems.push({
          path: ["gameGraph", "games", index, "items", itemIndex, "mediaId"],
          message: `game media ${item.mediaId} is not allowlisted`,
        });
      }
    });
    addMissingClaimProblems(problems, game.evidenceClaimIds, claims, ["gameGraph", "games", index, "evidenceClaimIds"]);
  });

  addGraphTopologyProblems(problems, graph, nodes);
  return problems;
}

function addGraphTopologyProblems(
  problems: ContractProblem[],
  graph: ExperienceGraphShape,
  nodes: ReadonlyMap<string, ExperienceNode>,
): void {
  const reachable = new Set<string>();
  const queue = [graph.chatGraph.entryNodeId];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (nodeId === undefined || reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    const node = nodes.get(nodeId);
    if (node !== undefined) queue.push(...node.allowedNextNodeIds);
  }

  graph.chatGraph.nodes.forEach((node, index) => {
    if (!reachable.has(node.id)) {
      problems.push({
        path: ["chatGraph", "nodes", index, "id"],
        message: `unreachable node: ${node.id}`,
      });
    }
  });

  const endings = graph.chatGraph.nodes.filter((node) => node.type === "ending");
  if (endings.length === 0) {
    problems.push({ path: ["chatGraph", "nodes"], message: "graph must contain an ending node" });
  }

  const reverse = new Map<string, string[]>();
  for (const node of graph.chatGraph.nodes) {
    for (const next of node.allowedNextNodeIds) {
      reverse.set(next, [...(reverse.get(next) ?? []), node.id]);
    }
  }
  const canReachEnding = new Set(endings.map((ending) => ending.id));
  const reverseQueue = [...canReachEnding];
  while (reverseQueue.length > 0) {
    const nodeId = reverseQueue.shift();
    if (nodeId === undefined) continue;
    for (const previous of reverse.get(nodeId) ?? []) {
      if (!canReachEnding.has(previous)) {
        canReachEnding.add(previous);
        reverseQueue.push(previous);
      }
    }
  }
  graph.chatGraph.nodes.forEach((node, index) => {
    if (reachable.has(node.id) && !canReachEnding.has(node.id)) {
      problems.push({
        path: ["chatGraph", "nodes", index, "id"],
        message: `node ${node.id} cannot reach an ending`,
      });
    }
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];
  const visit = (nodeId: string): void => {
    if (visiting.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      problems.push({
        path: ["chatGraph", "nodes"],
        message: `cycle detected: ${[...path.slice(cycleStart), nodeId].join(" -> ")}`,
      });
      return;
    }
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    path.push(nodeId);
    for (const next of nodes.get(nodeId)?.allowedNextNodeIds ?? []) visit(next);
    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  if (nodes.has(graph.chatGraph.entryNodeId)) visit(graph.chatGraph.entryNodeId);
}

function addDuplicateProblems<T extends { id: string }>(
  problems: ContractProblem[],
  items: readonly T[],
  path: Array<string | number>,
  label: string,
): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      problems.push({ path: [...path, index, "id"], message: `duplicate ${label} id: ${item.id}` });
    }
    seen.add(item.id);
  });
}

function addStringDuplicateProblems(
  problems: ContractProblem[],
  items: readonly string[],
  path: Array<string | number>,
  label: string,
): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item)) {
      problems.push({ path: [...path, index], message: `duplicate ${label}: ${item}` });
    }
    seen.add(item);
  });
}

function addMissingClaimProblems(
  problems: ContractProblem[],
  claimIds: readonly string[],
  claims: ReadonlySet<string>,
  path: Array<string | number>,
): void {
  claimIds.forEach((claimId, index) => {
    if (!claims.has(claimId)) {
      problems.push({ path: [...path, index], message: `evidence claim ${claimId} does not exist` });
    }
  });
}

function addDuplicateBindingProblems(
  problems: ContractProblem[],
  node: z.infer<typeof GeneratedImageRecipeNodeSchema>,
  recipe: z.infer<typeof ImageRecipeSchema>,
  nodeIndex: number,
): void {
  const variables = new Map(recipe.variables.map((variable) => [variable.id, variable]));
  const bindings = new Set<string>();
  node.variableBindings.forEach((binding, bindingIndex) => {
    if (bindings.has(binding.variableId)) {
      problems.push({
        path: ["chatGraph", "nodes", nodeIndex, "variableBindings", bindingIndex, "variableId"],
        message: `duplicate image variable binding: ${binding.variableId}`,
      });
    }
    bindings.add(binding.variableId);
    const variable = variables.get(binding.variableId);
    if (variable === undefined || !variable.allowedValueIds.includes(binding.valueId)) {
      problems.push({
        path: ["chatGraph", "nodes", nodeIndex, "variableBindings", bindingIndex],
        message: `image variable ${binding.variableId}=${binding.valueId} is not allowlisted`,
      });
    }
  });
  if (!sameSet(new Set(variables.keys()), bindings)) {
    problems.push({
      path: ["chatGraph", "nodes", nodeIndex, "variableBindings"],
      message: `generated image node ${node.id} must bind every recipe variable exactly once`,
    });
  }
}

function getGameSolutionIds(
  solution: z.infer<typeof GameSolutionSchema>,
): string[] {
  if (solution.type === "single_select") return solution.correctItemIds;
  if (solution.type === "sequence") return solution.orderedItemIds;
  return solution.pairs.flatMap((pair) => [pair.leftItemId, pair.rightItemId]);
}

function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}
