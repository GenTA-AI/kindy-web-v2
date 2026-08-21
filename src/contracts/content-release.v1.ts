import { z } from "zod";

/**
 * ContentRelease v1 is authored by Mori Studio and consumed by Kindy.
 * Keep this file byte-identical in both repositories. Cryptographic signing
 * and verification live in server-only modules; this file is the pure contract
 * and canonical payload definition shared by Zod 3 and Zod 4 runtimes.
 */

export const CONTENT_RELEASE_SCHEMA_VERSION = "content-release/v1" as const;
export const CONTENT_RELEASE_CANONICALIZATION = "kindy-json/v1" as const;
export const CONTENT_RELEASE_ISSUER = "mori-studio" as const;
export const CONTENT_RELEASE_AUDIENCE = "kindy-web" as const;

const OpaqueIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/);

const SemanticVersionSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
    "releaseVersion must be canonical semantic x.y.z",
  )
  .refine(
    (value) => value.split(".").every(isSafeSemanticVersionComponent),
    "releaseVersion component exceeds JavaScript safe integer range",
  );

function isSafeSemanticVersionComponent(value: string): boolean {
  return value.length < 16 || (
    value.length === 16 && value <= String(Number.MAX_SAFE_INTEGER)
  );
}

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const PositiveSafeIntegerSchema = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER);

const UtcTimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  .refine(
    (value) => {
      const instant = new Date(value);
      return Number.isFinite(instant.valueOf()) && instant.toISOString() === value;
    },
    "invalid or non-canonical UTC timestamp",
  );

const StorageKeySchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^releases\/[a-zA-Z0-9._\/-]+$/)
  .refine(
    (value) =>
      !value.includes("..") &&
      !value.includes("//") &&
      !value.includes("/./") &&
      !value.endsWith("/"),
    "storageKey must be a normalized immutable object path",
  );

export const ReleaseGateSchema = z.enum(["G0", "G1", "G2", "G3", "G4", "G5"]);
export type ReleaseGate = z.infer<typeof ReleaseGateSchema>;

export const ReleaseArtifactTypeSchema = z.enum([
  "rights_evidence",
  "story_premise",
  "experience_graph",
  "keyframe_manifest",
  "media_manifest",
  "release_candidate",
  "safety_report",
  "accessibility_report",
]);
export type ReleaseArtifactType = z.infer<typeof ReleaseArtifactTypeSchema>;

export const ReleaseReviewerRoleSchema = z.enum([
  "rights",
  "editorial",
  "education",
  "safety",
  "media",
  "accessibility",
  "release_owner",
]);
export type ReleaseReviewerRole = z.infer<typeof ReleaseReviewerRoleSchema>;

export const ContentReleaseGraphReferenceSchema = z
  .object({
    artifactId: OpaqueIdSchema,
    schemaVersion: z.literal("experience-graph/v1"),
    storageKey: StorageKeySchema,
    sha256: Sha256Schema,
    sizeBytes: PositiveSafeIntegerSchema,
  })
  .strict();

export const ContentReleaseArtifactSchema = z
  .object({
    artifactId: OpaqueIdSchema,
    artifactType: ReleaseArtifactTypeSchema,
    schemaVersion: z.string().min(1).max(100),
    storageKey: StorageKeySchema,
    mimeType: z.string().min(1).max(100),
    sha256: Sha256Schema,
    sizeBytes: PositiveSafeIntegerSchema,
  })
  .strict();

const ContentReleaseAssetCommonShape = {
  assetId: OpaqueIdSchema,
  storageKey: StorageKeySchema,
  sha256: Sha256Schema,
  sizeBytes: PositiveSafeIntegerSchema,
};

