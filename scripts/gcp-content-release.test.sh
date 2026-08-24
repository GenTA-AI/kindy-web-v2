#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1091,SC2329
source "$(dirname "$0")/gcp-content-release.sh"

fail() {
  printf 'gcp-content-release.test: %s\n' "$1" >&2
  exit 1
}

expect_failure() {
  local message="$1"
  shift
  if ("$@" >/dev/null 2>&1); then
    fail "$message"
  fi
}

run_json_check() {
  local json="$1"
  shift
  printf '%s' "$json" | node "$POLICY_CHECKER" "$@"
}

run_text_check() {
  local value="$1"
  shift
  printf '%s' "$value" | node "$POLICY_CHECKER" "$@"
}

VALID_LOCKED_BUCKET='{"name":"kindy-493701-content-releases-staging","project_number":"123456","location":"ASIA-NORTHEAST3","uniform_bucket_level_access":true,"public_access_prevention":"enforced","versioning_enabled":true,"cors_config":[{"origin":["https://kindy-landing-preview-g3d7kdf7ta-du.a.run.app"],"method":["HEAD","GET"],"response_header":["Range","Content-Type"],"max_age_seconds":3600}],"retention_policy":{"effectiveTime":"2026-08-24T00:00:00Z","isLocked":true,"retentionPeriod":"2592000"},"metageneration":"9"}'
VALID_UNLOCKED_BUCKET="${VALID_LOCKED_BUCKET/\"isLocked\":true/\"isLocked\":false}"
WILDCARD_CORS_BUCKET="${VALID_LOCKED_BUCKET/https:\/\/kindy-landing-preview-g3d7kdf7ta-du.a.run.app/*}"

run_json_check "$VALID_LOCKED_BUCKET" bucket-metadata \
  "$STAGING_BUCKET" 123456 "$LOCATION" "$STAGING_ORIGIN" \
  "$RETENTION_PERIOD_SECONDS" locked
run_json_check "$VALID_UNLOCKED_BUCKET" bucket-metadata \
  "$STAGING_BUCKET" 123456 "$LOCATION" "$STAGING_ORIGIN" \
  "$RETENTION_PERIOD_SECONDS" lock-optional
expect_failure 'activation check accepted an unlocked retention policy' \
  run_json_check "$VALID_UNLOCKED_BUCKET" bucket-metadata \
    "$STAGING_BUCKET" 123456 "$LOCATION" "$STAGING_ORIGIN" \
    "$RETENTION_PERIOD_SECONDS" locked
expect_failure 'bucket metadata accepted wildcard CORS' \
  run_json_check "$WILDCARD_CORS_BUCKET" bucket-metadata \
    "$STAGING_BUCKET" 123456 "$LOCATION" "$STAGING_ORIGIN" \
    "$RETENTION_PERIOD_SECONDS" locked

VALID_BUCKET_IAM="{\"bindings\":[{\"role\":\"roles/storage.objectViewer\",\"members\":[\"serviceAccount:${STAGING_RUNTIME_SERVICE_ACCOUNT}\"]},{\"role\":\"roles/storage.objectCreator\",\"members\":[\"serviceAccount:${STAGING_PUBLISHER_SERVICE_ACCOUNT}\"]}]}"
CROSS_CHANNEL_IAM="${VALID_BUCKET_IAM%?},{\"role\":\"roles/storage.objectViewer\",\"members\":[\"serviceAccount:${PRODUCTION_RUNTIME_SERVICE_ACCOUNT}\"]}]}"
ARBITRARY_BUCKET_IAM="${VALID_BUCKET_IAM%?},{\"role\":\"roles/storage.admin\",\"members\":[\"user:operator@example.com\"]}]}"
EXTRA_MEMBER_BUCKET_IAM="{\"bindings\":[{\"role\":\"roles/storage.objectViewer\",\"members\":[\"serviceAccount:${STAGING_RUNTIME_SERVICE_ACCOUNT}\",\"user:extra@example.com\"]},{\"role\":\"roles/storage.objectCreator\",\"members\":[\"serviceAccount:${STAGING_PUBLISHER_SERVICE_ACCOUNT}\"]}]}"
CONDITIONAL_BUCKET_IAM="{\"bindings\":[{\"role\":\"roles/storage.objectViewer\",\"members\":[\"serviceAccount:${STAGING_RUNTIME_SERVICE_ACCOUNT}\"],\"condition\":{\"title\":\"widened\",\"expression\":\"true\"}},{\"role\":\"roles/storage.objectCreator\",\"members\":[\"serviceAccount:${STAGING_PUBLISHER_SERVICE_ACCOUNT}\"]}]}"
run_json_check "$VALID_BUCKET_IAM" bucket-iam exact \
  "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
  "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT"
expect_failure 'bucket IAM accepted a production runtime on staging' \
  run_json_check "$CROSS_CHANNEL_IAM" bucket-iam exact \
    "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
    "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT"
expect_failure 'bucket IAM accepted a missing publisher creator binding' \
  run_json_check '{"bindings":[]}' bucket-iam exact \
    "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
    "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT"
expect_failure 'bucket IAM exact accepted an arbitrary role/principal' \
  run_json_check "$ARBITRARY_BUCKET_IAM" bucket-iam exact \
    "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
    "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT"
expect_failure 'bucket IAM bootstrap accepted an arbitrary role/principal' \
  run_json_check "$ARBITRARY_BUCKET_IAM" bucket-iam bootstrap \
    "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
    "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT"
expect_failure 'bucket IAM accepted an extra member in an allowed role' \
  run_json_check "$EXTRA_MEMBER_BUCKET_IAM" bucket-iam exact \
    "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
    "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT"
expect_failure 'bucket IAM accepted a conditional binding' \
  run_json_check "$CONDITIONAL_BUCKET_IAM" bucket-iam exact \
    "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
    "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT"
run_json_check '{"bindings":[]}' bucket-iam bootstrap \
  "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
  "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT"
