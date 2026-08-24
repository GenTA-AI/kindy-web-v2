#!/usr/bin/env node

import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`[kindy-content-release-check] ${message}\n`);
  process.exit(2);
}

function readJson() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    fail("stdin must contain one valid JSON document");
  }
}

function readText() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    fail("stdin could not be read");
  }
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function stringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : null;
}

function sorted(value) {
  return [...value].sort((left, right) => left.localeCompare(right));
}

function sameStrings(actual, expected) {
  const normalized = stringArray(actual);
  if (!normalized || normalized.length !== expected.length) return false;
  return JSON.stringify(sorted(normalized)) === JSON.stringify(sorted(expected));
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function normalizeBucket(raw) {
  return {
    name: raw.name,
    projectNumber: firstDefined(raw.project_number, raw.projectNumber),
    location: raw.location,
    uniformBucketLevelAccess: firstDefined(
      raw.uniform_bucket_level_access,
      raw.uniformBucketLevelAccess,
      raw.iamConfiguration?.uniformBucketLevelAccess?.enabled,
    ),
    publicAccessPrevention: firstDefined(
      raw.public_access_prevention,
      raw.publicAccessPrevention,
      raw.iamConfiguration?.publicAccessPrevention,
    ),
    versioning: firstDefined(
      raw.versioning_enabled,
      raw.versioningEnabled,
      raw.versioning?.enabled,
    ),
    cors: firstDefined(raw.cors_config, raw.corsConfig, raw.cors),
    retentionPolicy: firstDefined(raw.retention_policy, raw.retentionPolicy),
    metageneration: raw.metageneration,
  };
}

function retentionValue(policy, snakeName, camelName) {
  return firstDefined(policy?.[snakeName], policy?.[camelName]);
}

function checkCors(cors, expectedOrigin) {
  assert(Array.isArray(cors) && cors.length === 1, "bucket must have exactly one CORS rule");
  const rule = cors[0];
  assert(
    sameStrings(rule.origin, [expectedOrigin]),
    `CORS origin must be exactly ${expectedOrigin}`,
  );
  assert(sameStrings(rule.method, ["GET", "HEAD"]), "CORS methods must be exactly GET and HEAD");
  assert(
    sameStrings(firstDefined(rule.response_header, rule.responseHeader), ["Content-Type", "Range"]),
    "CORS response headers must be exactly Content-Type and Range",
  );
  assert(
    firstDefined(rule.max_age_seconds, rule.maxAgeSeconds) === 3600,
    "CORS max age must be exactly 3600 seconds",
  );
}

function checkCorsFile(args) {
  const [expectedOrigin, filePath] = args;
  assert(args.length === 2, "cors-file requires origin and file path");
  let cors;
  try {
    cors = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    fail(`could not parse CORS contract file: ${filePath}`);
  }
  checkCors(cors, expectedOrigin);
}

function checkBucketMetadata(args) {
  const [expectedBucket, expectedProjectNumber, expectedLocation, expectedOrigin, expectedRetention, lockMode] = args;
  assert(args.length === 6, "bucket-metadata requires 6 arguments");
  assert(lockMode === "locked" || lockMode === "lock-optional", "invalid retention lock mode");

  const bucket = normalizeBucket(readJson());
  assert(bucket.name === expectedBucket, `bucket name must be exactly ${expectedBucket}`);
  assert(
    String(bucket.projectNumber) === expectedProjectNumber,
    `bucket must be owned by project number ${expectedProjectNumber}`,
  );
  assert(
    String(bucket.location).toUpperCase() === expectedLocation.toUpperCase(),
    `bucket location must be exactly ${expectedLocation}`,
  );
  assert(bucket.uniformBucketLevelAccess === true, "uniform bucket-level access must be enabled");
  assert(bucket.publicAccessPrevention === "enforced", "public access prevention must be enforced");
  assert(bucket.versioning === true, "object versioning must be enabled");
  checkCors(bucket.cors, expectedOrigin);

  const period = retentionValue(bucket.retentionPolicy, "retention_period", "retentionPeriod");
  const locked = retentionValue(bucket.retentionPolicy, "is_locked", "isLocked");
  const effectiveTime = retentionValue(bucket.retentionPolicy, "effective_time", "effectiveTime");
  assert(String(period) === expectedRetention, `retention period must be ${expectedRetention} seconds`);
  assert(typeof effectiveTime === "string" && effectiveTime.length > 0, "retention policy needs an effective time");
  assert(typeof locked === "boolean", "retention lock state must be explicit");
  if (lockMode === "locked") assert(locked, "retention policy must be irreversibly locked");
  assert(/^[1-9][0-9]*$/.test(String(bucket.metageneration)), "bucket metageneration must be a positive integer");
}

function checkBucketBootstrap(args) {
  const [expectedBucket, expectedProjectNumber, expectedLocation, expectedRetention] = args;
  assert(args.length === 4, "bucket-bootstrap requires 4 arguments");
  const bucket = normalizeBucket(readJson());
  assert(bucket.name === expectedBucket, `bucket name must be exactly ${expectedBucket}`);
  assert(
    String(bucket.projectNumber) === expectedProjectNumber,
    `bucket must be owned by project number ${expectedProjectNumber}`,
  );
  assert(
    String(bucket.location).toUpperCase() === expectedLocation.toUpperCase(),
    `existing bucket location must be exactly ${expectedLocation}`,
  );
  assert(/^[1-9][0-9]*$/.test(String(bucket.metageneration)), "bucket metageneration must be positive");

  if (bucket.retentionPolicy !== undefined) {
    const period = retentionValue(bucket.retentionPolicy, "retention_period", "retentionPeriod");
    assert(
      String(period) === expectedRetention,
      `existing retention policy must already equal ${expectedRetention} seconds`,
    );
  }
}

function validateBucketIam(policy, args) {
  const [mode, ownRuntime, ownPublisher, otherRuntime, otherPublisher] = args;
  assert(args.length === 5, "bucket-iam requires 5 arguments");
  assert(
    mode === "exact" || mode === "bootstrap" || mode === "no-writer",
    "bucket IAM mode must be exact, bootstrap, or no-writer",
  );
  assert(
    policy.bindings === undefined || Array.isArray(policy.bindings),
    "bucket IAM bindings must be an array",
  );
  const bindings = policy.bindings ?? [];
  const allowed = [
    ["roles/storage.objectViewer", `serviceAccount:${ownRuntime}`],
    ["roles/storage.objectCreator", `serviceAccount:${ownPublisher}`],
  ];
  const seen = new Set();
  for (const binding of bindings) {
    assert(binding !== null && typeof binding === "object" && !Array.isArray(binding), "bucket IAM binding must be an object");
    assert(
      Object.keys(binding).every((key) => key === "role" || key === "members"),
      "bucket IAM binding contains an unsupported field",
    );
    assert(typeof binding.role === "string", "bucket IAM binding role must be a string");
    assert(binding.condition === undefined, "conditional bucket IAM bindings are forbidden");
    const members = stringArray(binding.members);
    assert(members !== null && members.length === 1, "bucket IAM binding must have exactly one member");
    const match = allowed.find(([role, member]) => role === binding.role && member === members[0]);
    assert(match !== undefined, `unexpected bucket IAM binding: ${binding.role}/${members[0]}`);
    const key = `${binding.role}\u0000${members[0]}`;
    assert(!seen.has(key), "duplicate bucket IAM binding is forbidden");
    seen.add(key);
  }

  for (const [role, member] of allowed) {
    const key = `${role}\u0000${member}`;
    if (mode === "exact") {
      assert(seen.has(key), `${member} must have exactly ${role}`);
    }
  }
  if (mode === "no-writer") {
    assert(
      seen.has(`roles/storage.objectViewer\u0000serviceAccount:${ownRuntime}`),
      "no-writer policy must retain the exact runtime viewer",
    );
    assert(
      !seen.has(`roles/storage.objectCreator\u0000serviceAccount:${ownPublisher}`),
      "no-writer policy must not grant publisher object creation",
    );
    assert(seen.size === 1, "no-writer policy must have exactly one binding");
  }

  assert(
    !bindings.some((binding) =>
      binding.members?.includes(`serviceAccount:${otherRuntime}`)
      || binding.members?.includes(`serviceAccount:${otherPublisher}`)),
    "cross-channel identities are forbidden",
  );
}

function checkBucketIam(args) {
  validateBucketIam(readJson(), args);
}

function renderBucketIam(args) {
  const policy = readJson();
  validateBucketIam(policy, ["bootstrap", ...args]);
  assert(typeof policy.etag === "string" && policy.etag.length > 0, "bucket IAM etag is required");
  const [ownRuntime, ownPublisher] = args;
  process.stdout.write(JSON.stringify({
    version: 3,
    etag: policy.etag,
    bindings: [
      {
        role: "roles/storage.objectCreator",
        members: [`serviceAccount:${ownPublisher}`],
      },
      {
        role: "roles/storage.objectViewer",
        members: [`serviceAccount:${ownRuntime}`],
      },
    ],
  }));
}

function renderNoWriterBucketIam(args) {
  const policy = readJson();
  validateBucketIam(policy, ["bootstrap", ...args]);
  assert(typeof policy.etag === "string" && policy.etag.length > 0, "bucket IAM etag is required");
  const [ownRuntime] = args;
  process.stdout.write(JSON.stringify({
    version: 3,
    etag: policy.etag,
    bindings: [
      {
        role: "roles/storage.objectViewer",
        members: [`serviceAccount:${ownRuntime}`],
      },
    ],
  }));
}

function validateNewBucketIamPolicy(policy, projectId) {
  assert(
    /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId),
    "new bucket project ID is invalid",
  );
  assert(typeof policy.etag === "string" && policy.etag.length > 0, "new bucket IAM etag is required");
  assert(
    policy.bindings === undefined || Array.isArray(policy.bindings),
    "new bucket IAM bindings must be an array",
  );
  const bindings = policy.bindings ?? [];
  const providerDefaults = new Map([
    [
      "roles/storage.legacyBucketOwner",
      [`projectEditor:${projectId}`, `projectOwner:${projectId}`],
    ],
    ["roles/storage.legacyBucketReader", [`projectViewer:${projectId}`]],
    [
      "roles/storage.legacyObjectOwner",
      [`projectEditor:${projectId}`, `projectOwner:${projectId}`],
    ],
    ["roles/storage.legacyObjectReader", [`projectViewer:${projectId}`]],
  ]);
  const seen = new Set();
  for (const binding of bindings) {
    assert(binding !== null && typeof binding === "object" && !Array.isArray(binding), "new bucket IAM binding must be an object");
    assert(
      Object.keys(binding).every((key) => key === "role" || key === "members"),
      "new bucket IAM binding contains an unsupported field",
    );
    assert(typeof binding.role === "string", "new bucket IAM binding role must be a string");
    const expectedMembers = providerDefaults.get(binding.role);
    assert(
      expectedMembers !== undefined,
      `new bucket has a non-provider-default IAM role: ${binding.role}`,
    );
    assert(
      sameStrings(binding.members, expectedMembers),
      `new bucket provider-default IAM members drifted for ${binding.role}`,
    );
    assert(!seen.has(binding.role), "new bucket provider-default IAM role is duplicated");
    seen.add(binding.role);
    assert(binding.condition === undefined, "new bucket must not start with conditional IAM");
  }
  assert(
    seen.size === providerDefaults.size,
    "new bucket provider-default IAM roles are missing",
  );
}

