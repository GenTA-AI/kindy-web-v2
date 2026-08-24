#!/usr/bin/env bash
set -euo pipefail

# Kindy immutable GCS ContentRelease harness.
#
# Public mutation commands are hard-disabled. `plan` is offline; check,
# prelock-check, and metageneration are read-only. Bootstrap/lock helpers remain
# preparation-only until a separate project, an 8-day sealed quarantine, second
# proof, and a new explicit irreversible approval are implemented and reviewed.

readonly PROJECT_ID="kindy-493701"
readonly LOCATION="asia-northeast3"
readonly RETENTION_PERIOD_SECONDS="2592000"
readonly STAGING_BUCKET="kindy-493701-content-releases-staging"
readonly PRODUCTION_BUCKET="kindy-493701-content-releases-production"
readonly STAGING_RUNTIME_SERVICE_ACCOUNT="kindy-preview-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
readonly PRODUCTION_RUNTIME_SERVICE_ACCOUNT="kindy-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
readonly STAGING_PUBLISHER_SERVICE_ACCOUNT="kindy-content-publisher-staging@${PROJECT_ID}.iam.gserviceaccount.com"
readonly PRODUCTION_PUBLISHER_SERVICE_ACCOUNT="kindy-content-publisher-production@${PROJECT_ID}.iam.gserviceaccount.com"
readonly SIGNER_ROLE_ID="kindyContentReleaseSigner"
readonly SIGNER_ROLE="projects/${PROJECT_ID}/roles/${SIGNER_ROLE_ID}"
readonly STAGING_ORIGIN="https://kindy-landing-preview-g3d7kdf7ta-du.a.run.app"
readonly PRODUCTION_ORIGIN="https://kindy.kr"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly REPO_ROOT
readonly POLICY_CHECKER="${SCRIPT_DIR}/gcp-content-release-policy-check.mjs"
readonly STAGING_CORS_FILE="${SCRIPT_DIR}/gcp-content-release-cors-staging.json"
readonly PRODUCTION_CORS_FILE="${SCRIPT_DIR}/gcp-content-release-cors-production.json"
KINDY_BUCKET_CREATED_THIS_RUN=0
KINDY_BUCKET_NEEDS_RETENTION_THIS_RUN=0

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/gcp-content-release.sh plan staging|production|all
  bash scripts/gcp-content-release.sh prelock-check staging|production|all
  bash scripts/gcp-content-release.sh check staging|production|all
  bash scripts/gcp-content-release.sh metageneration staging|production

Properties:
  - exact project, location, bucket, origin, and service-account allowlists;
  - separate physical buckets and publisher identities per channel;
  - runtime gets only roles/storage.objectViewer on its bucket;
  - publisher gets only roles/storage.objectCreator on its bucket;
  - runtime grants itself a custom role containing only signBlob;
  - UBLA, public access prevention, versioning, 30-day retention, exact CORS;
  - publisher runner wiring is intentionally absent and activation-blocked.
  - bootstrap mutations are hard-disabled pending a separately reviewed
    content project and an 8-day sealed resumable-session quarantine.
  - irreversible retention locking is also hard-disabled and unapproved.

There are no enabled mutation commands. `check` requires a locked policy but
remains a read-only static check: inherited org/folder/group IAM and effective
negative probes stay explicit activation blockers. `prelock-check` verifies an
externally provisioned boundary without approving or performing a lock.
USAGE
}

log() {
  printf '[kindy-content-release] %s\n' "$*"
}

die() {
  printf '[kindy-content-release] ERROR: %s\n' "$*" >&2
  exit 2
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

assert_repo_root() {
  [[ "$PWD" = "$REPO_ROOT" ]] || die "run from repository root: $REPO_ROOT"
  [[ -f "$POLICY_CHECKER" && -f "$STAGING_CORS_FILE" && -f "$PRODUCTION_CORS_FILE" ]] || \
    die "immutable GCS contract files are missing"
}

assert_gcloud_access() {
  require_command gcloud
  gcloud auth print-access-token >/dev/null 2>&1 || \
    die "gcloud authentication expired; run 'gcloud auth login' and retry"
  [[ "$(gcloud projects describe "$PROJECT_ID" --format='value(projectId)')" = "$PROJECT_ID" ]] || \
    die "active account cannot access exact project $PROJECT_ID"
}

validate_channel() {
  case "$1" in
    staging|production) ;;
    *) die "channel must be exactly staging or production" ;;
  esac
}

bucket_for_channel() {
  validate_channel "$1"
  case "$1" in
    staging) printf '%s' "$STAGING_BUCKET" ;;
    production) printf '%s' "$PRODUCTION_BUCKET" ;;
  esac
}