PARTIAL_BUCKET_IAM="{\"bindings\":[{\"role\":\"roles/storage.objectViewer\",\"members\":[\"serviceAccount:${STAGING_RUNTIME_SERVICE_ACCOUNT}\"]}]}"
run_json_check "$PARTIAL_BUCKET_IAM" bucket-iam bootstrap \
  "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
  "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT"
run_json_check "$PARTIAL_BUCKET_IAM" bucket-iam no-writer \
  "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
  "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT"
expect_failure 'no-writer bucket IAM accepted publisher object creation' \
  run_json_check "$VALID_BUCKET_IAM" bucket-iam no-writer \
    "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
    "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT"
RENDERED_BUCKET_IAM="$(run_json_check "{\"etag\":\"bucket-etag\",\"bindings\":[]}" \
  render-bucket-iam "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
  "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT")"
run_json_check "$RENDERED_BUCKET_IAM" bucket-iam exact \
  "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
  "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT"
RENDERED_NO_WRITER_IAM="$(run_json_check "{\"etag\":\"bucket-etag\",\"bindings\":[]}" \
  render-no-writer-bucket-iam "$STAGING_RUNTIME_SERVICE_ACCOUNT" \
  "$STAGING_PUBLISHER_SERVICE_ACCOUNT" "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" \
  "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT")"
run_json_check "$RENDERED_NO_WRITER_IAM" bucket-iam no-writer \
  "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
  "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT"
PROVIDER_DEFAULT_BUCKET_IAM="{\"etag\":\"bucket-etag\",\"bindings\":[{\"role\":\"roles/storage.legacyBucketOwner\",\"members\":[\"projectOwner:${PROJECT_ID}\",\"projectEditor:${PROJECT_ID}\"]},{\"role\":\"roles/storage.legacyBucketReader\",\"members\":[\"projectViewer:${PROJECT_ID}\"]},{\"role\":\"roles/storage.legacyObjectOwner\",\"members\":[\"projectEditor:${PROJECT_ID}\",\"projectOwner:${PROJECT_ID}\"]},{\"role\":\"roles/storage.legacyObjectReader\",\"members\":[\"projectViewer:${PROJECT_ID}\"]}]}"
RENDERED_NEW_BUCKET_IAM="$(run_json_check "$PROVIDER_DEFAULT_BUCKET_IAM" \
  render-new-bucket-iam "$STAGING_RUNTIME_SERVICE_ACCOUNT" \
  "$STAGING_PUBLISHER_SERVICE_ACCOUNT" "$PROJECT_ID")"
run_json_check "$RENDERED_NEW_BUCKET_IAM" bucket-iam exact \
  "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
  "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT"
RENDERED_NEW_NO_WRITER_IAM="$(run_json_check "$PROVIDER_DEFAULT_BUCKET_IAM" \
  render-new-no-writer-bucket-iam "$STAGING_RUNTIME_SERVICE_ACCOUNT" \
  "$STAGING_PUBLISHER_SERVICE_ACCOUNT" "$PROJECT_ID")"
run_json_check "$RENDERED_NEW_NO_WRITER_IAM" bucket-iam no-writer \
  "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
  "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT"
expect_failure 'new-bucket IAM renderer accepted a public principal' \
  run_json_check '{"etag":"bucket-etag","bindings":[{"role":"roles/storage.objectViewer","members":["allUsers"]}]}' \
    render-new-bucket-iam "$STAGING_RUNTIME_SERVICE_ACCOUNT" \
    "$STAGING_PUBLISHER_SERVICE_ACCOUNT" "$PROJECT_ID"
expect_failure 'new-bucket IAM renderer accepted attacker storage.admin' \
  run_json_check '{"etag":"bucket-etag","bindings":[{"role":"roles/storage.admin","members":["user:attacker@example.com"]}]}' \
    render-new-bucket-iam "$STAGING_RUNTIME_SERVICE_ACCOUNT" \
    "$STAGING_PUBLISHER_SERVICE_ACCOUNT" "$PROJECT_ID"
expect_failure 'new-bucket IAM renderer accepted drifted provider-default members' \
  run_json_check '{"etag":"bucket-etag","bindings":[{"role":"roles/storage.legacyBucketOwner","members":["projectOwner:attacker-project","projectEditor:attacker-project"]}]}' \
    render-new-bucket-iam "$STAGING_RUNTIME_SERVICE_ACCOUNT" \
    "$STAGING_PUBLISHER_SERVICE_ACCOUNT" "$PROJECT_ID"

run_json_check '{"bindings":[]}' project-iam \
  "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT"
PROJECT_WIDE_IAM="{\"bindings\":[{\"role\":\"roles/storage.admin\",\"members\":[\"serviceAccount:${STAGING_RUNTIME_SERVICE_ACCOUNT}\"]}]}"
expect_failure 'project-level broad storage access was accepted' \
  run_json_check "$PROJECT_WIDE_IAM" project-iam "$STAGING_RUNTIME_SERVICE_ACCOUNT"
PROJECT_TOKEN_CREATOR_IAM='{"bindings":[{"role":"roles/iam.serviceAccountTokenCreator","members":["group:operators@example.com"]}]}'
PROJECT_OIDC_CREATOR_IAM='{"bindings":[{"role":"roles/iam.serviceAccountOpenIdTokenCreator","members":["user:operator@example.com"]}]}'
PROJECT_EDITOR_IAM='{"bindings":[{"role":"roles/editor","members":["user:editor@example.com"]}]}'
PROJECT_WIF_IAM='{"bindings":[{"role":"roles/iam.workloadIdentityUser","members":["principalSet://iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/pool/*"]}]}'
PROJECT_CUSTOM_IAM="{\"bindings\":[{\"role\":\"projects/${PROJECT_ID}/roles/customSafeLooking\",\"members\":[\"user:operator@example.com\"]}]}"
PROJECT_INDIRECT_MEMBER_IAM='{"bindings":[{"role":"roles/viewer","members":["group:readers@example.com"]}]}'
expect_failure 'project IAM accepted project-wide TokenCreator' \
  run_json_check "$PROJECT_TOKEN_CREATOR_IAM" project-iam "$STAGING_RUNTIME_SERVICE_ACCOUNT"
