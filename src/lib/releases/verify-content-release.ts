import {
  createHash,
  createPublicKey,
  timingSafeEqual,
  verify as verifySignature,
  type KeyObject,
} from "node:crypto";

import {
  canonicalizeReleaseJson,
  getContentReleaseApprovalScopePayload,
  getContentReleaseManifestPayload,
  getContentReleaseSignaturePayload,
  parseContentRelease,
  type ContentRelease,
} from "@/contracts/content-release.v1";
import {
  parseExperienceGraph,
  type ExperienceGraph,
} from "@/contracts/experience-graph.v1";

export type ContentReleaseVerificationCode =
  | "invalid_manifest"
  | "invalid_experience_graph"
  | "approval_scope_mismatch"
  | "manifest_hash_mismatch"
  | "release_identity_mismatch"
  | "key_not_trusted"
  | "signature_invalid"
  | "graph_bytes_mismatch"
  | "graph_identity_mismatch"
  | "asset_manifest_mismatch"
  | "asset_bytes_mismatch";

export class ContentReleaseVerificationError extends Error {
  readonly code: ContentReleaseVerificationCode;

  constructor(code: ContentReleaseVerificationCode, options?: { cause?: unknown }) {
    super(code, options);
    this.name = "ContentReleaseVerificationError";
    this.code = code;
  }
}

export type VerifyContentReleaseInput = {
  manifestBytes: Uint8Array;
  experienceGraphBytes: Uint8Array;
  assetBytesById: Readonly<Record<string, Uint8Array>>;
  expectedRelease: Pick<
    ContentRelease,
    "releaseId" | "experienceId" | "releaseVersion" | "channel"
  >;
  trustedKey: TrustedReleaseKey;
  verificationTime?: string;
};

export type VerifyContentReleaseGraphInput = Omit<
  VerifyContentReleaseInput,
  "assetBytesById"
>;

export type TrustedReleaseKey = {
  keyId: string;
  publicKey: KeyObject | string | Buffer;
  allowedChannels: readonly ContentRelease["channel"][];
  validFrom: string;
  validUntil: string;
  revokedAt?: string;
};

const verifiedContentReleaseBrand = Symbol("VerifiedContentRelease");
const verifiedContentReleaseGraphBrand = Symbol("VerifiedContentReleaseGraph");

export type VerifiedContentReleaseGraph = {
  release: ContentRelease;
  experienceGraph: ExperienceGraph;
  readonly [verifiedContentReleaseGraphBrand]: true;
};

export type VerifiedContentRelease = {
  release: ContentRelease;
  experienceGraph: ExperienceGraph;
  readonly [verifiedContentReleaseBrand]: true;
};

/**
 * Fail-closed ingest verification for a complete immutable release bundle.
 * The verifier accepts actual bytes only and computes every hash and byte count
 * internally; caller-supplied object metadata cannot produce the verified brand.
 */
export function verifyContentRelease(
  input: VerifyContentReleaseInput,
): VerifiedContentRelease {
  const verified = verifyContentReleaseGraph(input);
  assertActualAssetBytes(verified.release, input.assetBytesById);

  return {
    release: verified.release,
    experienceGraph: verified.experienceGraph,
    [verifiedContentReleaseBrand]: true,
  };
}

/**
 * Runtime verification for the signed manifest and the exact graph bytes.
 *
 * This does not attest media bytes. The registry may only admit a release
 * after `verifyContentRelease` has checked the complete immutable bundle;
 * runtime calls then re-check the manifest signature and graph bytes before
 * resolving authored chat transitions.
 */
export function verifyContentReleaseGraph(
  input: VerifyContentReleaseGraphInput,
): VerifiedContentReleaseGraph {
  const release = parseManifestBytes(input.manifestBytes);
  const experienceGraph = parseGraphBytes(input.experienceGraphBytes);

  const expectedApprovalScopeHash = sha256Canonical(
    getContentReleaseApprovalScopePayload(release),
  );
  if (!equalSha256(release.approvalScopeSha256, expectedApprovalScopeHash)) {
    throw new ContentReleaseVerificationError("approval_scope_mismatch");
  }

  const expectedManifestHash = sha256Canonical(
    getContentReleaseManifestPayload(release),
  );
  if (!equalSha256(release.manifestSha256, expectedManifestHash)) {
    throw new ContentReleaseVerificationError("manifest_hash_mismatch");
  }

  assertExpectedRelease(release, input.expectedRelease);
  assertTrustedKey(release, input.trustedKey, input.verificationTime);

  const publicKey = normalizeEd25519PublicKey(input.trustedKey.publicKey);
  const signaturePayload = Buffer.from(
    canonicalizeReleaseJson(getContentReleaseSignaturePayload(release)),
    "utf8",
  );
  const signatureBytes = Buffer.from(release.signature.value, "base64url");
  if (
    signatureBytes.length !== 64 ||
    signatureBytes.toString("base64url") !== release.signature.value ||
    !verifySignature(null, signaturePayload, publicKey, signatureBytes)
  ) {
    throw new ContentReleaseVerificationError("signature_invalid");
  }

  if (!matchesActualBytes(input.experienceGraphBytes, release.graph)) {
    throw new ContentReleaseVerificationError("graph_bytes_mismatch");
  }
  if (
    experienceGraph.experienceId !== release.experienceId ||
    experienceGraph.releaseVersion !== release.releaseVersion
  ) {
    throw new ContentReleaseVerificationError("graph_identity_mismatch");
  }

  assertAssetManifestMatches(release, experienceGraph);

  return {
    release,
    experienceGraph,
    [verifiedContentReleaseGraphBrand]: true,
  };
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256")
    .update(canonicalizeReleaseJson(value), "utf8")
    .digest("hex");
}