runtime_for_channel() {
  validate_channel "$1"
  case "$1" in
    staging) printf '%s' "$STAGING_RUNTIME_SERVICE_ACCOUNT" ;;
    production) printf '%s' "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" ;;
  esac
}

publisher_for_channel() {
  validate_channel "$1"
  case "$1" in
    staging) printf '%s' "$STAGING_PUBLISHER_SERVICE_ACCOUNT" ;;
    production) printf '%s' "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT" ;;
  esac
}

other_runtime_for_channel() {
  validate_channel "$1"
  case "$1" in
    staging) printf '%s' "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" ;;
    production) printf '%s' "$STAGING_RUNTIME_SERVICE_ACCOUNT" ;;
  esac
}

other_publisher_for_channel() {
  validate_channel "$1"
  case "$1" in
    staging) printf '%s' "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT" ;;
    production) printf '%s' "$STAGING_PUBLISHER_SERVICE_ACCOUNT" ;;
  esac
}

origin_for_channel() {
  validate_channel "$1"
  case "$1" in
    staging) printf '%s' "$STAGING_ORIGIN" ;;
    production) printf '%s' "$PRODUCTION_ORIGIN" ;;
  esac
}

cors_file_for_channel() {
  validate_channel "$1"
  case "$1" in
    staging) printf '%s' "$STAGING_CORS_FILE" ;;
    production) printf '%s' "$PRODUCTION_CORS_FILE" ;;
  esac
}

for_each_target() {
  local command="$1"
  local target="$2"
  case "$target" in
    staging|production) "$command" "$target" || return 1 ;;
    all)
      "$command" staging || return 1
      "$command" production || return 1
      ;;
    *) die "target must be staging, production, or all" ;;
  esac
}

assert_contract_file() {
  local channel="$1"
  local origin
  local cors_file
  origin="$(origin_for_channel "$channel")"
  cors_file="$(cors_file_for_channel "$channel")"
  node "$POLICY_CHECKER" cors-file "$origin" "$cors_file" || return 1
}

project_number() {
  local value
  value="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')" || \
    die "could not resolve project number"
  [[ "$value" =~ ^[1-9][0-9]*$ ]] || die "GCP returned an invalid project number"
  printf '%s' "$value"
}

bucket_metadata() {
  local bucket="$1"
  gcloud storage buckets describe "gs://${bucket}" \
    --project="$PROJECT_ID" \
    --format=json
}

bucket_iam_policy() {
  local bucket="$1"
  gcloud storage buckets get-iam-policy "gs://${bucket}" \
    --project="$PROJECT_ID" \
    --format=json
}

service_account_policy() {
  local identity="$1"
  gcloud iam service-accounts get-iam-policy "$identity" \
    --project="$PROJECT_ID" \
    --format=json
}

service_account_exists() {
  gcloud iam service-accounts describe "$1" --project="$PROJECT_ID" >/dev/null 2>&1
}

bucket_exists() {
  gcloud storage buckets describe "gs://$1" --project="$PROJECT_ID" >/dev/null 2>&1
}

signer_role_exists() {
  gcloud iam roles describe "$SIGNER_ROLE_ID" --project="$PROJECT_ID" >/dev/null 2>&1
}

check_signer_role() {
  local role_json
  role_json="$(gcloud iam roles describe "$SIGNER_ROLE_ID" \
    --project="$PROJECT_ID" --format=json)" || die "signBlob-only custom role is missing"
  printf '%s' "$role_json" | node "$POLICY_CHECKER" custom-role "$SIGNER_ROLE" || return 1
}

check_project_iam() {
  local policy_json role_names role_name role_json
  policy_json="$(gcloud projects get-iam-policy "$PROJECT_ID" --format=json)" || \
    die "could not read project IAM policy"
  role_names="$(printf '%s' "$policy_json" | node "$POLICY_CHECKER" project-iam \
    "$STAGING_RUNTIME_SERVICE_ACCOUNT" \
    "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" \
    "$STAGING_PUBLISHER_SERVICE_ACCOUNT" \
    "$PRODUCTION_PUBLISHER_SERVICE_ACCOUNT")" || \
    die "project IAM policy is outside the protected-identity boundary"

  # Role names alone are not a durable security proof: predefined role
  # permissions evolve. Resolve every live project binding and fail closed if
  # the role cannot be described or can mint/attach credentials or rewrite IAM.
  while IFS= read -r role_name; do
    [[ -n "$role_name" ]] || continue
    role_json="$(gcloud iam roles describe "$role_name" --format=json)" || \
      die "could not prove project role safe: $role_name"
    printf '%s' "$role_json" | node "$POLICY_CHECKER" \
      project-role-permissions "$role_name" || \
      die "project role permissions are outside the exact read-only allowlist: $role_name"
  done <<<"$role_names"
}