expect_failure 'project IAM accepted OpenIdTokenCreator' \
  run_json_check "$PROJECT_OIDC_CREATOR_IAM" project-iam "$STAGING_RUNTIME_SERVICE_ACCOUNT"
expect_failure 'project IAM accepted primitive Editor' \
  run_json_check "$PROJECT_EDITOR_IAM" project-iam "$STAGING_RUNTIME_SERVICE_ACCOUNT"
expect_failure 'project IAM accepted a workload identity principalSet path' \
  run_json_check "$PROJECT_WIF_IAM" project-iam "$STAGING_RUNTIME_SERVICE_ACCOUNT"
expect_failure 'project IAM accepted an unverifiable custom role' \
  run_json_check "$PROJECT_CUSTOM_IAM" project-iam "$STAGING_RUNTIME_SERVICE_ACCOUNT"
expect_failure 'project IAM accepted an indirect group membership path' \
  run_json_check "$PROJECT_INDIRECT_MEMBER_IAM" project-iam "$STAGING_RUNTIME_SERVICE_ACCOUNT"
run_json_check \
  '{"name":"roles/browser","includedPermissions":["resourcemanager.projects.get","resourcemanager.projects.list"]}' \
  project-role-permissions roles/browser
expect_failure 'role permission proof accepted service-account actAs' \
  run_json_check \
    '{"name":"roles/example.unsafe","includedPermissions":["iam.serviceAccounts.actAs"]}' \
    project-role-permissions roles/example.unsafe
expect_failure 'role permission proof accepted uploaded service-account keys' \
  run_json_check \
    '{"name":"roles/example.unsafe","includedPermissions":["iam.serviceAccountKeys.upload"]}' \
    project-role-permissions roles/example.unsafe
expect_failure 'role permission proof accepted project-wide object creation' \
  run_json_check \
    '{"name":"roles/storage.admin","includedPermissions":["storage.objects.create"]}' \
    project-role-permissions roles/storage.admin
expect_failure 'role permission proof accepted signer custom-role mutation' \
  run_json_check \
    '{"name":"roles/iam.roleAdmin","includedPermissions":["iam.roles.update"]}' \
    project-role-permissions roles/iam.roleAdmin
expect_failure 'role permission proof accepted service-account API-key binding' \
  run_json_check \
    '{"name":"roles/example.unsafe","includedPermissions":["iam.serviceAccountApiKeyBindings.create"]}' \
    project-role-permissions roles/example.unsafe
expect_failure 'role permission proof accepted API-key string access' \
  run_json_check \
    '{"name":"roles/example.unsafe","includedPermissions":["apikeys.keys.getKeyString"]}' \
    project-role-permissions roles/example.unsafe
expect_failure 'role permission proof accepted Cloud Build indirect execution' \
  run_json_check \
    '{"name":"roles/cloudbuild.builds.editor","includedPermissions":["cloudbuild.builds.create"]}' \
    project-role-permissions roles/cloudbuild.builds.editor
expect_failure 'role permission proof accepted Deployment Manager indirect execution' \
  run_json_check \
    '{"name":"roles/deploymentmanager.editor","includedPermissions":["deploymentmanager.deployments.update"]}' \
    project-role-permissions roles/deploymentmanager.editor
expect_failure 'role permission proof accepted service-account HMAC creation' \
  run_json_check \
    '{"name":"roles/storage.hmacKeyAdmin","includedPermissions":["storage.hmacKeys.create"]}' \
    project-role-permissions roles/storage.hmacKeyAdmin

run_json_check '{"etag":"publisher-etag","version":1,"bindings":[]}' \
  empty-service-account-iam "$STAGING_PUBLISHER_SERVICE_ACCOUNT"
expect_failure 'publisher service-account resource IAM accepted a binding' \
  run_json_check \
    '{"bindings":[{"role":"roles/iam.serviceAccountTokenCreator","members":["user:operator@example.com"]}]}' \
    empty-service-account-iam "$STAGING_PUBLISHER_SERVICE_ACCOUNT"

