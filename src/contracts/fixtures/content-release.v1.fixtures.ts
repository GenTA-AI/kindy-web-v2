const RELEASE_PREFIX = "releases/world.seurat-river/1.0.0";
const EXPERIENCE_GRAPH_SHA256 =
  "1a6aa6c50022b46ab95acdf5efd1b5d50fa2136ea867fcd35a53920c4587f699";
const EXPERIENCE_GRAPH_SIZE_BYTES = 7_635;

const artifact = (
  artifactId: string,
  artifactType:
    | "rights_evidence"
    | "story_premise"
    | "experience_graph"
    | "keyframe_manifest"
    | "media_manifest"
    | "release_candidate"
    | "safety_report"
    | "accessibility_report",
  schemaVersion: string,
  fileName: string,
  sha256: string,
  sizeBytes: number,
) => ({
  artifactId,
  artifactType,
  schemaVersion,
  storageKey: `${RELEASE_PREFIX}/${fileName}`,
  mimeType: "application/json",
  sha256,
  sizeBytes,
});

const artifacts = [
  artifact(
    "artifact.rights",
    "rights_evidence",
    "rights-evidence/v1",
    "rights.json",
    "1111111111111111111111111111111111111111111111111111111111111111",
    1_100,
  ),
  artifact(
    "artifact.premise",
    "story_premise",
    "story-premise/v1",
    "premise.json",
    "2222222222222222222222222222222222222222222222222222222222222222",
    1_200,
  ),
  artifact(
    "artifact.graph",
    "experience_graph",
    "experience-graph/v1",
    "experience-graph.json",
    EXPERIENCE_GRAPH_SHA256,
    EXPERIENCE_GRAPH_SIZE_BYTES,
  ),
  artifact(
    "artifact.keyframes",
    "keyframe_manifest",
    "keyframe-manifest/v1",
    "keyframes.json",
    "4444444444444444444444444444444444444444444444444444444444444444",
    2_400,
  ),
  artifact(
    "artifact.media",
    "media_manifest",
    "media-manifest/v1",
    "media.json",
    "5555555555555555555555555555555555555555555555555555555555555555",
    3_500,
  ),
  artifact(
    "artifact.candidate",
    "release_candidate",
    "release-candidate/v1",
    "candidate.json",
    "6666666666666666666666666666666666666666666666666666666666666666",
    2_600,
  ),
  artifact(
    "artifact.safety",
    "safety_report",
    "safety-report/v1",
    "safety.json",
    "7777777777777777777777777777777777777777777777777777777777777777",
    1_700,
  ),
  artifact(
    "artifact.accessibility",
    "accessibility_report",
    "accessibility-report/v1",
    "accessibility.json",
    "8888888888888888888888888888888888888888888888888888888888888888",
    1_800,
  ),
] as const;

const gateApproval = (
  gate: "G0" | "G1" | "G2" | "G3" | "G4" | "G5",
  reviewerRole:
    | "rights"
    | "editorial"
    | "education"
    | "safety"
    | "media"
    | "accessibility"
    | "release_owner",
  subjectId: string,
  subjectSha256: string,
  approvedAt: string,
  approverId = `reviewer.${reviewerRole}`,
) => ({
  gate,
  subjectId,
  subjectSha256,
  decision: "approved" as const,
  approverId,
  reviewerRole,
  policyVersion: "release-policy-v1",
  approvedAt,
});

export const validContentReleaseUnsignedFixture = {
  schemaVersion: "content-release/v1",
  issuer: "mori-studio",
  audience: "kindy-web",
  releaseId: "release.world.seurat-river.1-0-0",
  experienceId: "world.seurat-river",
  releaseVersion: "1.0.0",
  channel: "production",
  preparedAt: "2026-08-20T05:20:00.000Z",
  finalizedAt: "2026-08-20T06:00:00.000Z",
  graph: {
    artifactId: "artifact.graph",
    schemaVersion: "experience-graph/v1",
    storageKey: `${RELEASE_PREFIX}/experience-graph.json`,
    sha256: EXPERIENCE_GRAPH_SHA256,
    sizeBytes: EXPERIENCE_GRAPH_SIZE_BYTES,
  },
  artifacts,
  assets: [
    {
      assetId: "media.mori-avatar",
      kind: "avatar",
      storageKey: `${RELEASE_PREFIX}/mori.webp`,
      mimeType: "image/webp",
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sizeBytes: 24_000,
      width: 512,
      height: 512,
    },
    {
      assetId: "media.river-light",
      kind: "video",
      storageKey: `${RELEASE_PREFIX}/river-light.mp4`,
      mimeType: "video/mp4",
      sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      sizeBytes: 2_400_000,
      width: 1080,
      height: 1920,
      durationMs: 12_000,
    },
    {
      assetId: "media.river-light-poster",
      kind: "image",
      storageKey: `${RELEASE_PREFIX}/river-light-poster.webp`,
      mimeType: "image/webp",
      sha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      sizeBytes: 210_000,
      width: 1080,
      height: 1920,
    },
    {
      assetId: "media.river-light-subtitles",
      kind: "subtitle",
      storageKey: `${RELEASE_PREFIX}/river-light.ko.vtt`,
      mimeType: "text/vtt",
      sha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      sizeBytes: 8_000,
    },
    {
      assetId: "media.sun-card",
      kind: "image",
      storageKey: `${RELEASE_PREFIX}/sun-card.webp`,
      mimeType: "image/webp",
      sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      sizeBytes: 180_000,
      width: 800,
      height: 1_000,
    },
    {
      assetId: "media.world-cover",
      kind: "image",
      storageKey: `${RELEASE_PREFIX}/world-cover.webp`,
      mimeType: "image/webp",
      sha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      sizeBytes: 260_000,
      width: 1080,
      height: 1920,
    },
  ],
  approvals: [
    gateApproval("G0", "rights", "artifact.rights", artifacts[0].sha256, "2026-08-20T01:00:00.000Z"),
    gateApproval("G1", "editorial", "artifact.premise", artifacts[1].sha256, "2026-08-20T02:00:00.000Z"),
    gateApproval("G2", "education", "artifact.graph", artifacts[2].sha256, "2026-08-20T03:00:00.000Z"),
    gateApproval("G2", "safety", "artifact.graph", artifacts[2].sha256, "2026-08-20T03:10:00.000Z"),
    gateApproval("G3", "media", "artifact.keyframes", artifacts[3].sha256, "2026-08-20T04:00:00.000Z"),
    gateApproval("G4", "accessibility", "artifact.media", artifacts[4].sha256, "2026-08-20T05:00:00.000Z"),
    gateApproval("G4", "safety", "artifact.media", artifacts[4].sha256, "2026-08-20T05:10:00.000Z"),
    gateApproval(
      "G5",
      "release_owner",
      "release.world.seurat-river.1-0-0",
      "97ac97644a656c8089b23c4caa0ed0deec32632631a487c26809a44588c1bf05",
      "2026-08-20T05:30:00.000Z",
    ),
    gateApproval(
      "G5",
      "safety",
      "release.world.seurat-river.1-0-0",
      "97ac97644a656c8089b23c4caa0ed0deec32632631a487c26809a44588c1bf05",
      "2026-08-20T05:40:00.000Z",
      "reviewer.final-safety",
    ),
  ],
  pins: {
    modelRegistrySha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    promptRegistrySha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    policyRegistrySha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  },
  approvalScopeSha256: "97ac97644a656c8089b23c4caa0ed0deec32632631a487c26809a44588c1bf05",
} as const;
