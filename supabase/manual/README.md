# supabase/manual — 자동 적용 금지 스크립트

`supabase db push`(및 `db reset`)는 `supabase/migrations/`의 SQL을 **주석과 무관하게 버전 순으로 전부 적용**한다.
그래서 "수동 전용" 스크립트는 migrations 폴더에 두면 안 된다. 이 폴더의 파일은 CLI가 절대 자동 적용하지 않는다.

- `0008_demo_parent_cleanup.sql` — demo-parent 데이터 파괴적 정리. 적용 전 백업 필수.
- `0099_rls_disable_rollback.sql` — **긴급 롤백 전용.** 전 테이블 RLS 해제(아동 데이터 전면 노출).
  RLS 정책 오류로 prod fetch가 0건이 되는 사고 상황에서만, 대표 승인 후 psql로 수동 실행하고
  원인 수정 즉시 RLS를 재활성화한다.

수동 실행 예:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/manual/0099_rls_disable_rollback.sql
```

과거에 `db push`로 0008/0099가 이미 히스토리에 기록된 환경이 있다면(현재 계획상 없음 — 프로드는 미프로비저닝):

```bash
supabase migration repair --status reverted 0008 0099   # 히스토리 정리
npx tsx scripts/verify-rls.ts                            # RLS 상태 검증 (0099가 실행된 적 있으면 0006/0016 정책 재적용)
```

이력: 2026-07-02 docs/07 감사 P0-1 — 이 두 파일이 migrations에 있어 `db push` 시 자동 적용되는 함정을 제거.