API_KEY_NAME='projects/123/locations/global/keys/12345678-abcd-4321-abcd-1234567890ab'
[[ "$(run_json_check "[{\"name\":\"${API_KEY_NAME}\"}]" api-key-names)" = "$API_KEY_NAME" ]] || \
  fail 'API-key list did not yield its canonical resource name'
run_json_check "{\"name\":\"${API_KEY_NAME}\",\"serviceAccountEmail\":\"unrelated@example.iam.gserviceaccount.com\"}" \
  api-key-description "$API_KEY_NAME" \
  "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT"
expect_failure 'service-account-bound API-key proof accepted a protected runtime key' \
  run_json_check "{\"name\":\"${API_KEY_NAME}\",\"serviceAccountEmail\":\"${STAGING_RUNTIME_SERVICE_ACCOUNT}\"}" \
    api-key-description "$API_KEY_NAME" \
    "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT"

EMPTY_MULTIPART_XML="<?xml version=\"1.0\"?><ListMultipartUploadsResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"><Bucket>${STAGING_BUCKET}</Bucket><KeyMarker></KeyMarker><UploadIdMarker></UploadIdMarker><MaxUploads>1</MaxUploads><IsTruncated>false</IsTruncated></ListMultipartUploadsResult>"
PENDING_MULTIPART_XML="${EMPTY_MULTIPART_XML%</ListMultipartUploadsResult>}<Upload><Key>x</Key><UploadId>id</UploadId></Upload></ListMultipartUploadsResult>"
TRUNCATED_MULTIPART_XML="${EMPTY_MULTIPART_XML/IsTruncated>false/IsTruncated>true}"
run_text_check "$EMPTY_MULTIPART_XML" multipart-empty "$STAGING_BUCKET"
expect_failure 'multipart proof accepted a pending upload' \
  run_text_check "$PENDING_MULTIPART_XML" multipart-empty "$STAGING_BUCKET"
expect_failure 'multipart proof accepted a truncated listing' \
  run_text_check "$TRUNCATED_MULTIPART_XML" multipart-empty "$STAGING_BUCKET"

VALID_RUNTIME_IAM="{\"bindings\":[{\"role\":\"${SIGNER_ROLE}\",\"members\":[\"serviceAccount:${STAGING_RUNTIME_SERVICE_ACCOUNT}\"]}]}"
run_json_check "$VALID_RUNTIME_IAM" service-account-iam exact \
  "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$SIGNER_ROLE"
BROAD_RUNTIME_IAM="${VALID_RUNTIME_IAM%?},{\"role\":\"roles/iam.serviceAccountTokenCreator\",\"members\":[\"user:operator@example.com\"]}]}"
expect_failure 'broad service-account token creator binding was accepted' \
  run_json_check "$BROAD_RUNTIME_IAM" service-account-iam exact \
    "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$SIGNER_ROLE"
SERVICE_ACCOUNT_USER_IAM="${VALID_RUNTIME_IAM%?},{\"role\":\"roles/iam.serviceAccountUser\",\"members\":[\"user:deployer@example.com\"]}]}"
OTHER_CUSTOM_ROLE_IAM="${VALID_RUNTIME_IAM%?},{\"role\":\"projects/${PROJECT_ID}/roles/otherRole\",\"members\":[\"serviceAccount:${STAGING_RUNTIME_SERVICE_ACCOUNT}\"]}]}"
EXTRA_SIGNER_MEMBER_IAM="{\"bindings\":[{\"role\":\"${SIGNER_ROLE}\",\"members\":[\"serviceAccount:${STAGING_RUNTIME_SERVICE_ACCOUNT}\",\"user:extra@example.com\"]}]}"
expect_failure 'service-account IAM bootstrap accepted serviceAccountUser' \
  run_json_check "$SERVICE_ACCOUNT_USER_IAM" service-account-iam bootstrap \
    "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$SIGNER_ROLE"
expect_failure 'service-account IAM exact accepted another custom role' \
  run_json_check "$OTHER_CUSTOM_ROLE_IAM" service-account-iam exact \
    "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$SIGNER_ROLE"
expect_failure 'service-account signer binding accepted an extra member' \
  run_json_check "$EXTRA_SIGNER_MEMBER_IAM" service-account-iam exact \
    "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$SIGNER_ROLE"
run_json_check '{"bindings":[]}' service-account-iam bootstrap \
  "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$SIGNER_ROLE"
RENDERED_RUNTIME_IAM="$(run_json_check '{"etag":"runtime-etag","bindings":[]}' \
  render-service-account-iam "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$SIGNER_ROLE")"
run_json_check "$RENDERED_RUNTIME_IAM" service-account-iam exact \
  "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$SIGNER_ROLE"

VALID_SIGNER_ROLE="{\"name\":\"${SIGNER_ROLE}\",\"includedPermissions\":[\"iam.serviceAccounts.signBlob\"],\"stage\":\"GA\",\"deleted\":false}"
run_json_check "$VALID_SIGNER_ROLE" custom-role "$SIGNER_ROLE"
expect_failure 'custom signer role accepted token-minting permission' \
  run_json_check "{\"name\":\"${SIGNER_ROLE}\",\"includedPermissions\":[\"iam.serviceAccounts.signBlob\",\"iam.serviceAccounts.getAccessToken\"],\"stage\":\"GA\"}" \
    custom-role "$SIGNER_ROLE"

# `plan` is deliberately offline and must never dispatch gcloud.
# shellcheck disable=SC2329
gcloud() {
  fail 'plan unexpectedly called gcloud'
}
plan_output="$(plan_channel staging)"
[[ "$plan_output" = *'retention_lock=HARD_DISABLED_UNAPPROVED_IRREVERSIBLE_MUTATION'* ]] || \
  fail 'plan does not expose the hard-disabled irreversible lock'
[[ "$plan_output" = *'publisher_runner=UNWIRED_ACTIVATION_BLOCKER'* ]] || \
  fail 'plan did not expose the missing publisher runner as an activation blocker'
[[ "$plan_output" = *'bootstrap_mutations=HARD_DISABLED_PENDING_SEPARATE_PROJECT_AND_8_DAY_QUARANTINE'* ]] || \
  fail 'plan did not expose the hard-disabled bootstrap and quarantine blocker'

BOOTSTRAP_CALL_LOG="$(mktemp)"
(
  # shellcheck disable=SC2329
  gcloud() { printf '%s\n' "$*" >>"$BOOTSTRAP_CALL_LOG"; }
  expect_failure 'bootstrap mutation entry point was not hard-disabled' \
    bootstrap_channel staging
)
[[ ! -s "$BOOTSTRAP_CALL_LOG" ]] || \
  fail 'hard-disabled bootstrap dispatched gcloud before failing'
: >"$BOOTSTRAP_CALL_LOG"
(
  # shellcheck disable=SC2329
  gcloud() { printf '%s\n' "$*" >>"$BOOTSTRAP_CALL_LOG"; }
  expect_failure 'retention-lock command entry point was not hard-disabled' \
    lock_retention_command staging 9
)
[[ ! -s "$BOOTSTRAP_CALL_LOG" ]] || \
  fail 'hard-disabled retention lock dispatched gcloud before failing'
rm -f "$BOOTSTRAP_CALL_LOG"

expect_failure 'invalid channel was accepted' bucket_for_channel preview
if declare -F publish_create >/dev/null || declare -F validate_storage_key >/dev/null; then
  fail 'unwired publisher command or storage-key helper remains callable'
fi
if declare -f usage main | rg -q -- 'publish-create|impersonate-service-account'; then
  fail 'CLI still advertises an unproven publisher credential path'
fi

expect_failure 'bootstrap proceeded without apply confirmation' \
  assert_bootstrap_confirmation staging
KINDY_GCS_APPLY=1 \
KINDY_GCS_CONFIRM="BOOTSTRAP:staging:${STAGING_BUCKET}" \
  assert_bootstrap_confirmation staging

expect_failure 'retention lock proceeded without irreversible confirmation' \
  assert_retention_lock_confirmation "$STAGING_BUCKET" 9
KINDY_GCS_ALLOW_IRREVERSIBLE=1 \
KINDY_GCS_CONFIRM_RETENTION_LOCK="LOCK_RETENTION:${STAGING_BUCKET}:${RETENTION_PERIOD_SECONDS}:9" \
  assert_retention_lock_confirmation "$STAGING_BUCKET" 9

if declare -f bootstrap_channel ensure_bucket ensure_channel_iam | rg -q -- 'lockRetentionPolicy|lock-retention-period'; then
  fail 'bootstrap preparation helpers contain an irreversible retention lock call'
fi
if declare -f ensure_bucket | rg -q -- '--retention-period'; then
  fail 'bucket creation/configuration adds retention before exact IAM and empty-object proof'
fi
declare -f perform_atomic_retention_lock | rg -F -- 'lockRetentionPolicy?ifMetagenerationMatch=' >/dev/null || \
  fail 'explicit lock does not bind the JSON API request to metageneration'
if declare -f lock_retention perform_atomic_retention_lock | rg -q -- 'storage buckets update|lock-retention-period'; then
  fail 'retention lock still uses a generic gcloud bucket update'
fi

# The common identity guard itself proves project IAM, both key lists, runtime
# resource IAM, and the publisher's exact-empty resource IAM.
ORDER_LOG="$(mktemp)"
(
  # shellcheck disable=SC2329
  check_project_iam() { printf 'project-check\n' >>"$ORDER_LOG"; }
  # shellcheck disable=SC2329
  check_no_user_managed_keys() { printf 'key:%s\n' "$1" >>"$ORDER_LOG"; }
  # shellcheck disable=SC2329
  check_no_hmac_keys() { printf 'hmac:%s\n' "$1" >>"$ORDER_LOG"; }
  # shellcheck disable=SC2329
  check_no_service_account_bound_api_keys() { printf 'api-keys:%s:%s\n' "$1" "$2" >>"$ORDER_LOG"; }
  # shellcheck disable=SC2329
  check_runtime_signer_binding() { printf 'runtime-check:%s\n' "$1" >>"$ORDER_LOG"; }
  # shellcheck disable=SC2329
  check_publisher_service_account_iam() { printf 'publisher-check:%s\n' "$1" >>"$ORDER_LOG"; }
  check_channel_identity_guard bootstrap staging
)
EXPECTED_GUARD_ORDER="project-check
key:${STAGING_RUNTIME_SERVICE_ACCOUNT}
key:${STAGING_PUBLISHER_SERVICE_ACCOUNT}
hmac:${STAGING_RUNTIME_SERVICE_ACCOUNT}
hmac:${STAGING_PUBLISHER_SERVICE_ACCOUNT}
api-keys:${STAGING_RUNTIME_SERVICE_ACCOUNT}:${STAGING_PUBLISHER_SERVICE_ACCOUNT}
runtime-check:bootstrap
publisher-check:${STAGING_PUBLISHER_SERVICE_ACCOUNT}"
[[ "$(sed -n '1,14p' "$ORDER_LOG")" = "$EXPECTED_GUARD_ORDER" ]] || \
  fail 'identity guard omitted project/resource IAM or long-lived credential proof'

# A failed first guard step must not be masked by later successful steps when
# the composite function itself is evaluated by `expect_failure`/`||`.
: >"$ORDER_LOG"
(
  # shellcheck disable=SC2329
  check_project_iam() { printf 'project-failed\n' >>"$ORDER_LOG"; return 1; }
  # shellcheck disable=SC2329
  check_no_user_managed_keys() { printf 'masked-key-check\n' >>"$ORDER_LOG"; }
  # shellcheck disable=SC2329
  check_no_hmac_keys() { printf 'masked-hmac-check\n' >>"$ORDER_LOG"; }
  # shellcheck disable=SC2329
  check_no_service_account_bound_api_keys() { printf 'masked-api-check\n' >>"$ORDER_LOG"; }
  # shellcheck disable=SC2329
  check_runtime_signer_binding() { printf 'masked-runtime-check\n' >>"$ORDER_LOG"; }
  # shellcheck disable=SC2329
  check_publisher_service_account_iam() { printf 'masked-publisher-check\n' >>"$ORDER_LOG"; }
  expect_failure 'identity guard masked an early project-IAM failure' \
    check_channel_identity_guard exact staging
)
[[ "$(cat "$ORDER_LOG")" = 'project-failed' ]] || \
  fail 'identity guard continued after an early project-IAM failure'

# The full guard brackets the bucket grant and then immediately brackets the
# self-signing policy replace as bootstrap/exact respectively.
: >"$ORDER_LOG"
(
  # Consumed by sourced ensure_channel_iam.
  # shellcheck disable=SC2034
  KINDY_BUCKET_CREATED_THIS_RUN=1
  # shellcheck disable=SC2034
  KINDY_BUCKET_NEEDS_RETENTION_THIS_RUN=1
  # shellcheck disable=SC2329
  check_channel_identity_guard() { printf 'guard:%s\n' "$1" >>"$ORDER_LOG"; }
  # shellcheck disable=SC2329
  set_exact_bucket_iam() { printf 'bucket-set:%s:%s\n' "$2" "$3" >>"$ORDER_LOG"; }
  # shellcheck disable=SC2329
  check_bucket_iam() { printf 'bucket-check:%s\n' "$1" >>"$ORDER_LOG"; }
  # shellcheck disable=SC2329
  set_exact_runtime_signer_iam() { printf 'signer-set\n' >>"$ORDER_LOG"; }
  # shellcheck disable=SC2329
  ensure_retention_while_no_writer() { printf 'retention-while-sealed\n' >>"$ORDER_LOG"; }
  ensure_channel_iam staging
)
EXPECTED_ORDER="guard:bootstrap
bucket-set:1:no-writer
bucket-check:no-writer
guard:bootstrap
guard:bootstrap
signer-set
guard:exact
retention-while-sealed
guard:exact
bucket-set:0:exact
bucket-check:exact
guard:exact"
[[ "$(sed -n '1,24p' "$ORDER_LOG")" = "$EXPECTED_ORDER" ]] || \
  fail 'no-writer retention and identity guards do not bracket final publisher grant'

: >"$ORDER_LOG"
(
  # shellcheck disable=SC2034
  KINDY_BUCKET_CREATED_THIS_RUN=1
  # shellcheck disable=SC2034
  KINDY_BUCKET_NEEDS_RETENTION_THIS_RUN=1
  final_check_seen=0
  # shellcheck disable=SC2329
  check_channel_identity_guard() { :; }
  # shellcheck disable=SC2329
  set_exact_bucket_iam() { printf 'bucket-set:%s\n' "$3" >>"$ORDER_LOG"; }
  # shellcheck disable=SC2329
  check_bucket_iam() {
    if [[ "$1" = "exact" && "$final_check_seen" = "0" ]]; then
      final_check_seen=1
      return 1
    fi
  }
  # shellcheck disable=SC2329
  set_exact_runtime_signer_iam() { :; }
  # shellcheck disable=SC2329
  ensure_retention_while_no_writer() { :; }
  expect_failure 'failed final publisher verification did not fail closed' \
    ensure_channel_iam staging
)
[[ "$(tail -n 1 "$ORDER_LOG")" = 'bucket-set:no-writer' ]] || \
  fail 'failed final publisher verification did not reseal the bucket no-writer'

: >"$ORDER_LOG"
(
  # shellcheck disable=SC2329
  gcloud() {
    case "${1-}:${2-}:${3-}" in
      projects:get-iam-policy:*)
        printf '{"bindings":[{"role":"roles/browser","members":["user:auditor@example.com"]}]}'
        ;;
      iam:roles:describe)
        printf 'describe:%s\n' "${4-}" >>"$ORDER_LOG"
        printf '{"name":"roles/browser","includedPermissions":["resourcemanager.projects.get"]}'
        ;;
      *) return 1 ;;
    esac
  }
  check_project_iam
)
[[ "$(sed -n '1p' "$ORDER_LOG")" = 'describe:roles/browser' ]] || \
  fail 'project IAM check did not resolve every live predefined role'