function renderNewBucketIam(args) {
  const [ownRuntime, ownPublisher, projectId] = args;
  assert(
    args.length === 3,
    "render-new-bucket-iam requires runtime, publisher, and project ID",
  );
  const policy = readJson();
  validateNewBucketIamPolicy(policy, projectId);
  process.stdout.write(JSON.stringify({
    version: 3,
    etag: policy.etag,
    bindings: [
      {
        role: "roles/storage.objectCreator",
        members: [`serviceAccount:${ownPublisher}`],
      },
      {
        role: "roles/storage.objectViewer",
        members: [`serviceAccount:${ownRuntime}`],
      },
    ],
  }));
}

function renderNewNoWriterBucketIam(args) {
  const [ownRuntime, , projectId] = args;
  assert(
    args.length === 3,
    "render-new-no-writer-bucket-iam requires runtime, publisher, and project ID",
  );
  const policy = readJson();
  validateNewBucketIamPolicy(policy, projectId);
  process.stdout.write(JSON.stringify({
    version: 3,
    etag: policy.etag,
    bindings: [
      {
        role: "roles/storage.objectViewer",
        members: [`serviceAccount:${ownRuntime}`],
      },
    ],
  }));
}

function checkProjectIam(args) {
  assert(args.length > 0, "project-iam requires protected service accounts");
  const policy = readJson();
  assert(
    policy.bindings === undefined || Array.isArray(policy.bindings),
    "project IAM bindings must be an array",
  );
  const bindings = policy.bindings ?? [];
  const forbiddenImpersonationRoles = new Set([
    "roles/iam.serviceAccountTokenCreator",
    "roles/iam.serviceAccountOpenIdTokenCreator",
    "roles/iam.serviceAccountUser",
    "roles/iam.workloadIdentityUser",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.serviceAccountKeyAdmin",
    "roles/iam.securityAdmin",
    "roles/resourcemanager.projectIamAdmin",
    "roles/editor",
    "roles/owner",
  ]);
  const protectedMembers = new Set(args.map((identity) => `serviceAccount:${identity}`));
  for (const binding of bindings) {
    assert(binding !== null && typeof binding === "object" && !Array.isArray(binding), "project IAM binding must be an object");
    assert(typeof binding.role === "string", "project IAM role must be a string");
    const members = stringArray(binding.members);
    assert(members !== null, "project IAM members must be strings");
    assert(
      !forbiddenImpersonationRoles.has(binding.role),
      `project-level impersonation role is forbidden: ${binding.role}`,
    );
    assert(
      !binding.role.startsWith("projects/") && !binding.role.startsWith("organizations/"),
      `project custom role cannot be proven free of iam.serviceAccounts.* permissions: ${binding.role}`,
    );
    for (const member of members) {
      assert(
        /^(user|serviceAccount):[^\s]+$/.test(member),
        `project IAM member has an indirect or unknown membership path: ${member}`,
      );
      assert(
        !protectedMembers.has(member),
        `${member} must not inherit project-level roles; grant only resource-level permissions`,
      );
    }
  }
  const roleNames = sorted(new Set(bindings.map((binding) => binding.role)));
  for (const roleName of roleNames) {
    assert(
      /^roles\/[A-Za-z0-9.]+$/.test(roleName),
      `project IAM role is not a verifiable predefined role: ${roleName}`,
    );
  }
  process.stdout.write(roleNames.join("\n"));
}

