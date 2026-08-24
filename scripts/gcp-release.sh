#!/usr/bin/env bash
set -euo pipefail

# Kindy GCP release harness.
#
# Invariants:
#   - project, region, repository, and service names are not inferred from the
#     operator's mutable gcloud defaults;
#   - a clean git commit produces one immutable Artifact Registry tag;
#   - preview and production always receive the same sha256 digest;
#   - production is first deployed with zero traffic, then advanced through
#     5/25/50/100% canaries; a failed smoke restores the prior revision.

readonly PROJECT_ID="kindy-493701"
readonly REGION="asia-northeast3"
readonly ARTIFACT_REPOSITORY="kindy-containers"
readonly IMAGE_NAME="kindy-web"
readonly PREVIEW_SERVICE="kindy-landing-preview"
readonly PRODUCTION_SERVICE="kindy"
readonly PRODUCTION_URL="https://kindy.kr"
readonly PREVIEW_RUNTIME_SERVICE_ACCOUNT="kindy-preview-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
readonly PRODUCTION_RUNTIME_SERVICE_ACCOUNT="kindy-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
readonly IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPOSITORY}/${IMAGE_NAME}"
readonly PUBLIC_ENV_FILE="${KINDY_PUBLIC_ENV_FILE:-.env.local}"
readonly CONTENT_RELEASE_BUCKET="content-releases"

readonly -a PRODUCTION_REQUIRED_SECRET_BINDINGS=(
  "SUPABASE_SERVICE_ROLE_KEY=kindy-supabase-service-role-key"
  "ANTHROPIC_API_KEY=kindy-anthropic-key"
  "FAL_KEY=kindy-fal-key"
  "GOOGLE_API_KEY=kindy-google-key"
  "INNGEST_SIGNING_KEY=kindy-inngest-signing-key"
  "INNGEST_EVENT_KEY=kindy-inngest-event-key"
  "PORTONE_API_SECRET=kindy-portone-api-secret"
  "PORTONE_WEBHOOK_SECRET=kindy-portone-webhook-secret"
  "BILLING_KEY_SECRET=kindy-billing-key-secret"
  "KINDY_OPERATOR_KEY=kindy-operator-key"
)

readonly -a PRODUCTION_OPTIONAL_SECRET_BINDINGS=(
  "TOSS_SECRET_KEY=kindy-toss-secret-key"
  "RESEND_API_KEY=kindy-resend-api-key"
  "RESEND_FROM_EMAIL=kindy-resend-from-email"
)

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/gcp-release.sh bootstrap
  bash scripts/gcp-release.sh build
  bash scripts/gcp-release.sh deploy-preview IMAGE@sha256:DIGEST [SOURCE_SHA]
  bash scripts/gcp-release.sh promote IMAGE@sha256:DIGEST [SOURCE_SHA]
  bash scripts/gcp-release.sh smoke preview|production [SOURCE_SHA]
  bash scripts/gcp-release.sh rollback PRODUCTION_REVISION
  bash scripts/gcp-release.sh status

Environment:
  KINDY_PUBLIC_ENV_FILE  dotenv file used only for allowlisted NEXT_PUBLIC_*
                         build inputs (default: .env.local)
  KINDY_PAYMENTS_ENABLED 0 (default) forces payment/business public values
                         empty; 1 requires complete PortOne + business values
  KINDY_LAUNCH_MODE      deploy-preview: open_preview (default) or
                         protected_chat_pilot; promote: production_presale
                         (default) or protected_chat_pilot
  STORY_CHAT_RUNTIME_ENABLED
                         must remain 0. Runtime activation is blocked until an
                         immutable GCS or RPC-only DB identity boundary ships
  STORY_CONTENT_RELEASE_BUCKET
                         content-releases (default and only valid value)
  STORY_CONTENT_RELEASE_CHANNEL
                         deploy-preview: staging (default and only valid value);
                         promote: production (default and only valid value)

The build command refuses a dirty worktree. deploy-preview/promote additionally
require HEAD to equal SOURCE_SHA. Runtime secret values are never read; Cloud
Run receives Secret Manager references only. Story chat free text is always
deployed as disabled.
USAGE
}

log() {
  printf '[kindy-release] %s\n' "$*"
}

die() {
  printf '[kindy-release] ERROR: %s\n' "$*" >&2
  exit 2
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

assert_repo_root() {
  local actual_root
  actual_root="$(git rev-parse --show-toplevel 2>/dev/null)" || die "not in a git repository"
  [[ "$PWD" = "$actual_root" ]] || die "run from repository root: $actual_root"
  [[ -f cloudbuild.yaml && -f Dockerfile ]] || die "Kindy build files not found in $PWD"
}

assert_gcloud_access() {
  require_command gcloud
  gcloud auth print-access-token >/dev/null 2>&1 || \
    die "gcloud authentication expired; run 'gcloud auth login' and retry"
  gcloud projects describe "$PROJECT_ID" --format='value(projectId)' >/dev/null || \
    die "active account cannot access GCP project $PROJECT_ID"
}

current_sha() {
  git rev-parse HEAD
}

validate_sha() {
  local sha="$1"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "SOURCE_SHA must be a lowercase 40-character git SHA"
}

assert_clean_at_sha() {
  local sha="$1"
  local head
  validate_sha "$sha"
  head="$(current_sha)"
  [[ "$head" = "$sha" ]] || die "checked-out HEAD $head does not match release SHA $sha"
  [[ -z "$(git status --porcelain --untracked-files=normal)" ]] || \
    die "worktree is dirty; commit/stash every tracked and untracked change before release"
}

validate_digest_uri() {
  local image="$1"
  local digest
  [[ "$image" = "${IMAGE_BASE}@sha256:"* ]] || \
    die "image must be an immutable digest under ${IMAGE_BASE}"
  digest="${image#"${IMAGE_BASE}"@sha256:}"
  [[ "$digest" =~ ^[0-9a-f]{64}$ ]] || die "image digest must be sha256 plus 64 lowercase hex characters"
}

validate_launch_configuration() {
  local deploy_env="$1"
  local launch_mode="$2"

  case "${deploy_env}:${launch_mode}" in
    preview:open_preview|preview:protected_chat_pilot) ;;
    production:production_presale|production:protected_chat_pilot) ;;
    *)
      die "invalid launch configuration: KINDY_DEPLOY_ENV=${deploy_env}, KINDY_LAUNCH_MODE=${launch_mode}"
      ;;
  esac
}