(
  # shellcheck disable=SC2329
  gcloud() {
    case "${1-}:${2-}:${3-}" in
      projects:get-iam-policy:*)
        printf '{"bindings":[{"role":"roles/browser","members":["user:auditor@example.com"]}]}'
        ;;
      iam:roles:describe) return 1 ;;
      *) return 1 ;;
    esac
  }
  expect_failure 'project IAM accepted an unavailable role descriptor' check_project_iam
)
: >"$ORDER_LOG"
(
  # shellcheck disable=SC2329
  gcloud() {
    case "${1-}:${2-}:${3-}" in
      projects:get-iam-policy:*)
        printf '{"bindings":[{"role":"roles/browser","members":["user:a@example.com"]},{"role":"roles/viewer","members":["user:b@example.com"]}]}'
        ;;
      iam:roles:describe)
        printf 'describe:%s\n' "${4-}" >>"$ORDER_LOG"
        if [[ "${4-}" = 'roles/browser' ]]; then
          printf '{"name":"roles/browser","includedPermissions":["cloudbuild.builds.create"]}'
        else
          printf '{"name":"roles/viewer","includedPermissions":["resourcemanager.projects.get"]}'
        fi
        ;;
      *) return 1 ;;
    esac
  }
  expect_failure 'project role scanner masked an unsafe early descriptor' check_project_iam
)
[[ "$(cat "$ORDER_LOG")" = 'describe:roles/browser' ]] || \
  fail 'project role scanner continued after an unsafe early descriptor'
