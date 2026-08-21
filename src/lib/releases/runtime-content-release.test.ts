import assert from 'node:assert/strict';
import {
  createHash,
  generateKeyPairSync,
  sign as signBytes,
  type KeyObject,
} from 'node:crypto';
import test from 'node:test';

import {
  CONTENT_RELEASE_CANONICALIZATION,
  canonicalizeReleaseJson,
  getContentReleaseApprovalScopePayload,
  getContentReleaseManifestPayload,
  getContentReleaseSignaturePayload,
  parseContentRelease,
  parseContentReleaseUnsigned,
  type ContentRelease,
  type ContentReleaseUnsigned,
} from '@/contracts/content-release.v1';
import { validContentReleaseUnsignedFixture } from '@/contracts/fixtures/content-release.v1.fixtures';
import { validExperienceGraphFixture } from '@/contracts/fixtures/experience-graph.v1.fixtures';
import { parseExperienceGraph } from '@/contracts/experience-graph.v1';
import type { StoryChatRoomRecord } from '@/types/story-chat-api';
import {
  VerifiedContentReleaseGraphLoader,
  VerifiedStoryGraphProvider,
  createDeadlineFetch,
  isAllowedPrivateReleaseSignedUrl,
  readBoundedReleaseResponse,
  type ContentReleaseRuntimeRegistry,
  type PrivateReleaseObjectStore,
  type RuntimeContentReleaseRecord,
  type RuntimeTrustedReleaseKeyRecord,
} from './runtime-content-release';
import { sha256Canonical } from './verify-content-release';

const SIGNED_AT = '2026-08-20T06:01:00.000Z';
const VERIFIED_AT = '2026-08-20T07:00:00.000Z';

test('loads one exact activated release through reusable loader and story adapter', async () => {
  const bundle = buildBundle();
  const loader = createLoader(bundle);
  const snapshot = await loader.load(bundle.room);

  assert.ok(snapshot);
  assert.equal(snapshot.release.releaseId, bundle.release.releaseId);
  assert.equal(snapshot.graph.experienceId, bundle.release.experienceId);

  const provider = new VerifiedStoryGraphProvider(loader);
  assert.deepEqual(await provider.loadApprovedGraph(bundle.room), {
    releaseId: bundle.release.releaseId,
    releaseManifestSha256: bundle.release.manifestSha256,
    graph: snapshot.graph,
  });
});

test('fails closed on a changed manifest signature even when registry object metadata is changed too', async () => {
  const bundle = buildBundle();
  const manifest = structuredClone(bundle.release);
  manifest.signature.value = `${manifest.signature.value.slice(0, -1)}${
    manifest.signature.value.endsWith('A') ? 'B' : 'A'
  }`;
  const manifestBytes = bytes(canonicalizeReleaseJson(manifest));
  bundle.objects.set(bundle.record.manifestStorageKey, manifestBytes);
  bundle.record.manifestObjectSha256 = sha256Bytes(manifestBytes);
  bundle.record.manifestSizeBytes = manifestBytes.byteLength;

  assert.equal(await createLoader(bundle).load(bundle.room), null);
});

test('fails closed on changed graph bytes, non-canonical manifest bytes, or wrong channel', async () => {
  const graphMismatch = buildBundle();
  graphMismatch.objects.set(
    graphMismatch.record.graphStorageKey,
    bytes(`${canonicalizeReleaseJson(graphMismatch.graph)}\n`),
  );
  assert.equal(await createLoader(graphMismatch).load(graphMismatch.room), null);

  const nonCanonical = buildBundle();
  const prettyManifest = bytes(JSON.stringify(nonCanonical.release, null, 2));
  nonCanonical.objects.set(nonCanonical.record.manifestStorageKey, prettyManifest);
  nonCanonical.record.manifestObjectSha256 = sha256Bytes(prettyManifest);
  nonCanonical.record.manifestSizeBytes = prettyManifest.byteLength;
  assert.equal(await createLoader(nonCanonical).load(nonCanonical.room), null);

  const wrongChannel = buildBundle();
  assert.equal(
    await createLoader(wrongChannel, { channel: 'staging' }).load(wrongChannel.room),
    null,
  );
});

test('fails closed when the signing key is absent, channel-scoped away, or revoked', async () => {
  const absent = buildBundle();
  absent.trustedKey = null;
  assert.equal(await createLoader(absent).load(absent.room), null);

  const scopedAway = buildBundle();
  assert.ok(scopedAway.trustedKey);
  scopedAway.trustedKey.allowedChannels = ['staging'];
  assert.equal(await createLoader(scopedAway).load(scopedAway.room), null);

  const revoked = buildBundle();
  assert.ok(revoked.trustedKey);
  revoked.trustedKey.revokedAt = '2026-08-20T06:30:00.000Z';
  assert.equal(await createLoader(revoked).load(revoked.room), null);
});

