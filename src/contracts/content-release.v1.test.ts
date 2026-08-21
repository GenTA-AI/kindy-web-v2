import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  sign as signBytes,
  type KeyObject,
} from "node:crypto";
import test from "node:test";

import {
  CONTENT_RELEASE_CANONICALIZATION,
  ContentReleaseUnsignedSchema,
  canonicalizeReleaseJson,
  getContentReleaseApprovalScopePayload,
  getContentReleaseManifestPayload,
  getContentReleaseSignaturePayload,
  parseContentRelease,
  parseContentReleaseUnsigned,
  type ContentRelease,
  type ContentReleaseUnsigned,
} from "./content-release.v1";
import { validContentReleaseUnsignedFixture } from "./fixtures/content-release.v1.fixtures";
import { validExperienceGraphFixture } from "./fixtures/experience-graph.v1.fixtures";
import { parseExperienceGraph } from "./experience-graph.v1";
import {
  ContentReleaseVerificationError,
  sha256Canonical,
  verifyContentRelease,
  type TrustedReleaseKey,
  type VerifyContentReleaseInput,
} from "../lib/releases/verify-content-release";

const SIGNED_AT = "2026-08-20T06:01:00.000Z";
const VERIFIED_AT = "2026-08-20T07:00:00.000Z";

test("ContentRelease v1 binds all artifacts, reviewer roles, and the G5 release scope", () => {
  const release = parseContentReleaseUnsigned(validContentReleaseUnsignedFixture);

  assert.equal(release.artifacts.length, 8);
  assert.equal(release.approvals.length, 9);
  assert.deepEqual(
    new Set(release.approvals.map(({ gate, reviewerRole }) => `${gate}:${reviewerRole}`)),
    new Set([
      "G0:rights",
      "G1:editorial",
      "G2:education",
      "G2:safety",
      "G3:media",
      "G4:accessibility",
      "G4:safety",
      "G5:release_owner",
      "G5:safety",
    ]),
  );
  assert.equal(
    sha256Canonical(getContentReleaseApprovalScopePayload(release)),
    release.approvalScopeSha256,
  );
});

test("rejects stale approvals, missing roles, duplicate reviewers, and unsafe numbers", () => {
  const staleArtifact = cloneUnsigned();
  staleArtifact.approvals[0].subjectSha256 = "f".repeat(64);
  assertProblems(staleArtifact, ["approval hash is stale"]);

  const missingRole = cloneUnsigned();
  missingRole.approvals[2].reviewerRole = "safety";
  assertProblems(missingRole, ["duplicate approval role", "missing required approval: G2:education"]);

  const sameFinalReviewer = cloneUnsigned();
  const finalApprovals = sameFinalReviewer.approvals.filter(({ gate }) => gate === "G5");
  finalApprovals[1].approverId = finalApprovals[0].approverId;
  assertProblems(sameFinalReviewer, ["must be different people"]);

  const unsafeInteger = cloneUnsigned();
  unsafeInteger.assets[0].sizeBytes = Number.MAX_SAFE_INTEGER + 1;
  assert.equal(ContentReleaseUnsignedSchema.safeParse(unsafeInteger).success, false);
});

test("rejects non-canonical time, version, storage, and kind-specific media metadata", () => {
  for (const releaseVersion of ["01.0.0", "1.00.0", "1.0.01"]) {
    const input = { ...cloneUnsigned(), releaseVersion };
    assert.equal(ContentReleaseUnsignedSchema.safeParse(input).success, false);
  }

  const invalidDate = { ...cloneUnsigned(), finalizedAt: "2026-02-30T06:00:00.000Z" };
  assert.equal(ContentReleaseUnsignedSchema.safeParse(invalidDate).success, false);

  const unnormalizedStorage = cloneUnsigned();
  unnormalizedStorage.assets[0].storageKey =
    "releases/world.seurat-river/1.0.0//mori.webp";
  assert.equal(ContentReleaseUnsignedSchema.safeParse(unnormalizedStorage).success, false);

  const videoWithoutDuration = cloneUnsigned() as unknown as {
    assets: Array<Record<string, unknown>>;
  };
  delete videoWithoutDuration.assets[1].durationMs;
  assert.equal(ContentReleaseUnsignedSchema.safeParse(videoWithoutDuration).success, false);
});