check_no_user_managed_keys() {
  local identity="$1"
  local keys
  keys="$(gcloud iam service-accounts keys list \
    --iam-account="$identity" \
    --project="$PROJECT_ID" \
    --managed-by=user \
    --format='value(name)')" || die "could not inspect keys for $identity"
  [[ -z "$keys" ]] || die "user-managed service-account keys are forbidden: $identity"
}

check_no_hmac_keys() {
  local identity="$1"
  local keys
  keys="$(gcloud storage hmac list \
    --all \
    --service-account="$identity" \
    --project="$PROJECT_ID" \
    --format='value(accessId)')" || die "could not inspect HMAC keys for $identity"
  [[ -z "$keys" ]] || die "service-account HMAC keys are forbidden: $identity"
}

check_no_service_account_bound_api_keys() {
  local runtime="$1"
  local publisher="$2"
  local keys_json key_names key_name key_json
  keys_json="$(gcloud services api-keys list \
    --show-deleted \
    --project="$PROJECT_ID" \
    --format=json)" || die "could not inspect service-account-bound API keys"
  key_names="$(printf '%s' "$keys_json" | node "$POLICY_CHECKER" api-key-names)" || \
    die "API-key listing could not be proven complete and canonical"
  while IFS= read -r key_name; do
    [[ -n "$key_name" ]] || continue
    key_json="$(gcloud services api-keys describe "$key_name" \
      --project="$PROJECT_ID" \
      --format=json)" || die "could not describe API key: $key_name"
    printf '%s' "$key_json" | node "$POLICY_CHECKER" api-key-description \
      "$key_name" "$runtime" "$publisher" || \
      die "API-key description is outside the protected-identity boundary: $key_name"
  done <<<"$key_names"
}

check_runtime_signer_binding() {
  local mode="$1"
  local runtime="$2"
  local policy_json
  policy_json="$(service_account_policy "$runtime")" || \
    die "could not read service-account IAM policy: $runtime"
  printf '%s' "$policy_json" | node "$POLICY_CHECKER" service-account-iam \
    "$mode" "$runtime" "$SIGNER_ROLE" || return 1
}

check_publisher_service_account_iam() {
  local publisher="$1"
  local policy_json
  policy_json="$(service_account_policy "$publisher")" || \
    die "could not read publisher service-account IAM policy: $publisher"
  printf '%s' "$policy_json" | node "$POLICY_CHECKER" \
    empty-service-account-iam "$publisher" || return 1
}

check_channel_identity_guard() {
  local mode="$1"
  local channel="$2"
  local runtime publisher
  runtime="$(runtime_for_channel "$channel")"
  publisher="$(publisher_for_channel "$channel")"

  # Project/resource IAM and keylessness are one fail-closed guard. Callers run
  # it on both sides of bucket/signBlob grants to narrow the mutation window.
  check_project_iam || return 1
  check_no_user_managed_keys "$runtime" || return 1
  check_no_user_managed_keys "$publisher" || return 1
  check_no_hmac_keys "$runtime" || return 1
  check_no_hmac_keys "$publisher" || return 1
  check_no_service_account_bound_api_keys "$runtime" "$publisher" || return 1
  check_runtime_signer_binding "$mode" "$runtime" || return 1
  check_publisher_service_account_iam "$publisher" || return 1
}

check_bucket_iam() {
  local mode="$1"
  local channel="$2"
  local bucket runtime publisher other_runtime other_publisher policy_json
  bucket="$(bucket_for_channel "$channel")" || return 1
  runtime="$(runtime_for_channel "$channel")" || return 1
  publisher="$(publisher_for_channel "$channel")" || return 1
  other_runtime="$(other_runtime_for_channel "$channel")" || return 1
  other_publisher="$(other_publisher_for_channel "$channel")" || return 1
  policy_json="$(bucket_iam_policy "$bucket")" || die "could not read IAM policy for $bucket"
  printf '%s' "$policy_json" | node "$POLICY_CHECKER" bucket-iam \
    "$mode" "$runtime" "$publisher" "$other_runtime" "$other_publisher" || return 1
}

check_bucket_controls() {
  local lock_mode="$1"
  local channel="$2"
  local bucket origin metadata project_number_value
  bucket="$(bucket_for_channel "$channel")" || return 1
  origin="$(origin_for_channel "$channel")" || return 1
  project_number_value="$(project_number)" || return 1
  metadata="$(bucket_metadata "$bucket")" || die "bucket missing or unreadable: $bucket"
  printf '%s' "$metadata" | node "$POLICY_CHECKER" bucket-metadata \
    "$bucket" "$project_number_value" "$LOCATION" "$origin" \
    "$RETENTION_PERIOD_SECONDS" "$lock_mode" || return 1
}