resolve_launch_mode() {
  local deploy_env="$1"
  local requested_mode="${KINDY_LAUNCH_MODE-}"
  local launch_mode

  if [[ -z "$requested_mode" ]]; then
    case "$deploy_env" in
      preview) launch_mode="open_preview" ;;
      production) launch_mode="production_presale" ;;
      *) die "invalid deploy environment: $deploy_env" ;;
    esac
  else
    launch_mode="$requested_mode"
  fi

  validate_launch_configuration "$deploy_env" "$launch_mode"
  printf '%s' "$launch_mode"
}

resolve_story_chat_runtime() {
  local launch_mode="$1"
  local runtime_enabled="${STORY_CHAT_RUNTIME_ENABLED-0}"

  case "$runtime_enabled" in
    0) ;;
    1)
      die "STORY_CHAT_RUNTIME_ENABLED=1 is blocked: immutable ContentRelease object/identity boundary is not provisioned"
      ;;
    *) die "STORY_CHAT_RUNTIME_ENABLED must be exactly 0 or 1" ;;
  esac

  printf '%s' "$runtime_enabled"
}

expected_content_release_channel() {
  local deploy_env="$1"

  case "$deploy_env" in
    preview) printf 'staging' ;;
    production) printf 'production' ;;
    *) die "invalid deploy environment for content release: $deploy_env" ;;
  esac
}

validate_content_release_configuration() {
  local deploy_env="$1"
  local bucket="$2"
  local channel="$3"
  local expected_channel

  expected_channel="$(expected_content_release_channel "$deploy_env")"
  [[ "$bucket" = "$CONTENT_RELEASE_BUCKET" ]] || \
    die "STORY_CONTENT_RELEASE_BUCKET must be exactly $CONTENT_RELEASE_BUCKET"
  [[ "$channel" = "$expected_channel" ]] || \
    die "STORY_CONTENT_RELEASE_CHANNEL must be ${expected_channel} for ${deploy_env}"
}

resolve_content_release_bucket() {
  local bucket="${STORY_CONTENT_RELEASE_BUCKET-$CONTENT_RELEASE_BUCKET}"

  [[ "$bucket" = "$CONTENT_RELEASE_BUCKET" ]] || \
    die "STORY_CONTENT_RELEASE_BUCKET must be exactly $CONTENT_RELEASE_BUCKET"
  printf '%s' "$bucket"
}

resolve_content_release_channel() {
  local deploy_env="$1"
  local expected_channel
  local channel

  expected_channel="$(expected_content_release_channel "$deploy_env")"
  channel="${STORY_CONTENT_RELEASE_CHANNEL-$expected_channel}"
  [[ "$channel" = "$expected_channel" ]] || \
    die "STORY_CONTENT_RELEASE_CHANNEL must be ${expected_channel} for ${deploy_env}"
  printf '%s' "$channel"
}

dotenv_value() {
  local name="$1"
  local direct="${!name-}"

  if [[ -n "$direct" ]]; then
    printf '%s' "$direct"
    return
  fi

  [[ -f "$PUBLIC_ENV_FILE" ]] || return
  # Node 20+ parses dotenv syntax natively. Keep the release harness usable in
  # a fresh clean worktree before `npm ci`; release preflight must not depend on
  # project node_modules being present.
  node --env-file="$PUBLIC_ENV_FILE" -e '
    process.stdout.write(process.env[process.argv[1]] || "");
  ' "$name"
}

safe_substitution_value() {
  local name="$1"
  local required="$2"
  local value
  value="$(dotenv_value "$name")"

  if [[ "$required" = "required" && -z "$value" ]]; then
    die "$name is required (export it or set it in $PUBLIC_ENV_FILE)"
  fi
  [[ "$value" != *'|'* ]] || die "$name contains reserved release delimiter '|'"
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || die "$name must be a single line"
  printf '%s' "$value"
}

secret_name_from_binding() {
  local binding="$1"
  printf '%s' "${binding#*=}"
}

enabled_secret_version() {
  local secret_name="$1"
  local description
  local full_name
  local state
  local version

  description="$(gcloud secrets versions describe latest \
    --secret="$secret_name" \
    --project="$PROJECT_ID" \
    --format='csv[no-heading](name,state)' 2>/dev/null)" || return 1
  IFS=',' read -r full_name state <<<"$description"
  [[ "$state" = "ENABLED" ]] || return 1
  version="${full_name##*/}"
  [[ "$version" =~ ^[1-9][0-9]*$ ]] || return 1
  printf '%s' "$version"
}