(
  # shellcheck disable=SC2329
  gcloud() { printf 'projects/-/serviceAccounts/test/keys/user-managed\n'; }
  expect_failure 'user-managed service-account key was accepted' \
    check_no_user_managed_keys "$STAGING_RUNTIME_SERVICE_ACCOUNT"
)
(
  # shellcheck disable=SC2329
  gcloud() { printf 'GOOG1EXAMPLEACTIVEORINACTIVE\n'; }
  expect_failure 'service-account HMAC key was accepted' \
    check_no_hmac_keys "$STAGING_PUBLISHER_SERVICE_ACCOUNT"
)
: >"$ORDER_LOG"
(
  # shellcheck disable=SC2329
  gcloud() {
    case "${1-}:${2-}:${3-}" in
      services:api-keys:list)
        printf '[{"name":"%s"}]' "$API_KEY_NAME"
        ;;
      services:api-keys:describe)
        printf 'describe-api-key:%s\n' "${4-}" >>"$ORDER_LOG"
        printf '{"name":"%s","serviceAccountEmail":"unrelated@example.iam.gserviceaccount.com"}' "$API_KEY_NAME"
        ;;
      *) return 1 ;;
    esac
  }
  check_no_service_account_bound_api_keys \
    "$STAGING_RUNTIME_SERVICE_ACCOUNT" "$STAGING_PUBLISHER_SERVICE_ACCOUNT"
)
[[ "$(sed -n '1p' "$ORDER_LOG")" = "describe-api-key:${API_KEY_NAME}" ]] || \
  fail 'API-key guard did not describe every listed key'

CALL_ARG_LOG="$(mktemp)"
CALL_CONFIG_LOG="$(mktemp)"
RETENTION_LOG="$(mktemp)"
MALICIOUS_CURLRC="$(mktemp)"
trap 'rm -f "$ORDER_LOG" "$CALL_ARG_LOG" "$CALL_CONFIG_LOG" "$RETENTION_LOG" "$MALICIOUS_CURLRC"' EXIT
printf 'header = "Authorization: Bearer attacker-from-curlrc"\n' >"$MALICIOUS_CURLRC"