check_channel() {
  local lock_mode="$1"
  local channel="$2"
  local runtime publisher
  validate_channel "$channel"
  runtime="$(runtime_for_channel "$channel")"
  publisher="$(publisher_for_channel "$channel")"

  assert_contract_file "$channel" || die "CORS contract file is invalid: $channel"
  service_account_exists "$runtime" || die "runtime service account is missing: $runtime"
  service_account_exists "$publisher" || die "publisher service account is missing: $publisher"
  check_signer_role || die "signer role is outside the exact contract"
  check_channel_identity_guard exact "$channel" || die "channel identity guard failed"
  check_bucket_controls "$lock_mode" "$channel" || die "bucket controls failed"
  check_bucket_iam exact "$channel" || die "bucket IAM failed"
  log "${channel} static controls passed (${lock_mode})"
  log "ACTIVATION BLOCKER: organization/folder/group inherited IAM is not proven by this static check; retain Policy Troubleshooter and effective negative-probe evidence"
}

plan_channel() {
  local channel="$1"
  local bucket runtime publisher origin cors_file
  validate_channel "$channel"
  bucket="$(bucket_for_channel "$channel")"
  runtime="$(runtime_for_channel "$channel")"
  publisher="$(publisher_for_channel "$channel")"
  origin="$(origin_for_channel "$channel")"
  cors_file="$(cors_file_for_channel "$channel")"
  assert_contract_file "$channel" || die "CORS contract file is invalid: $channel"

  cat <<PLAN
channel=${channel}
project=${PROJECT_ID}
location=${LOCATION}
bucket=${bucket}
runtime=${runtime}
publisher=${publisher}
runtime_bucket_role=roles/storage.objectViewer
publisher_bucket_role=roles/storage.objectCreator
signer_role=${SIGNER_ROLE}
signer_permissions=iam.serviceAccounts.signBlob
cors_origin=${origin}
cors_file=${cors_file}
retention_seconds=${RETENTION_PERIOD_SECONDS}
retention_lock=HARD_DISABLED_UNAPPROVED_IRREVERSIBLE_MUTATION
bootstrap_mutations=HARD_DISABLED_PENDING_SEPARATE_PROJECT_AND_8_DAY_QUARANTINE
publisher_runner=UNWIRED_ACTIVATION_BLOCKER
inherited_iam=UNPROVEN_ACTIVATION_BLOCKER
PLAN
}

ensure_service_account() {
  local identity="$1"
  local account_id="$2"
  local display_name="$3"
  if service_account_exists "$identity"; then
    log "service account already exists: $identity"
    return
  fi
  gcloud iam service-accounts create "$account_id" \
    --project="$PROJECT_ID" \
    --display-name="$display_name" \
    --description='Keyless, channel-isolated Kindy ContentRelease identity' \
    --quiet
}

ensure_signer_role() {
  local role_json
  if signer_role_exists; then
    check_signer_role
    return
  fi
  gcloud iam roles create "$SIGNER_ROLE_ID" \
    --project="$PROJECT_ID" \
    --title='Kindy ContentRelease V4 URL signer' \
    --description='Only signs blobs using the attached runtime identity' \
    --permissions=iam.serviceAccounts.signBlob \
    --stage=GA \
    --quiet
  role_json="$(gcloud iam roles describe "$SIGNER_ROLE_ID" \
    --project="$PROJECT_ID" --format=json)"
  printf '%s' "$role_json" | node "$POLICY_CHECKER" custom-role "$SIGNER_ROLE"
}

ensure_bucket() {
  local channel="$1"
  local bucket cors_file metadata policy_json project_number_value lock_state
  bucket="$(bucket_for_channel "$channel")"
  cors_file="$(cors_file_for_channel "$channel")"
  project_number_value="$(project_number)"
  KINDY_BUCKET_CREATED_THIS_RUN=0
  KINDY_BUCKET_NEEDS_RETENTION_THIS_RUN=0

  if bucket_exists "$bucket"; then
    metadata="$(bucket_metadata "$bucket")"
    printf '%s' "$metadata" | node "$POLICY_CHECKER" bucket-bootstrap \
      "$bucket" "$project_number_value" "$LOCATION" "$RETENTION_PERIOD_SECONDS"
    lock_state="$(printf '%s' "$metadata" | node "$POLICY_CHECKER" extract-lock-state)"
    policy_json="$(bucket_iam_policy "$bucket")"
    printf '%s' "$policy_json" | node "$POLICY_CHECKER" bucket-iam bootstrap \
      "$(runtime_for_channel "$channel")" \
      "$(publisher_for_channel "$channel")" \
      "$(other_runtime_for_channel "$channel")" \
      "$(other_publisher_for_channel "$channel")"
    if [[ "$lock_state" = "absent" ]]; then
      KINDY_BUCKET_NEEDS_RETENTION_THIS_RUN=1
    fi
  else
    gcloud storage buckets create "gs://${bucket}" \
      --project="$PROJECT_ID" \
      --location="$LOCATION" \
      --uniform-bucket-level-access \
      --public-access-prevention \
      --soft-delete-duration=7d \
      --quiet
    KINDY_BUCKET_CREATED_THIS_RUN=1
    KINDY_BUCKET_NEEDS_RETENTION_THIS_RUN=1
  fi

  gcloud storage buckets update "gs://${bucket}" \
    --project="$PROJECT_ID" \
    --uniform-bucket-level-access \
    --public-access-prevention \
    --versioning \
    --cors-file="$cors_file" \
    --quiet
}