secret_version_exists() {
  enabled_secret_version "$1" >/dev/null
}

runtime_secret_bindings() {
  local profile="$1"
  local binding
  local environment_name
  local secret_name
  local secret_version
  local joined=""
  local -a required=()
  local -a optional=()

  case "$profile" in
    preview)
      # Public preview is fixture/auth-only until it has a separate Supabase
      # project or an RPC-only database identity. Never inject a same-project
      # secret/service-role key here: both bypass every RLS policy.
      ;;
    production)
      required=("${PRODUCTION_REQUIRED_SECRET_BINDINGS[@]}")
      optional=("${PRODUCTION_OPTIONAL_SECRET_BINDINGS[@]}")
      ;;
    *) die "unknown runtime secret profile: $profile" ;;
  esac

  for binding in "${required[@]+"${required[@]}"}"; do
    environment_name="${binding%%=*}"
    secret_name="$(secret_name_from_binding "$binding")"
    secret_version="$(enabled_secret_version "$secret_name")" || \
      die "required Secret Manager version is missing/disabled: ${secret_name}:latest"
    joined="${joined:+${joined},}${environment_name}=${secret_name}:${secret_version}"
  done

  for binding in "${optional[@]+"${optional[@]}"}"; do
    environment_name="${binding%%=*}"
    secret_name="$(secret_name_from_binding "$binding")"
    if secret_version="$(enabled_secret_version "$secret_name")"; then
      joined="${joined:+${joined},}${environment_name}=${secret_name}:${secret_version}"
    else
      log "optional secret not wired because it is missing/disabled: ${secret_name}:latest" >&2
    fi
  done

  printf '%s' "$joined"
}

runtime_service_account() {
  local profile="$1"

  case "$profile" in
    preview) printf '%s' "$PREVIEW_RUNTIME_SERVICE_ACCOUNT" ;;
    production) printf '%s' "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" ;;
    *) die "unknown runtime service-account profile: $profile" ;;
  esac
}

assert_artifact_repository() {
  local immutable
  immutable="$(gcloud artifacts repositories describe "$ARTIFACT_REPOSITORY" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --format='value(dockerConfig.immutableTags)' 2>/dev/null)" || \
    die "Artifact Registry repository missing; run 'bash scripts/gcp-release.sh bootstrap'"
  [[ "$immutable" = "True" || "$immutable" = "true" ]] || \
    die "Artifact Registry tags are mutable; run bootstrap to enable immutable tags"
}

assert_image_matches_sha() {
  local digest_uri="$1"
  local sha="$2"
  local required_payment_mode="${3:-either}"
  local tag_uri
  local digest
  local resolved
  local mode
  local -a modes=()

  validate_digest_uri "$digest_uri"
  validate_sha "$sha"
  case "$required_payment_mode" in
    0|1) modes=("$required_payment_mode") ;;
    either) modes=(0 1) ;;
    *) die "payment mode must be 0, 1, or either" ;;
  esac

  for mode in "${modes[@]}"; do
    tag_uri="${IMAGE_BASE}:git-${sha}-pay${mode}"
    digest="$(gcloud artifacts docker images describe "$tag_uri" \
      --project="$PROJECT_ID" \
      --format='value(image_summary.digest)' 2>/dev/null || true)"
    resolved="${IMAGE_BASE}@${digest}"
    [[ "$resolved" = "$digest_uri" ]] && return 0
  done

  die "digest is not the git-${sha} release for required payment mode ${required_payment_mode}"
}

service_image() {
  local service="$1"
  gcloud run services describe "$service" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format='value(spec.template.spec.containers[0].image)'
}

service_url() {
  local service="$1"
  gcloud run services describe "$service" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format='value(status.url)'
}

service_environment_value() {
  local service="$1"
  local environment_name="$2"

  gcloud run services describe "$service" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format=json | ENVIRONMENT_NAME="$environment_name" node -e '
      const fs = require("fs");
      const service = JSON.parse(fs.readFileSync(0, "utf8"));
      const name = process.env.ENVIRONMENT_NAME;
      const variables = service.spec?.template?.spec?.containers?.[0]?.env || [];
      const match = variables.find((variable) => variable.name === name);
      if (!match || typeof match.value !== "string") process.exit(3);
      process.stdout.write(match.value);
    '
}

full_traffic_revision() {
  local service="$1"
  gcloud run services describe "$service" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format=json | node -e '
      const fs = require("fs");
      const service = JSON.parse(fs.readFileSync(0, "utf8"));
      const full = (service.status?.traffic || [])
        .filter((target) => target.percent === 100 && target.revisionName);
      if (full.length !== 1) process.exit(3);
      process.stdout.write(full[0].revisionName);
    '
}

latest_ready_revision() {
  local service="$1"
  gcloud run services describe "$service" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format='value(status.latestReadyRevisionName)'
}

tag_url() {
  local service="$1"
  local tag="$2"

  gcloud run services describe "$service" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format=json | TRAFFIC_TAG="$tag" node -e '
      const fs = require("fs");
      const service = JSON.parse(fs.readFileSync(0, "utf8"));
      const tag = process.env.TRAFFIC_TAG;
      const target = (service.status?.traffic || []).find((item) => item.tag === tag);
      if (!target || typeof target.url !== "string") process.exit(3);
      process.stdout.write(target.url);
    '
}

