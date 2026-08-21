#!/usr/bin/env bash
set -euo pipefail

cat >&2 <<'MESSAGE'
ERROR: scripts/deploy-cloud-run.sh is retired because it mutated production
without preview/digest verification. Use the guarded release flow instead:

  bash scripts/gcp-release.sh --help

Runtime Secret Manager references are wired automatically by deploy-preview and
promote; a production image can only be promoted after preview readiness passes.
MESSAGE
exit 2