set_exact_bucket_iam() (
  local channel="$1"
  local created_this_run="$2"
  local target_mode="$3"
  local bucket runtime publisher other_runtime other_publisher current_policy rendered_policy policy_file
  [[ "$target_mode" = "exact" || "$target_mode" = "no-writer" ]] || \
    die "bucket IAM target must be exact or no-writer"
  bucket="$(bucket_for_channel "$channel")"
  runtime="$(runtime_for_channel "$channel")"
  publisher="$(publisher_for_channel "$channel")"
  other_runtime="$(other_runtime_for_channel "$channel")"
  other_publisher="$(other_publisher_for_channel "$channel")"
  current_policy="$(bucket_iam_policy "$bucket")" || die "could not read IAM policy for $bucket"

  if [[ "$created_this_run" = "1" ]]; then
    # A just-created GCS bucket can carry provider-created legacy project
    # bindings. They are never accepted by `bucket-iam bootstrap`; instead this
    # one path atomically replaces the initial etag with the exact final policy.
    if [[ "$target_mode" = "no-writer" ]]; then
      rendered_policy="$(printf '%s' "$current_policy" | node "$POLICY_CHECKER" \
        render-new-no-writer-bucket-iam "$runtime" "$publisher" "$PROJECT_ID")" || \
        die "fresh bucket no-writer IAM could not be rendered"
    else
      rendered_policy="$(printf '%s' "$current_policy" | node "$POLICY_CHECKER" \
        render-new-bucket-iam "$runtime" "$publisher" "$PROJECT_ID")" || \
        die "fresh bucket final IAM could not be rendered"
    fi
  else
    if [[ "$target_mode" = "no-writer" ]]; then
      rendered_policy="$(printf '%s' "$current_policy" | node "$POLICY_CHECKER" \
        render-no-writer-bucket-iam \
        "$runtime" "$publisher" "$other_runtime" "$other_publisher")" || \
        die "existing bucket no-writer IAM could not be rendered"
    else
      rendered_policy="$(printf '%s' "$current_policy" | node "$POLICY_CHECKER" \
        render-bucket-iam "$runtime" "$publisher" "$other_runtime" "$other_publisher")" || \
        die "existing bucket final IAM could not be rendered"
    fi
  fi

  policy_file="$(mktemp)" || die "could not allocate a private bucket IAM policy file"
  trap 'rm -f "$policy_file"' EXIT HUP INT TERM
  chmod 600 "$policy_file" || die "could not protect the bucket IAM policy file"
  printf '%s' "$rendered_policy" >"$policy_file" || die "could not write bucket IAM policy"
  gcloud storage buckets set-iam-policy "gs://${bucket}" "$policy_file" \
    --project="$PROJECT_ID" \
    --quiet >/dev/null
)

set_exact_runtime_signer_iam() (
  local runtime="$1"
  local current_policy rendered_policy policy_file
  current_policy="$(service_account_policy "$runtime")" || \
    die "could not read service-account IAM policy: $runtime"
  rendered_policy="$(printf '%s' "$current_policy" | node "$POLICY_CHECKER" \
    render-service-account-iam "$runtime" "$SIGNER_ROLE")" || \
    die "runtime signer IAM could not be rendered"
  policy_file="$(mktemp)" || die "could not allocate a private signer IAM policy file"
  trap 'rm -f "$policy_file"' EXIT HUP INT TERM
  chmod 600 "$policy_file" || die "could not protect the signer IAM policy file"
  printf '%s' "$rendered_policy" >"$policy_file" || die "could not write signer IAM policy"
  gcloud iam service-accounts set-iam-policy "$runtime" "$policy_file" \
    --project="$PROJECT_ID" \
    --quiet >/dev/null
)