# Retention runs only while exact no-writer IAM is maintained on both sides of
# all empty proofs. Final publisher IAM is outside this function.
(
  # shellcheck disable=SC2034
  KINDY_BUCKET_NEEDS_RETENTION_THIS_RUN=1
  # shellcheck disable=SC2329
  check_channel_identity_guard() { printf 'guard:%s\n' "$1" >>"$RETENTION_LOG"; }
  # shellcheck disable=SC2329
  check_bucket_iam() { printf 'bucket-check:%s\n' "$1" >>"$RETENTION_LOG"; }
  # shellcheck disable=SC2329
  assert_bucket_empty_for_retention() { printf 'empty-proof\n' >>"$RETENTION_LOG"; }
  # shellcheck disable=SC2329
  check_bucket_controls() { printf 'controls:%s\n' "$1" >>"$RETENTION_LOG"; }
  # shellcheck disable=SC2329
  gcloud() { printf 'gcloud:%s\n' "$*" >>"$RETENTION_LOG"; }
  ensure_retention_while_no_writer staging
)
RETENTION_SEQUENCE="$(sed -n '1,10p' "$RETENTION_LOG")"
[[ "$RETENTION_SEQUENCE" = "guard:exact
bucket-check:no-writer
empty-proof
guard:exact
bucket-check:no-writer
gcloud:storage buckets update gs://${STAGING_BUCKET} --project=${PROJECT_ID} --retention-period=${RETENTION_PERIOD_SECONDS}s --quiet
controls:lock-optional" ]] || \
  fail 'retention did not remain sealed no-writer through every empty proof'

# The empty proof enumerates live/noncurrent versions, soft-deleted objects,
# managed folders, and pending XML multipart uploads.
: >"$RETENTION_LOG"
(
  # shellcheck disable=SC2329
  require_command() { :; }
  # shellcheck disable=SC2329
  gcloud() {
    printf 'gcloud:%s\n' "$*" >>"$RETENTION_LOG"
    if [[ "${1-}:${2-}:${3-}" = "auth:print-access-token:" ]]; then
      printf 'ya29.test-token-1234567890\n'
    fi
  }
  # shellcheck disable=SC2329
  perform_multipart_empty_check() { printf 'multipart:%s\n' "$1" >>"$RETENTION_LOG"; }
  assert_bucket_empty_for_retention "$STAGING_BUCKET"
)
rg -F -- "storage ls gs://${STAGING_BUCKET}/** --all-versions --project=${PROJECT_ID}" "$RETENTION_LOG" >/dev/null || \
  fail 'empty proof omitted live/noncurrent object versions'
rg -F -- "storage ls gs://${STAGING_BUCKET}/** --soft-deleted --project=${PROJECT_ID}" "$RETENTION_LOG" >/dev/null || \
  fail 'empty proof omitted soft-deleted objects'
rg -F -- "storage managed-folders list gs://${STAGING_BUCKET}/ --project=${PROJECT_ID}" "$RETENTION_LOG" >/dev/null || \
  fail 'empty proof omitted managed folders'
rg -F -- "multipart:${STAGING_BUCKET}" "$RETENTION_LOG" >/dev/null || \
  fail 'empty proof omitted pending multipart uploads'

: >"$RETENTION_LOG"
(
  # shellcheck disable=SC2329
  require_command() { :; }
  # shellcheck disable=SC2329
  gcloud() {
    printf 'gcloud:%s\n' "$*" >>"$RETENTION_LOG"
    if [[ "$*" = *' --soft-deleted '* ]]; then
      printf 'gs://%s/releases/soft-deleted#1\n' "$STAGING_BUCKET"
    fi
  }
  # shellcheck disable=SC2329
  perform_multipart_empty_check() { fail 'multipart proof ran after soft-deleted drift'; }
  expect_failure 'retention empty proof accepted a soft-deleted object' \
    assert_bucket_empty_for_retention "$STAGING_BUCKET"
)

: >"$RETENTION_LOG"
(
  # shellcheck disable=SC2034
  KINDY_BUCKET_NEEDS_RETENTION_THIS_RUN=1
  # shellcheck disable=SC2329
  check_channel_identity_guard() { :; }
  # shellcheck disable=SC2329
  check_bucket_iam() { printf 'bucket-check:%s\n' "$1" >>"$RETENTION_LOG"; }
  # shellcheck disable=SC2329
  assert_bucket_empty_for_retention() { return 1; }
  # shellcheck disable=SC2329
  gcloud() { printf 'gcloud:%s\n' "$*" >>"$RETENTION_LOG"; }
  expect_failure 'retention proceeded after empty proof failure' \
    ensure_retention_while_no_writer staging
)
if rg -F -- 'storage buckets update' "$RETENTION_LOG" >/dev/null; then
  fail 'retention update ran after an empty-proof failure'
fi
[[ "$(tail -n 1 "$RETENTION_LOG")" = 'bucket-check:no-writer' ]] || \
  fail 'empty-proof failure did not leave the bucket at its no-writer check'

# A failed multipart proof is the final non-assignment proof. Clearing the
# token afterward must never turn that failure into success.
(
  # shellcheck disable=SC2329
  require_command() { :; }
  # shellcheck disable=SC2329
  gcloud() {
    if [[ "${1-}:${2-}:${3-}" = 'auth:print-access-token:' ]]; then
      printf 'ya29.test-token-1234567890\n'
    fi
  }
  # shellcheck disable=SC2329
  perform_multipart_empty_check() { return 1; }
  expect_failure 'empty proof masked a failed multipart listing' \
    assert_bucket_empty_for_retention "$STAGING_BUCKET"
)

: >"$RETENTION_LOG"
(
  # shellcheck disable=SC2034
  KINDY_BUCKET_NEEDS_RETENTION_THIS_RUN=1
  # shellcheck disable=SC2329
  check_channel_identity_guard() { :; }
  # shellcheck disable=SC2329
  check_bucket_iam() { printf 'no-writer-failed\n' >>"$RETENTION_LOG"; return 1; }
  # shellcheck disable=SC2329
  assert_bucket_empty_for_retention() { printf 'masked-empty\n' >>"$RETENTION_LOG"; }
  # shellcheck disable=SC2329
  gcloud() { printf 'masked-update\n' >>"$RETENTION_LOG"; }
  expect_failure 'retention masked a failed no-writer precondition' \
    ensure_retention_while_no_writer staging
)
[[ "$(cat "$RETENTION_LOG")" = 'no-writer-failed' ]] || \
  fail 'retention continued after a failed no-writer precondition'

: >"$RETENTION_LOG"
(
  # shellcheck disable=SC2034
  KINDY_BUCKET_NEEDS_RETENTION_THIS_RUN=1
  # shellcheck disable=SC2329
  check_channel_identity_guard() { :; }
  # shellcheck disable=SC2329
  check_bucket_iam() { :; }
  # shellcheck disable=SC2329
  assert_bucket_empty_for_retention() { :; }
  # shellcheck disable=SC2329
  gcloud() { printf 'retention-updated\n' >>"$RETENTION_LOG"; }
  # shellcheck disable=SC2329
  check_bucket_controls() { printf 'retention-postcheck-failed\n' >>"$RETENTION_LOG"; return 1; }
  expect_failure 'retention masked a failed postcondition' \
    ensure_retention_while_no_writer staging
)
[[ "$(cat "$RETENTION_LOG")" = $'retention-updated\nretention-postcheck-failed' ]] || \
  fail 'retention postcondition failure was masked or reordered'

LOCK_RESPONSE="{\"name\":\"${STAGING_BUCKET}\",\"retentionPolicy\":{\"isLocked\":true,\"retentionPeriod\":\"${RETENTION_PERIOD_SECONDS}\"},\"metageneration\":\"10\"}"
curl() {
  local output_file=""
  local response_body="$LOCK_RESPONSE"
  local previous=""
  local argument
  printf '%s\n' "$*" >>"$CALL_ARG_LOG"
  if [[ "${1-}" != "-q" ]]; then
    cat "$MALICIOUS_CURLRC" >>"$CALL_CONFIG_LOG"
    return 92
  fi
  cat >>"$CALL_CONFIG_LOG"
  for argument in "$@"; do
    if [[ "$argument" = *'?uploads&max-uploads=1'* ]]; then
      response_body="$EMPTY_MULTIPART_XML"
    fi
    if [[ "$previous" = "--output" ]]; then
      output_file="$argument"
      break
    fi
    previous="$argument"
  done
  [[ -n "$output_file" ]] || return 90
  case "${CURL_TEST_MODE-ok}" in
    ok)
      printf '%s' "$response_body" >"$output_file"
      printf '200'
      ;;
    precondition)
      printf '{"error":"precondition"}' >"$output_file"
      printf '412'
      return 22
      ;;
    malformed)
      printf 'not-json' >"$output_file"
      printf '200'
      ;;
    multipart-pending)
      printf '%s' "$PENDING_MULTIPART_XML" >"$output_file"
      printf '200'
      ;;
    *) return 91 ;;
  esac
}

