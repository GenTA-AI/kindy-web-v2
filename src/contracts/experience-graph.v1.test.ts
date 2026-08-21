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
    {
      coverMediaId: graph.presentation.coverMediaId,
      primaryCharacterId: graph.presentation.primaryCharacterId,
    },
    {
      coverMediaId: "media.world-cover",
      primaryCharacterId: "character.mori",
    },
  );
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
  const cinematic = graph.chatGraph.nodes.find((node) => node.type === "cinematic");
  assert.ok(cinematic?.type === "cinematic");
  assert.equal(cinematic.posterMediaId, "media.river-light-poster");
  assert.equal(cinematic.subtitleMediaId, "media.river-light-subtitles");
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

  const unsafeSemver = {
    ...validExperienceGraphFixture,
    releaseVersion: "9007199254740992.0.0",
  };
  assert.equal(ExperienceGraphSchema.safeParse(unsafeSemver).success, false);
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

test("requires a distinct primary character with a square avatar and dimensioned cover", () => {
  const childAsPrimary = cloneValid();
  childAsPrimary.presentation.primaryCharacterId =
    childAsPrimary.playerGraph.protagonistCharacterId;
  assertProblems(childAsPrimary, ["primary character must not be the child protagonist"]);

  const nonSquareAvatar = cloneValid();
  const avatar = nonSquareAvatar.mediaManifest.assets.find(
    (asset) => asset.id === "media.mori-avatar",
  );
  assert.ok(avatar?.kind === "avatar");
  avatar.width = 480;
  assertProblems(nonSquareAvatar, ["must have square dimensions"]);

  const coverWithoutDimensions = cloneValid();
  const cover = coverWithoutDimensions.mediaManifest.assets.find(
    (asset) => asset.id === coverWithoutDimensions.presentation.coverMediaId,
  );
  assert.ok(cover?.kind === "image");
  delete cover.width;
  assertProblems(coverWithoutDimensions, ["requires image dimensions"]);
});

test("requires exact cinematic video, poster, and WebVTT media metadata", () => {
  const landscapeVideo = cloneValid();
  const video = landscapeVideo.mediaManifest.assets.find(
    (asset) => asset.id === "media.river-light",
  );
  assert.ok(video?.kind === "video");
  video.width = 1920;
  assertProblems(landscapeVideo, ["requires exact 9:16 dimensions"]);

  const videoWithoutDuration = cloneValid();
  const durationless = videoWithoutDuration.mediaManifest.assets.find(
    (asset) => asset.id === "media.river-light",
  );
  assert.ok(durationless?.kind === "video");
  delete durationless.durationMs;
  assertProblems(videoWithoutDuration, ["requires durationMs"]);

  const landscapePoster = cloneValid();
  const poster = landscapePoster.mediaManifest.assets.find(
    (asset) => asset.id === "media.river-light-poster",
  );
  assert.ok(poster?.kind === "image");
  poster.height = 1080;
  assertProblems(landscapePoster, ["cinematic poster", "exact 9:16 dimensions"]);

  const wrongSubtitleMime = cloneValid();
  const subtitle = wrongSubtitleMime.mediaManifest.assets.find(
    (asset) => asset.id === "media.river-light-subtitles",
  );
  assert.ok(subtitle?.kind === "subtitle");
  subtitle.mimeType = "text/plain";
  assertProblems(wrongSubtitleMime, ["approved text/vtt subtitle asset"]);
});

test("fails closed on unknown, malformed, or unbounded child-name tokens", () => {
  const unknown = cloneValid();
  unknown.presentation.summary = "{{guardian_name}} 와 함께 떠나는 이야기";
  assertProblems(unknown, ["unknown template token: {{guardian_name}}"]);

  const malformed = cloneValid();
  malformed.presentation.summary = "반가워요, {{child_name";
  assertProblems(malformed, ["template token delimiters must form {{child_name}}"]);

  const unbounded = cloneValid();
  unbounded.presentation.summary = "안녕{{child_name}}님";
  assertProblems(unbounded, ["must be separated from letters, numbers, or _"]);

  const bounded = cloneValid();
  bounded.presentation.summary = "안녕, {{child_name}}! 함께 떠나자.";
  assert.doesNotThrow(() => parseExperienceGraph(bounded));
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