export const ContentReleaseAssetSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...ContentReleaseAssetCommonShape,
      kind: z.literal("image"),
      mimeType: z.enum(["image/avif", "image/jpeg", "image/png", "image/webp"]),
      width: PositiveSafeIntegerSchema.max(16_384),
      height: PositiveSafeIntegerSchema.max(16_384),
    })
    .strict(),
  z
    .object({
      ...ContentReleaseAssetCommonShape,
      kind: z.literal("avatar"),
      mimeType: z.enum(["image/avif", "image/png", "image/webp"]),
      width: PositiveSafeIntegerSchema.max(4_096),
      height: PositiveSafeIntegerSchema.max(4_096),
    })
    .strict(),
  z
    .object({
      ...ContentReleaseAssetCommonShape,
      kind: z.literal("sprite"),
      mimeType: z.enum(["image/avif", "image/png", "image/webp"]),
      width: PositiveSafeIntegerSchema.max(16_384),
      height: PositiveSafeIntegerSchema.max(16_384),
    })
    .strict(),
  z
    .object({
      ...ContentReleaseAssetCommonShape,
      kind: z.literal("video"),
      mimeType: z.enum(["video/mp4", "video/webm"]),
      width: PositiveSafeIntegerSchema.max(7_680),
      height: PositiveSafeIntegerSchema.max(7_680),
      durationMs: PositiveSafeIntegerSchema.max(30 * 60 * 1_000),
    })
    .strict(),
  z
    .object({
      ...ContentReleaseAssetCommonShape,
      kind: z.literal("audio"),
      mimeType: z.enum(["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav"]),
      durationMs: PositiveSafeIntegerSchema.max(30 * 60 * 1_000),
    })
    .strict(),
  z
    .object({
      ...ContentReleaseAssetCommonShape,
      kind: z.literal("subtitle"),
      mimeType: z.literal("text/vtt"),
    })
    .strict(),
]);

export const ContentReleaseApprovalSchema = z
  .object({
    gate: ReleaseGateSchema,
    subjectId: OpaqueIdSchema,
    subjectSha256: Sha256Schema,
    decision: z.literal("approved"),
    approverId: OpaqueIdSchema,
    reviewerRole: ReleaseReviewerRoleSchema,
    policyVersion: z.string().min(1).max(100),
    approvedAt: UtcTimestampSchema,
  })
  .strict();

export const ContentReleasePinsSchema = z
  .object({
    modelRegistrySha256: Sha256Schema,
    promptRegistrySha256: Sha256Schema,
    policyRegistrySha256: Sha256Schema,
  })
  .strict();

export const ContentReleaseSignatureSchema = z
  .object({
    algorithm: z.literal("ed25519"),
    canonicalization: z.literal(CONTENT_RELEASE_CANONICALIZATION),
    keyId: OpaqueIdSchema,
    signedAt: UtcTimestampSchema,
    value: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
  })
  .strict();

const ContentReleaseUnsignedShapeSchema = z
  .object({
    schemaVersion: z.literal(CONTENT_RELEASE_SCHEMA_VERSION),
    issuer: z.literal(CONTENT_RELEASE_ISSUER),
    audience: z.literal(CONTENT_RELEASE_AUDIENCE),
    releaseId: OpaqueIdSchema,
    experienceId: OpaqueIdSchema,
    releaseVersion: SemanticVersionSchema,
    channel: z.enum(["staging", "production"]),
    preparedAt: UtcTimestampSchema,
    finalizedAt: UtcTimestampSchema,
    graph: ContentReleaseGraphReferenceSchema,
    artifacts: z.array(ContentReleaseArtifactSchema).length(8),
    assets: z.array(ContentReleaseAssetSchema).max(1_000),
    approvals: z.array(ContentReleaseApprovalSchema).length(9),
    pins: ContentReleasePinsSchema,
    approvalScopeSha256: Sha256Schema,
  })
  .strict();

type ContentReleaseUnsignedShape = z.infer<typeof ContentReleaseUnsignedShapeSchema>;

export const ContentReleaseUnsignedSchema = ContentReleaseUnsignedShapeSchema.superRefine(
  (release, ctx) => addReleaseProblems(release, ctx),
);

export type ContentReleaseUnsigned = z.infer<typeof ContentReleaseUnsignedSchema>;

const ContentReleaseShapeSchema = ContentReleaseUnsignedShapeSchema.extend({
  manifestSha256: Sha256Schema,
  signature: ContentReleaseSignatureSchema,
}).strict();

export const ContentReleaseSchema = ContentReleaseShapeSchema.superRefine((release, ctx) => {
  addReleaseProblems(release, ctx);
  if (Date.parse(release.signature.signedAt) < Date.parse(release.finalizedAt)) {
    ctx.addIssue({
      code: "custom",
      path: ["signature", "signedAt"],
      message: "signature must be created after release finalization",
    });
  }
});

export type ContentRelease = z.infer<typeof ContentReleaseSchema>;

export function parseContentReleaseUnsigned(input: unknown): ContentReleaseUnsigned {
  return ContentReleaseUnsignedSchema.parse(input);
}