remove_preview_candidate_tag() {
  gcloud run services update-traffic "$PREVIEW_SERVICE" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --remove-tags=preview-candidate \
    --quiet >/dev/null 2>&1 || true
}

smoke_url() {
  local base_url="${1%/}"
  local expected_sha="${2:-}"
  local authenticated="${3:-false}"
  local expected_revision="${4:-}"
  local token=""
  local endpoint
  local body
  local -a curl_args=(
    --fail
    --silent
    --show-error
    --location
    --connect-timeout 10
    --max-time 20
    --retry 12
    --retry-delay 5
    --retry-all-errors
  )

  require_command curl
  if [[ "$authenticated" = "true" ]]; then
    token="$(gcloud auth print-identity-token 2>/dev/null)" || \
      die "could not mint an identity token for authenticated Cloud Run smoke"
    curl_args+=(--header "Authorization: Bearer ${token}")
  fi

  for endpoint in /api/health/live /api/health/ready; do
    body="$(curl "${curl_args[@]}" "${base_url}${endpoint}")" || \
      return 1
    if [[ -n "$expected_sha" && "$body" != *"$expected_sha"* ]]; then
      printf '[kindy-release] ERROR: %s did not report expected release SHA %s\n' \
        "$endpoint" "$expected_sha" >&2
      return 1
    fi
    if [[ -n "$expected_revision" && "$body" != *"\"revision\":\"${expected_revision}\""* ]]; then
      printf '[kindy-release] ERROR: %s did not report expected revision %s\n' \
        "$endpoint" "$expected_revision" >&2
      return 1
    fi
    log "smoke passed: ${base_url}${endpoint}"
  done
}

smoke_canary() {
  local base_url="${1%/}"
  local expected_sha="$2"
  local expected_revision="$3"
  local attempts="$4"
  local body=""
  local attempt

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    body="$(curl --fail --silent --show-error \
      --connect-timeout 5 --max-time 10 \
      --header 'Cache-Control: no-cache' \
      --header 'Connection: close' \
      "${base_url}/api/health/ready")" || continue
    if [[ "$body" = *"$expected_sha"* && "$body" = *"\"revision\":\"${expected_revision}\""* ]]; then
      log "canary smoke observed $expected_revision / $expected_sha on attempt $attempt/$attempts"
      return 0
    fi
  done

  printf '[kindy-release] ERROR: canary never reported expected revision %s / SHA %s\n' \
    "$expected_revision" "$expected_sha" >&2
  return 1
}

deploy_revision() {
  local service="$1"
  local deploy_env="$2"
  local digest_uri="$3"
  local sha="$4"
  local traffic_mode="$5"
  local launch_mode="$6"
  local story_chat_runtime_enabled="$7"
  local content_release_bucket="$8"
  local content_release_channel="$9"
  local traffic_tag="${10:-}"
  local short_sha="${sha:0:12}"
  local suffix
  local secrets
  local service_account
  local ingress
  local max_instances
  local -a secret_args=()
  local -a tag_args=()
  local -a traffic_args=()

  suffix="r${short_sha}-$(date -u +%m%d%H%M%S)"

  validate_launch_configuration "$deploy_env" "$launch_mode"
  [[ "$story_chat_runtime_enabled" = "0" || "$story_chat_runtime_enabled" = "1" ]] || \
    die "STORY_CHAT_RUNTIME_ENABLED must be exactly 0 or 1"
  if [[ "$story_chat_runtime_enabled" = "1" ]]; then
    die "STORY_CHAT_RUNTIME_ENABLED=1 is blocked: immutable ContentRelease object/identity boundary is not provisioned"
  fi
  validate_content_release_configuration \
    "$deploy_env" "$content_release_bucket" "$content_release_channel"

  secrets="$(runtime_secret_bindings "$deploy_env")"
  if [[ -n "$secrets" ]]; then
    secret_args=(--set-secrets="$secrets")
  else
    secret_args=(--clear-secrets)
  fi
  service_account="$(runtime_service_account "$deploy_env")"
  case "$deploy_env" in
    preview)
      ingress="all"
      max_instances="2"
      ;;
    production)
      ingress="internal-and-cloud-load-balancing"
      max_instances="10"
      ;;
    *) die "invalid deploy environment: $deploy_env" ;;
  esac
  case "$traffic_mode" in
    traffic)
      # `gcloud run deploy` moves traffic by default and has no --to-latest
      # flag. Keep this empty, then use the Bash 3.2-safe conditional array
      # expansion at the call site below.
      traffic_args=()
      ;;
    no-traffic)
      traffic_args=(--no-traffic)
      ;;
    *)
      die "traffic mode must be traffic or no-traffic"
      ;;
  esac
  if [[ -n "$traffic_tag" ]]; then
    [[ "$traffic_tag" =~ ^[a-z][a-z0-9-]{0,62}$ ]] || die "invalid Cloud Run traffic tag"
    tag_args=(--tag="$traffic_tag")
  fi

  log "runtime configuration: deploy=${deploy_env}, launch=${launch_mode}, story-chat=${story_chat_runtime_enabled}, content-release=${content_release_bucket}/${content_release_channel}, free-text=0"
  gcloud run deploy "$service" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --platform=managed \
    --image="$digest_uri" \
    --service-account="$service_account" \
    --revision-suffix="$suffix" \
    --port=8080 \
    --memory=1Gi \
    --cpu=1 \
    --concurrency=40 \
    --max-instances="$max_instances" \
    --ingress="$ingress" \
    --timeout=900 \
    --startup-probe='httpGet.path=/api/health/live,httpGet.port=8080,initialDelaySeconds=0,timeoutSeconds=3,periodSeconds=5,failureThreshold=12' \
    --liveness-probe='httpGet.path=/api/health/live,httpGet.port=8080,initialDelaySeconds=10,timeoutSeconds=3,periodSeconds=30,failureThreshold=3' \
    --update-env-vars="KINDY_DEPLOY_ENV=${deploy_env},KINDY_LAUNCH_MODE=${launch_mode},KINDY_RELEASE_SHA=${sha},KINDY_LOCAL_PREVIEW=0,LESSON_GUEST_MODE=0,STORY_CHAT_RUNTIME_ENABLED=${story_chat_runtime_enabled},STORY_CHAT_FREE_TEXT_ENABLED=0,STORY_CONTENT_RELEASE_BUCKET=${content_release_bucket},STORY_CONTENT_RELEASE_CHANNEL=${content_release_channel}" \
    --remove-env-vars=VERCEL_ENV,INNGEST_DEV,KINDY_PRESALE_LOCKDOWN \
    "${secret_args[@]}" \
    --update-labels="app=kindy,managed-by=kindy-gcp-release,kindy-release-sha=${sha}" \
    "${tag_args[@]+"${tag_args[@]}"}" \
    "${traffic_args[@]+"${traffic_args[@]}"}" \
    --quiet
}