function checkProjectRolePermissions(args) {
  const [expectedRole] = args;
  assert(args.length === 1, "project-role-permissions requires one role name");
  assert(
    /^roles\/[A-Za-z0-9.]+$/.test(expectedRole),
    "project role name must be a predefined role",
  );
  const role = readJson();
  assert(role.name === expectedRole, `described project role must be ${expectedRole}`);
  const permissions = stringArray(role.includedPermissions);
  assert(permissions !== null, `project role permissions are unavailable: ${expectedRole}`);
  const safeReadOnlyPermissions = new Set([
    "iam.serviceAccounts.get",
    "iam.serviceAccounts.getIamPolicy",
    "iam.serviceAccounts.list",
    "iam.serviceAccountKeys.get",
    "iam.serviceAccountKeys.list",
    "iam.roles.get",
    "iam.roles.list",
    "resourcemanager.projects.get",
    "resourcemanager.projects.getIamPolicy",
    "resourcemanager.projects.list",
    "serviceusage.services.get",
    "serviceusage.services.list",
    "storage.buckets.get",
    "storage.buckets.getIamPolicy",
    "storage.buckets.list",
  ]);
  for (const permission of permissions) {
    assert(
      safeReadOnlyPermissions.has(permission),
      `project role permission is outside the exact read-only allowlist: ${expectedRole}/${permission}`,
    );
  }
}