export function parseContentRelease(input: unknown): ContentRelease {
  return ContentReleaseSchema.parse(input);
}

/** Core manifest bytes are hashed before a signature envelope is attached. */
export function getContentReleaseManifestPayload(
  release: ContentRelease | ContentReleaseUnsigned,
): ContentReleaseUnsigned {
  return {
    schemaVersion: release.schemaVersion,
    issuer: release.issuer,
    audience: release.audience,
    releaseId: release.releaseId,
    experienceId: release.experienceId,
    releaseVersion: release.releaseVersion,
    channel: release.channel,
    preparedAt: release.preparedAt,
    finalizedAt: release.finalizedAt,
    graph: release.graph,
    artifacts: [...release.artifacts].sort((left, right) =>
      compareCanonicalText(left.artifactId, right.artifactId),
    ),
    assets: [...release.assets].sort((left, right) =>
      compareCanonicalText(left.assetId, right.assetId),
    ),
    approvals: [...release.approvals].sort(
      (left, right) =>
        compareCanonicalText(left.gate, right.gate) ||
        compareCanonicalText(left.reviewerRole, right.reviewerRole) ||
        compareCanonicalText(left.approverId, right.approverId),
    ),
    pins: release.pins,
    approvalScopeSha256: release.approvalScopeSha256,
  };
}

export type ContentReleaseApprovalScopeInput = Pick<
  ContentReleaseUnsigned,
  | "schemaVersion"
  | "issuer"
  | "audience"
  | "releaseId"
  | "experienceId"
  | "releaseVersion"
  | "channel"
  | "preparedAt"
  | "graph"
  | "artifacts"
  | "assets"
  | "pins"
>;

/** Immutable release core approved by G5, excluding the approvals themselves. */
export function getContentReleaseApprovalScopePayload(
  release: ContentReleaseApprovalScopeInput,
) {
  return {
    schemaVersion: release.schemaVersion,
    issuer: release.issuer,
    audience: release.audience,
    releaseId: release.releaseId,
    experienceId: release.experienceId,
    releaseVersion: release.releaseVersion,
    channel: release.channel,
    preparedAt: release.preparedAt,
    graph: release.graph,
    artifacts: [...release.artifacts].sort((left, right) =>
      compareCanonicalText(left.artifactId, right.artifactId),
    ),
    assets: [...release.assets].sort((left, right) =>
      compareCanonicalText(left.assetId, right.assetId),
    ),
    pins: release.pins,
  } as const;
}

export type ContentReleaseSignaturePayloadInput = {
  schemaVersion: typeof CONTENT_RELEASE_SCHEMA_VERSION;
  releaseId: string;
  manifestSha256: string;
  signature: Pick<
    ContentRelease["signature"],
    "algorithm" | "canonicalization" | "keyId" | "signedAt"
  >;
};

/** The Ed25519 signature covers the manifest hash and its signing metadata. */
export function getContentReleaseSignaturePayload(
  release: ContentReleaseSignaturePayloadInput,
) {
  return {
    schemaVersion: release.schemaVersion,
    releaseId: release.releaseId,
    manifestSha256: release.manifestSha256,
    signature: {
      algorithm: release.signature.algorithm,
      canonicalization: release.signature.canonicalization,
      keyId: release.signature.keyId,
      signedAt: release.signature.signedAt,
    },
  } as const;
}

/**
 * Deterministic JSON for the schema's JSON-safe values. Object keys are sorted,
 * array order is preserved, and unsupported values fail closed.
 */
export function canonicalizeReleaseJson(value: unknown): string {
  return canonicalizeReleaseValue(value, new Set<object>());
}

function canonicalizeReleaseValue(
  value: unknown,
  ancestors: Set<object>,
): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError("canonical JSON accepts only safe integers");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new TypeError("canonical JSON rejects cycles");
    ancestors.add(value);
    const items: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) throw new TypeError("canonical JSON rejects sparse arrays");
      items.push(canonicalizeReleaseValue(value[index], ancestors));
    }
    ancestors.delete(value);
    return `[${items.join(",")}]`;
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("canonical JSON accepts only plain objects");
    }
    if (ancestors.has(value)) throw new TypeError("canonical JSON rejects cycles");
    ancestors.add(value);
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map(
        (key) => {
          if (record[key] === undefined) {
            throw new TypeError("canonical JSON rejects undefined values");
          }
          return `${JSON.stringify(key)}:${canonicalizeReleaseValue(record[key], ancestors)}`;
        },
      );
    ancestors.delete(value);
    return `{${entries.join(",")}}`;
  }
  throw new TypeError(`canonical JSON rejects ${typeof value}`);
}