bootstrap() {
  local binding
  local build_service_account
  local secret_name

  assert_repo_root
  assert_gcloud_access
  log "enabling required APIs in explicit project $PROJECT_ID"
  gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    iam.googleapis.com \
    --project="$PROJECT_ID" \
    --quiet

  if gcloud artifacts repositories describe "$ARTIFACT_REPOSITORY" \
    --project="$PROJECT_ID" --location="$REGION" >/dev/null 2>&1; then
    log "enforcing immutable tags on Artifact Registry $ARTIFACT_REPOSITORY"
    gcloud artifacts repositories update "$ARTIFACT_REPOSITORY" \
      --project="$PROJECT_ID" \
      --location="$REGION" \
      --immutable-tags \
      --quiet
  else
    log "creating Artifact Registry $ARTIFACT_REPOSITORY in $REGION"
    gcloud artifacts repositories create "$ARTIFACT_REPOSITORY" \
      --project="$PROJECT_ID" \
      --location="$REGION" \
      --repository-format=docker \
      --immutable-tags \
      --description='Immutable Kindy release containers' \
      --labels='app=kindy,managed-by=kindy-gcp-release' \
      --quiet
  fi

  build_service_account="$(gcloud builds get-default-service-account \
    --project="$PROJECT_ID")" || die "could not resolve the Cloud Build service account"
  gcloud artifacts repositories add-iam-policy-binding "$ARTIFACT_REPOSITORY" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --member="serviceAccount:${build_service_account}" \
    --role=roles/artifactregistry.writer \
    --quiet >/dev/null

  if ! gcloud iam service-accounts describe "$PREVIEW_RUNTIME_SERVICE_ACCOUNT" \
    --project="$PROJECT_ID" >/dev/null 2>&1; then
    log "creating isolated preview Cloud Run runtime service account"
    gcloud iam service-accounts create kindy-preview-runtime \
      --project="$PROJECT_ID" \
      --display-name='Kindy preview Cloud Run runtime' \
      --description='Runtime identity for the public Kindy preview only' \
      --quiet
  fi

  if ! gcloud iam service-accounts describe "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" \
    --project="$PROJECT_ID" >/dev/null 2>&1; then
    log "creating isolated production Cloud Run runtime service account"
    gcloud iam service-accounts create kindy-runtime \
      --project="$PROJECT_ID" \
      --display-name='Kindy production Cloud Run runtime' \
      --description='Runtime identity for the Kindy production service only' \
      --quiet
  fi

  # Do not create empty secrets: an empty credential is more dangerous than a
  # visible preflight failure. Grant access only to existing enabled versions.
  runtime_secret_bindings preview >/dev/null
  if ! runtime_secret_bindings production >/dev/null 2>&1; then
    log "production-only secrets are incomplete; preview bootstrap can continue, but promotion will fail closed" >&2
  fi
  # Deliberately grant no Secret Manager access to the public preview runtime.
  # Its browser auth uses the public anon key baked into the immutable image.
  for binding in \
    "${PRODUCTION_REQUIRED_SECRET_BINDINGS[@]}" \
    "${PRODUCTION_OPTIONAL_SECRET_BINDINGS[@]}"
  do
    secret_name="$(secret_name_from_binding "$binding")"
    if secret_version_exists "$secret_name"; then
      gcloud secrets add-iam-policy-binding "$secret_name" \
        --project="$PROJECT_ID" \
        --member="serviceAccount:${PRODUCTION_RUNTIME_SERVICE_ACCOUNT}" \
        --role=roles/secretmanager.secretAccessor \
        --quiet >/dev/null
    fi
  done

  assert_artifact_repository
  log "bootstrap complete: ${IMAGE_BASE} (immutable tags enabled)"
}