function checkEmptyServiceAccountIam(args) {
  const [identity] = args;
  assert(args.length === 1, "empty-service-account-iam requires one identity");
  const policy = readJson();
  assert(
    policy.bindings === undefined || Array.isArray(policy.bindings),
    "publisher service-account IAM bindings must be an array",
  );
  const bindings = policy.bindings ?? [];
  assert(
    Object.keys(policy).every((key) => key === "bindings" || key === "etag" || key === "version"),
    "publisher service-account IAM contains an unsupported top-level field",
  );
  assert(
    bindings.length === 0,
    `${identity} resource IAM must remain exactly empty`,
  );
}

function extractApiKeyNames(args) {
  assert(args.length === 0, "api-key-names takes no arguments");
  const keys = readJson();
  assert(Array.isArray(keys), "API-key listing must be a JSON array");
  const names = [];
  for (const key of keys) {
    assert(key !== null && typeof key === "object" && !Array.isArray(key), "API-key entry must be an object");
    assert(
      typeof key.name === "string"
        && /^projects\/[1-9][0-9]*\/locations\/global\/keys\/[A-Za-z0-9-]+$/.test(key.name),
      "API-key listing contains an invalid resource name",
    );
    assert(!names.includes(key.name), "API-key listing contains a duplicate resource name");
    names.push(key.name);
  }
  process.stdout.write(sorted(names).join("\n"));
}