const REQUIRED_GATES: readonly ReleaseGate[] = ["G0", "G1", "G2", "G3", "G4", "G5"];

const GATE_ARTIFACT_TYPES: Record<Exclude<ReleaseGate, "G5">, ReleaseArtifactType> = {
  G0: "rights_evidence",
  G1: "story_premise",
  G2: "experience_graph",
  G3: "keyframe_manifest",
  G4: "media_manifest",
};

const REQUIRED_ARTIFACT_TYPES: readonly ReleaseArtifactType[] = [
  "rights_evidence",
  "story_premise",
  "experience_graph",
  "keyframe_manifest",
  "media_manifest",
  "release_candidate",
  "safety_report",
  "accessibility_report",
];

const REQUIRED_REVIEWER_ROLES: Record<ReleaseGate, readonly ReleaseReviewerRole[]> = {
  G0: ["rights"],
  G1: ["editorial"],
  G2: ["education", "safety"],
  G3: ["media"],
  G4: ["accessibility", "safety"],
  G5: ["release_owner", "safety"],
};

function addReleaseProblems(
  release: ContentReleaseUnsignedShape,
  ctx: z.RefinementCtx,
): void {
  if (Date.parse(release.finalizedAt) < Date.parse(release.preparedAt)) {
    addIssue(ctx, ["finalizedAt"], "release cannot be finalized before preparation");
  }
  const prefix = `releases/${release.experienceId}/${release.releaseVersion}/`;
  const artifacts = new Map<string, ContentReleaseUnsignedShape["artifacts"][number]>();
  const artifactStorageKeys = new Set<string>();
  const artifactTypes = new Set<ReleaseArtifactType>();
  release.artifacts.forEach((artifact, index) => {
    if (artifacts.has(artifact.artifactId)) {
      addIssue(ctx, ["artifacts", index, "artifactId"], `duplicate artifact id: ${artifact.artifactId}`);
    }
    artifacts.set(artifact.artifactId, artifact);
    if (artifactTypes.has(artifact.artifactType)) {
      addIssue(ctx, ["artifacts", index, "artifactType"], `duplicate artifact type: ${artifact.artifactType}`);
    }
    artifactTypes.add(artifact.artifactType);
    if (artifactStorageKeys.has(artifact.storageKey)) {
      addIssue(ctx, ["artifacts", index, "storageKey"], `duplicate artifact storageKey: ${artifact.storageKey}`);
    }
    artifactStorageKeys.add(artifact.storageKey);
    if (!artifact.storageKey.startsWith(prefix)) {
      addIssue(ctx, ["artifacts", index, "storageKey"], `artifact must stay under ${prefix}`);
    }
  });

  const assetIds = new Set<string>();
  const assetStorageKeys = new Set<string>();
  release.assets.forEach((asset, index) => {
    if (assetIds.has(asset.assetId)) {
      addIssue(ctx, ["assets", index, "assetId"], `duplicate asset id: ${asset.assetId}`);
    }
    assetIds.add(asset.assetId);
    if (assetStorageKeys.has(asset.storageKey)) {
      addIssue(ctx, ["assets", index, "storageKey"], `duplicate asset storageKey: ${asset.storageKey}`);
    }
    assetStorageKeys.add(asset.storageKey);
    if (artifactStorageKeys.has(asset.storageKey)) {
      addIssue(ctx, ["assets", index, "storageKey"], "asset storageKey collides with an artifact");
    }
    if (!asset.storageKey.startsWith(prefix)) {
      addIssue(ctx, ["assets", index, "storageKey"], `asset must stay under ${prefix}`);
    }
  });

  if (!release.graph.storageKey.startsWith(prefix)) {
    addIssue(ctx, ["graph", "storageKey"], `graph must stay under ${prefix}`);
  }
  const graphArtifact = artifacts.get(release.graph.artifactId);
  if (graphArtifact?.artifactType !== "experience_graph") {
    addIssue(ctx, ["graph", "artifactId"], "graph artifact must reference experience_graph");
  } else if (
    graphArtifact.storageKey !== release.graph.storageKey ||
    graphArtifact.sha256 !== release.graph.sha256 ||
    graphArtifact.sizeBytes !== release.graph.sizeBytes ||
    graphArtifact.schemaVersion !== release.graph.schemaVersion
  ) {
    addIssue(ctx, ["graph"], "graph reference must exactly match its artifact");
  }

  const approvalKeys = new Set<string>();
  release.approvals.forEach((approval, index) => {
    const approvalKey = `${approval.gate}:${approval.reviewerRole}`;
    if (approvalKeys.has(approvalKey)) {
      addIssue(ctx, ["approvals", index, "reviewerRole"], `duplicate approval role: ${approvalKey}`);
    }
    approvalKeys.add(approvalKey);

    if (approval.gate === "G5") {
      if (approval.subjectId !== release.releaseId) {
        addIssue(ctx, ["approvals", index, "subjectId"], "G5 must approve the release id");
      }
      if (approval.subjectSha256 !== release.approvalScopeSha256) {
        addIssue(ctx, ["approvals", index, "subjectSha256"], "G5 release scope hash is stale");
      }
    } else {
      const subject = artifacts.get(approval.subjectId);
      if (subject === undefined) {
        addIssue(ctx, ["approvals", index, "subjectId"], `approval subject is not an artifact: ${approval.subjectId}`);
      } else {
        const expectedType = GATE_ARTIFACT_TYPES[approval.gate];
        if (subject.artifactType !== expectedType) {
          addIssue(
            ctx,
            ["approvals", index, "subjectId"],
            `${approval.gate} must approve ${expectedType}`,
          );
        }
        if (subject.sha256 !== approval.subjectSha256) {
          addIssue(ctx, ["approvals", index, "subjectSha256"], "approval hash is stale");
        }
      }
    }

    const approvedAt = Date.parse(approval.approvedAt);
    const preparedAt = Date.parse(release.preparedAt);
    const finalizedAt = Date.parse(release.finalizedAt);
    if (approvedAt > finalizedAt) {
      addIssue(ctx, ["approvals", index, "approvedAt"], "approval cannot be newer than release finalization");
    }
    if (approval.gate === "G5" && approvedAt < preparedAt) {
      addIssue(ctx, ["approvals", index, "approvedAt"], "G5 approval cannot predate release preparation");
    }
    if (approval.gate !== "G5" && approvedAt > preparedAt) {
      addIssue(ctx, ["approvals", index, "approvedAt"], `${approval.gate} approval must precede release preparation`);
    }
  });

  for (const gate of REQUIRED_GATES) {
    for (const reviewerRole of REQUIRED_REVIEWER_ROLES[gate]) {
      if (!approvalKeys.has(`${gate}:${reviewerRole}`)) {
        addIssue(ctx, ["approvals"], `missing required approval: ${gate}:${reviewerRole}`);
      }
    }
  }
  const g5Approvers = release.approvals
    .filter((approval) => approval.gate === "G5")
    .map((approval) => approval.approverId);
  if (new Set(g5Approvers).size !== g5Approvers.length) {
    addIssue(ctx, ["approvals"], "G5 release owner and safety reviewer must be different people");
  }
  for (let gateIndex = 0; gateIndex < REQUIRED_GATES.length - 1; gateIndex += 1) {
    const currentGate = REQUIRED_GATES[gateIndex];
    const nextGate = REQUIRED_GATES[gateIndex + 1];
    const currentTimes = release.approvals
      .filter((approval) => approval.gate === currentGate)
      .map((approval) => Date.parse(approval.approvedAt));
    const nextTimes = release.approvals
      .filter((approval) => approval.gate === nextGate)
      .map((approval) => Date.parse(approval.approvedAt));
    if (
      currentTimes.length > 0 &&
      nextTimes.length > 0 &&
      Math.max(...currentTimes) > Math.min(...nextTimes)
    ) {
      addIssue(ctx, ["approvals"], `${currentGate} approvals must precede ${nextGate}`);
    }
  }
  for (const expectedType of REQUIRED_ARTIFACT_TYPES) {
    if (!release.artifacts.some((artifact) => artifact.artifactType === expectedType)) {
      addIssue(ctx, ["artifacts"], `missing required artifact type: ${expectedType}`);
    }
  }
}

function compareCanonicalText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function addIssue(
  ctx: z.RefinementCtx,
  path: Array<string | number>,
  message: string,
): void {
  ctx.addIssue({ code: "custom", path, message });
}