test('fails closed when release or key eligibility changes during object verification', async () => {
  const bundle = buildBundle();
  assert.equal(
    await createLoader(bundle, { confirmEligibility: false }).load(bundle.room),
    null,
  );
});

test('bounded release response requires exact Content-Length and counts streamed bytes', async () => {
  const exact = streamResponse([bytes('abc'), bytes('def')], '6');
  const exactBytes = await readBoundedReleaseResponse(exact, {
    expectedSizeBytes: 6,
    maximumBytes: 8,
  });
  assert.ok(exactBytes);
  assert.deepEqual([...exactBytes], [...bytes('abcdef')]);

  let preflightAborted = false;
  const oversized = streamResponse([bytes('too large')], '9');
  assert.equal(await readBoundedReleaseResponse(oversized, {
    expectedSizeBytes: 6,
    maximumBytes: 8,
    abort: () => { preflightAborted = true; },
  }), null);
  assert.equal(preflightAborted, true);

  let counterAborted = false;
  const lyingLength = streamResponse([bytes('abcdef'), bytes('!')], '6');
  assert.equal(await readBoundedReleaseResponse(lyingLength, {
    expectedSizeBytes: 6,
    maximumBytes: 8,
    abort: () => { counterAborted = true; },
  }), null);
  assert.equal(counterAborted, true);

  const missingLength = streamResponse([bytes('abcdef')], null);
  assert.equal(await readBoundedReleaseResponse(missingLength, {
    expectedSizeBytes: 6,
    maximumBytes: 8,
  }), null);
});

test('bounded release response cancels a stalled stream on abort', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream<Uint8Array>({
    pull: () => new Promise<void>(() => undefined),
    cancel: () => { cancelled = true; },
  }), {
    status: 200,
    headers: { 'content-length': '1' },
  });
  const controller = new AbortController();
  const result = readBoundedReleaseResponse(response, {
    expectedSizeBytes: 1,
    maximumBytes: 1,
    signal: controller.signal,
  });
  controller.abort();
  assert.equal(await result, null);
  assert.equal(cancelled, true);
});

test('deadline fetch aborts a stalled storage control-plane request', async () => {
  let observedAbort = false;
  const hangingFetch: typeof fetch = (_resource, init) => new Promise<Response>(
    (_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        observedAbort = true;
        reject(init.signal?.reason);
      }, { once: true });
    },
  );

  await assert.rejects(
    createDeadlineFetch(5, hangingFetch)('https://example.supabase.co/storage/v1/object/sign'),
  );
  assert.equal(observedAbort, true);
});

test('deadline fetch also aborts when headers arrive but the JSON body stalls', async () => {
  let bodyCancelled = false;
  const headersThenStall: typeof fetch = async () => new Response(
    new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => undefined),
      cancel: () => { bodyCancelled = true; },
    }),
    {
      status: 200,
      headers: {
        'content-length': '1',
        'content-type': 'application/json',
      },
    },
  );

  const response = await createDeadlineFetch(5, headersThenStall)(
    'https://example.supabase.co/storage/v1/object/sign',
  );
  await assert.rejects(response.json());
  assert.equal(bodyCancelled, true);
});

test('private release signed URLs stay on the configured storage origin', () => {
  const origin = 'https://example.supabase.co';
  assert.equal(isAllowedPrivateReleaseSignedUrl(
    `${origin}/storage/v1/object/sign/content-releases/release.json?token=secret`,
    origin,
  ), true);
  assert.equal(isAllowedPrivateReleaseSignedUrl(
    'https://attacker.invalid/storage/v1/object/sign/content-releases/release.json',
    origin,
  ), false);
  assert.equal(isAllowedPrivateReleaseSignedUrl(
    `${origin}/storage/v1/object/sign/content-releases/release.json#secret`,
    origin,
  ), false);
  assert.equal(isAllowedPrivateReleaseSignedUrl(
    `${origin}/storage/v1/object/public/content-releases/release.json`,
    origin,
  ), false);
});

type TestBundle = ReturnType<typeof buildBundle>;