function checkApiKeyDescription(args) {
  const [expectedName, ...protectedIdentities] = args;
  assert(
    args.length > 1,
    "api-key-description requires resource name and protected service accounts",
  );
  const key = readJson();
  assert(key !== null && typeof key === "object" && !Array.isArray(key), "API-key description must be an object");
  assert(key.name === expectedName, "API-key description resource name drifted");
  assert(
    key.serviceAccountEmail === undefined || typeof key.serviceAccountEmail === "string",
    "API-key serviceAccountEmail must be a string",
  );
  assert(
    !protectedIdentities.includes(key.serviceAccountEmail),
    `service-account-bound API keys are forbidden: ${key.serviceAccountEmail}`,
  );
}

function checkMultipartEmpty(args) {
  const [expectedBucket] = args;
  assert(args.length === 1, "multipart-empty requires one bucket name");
  assert(/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/.test(expectedBucket), "multipart bucket is invalid");
  const xml = readText();
  assert(xml.length > 0 && xml.length <= 65536, "multipart listing response is outside bounds");
  assert(!/<!DOCTYPE|<!ENTITY/i.test(xml), "multipart listing must not contain a DTD");
  assert(/<ListMultipartUploadsResult(?:\s|>)/.test(xml), "multipart listing root is missing");
  assert(
    xml.includes(`<Bucket>${expectedBucket}</Bucket>`),
    "multipart listing bucket drifted",
  );
  assert(
    /<IsTruncated>\s*false\s*<\/IsTruncated>/.test(xml),
    "multipart listing must be complete",
  );
  assert(!/<Upload(?:\s|>)/.test(xml), "pending multipart upload is forbidden");
  assert(!/<Error(?:\s|>)/.test(xml), "multipart listing returned an error");
}

function validateServiceAccountIam(policy, args) {
  const [mode, runtimeIdentity, signerRole] = args;
  assert(args.length === 3, "service-account-iam requires mode, runtime identity, and signer role");
  assert(mode === "exact" || mode === "bootstrap", "service-account IAM mode must be exact or bootstrap");
  const selfMember = `serviceAccount:${runtimeIdentity}`;
  assert(
    policy.bindings === undefined || Array.isArray(policy.bindings),
    "service-account IAM bindings must be an array",
  );
  const bindings = policy.bindings ?? [];
  assert(bindings.length <= 1, "runtime service-account IAM must contain at most one binding");
  if (bindings.length === 1) {
    const [binding] = bindings;
    assert(binding !== null && typeof binding === "object" && !Array.isArray(binding), "runtime service-account IAM binding must be an object");
    assert(
      Object.keys(binding).every((key) => key === "role" || key === "members"),
      "runtime service-account IAM binding contains an unsupported field",
    );
    assert(binding.condition === undefined, "conditional runtime service-account IAM is forbidden");
    assert(binding.role === signerRole, "runtime service account may only expose the signBlob-only role");
    assert(
      sameStrings(binding.members, [selfMember]),
      "signBlob-only role must have exactly the runtime self member",
    );
  }
  if (mode === "exact") {
    assert(bindings.length === 1, "runtime service-account IAM must contain its self signer binding");
  }
}

function checkServiceAccountIam(args) {
  validateServiceAccountIam(readJson(), args);
}