perform_multipart_empty_check() (
  local bucket="$1"
  local access_token="$2"
  local response_file list_url http_code curl_status response_size
  [[ "$bucket" = "$STAGING_BUCKET" || "$bucket" = "$PRODUCTION_BUCKET" ]] || \
    die "multipart bucket is outside the exact allowlist"
  [[ "${#access_token}" -ge 20 && "${#access_token}" -le 4096 ]] || \
    die "gcloud returned an invalid access token length"
  [[ "$access_token" =~ ^[A-Za-z0-9._~-]+$ ]] || \
    die "gcloud returned an unsafe access token shape"

  response_file="$(mktemp)" || die "could not allocate multipart response file"
  trap 'rm -f "$response_file"' EXIT HUP INT TERM
  chmod 600 "$response_file" || die "could not protect multipart response file"
  list_url="https://${bucket}.storage.googleapis.com/?uploads&max-uploads=1"
  set +e
  http_code="$(printf 'header = "Authorization: Bearer %s"\n' "$access_token" | \
    curl -q --config - \
      --proto '=https' \
      --silent \
      --show-error \
      --request GET \
      --url "$list_url" \
      --output "$response_file" \
      --write-out '%{http_code}' \
      --connect-timeout 5 \
      --max-time 15 \
      --max-filesize 65536)"
  curl_status=$?
  set -e
  [[ "$curl_status" -eq 0 ]] || die "multipart listing request failed closed"
  [[ "$http_code" = "200" ]] || die "multipart listing returned HTTP $http_code"
  response_size="$(wc -c <"$response_file" | tr -d '[:space:]')" || \
    die "could not measure multipart response"
  [[ "$response_size" =~ ^[0-9]+$ && "$response_size" -le 65536 ]] || \
    die "multipart listing response exceeded its bound"
  node "$POLICY_CHECKER" multipart-empty "$bucket" <"$response_file" || return 1
)

assert_bucket_empty_for_retention() {
  local bucket="$1"
  local live_versions soft_deleted managed_folders access_token
  require_command curl
  live_versions="$(gcloud storage ls \
    "gs://${bucket}/**" \
    --all-versions \
    --project="$PROJECT_ID")" || die "could not list all object versions before retention: $bucket"
  [[ -z "$live_versions" ]] || \
    die "bucket contains a live/noncurrent object version; retention was not added: $bucket"

  soft_deleted="$(gcloud storage ls \
    "gs://${bucket}/**" \
    --soft-deleted \
    --project="$PROJECT_ID")" || die "could not list soft-deleted objects before retention: $bucket"
  [[ -z "$soft_deleted" ]] || \
    die "bucket contains a soft-deleted object; retention was not added: $bucket"

  managed_folders="$(gcloud storage managed-folders list \
    "gs://${bucket}/" \
    --project="$PROJECT_ID" \
    --format='value(name)')" || die "could not list managed folders before retention: $bucket"
  [[ -z "$managed_folders" ]] || \
    die "bucket contains a managed folder; retention was not added: $bucket"

  access_token="$(gcloud auth print-access-token)" || \
    die "could not mint an access token for multipart proof"
  perform_multipart_empty_check "$bucket" "$access_token" || \
    die "pending multipart upload proof failed: $bucket"
  access_token=""
}

ensure_retention_while_no_writer() {
  local channel="$1"
  local bucket
  [[ "$KINDY_BUCKET_NEEDS_RETENTION_THIS_RUN" = "1" ]] || return 0
  bucket="$(bucket_for_channel "$channel")"

  check_channel_identity_guard exact "$channel" || \
    die "identity boundary failed before retention empty proof"
  check_bucket_iam no-writer "$channel" || \
    die "bucket is not sealed no-writer before retention empty proof"
  assert_bucket_empty_for_retention "$bucket" || \
    die "bucket emptiness could not be proven while sealed"

  # Recheck the credential and no-writer boundary immediately after all empty
  # proofs. No publisher grant exists during the retention update.
  check_channel_identity_guard exact "$channel" || \
    die "identity boundary drifted after retention empty proof"
  check_bucket_iam no-writer "$channel" || \
    die "bucket writer appeared after retention empty proof"
  gcloud storage buckets update "gs://${bucket}" \
    --project="$PROJECT_ID" \
    --retention-period="${RETENTION_PERIOD_SECONDS}s" \
    --quiet || die "could not add unlocked retention while bucket was sealed"
  check_bucket_controls lock-optional "$channel" || \
    die "retention postcondition failed; bucket remains no-writer"
  KINDY_BUCKET_NEEDS_RETENTION_THIS_RUN=0
}