TEST_ACCESS_TOKEN='ya29.test-token-1234567890'
expect_failure 'atomic lock accepted an unsafe bearer token shape' \
  perform_atomic_retention_lock "$STAGING_BUCKET" 9 'unsafe token with spaces'
perform_atomic_retention_lock "$STAGING_BUCKET" 9 "$TEST_ACCESS_TOKEN"
[[ "$(sed -n '1p' "$CALL_ARG_LOG")" = '-q --config - '* ]] || \
  fail 'curl disable option is not the first argv element before --config -'
rg -F -- "lockRetentionPolicy?ifMetagenerationMatch=9" "$CALL_ARG_LOG" >/dev/null || \
  fail 'atomic lock argv omitted the confirmed metageneration'
rg -F -- '--max-filesize 65536' "$CALL_ARG_LOG" >/dev/null || \
  fail 'atomic lock omitted its response transfer bound'
if rg -F -- "$TEST_ACCESS_TOKEN" "$CALL_ARG_LOG" >/dev/null; then
  fail 'access token leaked into curl argv'
fi
rg -F -- "Authorization: Bearer ${TEST_ACCESS_TOKEN}" "$CALL_CONFIG_LOG" >/dev/null || \
  fail 'curl did not receive its bearer header through stdin config'
if rg -F -- 'attacker-from-curlrc' "$CALL_CONFIG_LOG" >/dev/null; then
  fail 'a user curlrc affected the atomic retention request'
fi
perform_multipart_empty_check "$STAGING_BUCKET" "$TEST_ACCESS_TOKEN"
rg -F -- "https://${STAGING_BUCKET}.storage.googleapis.com/?uploads&max-uploads=1" "$CALL_ARG_LOG" >/dev/null || \
  fail 'multipart proof did not use the exact bounded bucket listing URL'
run_multipart_mode() {
  local mode="$1"
  CURL_TEST_MODE="$mode" perform_multipart_empty_check \
    "$STAGING_BUCKET" "$TEST_ACCESS_TOKEN"
}
expect_failure 'multipart HTTP proof accepted a pending upload' \
  run_multipart_mode multipart-pending
run_atomic_lock_mode() {
  local mode="$1"
  CURL_TEST_MODE="$mode" perform_atomic_retention_lock \
    "$STAGING_BUCKET" 9 "$TEST_ACCESS_TOKEN"
}
expect_failure 'atomic lock accepted a failed metageneration precondition' \
  run_atomic_lock_mode precondition
expect_failure 'atomic lock accepted a malformed success response' \
  run_atomic_lock_mode malformed

printf 'gcp-content-release.test: ok\n'
