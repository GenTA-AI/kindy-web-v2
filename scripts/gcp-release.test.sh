#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=./gcp-release.sh
source "$(dirname "$0")/gcp-release.sh"

fail() {
  printf 'gcp-release.test: %s\n' "$1" >&2
  exit 1
}

# Stub only the read-only Secret Manager metadata call used by the resolver.
# No credential value or network access is involved in this test.
gcloud() {
  local argument
  local secret_name=""

  if [[ "${1-}" = "artifacts" && "${2-}" = "docker" && "${3-}" = "images" && "${4-}" = "describe" ]]; then
    case "${5-}" in
      *-pay0) printf 'sha256:%064d\n' 0 ;;
      *-pay1) printf 'sha256:%064d\n' 1 ;;
      *) return 1 ;;
    esac
    return
  fi

  for argument in "$@"; do
    case "$argument" in
      --secret=*) secret_name="${argument#--secret=}" ;;
    esac
  done
  [[ -n "$secret_name" ]] || return 1
  printf 'projects/123/secrets/%s/versions/7,ENABLED\n' "$secret_name"
}

[[ "$(runtime_secret_bindings preview)" = "" ]] || \
  fail 'preview must have zero Secret Manager bindings'

production_bindings="$(runtime_secret_bindings production)"
[[ "$production_bindings" = *'SUPABASE_SERVICE_ROLE_KEY=kindy-supabase-service-role-key:7'* ]] || \
  fail 'production service key was not pinned to a numeric version'
[[ "$production_bindings" != *':latest'* ]] || \
  fail 'production bindings must never retain the latest alias'

[[ "$(runtime_service_account preview)" = "$PREVIEW_RUNTIME_SERVICE_ACCOUNT" ]] || \
  fail 'preview runtime identity mismatch'
[[ "$(runtime_service_account production)" = "$PRODUCTION_RUNTIME_SERVICE_ACCOUNT" ]] || \
  fail 'production runtime identity mismatch'

test_sha='1111111111111111111111111111111111111111'
pay0_digest="${IMAGE_BASE}@sha256:0000000000000000000000000000000000000000000000000000000000000000"
pay1_digest="${IMAGE_BASE}@sha256:0000000000000000000000000000000000000000000000000000000000000001"
assert_image_matches_sha "$pay0_digest" "$test_sha" 0
if (assert_image_matches_sha "$pay1_digest" "$test_sha" 0 >/dev/null 2>&1); then
  fail 'payment-enabled artifact must not satisfy the preview pay0 boundary'
fi

if (
  KINDY_LAUNCH_MODE=protected_chat_pilot
  STORY_CHAT_RUNTIME_ENABLED=1
  resolve_story_chat_runtime protected_chat_pilot >/dev/null 2>&1
); then
  fail 'story runtime activation must remain hard-blocked'
fi

printf 'gcp-release.test: ok\n'