test("enforces G0-G4 → prepare → G5 → finalize ordering", () => {
  const earlyG5 = cloneUnsigned();
  const g5 = earlyG5.approvals.find((approval) => approval.gate === "G5");
  assert.ok(g5);
  g5.approvedAt = "2026-08-20T05:00:00.000Z";
  assertProblems(earlyG5, ["G5 approval cannot predate release preparation"]);

  const lateG4 = cloneUnsigned();
  const g4 = lateG4.approvals.find((approval) => approval.gate === "G4");
  assert.ok(g4);
  g4.approvedAt = "2026-08-20T05:25:00.000Z";
  assertProblems(lateG4, ["G4 approval must precede release preparation"]);

  const impossibleFinalization = cloneUnsigned();
  impossibleFinalization.finalizedAt = "2026-08-20T05:19:00.000Z";
  assertProblems(impossibleFinalization, ["cannot be finalized before preparation"]);
});

test("canonical bytes are order-stable and reject non-JSON or ambiguous values", () => {
  const release = cloneUnsigned();
  const reordered = cloneUnsigned();
  reordered.artifacts.reverse();
  reordered.assets.reverse();
  reordered.approvals.reverse();

  assert.equal(
    sha256Canonical(getContentReleaseManifestPayload(release)),
    sha256Canonical(getContentReleaseManifestPayload(reordered)),
  );
  assert.throws(() => canonicalizeReleaseJson({ value: undefined }), /undefined/);
  assert.throws(() => canonicalizeReleaseJson(new Date()), /plain objects/);
  assert.throws(() => canonicalizeReleaseJson(Number.MAX_SAFE_INTEGER + 1), /safe integers/);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalizeReleaseJson(cyclic), /cycles/);
});

test("verifies an exact pinned release, Ed25519 key, graph, and asset byte set", () => {
  const keys = generateKeyPairSync("ed25519");
  const signed = signFixture(cloneUnsigned(), keys.privateKey);
  const verified = verifyContentRelease(validVerificationInput(signed, keys.publicKey));

  assert.equal(verified.release.releaseId, signed.releaseId);
  assert.equal(verified.experienceGraph.experienceId, signed.experienceId);
});

test("fails closed when the approved scope, manifest, signature, or pin is changed", () => {
  const keys = generateKeyPairSync("ed25519");
  const signed = signFixture(cloneUnsigned(), keys.privateKey);

  const staleScope = structuredClone(signed);
  staleScope.pins.modelRegistrySha256 = "0".repeat(64);
  assertVerificationCode(
    { ...validVerificationInput(staleScope, keys.publicKey) },
    "approval_scope_mismatch",
  );

  const staleManifest = structuredClone(signed);
  staleManifest.approvals[0].approverId = "reviewer.changed";
  assertVerificationCode(
    { ...validVerificationInput(staleManifest, keys.publicKey) },
    "manifest_hash_mismatch",
  );

  const badSignature = structuredClone(signed);
  badSignature.signature.value = `${signed.signature.value.slice(0, -1)}${
    signed.signature.value.endsWith("A") ? "B" : "A"
  }`;
  assertVerificationCode(
    { ...validVerificationInput(badSignature, keys.publicKey) },
    "signature_invalid",
  );
});

