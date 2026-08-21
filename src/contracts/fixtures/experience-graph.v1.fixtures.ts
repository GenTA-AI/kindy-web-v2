const RELEASE_VERSION = "1.0.0" as const;
const APPROVED = ["age:7-8", "safety:human-approved"] as const;

function nodeBase(
  id: string,
  allowedNextNodeIds: readonly string[],
  evidenceClaimIds: readonly string[] = [],
) {
  return {
    id,
    releaseVersion: RELEASE_VERSION,
    allowedNextNodeIds,
    evidenceClaimIds,
    safetyTags: APPROVED,
  } as const;
}

/** Covers every ExperienceGraph v1 node type in one small, branching release. */
export const validExperienceGraphFixture = {
  schemaVersion: "experience-graph/v1",
  experienceId: "world.seurat-river",
  releaseVersion: RELEASE_VERSION,
  chatGraph: {
    releaseVersion: RELEASE_VERSION,
    entryNodeId: "n.intro",
    nodes: [
      {
        ...nodeBase("n.intro", ["n.prompt"], ["claim.color"]),
        type: "character_text",
        characterId: "character.mori",
        text: "강물 위의 색이 가만히 있지 않네. 같이 단서를 찾아볼까?",
      },
      {
        ...nodeBase("n.prompt", ["n.reply"]),
        type: "child_prompt",
        prompt: "어떤 색이 가장 먼저 눈에 들어왔어?",
        responseMode: "free_text",
        maxLength: 120,
        moderationPolicyId: "minor-chat-v1",
        safetyTags: [
          "age:7-8",
          "input:free-text",
          "safety:human-approved",
          "safety:runtime-moderation",
        ],
      },
      {
        ...nodeBase("n.reply", ["n.cinematic", "n.transition"]),
        type: "quick_reply",
        prompt: "다음에는 어떻게 살펴볼까?",
        options: [
          { id: "option.watch", label: "빛을 자세히 본다", nextNodeId: "n.cinematic" },
          { id: "option.ask", label: "모리에게 물어본다", nextNodeId: "n.transition" },
        ],
      },
      {
        ...nodeBase("n.cinematic", ["n.choice"], ["claim.color"]),
        type: "cinematic",
        mediaId: "media.river-light",
        autoplay: false,
        subtitlesDefaultOn: true,
        canReplay: true,
      },
      {
        ...nodeBase("n.transition", ["n.choice"]),
        type: "system_transition",
        transitionKind: "chapter",
        message: "모리가 작은 돋보기를 건넸어요.",
      },
      {
        ...nodeBase("n.choice", ["n.image", "n.quiz"]),
        type: "choice",
        prompt: "우리만의 강을 먼저 만들까, 퀴즈를 먼저 풀까?",
        options: [
          { id: "option.create", label: "강 그림 만들기", nextNodeId: "n.image" },
          { id: "option.quiz", label: "색 퀴즈 풀기", nextNodeId: "n.quiz" },
        ],
      },
      {
        ...nodeBase("n.image", ["n.quiz"]),
        type: "generated_image_recipe",
        mediaId: "recipe.child-river",
        variableBindings: [{ variableId: "style", valueId: "curious" }],
        altText: "아이가 고른 분위기로 다시 그린 반짝이는 강",
        safetyTags: [
          "age:7-8",
          "media:generated",
          "privacy:no-child-data",
          "safety:human-approved",
          "safety:runtime-moderation",
        ],
      },
      {
        ...nodeBase("n.quiz", ["n.game"], ["claim.color"]),
        type: "quiz",
        quizId: "quiz.color",
      },
      {
        ...nodeBase("n.game", ["n.ending"], ["claim.color"]),
        type: "minigame",
        gameId: "game.light-order",
      },
      {
        ...nodeBase("n.ending", [], ["claim.color"]),
        type: "ending",
        endingKind: "complete",
        summary: "빛과 주변 색이 만나 강물의 색이 달라 보인다는 단서를 찾았어요.",
      },
    ],
  },
  playerGraph: {
    releaseVersion: RELEASE_VERSION,
    protagonistCharacterId: "character.child",
    displayNameToken: "{{child_name}}",
    characters: [
      { id: "character.child", displayName: "나" },
      {
        id: "character.mori",
        displayName: "모리",
        avatarMediaId: "media.mori-avatar",
      },
    ],
    memorySlots: [
      {
        id: "memory.river-mood",
        scope: "world",
        allowedValueIds: ["curious", "calm"],
        initialValueId: "curious",
      },
    ],
  },
  mediaManifest: {
    releaseVersion: RELEASE_VERSION,
    assets: [
      {
        id: "media.mori-avatar",
        releaseVersion: RELEASE_VERSION,
        kind: "avatar",
        storageKey: "releases/world.seurat-river/1.0.0/mori.webp",
        mimeType: "image/webp",
        sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        width: 512,
        height: 512,
        safetyStatus: "approved",
      },
      {
        id: "media.river-light",
        releaseVersion: RELEASE_VERSION,
        kind: "video",
        storageKey: "releases/world.seurat-river/1.0.0/river-light.mp4",
        mimeType: "video/mp4",
        sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        width: 1080,
        height: 1920,
        durationMs: 12_000,
        safetyStatus: "approved",
      },
      {
        id: "media.sun-card",
        releaseVersion: RELEASE_VERSION,
        kind: "image",
        storageKey: "releases/world.seurat-river/1.0.0/sun-card.webp",
        mimeType: "image/webp",
        sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        width: 800,
        height: 1_000,
        safetyStatus: "approved",
      },
    ],
    imageRecipes: [
      {
        id: "recipe.child-river",
        releaseVersion: RELEASE_VERSION,
        templateId: "template.seurat-river-v1",
        aspectRatio: "4:5",
        outputMimeType: "image/webp",
        variables: [{ id: "style", allowedValueIds: ["curious", "calm"] }],
        safetyStatus: "approved",
      },
    ],
  },
  quizGraph: {
    releaseVersion: RELEASE_VERSION,
    quizzes: [
      {
        id: "quiz.color",
        releaseVersion: RELEASE_VERSION,
        prompt: "강물의 색이 여러 가지로 보인 까닭은 무엇일까?",
        evidenceClaimIds: ["claim.color"],
        options: [
          { id: "answer.light", label: "빛과 주변 색이 비쳤기 때문" },
          { id: "answer.paint", label: "누군가 물감을 풀었기 때문" },
        ],
        correctOptionId: "answer.light",
        feedback: [
          { optionId: "answer.light", text: "맞아. 빛과 주변 색이 물 위에서 만났어." },
          { optionId: "answer.paint", text: "다시 물 위의 빛을 살펴보자." },
        ],
      },
    ],
  },
  gameGraph: {
    releaseVersion: RELEASE_VERSION,
    games: [
      {
        id: "game.light-order",
        releaseVersion: RELEASE_VERSION,
        template: "sequence",
        prompt: "빛을 관찰한 순서대로 놓아 보자.",
        evidenceClaimIds: ["claim.color"],
        items: [
          { id: "item.look", label: "강물을 본다", mediaId: "media.sun-card" },
          { id: "item.compare", label: "주변 색과 비교한다" },
          { id: "item.explain", label: "달라 보이는 까닭을 말한다" },
        ],
        solution: {
          type: "sequence",
          orderedItemIds: ["item.look", "item.compare", "item.explain"],
        },
      },
    ],
  },
  evidenceClaims: [
    {
      id: "claim.color",
      statement: "물 표면의 색은 빛과 주변 환경의 반사에 따라 다르게 보일 수 있다.",
      sourceRefs: ["source:museum.seurat-river-color"],
      reviewStatus: "approved",
    },
  ],
} as const;

/** Deliberately breaks both the node and media allowlists. */
export const invalidExperienceGraphFixture = {
  ...validExperienceGraphFixture,
  chatGraph: {
    ...validExperienceGraphFixture.chatGraph,
    nodes: validExperienceGraphFixture.chatGraph.nodes.map((node) => {
      if (node.type === "quick_reply") {
        return {
          ...node,
          allowedNextNodeIds: ["n.missing", "n.transition"],
          options: [
            { id: "option.watch", label: "빛을 자세히 본다", nextNodeId: "n.missing" },
            node.options[1],
          ],
        };
      }
      if (node.type === "cinematic") {
        return { ...node, mediaId: "media.not-approved" };
      }
      return node;
    }),
  },
};
