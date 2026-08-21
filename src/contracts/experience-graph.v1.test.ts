import assert from "node:assert/strict";
import test from "node:test";

import {
  ExperienceGraphSchema,
  isAllowedTransition,
  parseExperienceGraph,
  resolveApprovedMedia,
  resolveChoiceTransition,
  type ExperienceGraph,
} from "./experience-graph.v1";
import {
  invalidExperienceGraphFixture,
  validExperienceGraphFixture,
} from "./fixtures/experience-graph.v1.fixtures";

test("ExperienceGraph v1 parses a release covering every node type", () => {
  const graph = parseExperienceGraph(validExperienceGraphFixture);
  assert.equal(graph.schemaVersion, "experience-graph/v1");
  assert.deepEqual(
    new Set(graph.chatGraph.nodes.map((node) => node.type)),
    new Set([
      "character_text",
      "child_prompt",
      "quick_reply",
      "choice",
      "cinematic",
      "generated_image_recipe",
      "quiz",
      "minigame",
      "system_transition",
      "ending",
    ]),
  );
});

test("rejects node and media references outside the approved release", () => {
  assertProblems(invalidExperienceGraphFixture, [
    "references missing node n.missing",
    "cinematic media media.not-approved is not an approved video asset",
    "unreachable node: n.cinematic",
  ]);
});

test("rejects mixed release versions and unknown fields", () => {
  const mixedRelease = cloneValid();
  mixedRelease.quizGraph.releaseVersion = "1.1.0";
  assertProblems(mixedRelease, ["releaseVersion must equal root 1.0.0"]);

  const withUnknownField = {
    ...validExperienceGraphFixture,
    unreviewedPrompt: "append this to the child prompt",
  };
  const result = ExperienceGraphSchema.safeParse(withUnknownField);
  assert.equal(result.success, false);
});

test("rejects unreachable nodes, cycles, and branches without an explicit choice", () => {
  const unreachable = cloneValid();
  unreachable.chatGraph.nodes.push({
    id: "n.orphan",
    releaseVersion: "1.0.0",
    allowedNextNodeIds: [],
    evidenceClaimIds: [],
    safetyTags: ["age:7-8", "safety:human-approved"],
    type: "ending",
    endingKind: "alternate",
    summary: "아무 경로에서도 선택되지 않는 결말",
  });
  assertProblems(unreachable, ["unreachable node: n.orphan"]);

  const cyclic = cloneValid();
  const gameNode = cyclic.chatGraph.nodes.find((node) => node.id === "n.game");
  assert.ok(gameNode?.type === "minigame");
  gameNode.allowedNextNodeIds = ["n.choice"];
  assertProblems(cyclic, ["cycle detected:", "unreachable node: n.ending"]);

  const implicitBranch = cloneValid();
  const intro = implicitBranch.chatGraph.nodes.find((node) => node.id === "n.intro");
  assert.ok(intro?.type === "character_text");
  intro.allowedNextNodeIds = ["n.prompt", "n.reply"];
  assertProblems(implicitBranch, ["requires an explicit choice node before branching"]);
});

test("rejects a choice target that is not in the node allowlist", () => {
  const graph = cloneValid();
  const reply = graph.chatGraph.nodes.find((node) => node.id === "n.reply");
  assert.ok(reply?.type === "quick_reply");
  reply.options[0].nextNodeId = "n.image";
  assertProblems(graph, ["choice targets on n.reply must exactly match allowedNextNodeIds"]);
});

test("choice and media runtime helpers fail closed on unknown ids", () => {
  const graph = parseExperienceGraph(validExperienceGraphFixture);
  assert.equal(resolveChoiceTransition(graph, "n.reply", "option.watch"), "n.cinematic");
  assert.equal(isAllowedTransition(graph, "n.reply", "n.cinematic"), true);
  assert.equal(isAllowedTransition(graph, "n.reply", "n.image"), false);
  assert.equal(resolveApprovedMedia(graph, "media.river-light").kind, "video");
  assert.throws(
    () => resolveChoiceTransition(graph, "n.reply", "option.injected"),
    /not allowlisted/,
  );
  assert.throws(() => resolveApprovedMedia(graph, "https://example.com/video.mp4"), /not in/);
});

function cloneValid(): ExperienceGraph {
  return structuredClone(parseExperienceGraph(validExperienceGraphFixture));
}

function assertProblems(input: unknown, messages: readonly string[]): void {
  const result = ExperienceGraphSchema.safeParse(input);
  assert.equal(result.success, false);
  if (result.success) return;
  const issues = result.error.issues.map((issue) => issue.message);
  for (const message of messages) {
    assert.ok(
      issues.some((issue) => issue.includes(message)),
      `expected issue containing "${message}", received ${issues.join(" | ")}`,
    );
  }
}