export function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseManifestBytes(input: Uint8Array): ContentRelease {
  try {
    return parseContentRelease(parseCanonicalJsonBytes(input));
  } catch (cause) {
    throw new ContentReleaseVerificationError("invalid_manifest", { cause });
  }
}

function parseGraphBytes(input: Uint8Array): ExperienceGraph {
  try {
    return parseExperienceGraph(parseCanonicalJsonBytes(input));
  } catch (cause) {
    throw new ContentReleaseVerificationError("invalid_experience_graph", {
      cause,
    });
  }
}

function parseCanonicalJsonBytes(input: Uint8Array): unknown {
  if (!(input instanceof Uint8Array) || input.byteLength < 1) {
    throw new Error("release object bytes are required");
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(input);
  const parsed: unknown = JSON.parse(text);
  if (canonicalizeReleaseJson(parsed) !== text) {
    throw new Error("release object must use canonical JSON bytes");
  }
  return parsed;
}

function normalizeEd25519PublicKey(
  input: KeyObject | string | Buffer,
): KeyObject {
  try {
    let key: KeyObject;
    if (typeof input === "string" || Buffer.isBuffer(input)) {
      key = createPublicKey(input);
    } else {
      key = input.type === "public" ? input : createPublicKey(input);
    }
    if (key.asymmetricKeyType !== "ed25519") {
      throw new Error("release key must be Ed25519");
    }
    return key;
  } catch (cause) {
    throw new ContentReleaseVerificationError("signature_invalid", { cause });
  }
}

function assertExpectedRelease(
  release: ContentRelease,
  expected: VerifyContentReleaseInput["expectedRelease"],
): void {
  if (
    release.releaseId !== expected.releaseId ||
    release.experienceId !== expected.experienceId ||
    release.releaseVersion !== expected.releaseVersion ||
    release.channel !== expected.channel
  ) {
    throw new ContentReleaseVerificationError("release_identity_mismatch");
  }
}

function assertTrustedKey(
  release: ContentRelease,
  trustedKey: TrustedReleaseKey,
  verificationTime = new Date().toISOString(),
): void {
  const signedAt = Date.parse(release.signature.signedAt);
  const validFrom = Date.parse(trustedKey.validFrom);
  const validUntil = Date.parse(trustedKey.validUntil);
  const verifiedAt = Date.parse(verificationTime);
  const revokedAt = trustedKey.revokedAt === undefined
    ? undefined
    : Date.parse(trustedKey.revokedAt);
  if (
    release.signature.keyId !== trustedKey.keyId ||
    !trustedKey.allowedChannels.includes(release.channel) ||
    !Number.isFinite(validFrom) ||
    !Number.isFinite(validUntil) ||
    !Number.isFinite(verifiedAt) ||
    signedAt < validFrom ||
    signedAt > validUntil ||
    signedAt > verifiedAt + 5 * 60 * 1_000 ||
    (revokedAt !== undefined && (!Number.isFinite(revokedAt) || verifiedAt >= revokedAt))
  ) {
    throw new ContentReleaseVerificationError("key_not_trusted");
  }
}

function assertAssetManifestMatches(
  release: ContentRelease,
  graph: ExperienceGraph,
): void {
  if (release.assets.length !== graph.mediaManifest.assets.length) {
    throw new ContentReleaseVerificationError("asset_manifest_mismatch");
  }

  const graphAssets = new Map(
    graph.mediaManifest.assets.map((asset) => [asset.id, asset] as const),
  );
  for (const releaseAsset of release.assets) {
    const graphAsset = graphAssets.get(releaseAsset.assetId);
    if (
      graphAsset === undefined ||
      graphAsset.kind !== releaseAsset.kind ||
      graphAsset.storageKey !== releaseAsset.storageKey ||
      graphAsset.mimeType !== releaseAsset.mimeType ||
      graphAsset.sha256 !== releaseAsset.sha256 ||
      graphAsset.width !== getOptionalNumber(releaseAsset, "width") ||
      graphAsset.height !== getOptionalNumber(releaseAsset, "height") ||
      graphAsset.durationMs !== getOptionalNumber(releaseAsset, "durationMs")
    ) {
      throw new ContentReleaseVerificationError("asset_manifest_mismatch");
    }
  }
}

function assertActualAssetBytes(
  release: ContentRelease,
  actualBytesById: Readonly<Record<string, Uint8Array>>,
): void {
  const expectedIds = release.assets.map((asset) => asset.assetId).sort();
  const actualIds = Object.keys(actualBytesById).sort();
  if (
    expectedIds.length !== actualIds.length ||
    expectedIds.some((assetId, index) => assetId !== actualIds[index])
  ) {
    throw new ContentReleaseVerificationError("asset_bytes_mismatch");
  }

  for (const asset of release.assets) {
    const actual = actualBytesById[asset.assetId];
    if (!(actual instanceof Uint8Array) || !matchesActualBytes(actual, asset)) {
      throw new ContentReleaseVerificationError("asset_bytes_mismatch");
    }
  }
}

function matchesActualBytes(
  actual: Uint8Array,
  expected: { sha256: string; sizeBytes: number },
): boolean {
  return (
    actual.byteLength === expected.sizeBytes &&
    equalSha256(sha256Bytes(actual), expected.sha256)
  );
}

function getOptionalNumber(
  value: object,
  property: "width" | "height" | "durationMs",
): number | undefined {
  return property in value
    ? (value as Record<typeof property, number>)[property]
    : undefined;
}

function equalSha256(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