build_release() {
  local sha
  local payments_enabled="${KINDY_PAYMENTS_ENABLED:-0}"
  local tag_uri
  local digest
  local substitutions
  local supabase_url supabase_anon toss_client portone_store portone_channel
  local site_url biz_name biz_number biz_mail_order biz_address biz_phone biz_email start_base

  require_command node
  assert_repo_root
  assert_gcloud_access
  sha="$(current_sha)"
  assert_clean_at_sha "$sha"
  assert_artifact_repository

  case "$payments_enabled" in
    0|1) ;;
    *) die "KINDY_PAYMENTS_ENABLED must be exactly 0 or 1" ;;
  esac

  supabase_url="$(safe_substitution_value NEXT_PUBLIC_SUPABASE_URL required)"
  supabase_anon="$(safe_substitution_value NEXT_PUBLIC_SUPABASE_ANON_KEY required)"
  site_url="$(safe_substitution_value NEXT_PUBLIC_SITE_URL required)"
  start_base="$(safe_substitution_value NEXT_PUBLIC_KINDY_START_BASE optional)"

  if [[ "$payments_enabled" = "1" ]]; then
    toss_client="$(safe_substitution_value NEXT_PUBLIC_TOSS_CLIENT_KEY optional)"
    portone_store="$(safe_substitution_value NEXT_PUBLIC_PORTONE_STORE_ID required)"
    portone_channel="$(safe_substitution_value NEXT_PUBLIC_PORTONE_CHANNEL_KEY required)"
    biz_name="$(safe_substitution_value NEXT_PUBLIC_BIZ_REPRESENTATIVE_NAME required)"
    biz_number="$(safe_substitution_value NEXT_PUBLIC_BIZ_REGISTRATION_NUMBER required)"
    biz_mail_order="$(safe_substitution_value NEXT_PUBLIC_BIZ_MAIL_ORDER_NUMBER required)"
    biz_address="$(safe_substitution_value NEXT_PUBLIC_BIZ_ADDRESS required)"
    biz_phone="$(safe_substitution_value NEXT_PUBLIC_BIZ_PHONE required)"
    biz_email="$(safe_substitution_value NEXT_PUBLIC_BIZ_EMAIL required)"
  else
    # Ignore any stale live values in .env.local for a preview-safe build.
    toss_client=""
    portone_store=""
    portone_channel=""
    biz_name=""
    biz_number=""
    biz_mail_order=""
    biz_address=""
    biz_phone=""
    biz_email=""
    log "payments disabled: PortOne/Toss/business public values forced empty"
  fi

  substitutions="^|^_SOURCE_SHA=${sha}|_IMAGE_TAG=git-${sha}-pay${payments_enabled}|_PAYMENTS_ENABLED=${payments_enabled}"
  substitutions+="|_SUPABASE_URL=${supabase_url}|_SUPABASE_ANON_KEY=${supabase_anon}"
  substitutions+="|_TOSS_CLIENT_KEY=${toss_client}|_PORTONE_STORE_ID=${portone_store}"
  substitutions+="|_PORTONE_CHANNEL_KEY=${portone_channel}|_SITE_URL=${site_url}"
  substitutions+="|_BIZ_REPRESENTATIVE_NAME=${biz_name}|_BIZ_REGISTRATION_NUMBER=${biz_number}"
  substitutions+="|_BIZ_MAIL_ORDER_NUMBER=${biz_mail_order}|_BIZ_ADDRESS=${biz_address}"
  substitutions+="|_BIZ_PHONE=${biz_phone}|_BIZ_EMAIL=${biz_email}|_KINDY_START_BASE=${start_base}"

  tag_uri="${IMAGE_BASE}:git-${sha}-pay${payments_enabled}"
  log "submitting clean commit $sha to Cloud Build (public values are not printed)"
  gcloud builds submit . \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --config=cloudbuild.yaml \
    --substitutions="$substitutions" \
    --quiet

  digest="$(gcloud artifacts docker images describe "$tag_uri" \
    --project="$PROJECT_ID" \
    --format='value(image_summary.digest)')"
  [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || die "could not resolve immutable digest for $tag_uri"

  log "build complete"
  printf 'KINDY_RELEASE_SHA=%s\n' "$sha"
  printf 'KINDY_PAYMENTS_ENABLED=%s\n' "$payments_enabled"
  printf 'KINDY_IMAGE_DIGEST_URI=%s@%s\n' "$IMAGE_BASE" "$digest"
}

