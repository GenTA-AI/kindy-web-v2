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
```

## 인증 RLS 사람 게이트

`scripts/verify-rls.ts`는 읽기 전용 도구가 아니다. 두 명의 일회용 Auth 사용자를 만든 뒤 실제
`authenticated` JWT로 INSERT/UPDATE/DELETE/RPC를 시도한다. 0099가 실행된 적이 있다면 필요한 정책과
최신 마이그레이션을 사람이 먼저 재적용한 뒤, 프로덕션이 아닌 로컬 Supabase에서 다음처럼 실행한다.

```bash
RLS_VERIFY_ENVIRONMENT=local \
RLS_VERIFY_ALLOW_WRITES=I_ACKNOWLEDGE_THIS_IS_NOT_PRODUCTION \
npx tsx --env-file=.env.local scripts/verify-rls.ts
```

필요한 환경변수 이름은 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `RLS_VERIFY_ENVIRONMENT`, `RLS_VERIFY_ALLOW_WRITES`다. 원격 staging에서는
`RLS_VERIFY_EXPECTED_HOST`도 필요하다. 값은 로그에 출력하지 않는다.

안전장치는 `production` 환경값 거부, 로컬 URL의 loopback 제한, staging의 HTTPS·호스트 정확 일치,
알려진 프로덕션 Supabase 호스트 거부, 명시적 쓰기 확인 문자열로 구성된다. 성공·실패와 무관하게
`finally`에서 fixture 행과 Auth 사용자 두 명을 정리한다. 정리 실패 시 `FAIL cleanup`에 run ID와
잔존 가능성이 있는 사용자·행 ID를 출력하므로 service-role로 자식 행부터 삭제하고 Auth admin API로
사용자를 삭제한다.

UPDATE/DELETE의 2xx/204는 판정 근거로 쓰지 않는다. 각 공격 직전과 직후에 service-role로 실제 행의
존재와 대상 컬럼을 조회해 값을 비교하며, 하나라도 달라지면 전/후 값을 포함한 `FAIL`을 출력하고
0이 아닌 종료코드로 끝난다. 실 DB 키가 필요하므로 이 스크립트는 `npm test`나 CI validation에 넣지
않고 사람 게이트로만 실행한다.

이력: 2026-07-02 docs/07 감사 P0-1 — 이 두 파일이 migrations에 있어 `db push` 시 자동 적용되는 함정을 제거.