function renderServiceAccountIam(args) {
  const [runtimeIdentity, signerRole] = args;
  assert(args.length === 2, "render-service-account-iam requires runtime and signer role");
  const policy = readJson();
  validateServiceAccountIam(policy, ["bootstrap", runtimeIdentity, signerRole]);
  assert(typeof policy.etag === "string" && policy.etag.length > 0, "service-account IAM etag is required");
  process.stdout.write(JSON.stringify({
    version: 3,
    etag: policy.etag,
    bindings: [
      {
        role: signerRole,
        members: [`serviceAccount:${runtimeIdentity}`],
      },
    ],
  }));
}

function checkCustomRole(args) {
  const [expectedRoleName] = args;
  assert(args.length === 1, "custom-role requires one exact role name");
  const role = readJson();
  assert(role.name === expectedRoleName, `custom signer role name must be ${expectedRoleName}`);
  assert(
    sameStrings(role.includedPermissions, ["iam.serviceAccounts.signBlob"]),
    "custom signer role must contain only iam.serviceAccounts.signBlob",
  );
  assert(role.stage === "GA", "custom signer role must be GA");
  assert(role.deleted !== true, "custom signer role must not be deleted");
}

function extractMetageneration(args) {
  assert(args.length === 0, "extract-metageneration takes no arguments");
  const bucket = normalizeBucket(readJson());
  assert(/^[1-9][0-9]*$/.test(String(bucket.metageneration)), "bucket metageneration must be positive");
  process.stdout.write(String(bucket.metageneration));
}

function extractLockState(args) {
  assert(args.length === 0, "extract-lock-state takes no arguments");
  const bucket = normalizeBucket(readJson());
  if (bucket.retentionPolicy === undefined) {
    process.stdout.write("absent");
    return;
  }
  const locked = retentionValue(bucket.retentionPolicy, "is_locked", "isLocked");
  assert(typeof locked === "boolean", "retention lock state must be explicit");
  process.stdout.write(locked ? "locked" : "unlocked");
}

function checkLockResponse(args) {
  const [expectedBucket, expectedRetention] = args;
  assert(args.length === 2, "lock-response requires bucket and retention period");
  const bucket = normalizeBucket(readJson());
  assert(bucket.name === expectedBucket, `lock response bucket must be ${expectedBucket}`);
  const period = retentionValue(bucket.retentionPolicy, "retention_period", "retentionPeriod");
  const locked = retentionValue(bucket.retentionPolicy, "is_locked", "isLocked");
  assert(String(period) === expectedRetention, `lock response retention must be ${expectedRetention}`);
  assert(locked === true, "lock response must attest an irreversible lock");
  assert(/^[1-9][0-9]*$/.test(String(bucket.metageneration)), "lock response needs metageneration");
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case "bucket-metadata":
    checkBucketMetadata(args);
    break;
  case "bucket-bootstrap":
    checkBucketBootstrap(args);
    break;
  case "cors-file":
    checkCorsFile(args);
    break;
  case "bucket-iam":
    checkBucketIam(args);
    break;
  case "render-bucket-iam":
    renderBucketIam(args);
    break;
  case "render-no-writer-bucket-iam":
    renderNoWriterBucketIam(args);
    break;
  case "render-new-bucket-iam":
    renderNewBucketIam(args);
    break;
  case "render-new-no-writer-bucket-iam":
    renderNewNoWriterBucketIam(args);
    break;
  case "project-iam":
    checkProjectIam(args);
    break;
  case "project-role-permissions":
    checkProjectRolePermissions(args);
    break;
  case "empty-service-account-iam":
    checkEmptyServiceAccountIam(args);
    break;
  case "api-key-names":
    extractApiKeyNames(args);
    break;
  case "api-key-description":
    checkApiKeyDescription(args);
    break;
  case "multipart-empty":
    checkMultipartEmpty(args);
    break;
  case "service-account-iam":
    checkServiceAccountIam(args);
    break;
  case "render-service-account-iam":
    renderServiceAccountIam(args);
    break;
  case "custom-role":
    checkCustomRole(args);
    break;
  case "extract-metageneration":
    extractMetageneration(args);
    break;
  case "extract-lock-state":
    extractLockState(args);
    break;
  case "lock-response":
    checkLockResponse(args);
    break;
  default:
    fail("unknown check command");
}