deploy_preview() {
  local digest_uri="$1"
  local sha="${2:-$(current_sha)}"
  local deployed_image
  local launch_mode
  local story_chat_runtime_enabled
  local content_release_bucket
  local content_release_channel
  local candidate_url
  local previous_revision
  local preview_revision
  local url

  launch_mode="$(resolve_launch_mode preview)"
  story_chat_runtime_enabled="$(resolve_story_chat_runtime "$launch_mode")"
  content_release_bucket="$(resolve_content_release_bucket)"
  content_release_channel="$(resolve_content_release_channel preview)"
  require_command node
  assert_repo_root
  assert_gcloud_access
  assert_clean_at_sha "$sha"
  assert_artifact_repository
  # Public preview must always use the payment-disabled artifact. A pay1 image
  # can contain public checkout configuration even if runtime secrets are
  # cleared, so accepting either tag would weaken the preview boundary.
  assert_image_matches_sha "$digest_uri" "$sha" 0
  previous_revision="$(full_traffic_revision "$PREVIEW_SERVICE" 2>/dev/null || true)"

  log "deploying preview from exact digest $digest_uri"
  deploy_revision "$PREVIEW_SERVICE" preview "$digest_uri" "$sha" no-traffic \
    "$launch_mode" "$story_chat_runtime_enabled" \
    "$content_release_bucket" "$content_release_channel" preview-candidate
  # The tag is a public direct URL. Any error after creation must remove it so
  # an unapproved revision cannot remain reachable outside canonical traffic.
  trap remove_preview_candidate_tag EXIT
  deployed_image="$(service_image "$PREVIEW_SERVICE")"
  [[ "$deployed_image" = "$digest_uri" ]] || \
    die "preview service reports unexpected image: $deployed_image"
  url="$(service_url "$PREVIEW_SERVICE")"
  preview_revision="$(latest_ready_revision "$PREVIEW_SERVICE")"
  [[ -n "$preview_revision" ]] || die "preview did not report a ready revision"
  candidate_url="$(tag_url "$PREVIEW_SERVICE" preview-candidate)" || \
    die "preview candidate tag URL was not created"
  smoke_url "$candidate_url" "$sha" false "$preview_revision" || \
    die "preview candidate smoke failed; existing preview traffic is unchanged"
  gcloud run services update-traffic "$PREVIEW_SERVICE" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --to-revisions="${preview_revision}=100" \
    --remove-tags=preview-candidate \
    --quiet
  trap - EXIT
  if ! smoke_url "$url" "$sha" false "$preview_revision"; then
    if [[ -n "$previous_revision" ]]; then
      gcloud run services update-traffic "$PREVIEW_SERVICE" \
        --project="$PROJECT_ID" \
        --region="$REGION" \
        --to-revisions="${previous_revision}=100" \
        --quiet
    fi
    die "preview canonical smoke failed; previous traffic was restored when available"
  fi
  log "preview verified; production promotion may now use the same digest"
}

promote_production() {
  local digest_uri="$1"
  local sha="${2:-$(current_sha)}"
  local launch_mode
  local preview_image
  local preview_launch_mode
  local preview_revision
  local preview_runtime_enabled
  local preview_url
  local previous_revision
  local candidate_revision
  local story_chat_runtime_enabled
  local content_release_bucket
  local content_release_channel

  launch_mode="$(resolve_launch_mode production)"
  story_chat_runtime_enabled="$(resolve_story_chat_runtime "$launch_mode")"
  content_release_bucket="$(resolve_content_release_bucket)"
  content_release_channel="$(resolve_content_release_channel production)"
  require_command node
  assert_repo_root
  assert_gcloud_access
  assert_clean_at_sha "$sha"
  assert_artifact_repository
  # Payment-disabled preview images are intentionally non-promotable.
  assert_image_matches_sha "$digest_uri" "$sha" 1

  preview_image="$(service_image "$PREVIEW_SERVICE")" || die "preview service is missing"
  [[ "$preview_image" = "$digest_uri" ]] || \
    die "preview is running $preview_image, not requested production digest $digest_uri"
  preview_url="$(service_url "$PREVIEW_SERVICE")"
  preview_revision="$(latest_ready_revision "$PREVIEW_SERVICE")"
  preview_launch_mode="$(service_environment_value "$PREVIEW_SERVICE" KINDY_LAUNCH_MODE)" || \
    die "preview does not expose an inspectable launch mode"
  preview_runtime_enabled="$(service_environment_value "$PREVIEW_SERVICE" STORY_CHAT_RUNTIME_ENABLED)" || \
    die "preview does not expose an inspectable story runtime flag"
  case "$launch_mode" in
    production_presale)
      [[ "$preview_launch_mode" = "open_preview" ]] || \
        die "production_presale promotion requires an open_preview verification revision"
      ;;
    protected_chat_pilot)
      [[ "$preview_launch_mode" = "protected_chat_pilot" ]] || \
        die "protected chat promotion requires a protected chat preview revision"
      ;;
  esac
  [[ "$preview_runtime_enabled" = "$story_chat_runtime_enabled" ]] || \
    die "preview story runtime flag differs from the production target"
  smoke_url "$preview_url" "$sha" false "$preview_revision" || \
    die "preview readiness no longer passes; promotion blocked"

  previous_revision="$(full_traffic_revision "$PRODUCTION_SERVICE")" || \
    die "production must have exactly one revision receiving 100% traffic before promotion"
  log "deploying production candidate with zero traffic (rollback target: $previous_revision)"
  deploy_revision "$PRODUCTION_SERVICE" production "$digest_uri" "$sha" no-traffic \
    "$launch_mode" "$story_chat_runtime_enabled" \
    "$content_release_bucket" "$content_release_channel"
  candidate_revision="$(latest_ready_revision "$PRODUCTION_SERVICE")"
  [[ -n "$candidate_revision" ]] || die "Cloud Run did not report a ready candidate revision"
  [[ "$(service_image "$PRODUCTION_SERVICE")" = "$digest_uri" ]] || \
    die "production candidate reports an unexpected image"
  log "Cloud Run marked the zero-traffic candidate Ready; starting a 5% canary"
  gcloud run services update-traffic "$PRODUCTION_SERVICE" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --to-revisions="${candidate_revision}=5,${previous_revision}=95" \
    --quiet

  if ! smoke_canary "$PRODUCTION_URL" "$sha" "$candidate_revision" 80; then
    log "5% canary smoke failed; restoring $previous_revision" >&2
    gcloud run services update-traffic "$PRODUCTION_SERVICE" \
      --project="$PROJECT_ID" --region="$REGION" \
      --to-revisions="${previous_revision}=100" --quiet
    die "production canary failed and traffic was rolled back"
  fi

  local percent
  for percent in 25 50; do
    log "moving production canary to ${percent}%"
    gcloud run services update-traffic "$PRODUCTION_SERVICE" \
      --project="$PROJECT_ID" --region="$REGION" \
      --to-revisions="${candidate_revision}=${percent},${previous_revision}=$((100 - percent))" \
      --quiet
    if ! smoke_canary "$PRODUCTION_URL" "$sha" "$candidate_revision" 24; then
      log "${percent}% canary smoke failed; restoring $previous_revision" >&2
      gcloud run services update-traffic "$PRODUCTION_SERVICE" \
        --project="$PROJECT_ID" --region="$REGION" \
        --to-revisions="${previous_revision}=100" --quiet
      die "production canary failed and traffic was rolled back"
    fi
  done

  log "canaries passed; moving production traffic to $candidate_revision"
  gcloud run services update-traffic "$PRODUCTION_SERVICE" \
    --project="$PROJECT_ID" --region="$REGION" \
    --to-revisions="${candidate_revision}=100" --quiet

  if ! smoke_url "$PRODUCTION_URL" "$sha" false "$candidate_revision"; then
    log "public smoke failed; automatically restoring $previous_revision" >&2
    gcloud run services update-traffic "$PRODUCTION_SERVICE" \
      --project="$PROJECT_ID" \
      --region="$REGION" \
      --to-revisions="${previous_revision}=100" \
      --quiet
    die "production smoke failed and traffic was rolled back to $previous_revision"
  fi

  log "production promotion complete: $candidate_revision"
  printf 'ROLLBACK_COMMAND=bash scripts/gcp-release.sh rollback %s\n' "$previous_revision"
}