ensure_channel_iam() {
  local channel="$1"
  local runtime initial_created
  runtime="$(runtime_for_channel "$channel")"
  initial_created="$KINDY_BUCKET_CREATED_THIS_RUN"

  # A retention-absent bucket is sealed before any empty proof. This removes an
  # existing publisher grant too. Any later failure therefore leaves no writer.
  if [[ "$KINDY_BUCKET_NEEDS_RETENTION_THIS_RUN" = "1" ]]; then
    check_channel_identity_guard bootstrap "$channel" || \
      die "identity boundary failed before bucket reseal"
    set_exact_bucket_iam "$channel" "$initial_created" no-writer || \
      die "could not atomically seal retention-absent bucket"
    KINDY_BUCKET_CREATED_THIS_RUN=0
    check_bucket_iam no-writer "$channel" || die "bucket no-writer postcondition failed"
    check_channel_identity_guard bootstrap "$channel" || \
      die "identity boundary failed after bucket reseal"
  fi

  # The self-signing grant cannot write objects. It is established and checked
  # while a retention-absent bucket remains sealed.
  check_channel_identity_guard bootstrap "$channel" || \
    die "identity boundary failed before self-signing grant"
  set_exact_runtime_signer_iam "$runtime" || die "self-signing grant failed"
  check_channel_identity_guard exact "$channel" || \
    die "identity boundary failed after self-signing grant"

  ensure_retention_while_no_writer "$channel" || \
    die "retention failed while bucket was sealed no-writer"

  # Publisher creation is the final grant and never precedes retention. If a
  # postcondition fails, immediately replace the live etag with no-writer IAM.
  check_channel_identity_guard exact "$channel" || \
    die "identity boundary failed before final publisher grant"
  set_exact_bucket_iam "$channel" "$KINDY_BUCKET_CREATED_THIS_RUN" exact || \
    die "final publisher grant failed; prior no-writer policy remains"
  if ! check_bucket_iam exact "$channel" || \
    ! check_channel_identity_guard exact "$channel"; then
    if ! set_exact_bucket_iam "$channel" 0 no-writer || \
      ! check_bucket_iam no-writer "$channel"; then
      die "final publisher grant failed verification and emergency reseal failed"
    fi
    die "final publisher grant failed verification; bucket was resealed no-writer"
  fi
}

assert_bootstrap_confirmation() {
  local channel="$1"
  local bucket expected
  bucket="$(bucket_for_channel "$channel")"
  expected="BOOTSTRAP:${channel}:${bucket}"
  [[ "${KINDY_GCS_APPLY-0}" = "1" ]] || die "bootstrap requires KINDY_GCS_APPLY=1"
  [[ "${KINDY_GCS_CONFIRM-}" = "$expected" ]] || \
    die "bootstrap requires KINDY_GCS_CONFIRM=${expected}"
}

bootstrap_channel() {
  local channel="$1"
  validate_channel "$channel"
  die "bootstrap mutations are hard-disabled: use a separate content project, seal no-writer for at least 8 days, then complete a second empty/audit proof in a separately reviewed two-phase harness"
}

lock_retention_command() {
  local channel="$1"
  local expected_metageneration="$2"
  validate_channel "$channel"
  [[ "$expected_metageneration" =~ ^[1-9][0-9]*$ ]] || \
    die "LIVE_METAGENERATION must be positive"
  die "lock-retention is hard-disabled: irreversible retention was not approved and separate-project quarantine gates are incomplete"
}

live_metageneration() {
  local channel="$1"
  local metadata
  validate_channel "$channel"
  metadata="$(bucket_metadata "$(bucket_for_channel "$channel")")" || \
    die "could not read bucket metadata"
  printf '%s' "$metadata" | node "$POLICY_CHECKER" extract-metageneration
}

assert_retention_lock_confirmation() {
  local bucket="$1"
  local metageneration="$2"
  local expected_confirmation
  expected_confirmation="LOCK_RETENTION:${bucket}:${RETENTION_PERIOD_SECONDS}:${metageneration}"
  [[ "${KINDY_GCS_ALLOW_IRREVERSIBLE-0}" = "1" ]] || \
    die "lock-retention requires KINDY_GCS_ALLOW_IRREVERSIBLE=1"
  [[ "${KINDY_GCS_CONFIRM_RETENTION_LOCK-}" = "$expected_confirmation" ]] || \
    die "lock-retention requires KINDY_GCS_CONFIRM_RETENTION_LOCK=${expected_confirmation}"
}