test("rejects a wrong pin, untrusted key, revoked key, or byte mismatch", () => {
  const keys = generateKeyPairSync("ed25519");
  const signed = signFixture(cloneUnsigned(), keys.privateKey);

  const wrongPin = validVerificationInput(signed, keys.publicKey);
  wrongPin.expectedRelease.releaseVersion = "1.0.1";
  assertVerificationCode(wrongPin, "release_identity_mismatch");

  const wrongKey = generateKeyPairSync("ed25519").publicKey;
  assertVerificationCode(
    validVerificationInput(signed, wrongKey),
    "signature_invalid",
  );

  const revoked = validVerificationInput(signed, keys.publicKey);
  revoked.trustedKey.revokedAt = "2026-08-20T06:30:00.000Z";
  assertVerificationCode(revoked, "key_not_trusted");

  const graphMismatch = validVerificationInput(signed, keys.publicKey);
  graphMismatch.observedGraph.sizeBytes += 1;
  assertVerificationCode(graphMismatch, "graph_bytes_mismatch");

  const assetMismatch = validVerificationInput(signed, keys.publicKey);
  assetMismatch.observedAssetsById["media.river-light"].sizeBytes += 1;
  assertVerificationCode(assetMismatch, "asset_bytes_mismatch");
});

test("rejects a graph whose signed media declarations drift from the release", () => {
  const keys = generateKeyPairSync("ed25519");
  const signed = signFixture(cloneUnsigned(), keys.privateKey);
  const input = validVerificationInput(signed, keys.publicKey);
  const graph = structuredClone(parseExperienceGraph(validExperienceGraphFixture));
  graph.mediaManifest.assets[1].storageKey =
    "releases/world.seurat-river/1.0.0/replaced.mp4";
  input.experienceGraph = graph;

  assertVerificationCode(input, "asset_manifest_mismatch");
});

function cloneUnsigned(): ContentReleaseUnsigned {
  return structuredClone(parseContentReleaseUnsigned(validContentReleaseUnsignedFixture));
}

function signFixture(unsigned: ContentReleaseUnsigned, privateKey: KeyObject): ContentRelease {
  const manifestSha256 = sha256Canonical(getContentReleaseManifestPayload(unsigned));
  const signature = {
    algorithm: "ed25519" as const,
    canonicalization: CONTENT_RELEASE_CANONICALIZATION,
    keyId: "release-key.primary",
    signedAt: SIGNED_AT,
  };
  const signaturePayload = getContentReleaseSignaturePayload({
    schemaVersion: unsigned.schemaVersion,
    releaseId: unsigned.releaseId,
    manifestSha256,
    signature,
  });
  const value = signBytes(
    null,
    Buffer.from(canonicalizeReleaseJson(signaturePayload), "utf8"),
    privateKey,
  ).toString("base64url");

  return parseContentRelease({
    ...unsigned,
    manifestSha256,
    signature: { ...signature, value },
  });
}

function validVerificationInput(
  release: ContentRelease,
  publicKey: KeyObject,
): VerifyContentReleaseInput {
  const trustedKey: TrustedReleaseKey = {
    keyId: release.signature.keyId,
    publicKey,
    allowedChannels: ["production"],
    validFrom: "2026-08-20T00:00:00.000Z",
    validUntil: "2026-08-21T00:00:00.000Z",
  };
  return {
    manifest: release,
    experienceGraph: structuredClone(validExperienceGraphFixture),
    observedGraph: {
      sha256: release.graph.sha256,
      sizeBytes: release.graph.sizeBytes,
    },
    observedAssetsById: Object.fromEntries(
      release.assets.map((asset) => [
        asset.assetId,
        { sha256: asset.sha256, sizeBytes: asset.sizeBytes },
      ]),
    ),
    expectedRelease: {
      releaseId: release.releaseId,
      experienceId: release.experienceId,
      releaseVersion: release.releaseVersion,
      channel: release.channel,
    },
    trustedKey,
    verificationTime: VERIFIED_AT,
  };
}

function assertProblems(input: unknown, messages: readonly string[]): void {
  const result = ContentReleaseUnsignedSchema.safeParse(input);
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

function assertVerificationCode(
  input: VerifyContentReleaseInput,
  code: ContentReleaseVerificationError["code"],
): void {
  assert.throws(
    () => verifyContentRelease(input),
    (error) =>
      error instanceof ContentReleaseVerificationError && error.code === code,
  );
}
