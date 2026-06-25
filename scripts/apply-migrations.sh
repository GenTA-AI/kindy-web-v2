#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_URL="${DATABASE_URL:-${SUPABASE_DB_URL:-}}"

SAFE_MIGRATIONS=(
  "supabase/migrations/0006_rls_policies.sql"
  "supabase/migrations/0007_waitlist_invite.sql"
)

echo "Applying safe migrations only: 0006_rls_policies.sql, 0007_waitlist_invite.sql"
echo "Manual only: 0008_demo_parent_cleanup.sql (destructive cleanup)"
echo "Manual only: 0099_rls_disable_rollback.sql (emergency rollback)"

if [[ -z "${DB_URL}" ]]; then
  echo "DATABASE_URL or SUPABASE_DB_URL is not set."
  echo "Run manually after setting one of them, for example:"
  echo "  DATABASE_URL='postgresql://...' scripts/apply-migrations.sh"
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to apply only 0006 and 0007 without auto-running 0008/0099." >&2
  exit 1
fi

for migration in "${SAFE_MIGRATIONS[@]}"; do
  echo "Applying ${migration}"
  psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${ROOT_DIR}/${migration}"
done

echo "Done. 0008 and 0099 were not applied."
