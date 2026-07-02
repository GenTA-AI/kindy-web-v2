#!/usr/bin/env bash
set -euo pipefail

# DEPRECATED (2026-07-02, docs/07 P0-1): 수동 전용 스크립트(0008/0099)가
# supabase/manual/ 로 이동해 supabase/migrations/ 는 전부 자동 적용해도 안전하다.
# 프로비저닝 정본 경로는 Supabase CLI:
#
#   supabase link --project-ref <ref>
#   supabase db push
#
# 이 스크립트는 psql 로 마이그레이션 일부만 골라 적용하던 과거 방식의 잔재이며,
# 0010-0020 이 빠져 있어 프로비저닝 용도로 쓰면 안 된다.

echo "DEPRECATED: use 'supabase db push' (supabase/migrations/ is now fully safe to auto-apply)."
echo "Manual-only scripts live in supabase/manual/ (see its README)."
exit 1