function buildBundle() {
  const keys = generateKeyPairSync('ed25519');
  const graph = structuredClone(parseExperienceGraph(validExperienceGraphFixture));
  const graphBytes = bytes(canonicalizeReleaseJson(graph));
  const graphSha256 = sha256Bytes(graphBytes);
  const unsigned = cloneUnsigned();

  unsigned.graph.sha256 = graphSha256;
  unsigned.graph.sizeBytes = graphBytes.byteLength;
  const graphArtifact = unsigned.artifacts.find(
    ({ artifactId }) => artifactId === unsigned.graph.artifactId,
  );
  assert.ok(graphArtifact);
  graphArtifact.sha256 = graphSha256;
  graphArtifact.sizeBytes = graphBytes.byteLength;
  for (const approval of unsigned.approvals) {
    if (approval.gate === 'G2') approval.subjectSha256 = graphSha256;
  }

  unsigned.approvalScopeSha256 = sha256Canonical(
    getContentReleaseApprovalScopePayload(unsigned),
  );
  for (const approval of unsigned.approvals) {
    if (approval.gate === 'G5') {
      approval.subjectSha256 = unsigned.approvalScopeSha256;
    }
  }

  const release = signFixture(parseContentReleaseUnsigned(unsigned), keys.privateKey);
  const manifestBytes = bytes(canonicalizeReleaseJson(release));
  const manifestStorageKey =
    `releases/${release.experienceId}/${release.releaseVersion}/content-release.json`;
  const record: RuntimeContentReleaseRecord = {
    releaseId: release.releaseId,
    experienceId: release.experienceId,
    releaseVersion: release.releaseVersion,
    channel: release.channel,
    manifestSha256: release.manifestSha256,
    manifestObjectSha256: sha256Bytes(manifestBytes),
    manifestSizeBytes: manifestBytes.byteLength,
    manifestStorageKey,
    graphSha256,
    graphSizeBytes: graphBytes.byteLength,
    graphStorageKey: release.graph.storageKey,
    signatureKeyId: release.signature.keyId,
    assetsVerifiedAt: VERIFIED_AT,
    activationSequence: 1,
  };
  const trustedKey: RuntimeTrustedReleaseKeyRecord = {
    keyId: release.signature.keyId,
    issuer: 'mori-studio',
    audience: 'kindy-web',
    publicKey: keys.publicKey,
    allowedChannels: ['production'],
    validFrom: '2026-08-20T00:00:00.000Z',
    validUntil: '2026-08-21T00:00:00.000Z',
  };
  const room: StoryChatRoomRecord = {
    id: '63ab7d15-d6c0-4932-8434-b8e698aef7a5',
    childId: '698b8877-dff3-44a5-948d-a80bfde19c81',
    experienceId: release.experienceId,
    releaseId: release.releaseId,
    releaseVersion: release.releaseVersion,
    releaseChannel: 'production',
    releaseManifestSha256: release.manifestSha256,
    currentNodeId: graph.chatGraph.entryNodeId,
    status: 'awaiting_child',
    revision: 0,
    messageSequence: 0,
    createdAt: VERIFIED_AT,
    updatedAt: VERIFIED_AT,
  };

  return {
    release,
    graph,
    graphBytes,
    record,
    trustedKey: trustedKey as RuntimeTrustedReleaseKeyRecord | null,
    room,
    objects: new Map<string, Uint8Array>([
      [manifestStorageKey, manifestBytes],
      [release.graph.storageKey, graphBytes],
    ]),
  };
}

function createLoader(
  bundle: TestBundle,
  options: {
    channel?: 'staging' | 'production';
    confirmEligibility?: boolean;
  } = {},
): VerifiedContentReleaseGraphLoader {
  const registry: ContentReleaseRuntimeRegistry = {
    async findEligibleRelease() {
      return bundle.record;
    },
    async findTrustedKey() {
      return bundle.trustedKey;
    },
    async confirmEligibility() {
      return options.confirmEligibility ?? true;
    },
  };
  const objectStore: PrivateReleaseObjectStore = {
    async readObject(input) {
      return bundle.objects.get(input.storageKey) ?? null;
    },
  };
  return new VerifiedContentReleaseGraphLoader({
    registry,
    objectStore,
    channel: options.channel ?? 'production',
    now: () => new Date(VERIFIED_AT),
  });
}

function cloneUnsigned(): ContentReleaseUnsigned {
  return structuredClone(parseContentReleaseUnsigned(validContentReleaseUnsignedFixture));
}

function signFixture(unsigned: ContentReleaseUnsigned, privateKey: KeyObject): ContentRelease {
  const manifestSha256 = sha256Canonical(getContentReleaseManifestPayload(unsigned));
  const signature = {
    algorithm: 'ed25519' as const,
    canonicalization: CONTENT_RELEASE_CANONICALIZATION,
    keyId: 'release-key.primary',
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
    bytes(canonicalizeReleaseJson(signaturePayload)),
    privateKey,
  ).toString('base64url');
  return parseContentRelease({
    ...unsigned,
    manifestSha256,
    signature: { ...signature, value },
  });
}

function bytes(value: string): Uint8Array {
  return Buffer.from(value, 'utf8');
}

function sha256Bytes(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function streamResponse(chunks: Uint8Array[], contentLength: string | null): Response {
  const headers = new Headers();
  if (contentLength !== null) headers.set('content-length', contentLength);
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  }), { status: 200, headers });
}
