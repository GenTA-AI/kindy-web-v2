# t2-migrations: 0024–0029 마이그레이션 파일 작성 (02 문서 SQL 전사)
effort: medium

## Goal
`docs/plan/02_SCHEMA_RECONCILIATION.md`(스키마 SSOT)의 §3~§8에 확정된 마이그레이션 6본을 `supabase/migrations/`에 파일로 생성하고, 기존 검증 스크립트(verify-migrations.ts·verify-rls.ts)에 신규 테이블 검증을 확장한다. **DB 적용(`supabase db push`)은 절대 하지 않는다 — [사람] 게이트.** 절차 정본: `docs/plan/04_R0_EXECUTION_PLAN.md` Task 2.1.

## Scope
- `NEW: supabase/migrations/0024_hero_world_state.sql`
- `NEW: supabase/migrations/0025_hero_avatars.sql`
- `NEW: supabase/migrations/0026_product_defaults.sql`
- `NEW: supabase/migrations/0027_studio_episodes.sql`
- `NEW: supabase/migrations/0028_studio_model_registry.sql`
- `NEW: supabase/migrations/0029_hero_metrics.sql`
- `scripts/verify-migrations.ts` (검증 확장만)
- `scripts/verify-rls.ts` (검증 확장만)

## Constraints
- SQL은 02 문서의 각 절 SQL 블록을 **그대로 전사**하라(컬럼·CHECK·시드 값·코멘트 재발명 금지 — LEAD nag #1). 02에 없는 개선을 추가하지 마라.
- 실행 명령 금지: `supabase db push`, `supabase link`, psql로 원격 접속. 네트워크로 DB를 만지지 마라.
- verify 스크립트 확장은 기존 패턴(파일 내 기존 테이블 검증 방식)을 따르라 — 신규 테이블·컬럼·RLS 존재 확인 항목 추가. 실행은 db push 이후에만 가능함을 스크립트 주석에 명시.
- worktree에 node_modules가 없으면 먼저 `npm ci`.

## Deliverables
- 마이그레이션 6본 — 02 문서와 diff 수준으로 일치(헤더 주석에 "SSOT: docs/plan/02 §N" 표기)
- verify 스크립트에 0024~0029 검증 블록 추가

## Validation
```bash
ls supabase/migrations/ | grep -c '^002[4-9]_' | grep -qx 6 && echo six-files
grep -ql 'create table.*world_states\|create table world_states' supabase/migrations/0024_hero_world_state.sql && echo ws-ok
grep -ql 'photoreal_check' supabase/migrations/0025_hero_avatars.sql && echo avatar-ok
grep -ql "insert into product_defaults" supabase/migrations/0026_product_defaults.sql && echo defaults-ok
grep -ql 'episode_nodes' supabase/migrations/0027_studio_episodes.sql && echo episodes-ok
grep -ql 'model_registry' supabase/migrations/0028_studio_model_registry.sql && echo registry-ok
grep -ql 'holdout_assignments' supabase/migrations/0029_hero_metrics.sql && echo metrics-ok
grep -ql '0024' scripts/verify-migrations.ts && echo verify-ok
npm run lint
npx tsc --noEmit
```

## Handoff requirements
End your final message with: summary, files_changed, validation, risks, handoff_note — 특히 02 문서와 의도적으로 다르게 한 곳이 있으면(없어야 정상) 반드시 명시.