smoke_service() {
  local target="$1"
  local expected_sha="${2:-}"
  local url

  assert_gcloud_access
  case "$target" in
    preview)
      url="$(service_url "$PREVIEW_SERVICE")"
      smoke_url "$url" "$expected_sha" false
      ;;
    production)
      smoke_url "$PRODUCTION_URL" "$expected_sha" false
      ;;
    *) die "smoke target must be preview or production" ;;
  esac
}

rollback_production() {
  local revision="$1"
  local owner

  assert_gcloud_access
  [[ "$revision" = "${PRODUCTION_SERVICE}-"* ]] || \
    die "rollback revision must belong to service $PRODUCTION_SERVICE"
  owner="$(gcloud run revisions describe "$revision" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format='value(metadata.labels.serving_knative_dev/service)' 2>/dev/null || true)"
  # gcloud label projection escapes dots inconsistently across SDK versions;
  # the revision-name prefix plus a successful scoped describe is the fallback.
  [[ -n "$owner" || -n "$(gcloud run revisions describe "$revision" \
    --project="$PROJECT_ID" --region="$REGION" --format='value(metadata.name)' 2>/dev/null)" ]] || \
    die "revision does not exist in $PROJECT_ID/$REGION"

  log "rolling production traffic back to $revision"
  gcloud run services update-traffic "$PRODUCTION_SERVICE" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --to-revisions="${revision}=100" \
    --quiet
  smoke_url "$PRODUCTION_URL" "" false || \
    die "rollback traffic moved, but public readiness still fails; inspect Cloud Run immediately"
  log "rollback complete"
}

show_status() {
  local service
  assert_gcloud_access
  for service in "$PREVIEW_SERVICE" "$PRODUCTION_SERVICE"; do
    log "$service"
    gcloud run services describe "$service" \
      --project="$PROJECT_ID" \
      --region="$REGION" \
      --format='table(metadata.name,status.url,status.latestReadyRevisionName,spec.template.spec.containers[0].image)'
  done
}

main() {
  local command="${1:-}"
  case "$command" in
    bootstrap)
      [[ "$#" -eq 1 ]] || die "bootstrap takes no arguments"
      bootstrap
      ;;
    build)
      [[ "$#" -eq 1 ]] || die "build takes no arguments"
      build_release
      ;;
    deploy-preview)
      [[ "$#" -ge 2 && "$#" -le 3 ]] || die "deploy-preview requires DIGEST_URI [SOURCE_SHA]"
      deploy_preview "$2" "${3:-$(current_sha)}"
      ;;
    promote)
      [[ "$#" -ge 2 && "$#" -le 3 ]] || die "promote requires DIGEST_URI [SOURCE_SHA]"
      promote_production "$2" "${3:-$(current_sha)}"
      ;;
    smoke)
      [[ "$#" -ge 2 && "$#" -le 3 ]] || die "smoke requires preview|production [SOURCE_SHA]"
      smoke_service "$2" "${3:-}"
      ;;
    rollback)
      [[ "$#" -eq 2 ]] || die "rollback requires a production revision name"
      rollback_production "$2"
      ;;
    status)
      [[ "$#" -eq 1 ]] || die "status takes no arguments"
      show_status
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

if [[ "${BASH_SOURCE[0]}" = "$0" ]]; then
  main "$@"
fi