perform_atomic_retention_lock() (
  local bucket="$1"
  local metageneration="$2"
  local access_token="$3"
  local response_file lock_url http_code curl_status response_size
  [[ "$bucket" = "$STAGING_BUCKET" || "$bucket" = "$PRODUCTION_BUCKET" ]] || \
    die "retention lock bucket is outside the exact allowlist"
  [[ "$metageneration" =~ ^[1-9][0-9]*$ ]] || die "retention lock metageneration is invalid"
  [[ "${#access_token}" -ge 20 && "${#access_token}" -le 4096 ]] || \
    die "gcloud returned an invalid access token length"
  [[ "$access_token" =~ ^[A-Za-z0-9._~-]+$ ]] || \
    die "gcloud returned an unsafe access token shape"

  response_file="$(mktemp)" || die "could not allocate retention-lock response file"
  trap 'rm -f "$response_file"' EXIT HUP INT TERM
  chmod 600 "$response_file" || die "could not protect retention-lock response file"
  lock_url="https://storage.googleapis.com/storage/v1/b/${bucket}/lockRetentionPolicy?ifMetagenerationMatch=${metageneration}"

  # The bearer header is consumed from curl's stdin config. It never appears in
  # curl argv, process listings, normal output, or error logs. Response bodies
  # stay in a bounded private temp file and are never echoed.
  set +e
  http_code="$(printf 'header = "Authorization: Bearer %s"\n' "$access_token" | \
    curl -q --config - \
      --proto '=https' \
      --silent \
      --show-error \
      --request POST \
      --url "$lock_url" \
      --output "$response_file" \
      --write-out '%{http_code}' \
      --connect-timeout 5 \
      --max-time 15 \
      --max-filesize 65536)"
  curl_status=$?
  set -e
  [[ "$curl_status" -eq 0 ]] || die "atomic retention lock request failed closed"
  [[ "$http_code" = "200" ]] || die "atomic retention lock returned HTTP $http_code"
  response_size="$(wc -c <"$response_file" | tr -d '[:space:]')" || \
    die "could not measure retention-lock response"
  [[ "$response_size" =~ ^[0-9]+$ && "$response_size" -le 65536 ]] || \
    die "atomic retention lock response exceeded its bound"
  node "$POLICY_CHECKER" lock-response "$bucket" "$RETENTION_PERIOD_SECONDS" <"$response_file"
)

lock_retention() {
  local channel="$1"
  local expected_metageneration="$2"
  local bucket metadata live lock_state access_token
  validate_channel "$channel"
  require_command curl || return 1
  [[ "$expected_metageneration" =~ ^[1-9][0-9]*$ ]] || die "LIVE_METAGENERATION must be positive"
  bucket="$(bucket_for_channel "$channel")"
  assert_gcloud_access || return 1
  check_channel lock-optional "$channel" || return 1
  metadata="$(bucket_metadata "$bucket")" || return 1
  live="$(printf '%s' "$metadata" | node "$POLICY_CHECKER" extract-metageneration)" || return 1
  lock_state="$(printf '%s' "$metadata" | node "$POLICY_CHECKER" extract-lock-state)" || return 1
  [[ "$live" = "$expected_metageneration" ]] || \
    die "bucket metageneration changed; inspect and reconfirm the live value $live"
  if [[ "$lock_state" = "locked" ]]; then
    log "retention is already locked for $bucket"
    return
  fi

  assert_retention_lock_confirmation "$bucket" "$live" || return 1

  # Re-read immediately before the irreversible call. The GCS lock API itself
  # also operates on bucket metageneration; the human confirmation is bound to
  # the same live value so stale review cannot silently proceed.
  [[ "$(live_metageneration "$channel")" = "$live" ]] || \
    die "bucket changed after confirmation; no lock was attempted"
  access_token="$(gcloud auth print-access-token)" || die "could not mint a GCP access token"
  perform_atomic_retention_lock "$bucket" "$live" "$access_token" || return 1
  access_token=""
  check_channel locked "$channel" || return 1
  log "IRREVERSIBLE retention lock verified: $bucket"
}

main() {
  local command="${1:-}"
  local target="${2:-}"
  assert_repo_root || exit 2
  require_command node || exit 2

  case "$command" in
    plan)
      [[ "$#" -eq 2 ]] || die "plan requires staging|production|all"
      for_each_target plan_channel "$target" || die "plan contract failed"
      ;;
    bootstrap)
      [[ "$#" -eq 2 ]] || die "bootstrap requires staging|production"
      [[ "$target" != "all" ]] || die "bootstrap must be confirmed one channel at a time"
      bootstrap_channel "$target"
      ;;
    prelock-check)
      [[ "$#" -eq 2 ]] || die "prelock-check requires staging|production|all"
      assert_gcloud_access || exit 2
      for_each_target check_channel_wrapper_optional "$target" || exit 2
      ;;
    check)
      [[ "$#" -eq 2 ]] || die "check requires staging|production|all"
      assert_gcloud_access || exit 2
      for_each_target check_channel_wrapper_locked "$target" || exit 2
      ;;
    metageneration)
      [[ "$#" -eq 2 ]] || die "metageneration requires staging|production"
      assert_gcloud_access || exit 2
      live_metageneration "$target" || exit 2
      printf '\n'
      ;;
    lock-retention)
      [[ "$#" -eq 3 ]] || die "lock-retention requires CHANNEL LIVE_METAGENERATION"
      lock_retention_command "$target" "$3"
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

check_channel_wrapper_optional() {
  check_channel lock-optional "$1"
}

check_channel_wrapper_locked() {
  check_channel locked "$1"
}

if [[ "${BASH_SOURCE[0]}" = "$0" ]]; then
  main "$@"
fi
