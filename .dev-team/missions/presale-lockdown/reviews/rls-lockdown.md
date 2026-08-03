# review: rls-lockdown
decision: approve

## 렌즈 1 — DB 레이어 강제 (이 미션의 존재 이유): 통과

`0030`이 정책 삭제만으로 네 개의 실제 공격을 닫는다. RLS는 켜져 있고 해당 커맨드에 정책이
하나도 없으면 기본 거부이므로, `drop policy`만으로 authenticated는 막히고 service_role은 계속
우회한다 — `0024~0029`가 쓰는 패턴 그대로다. 새 패턴 발명 없음.

닫히는 것:
- `purchases` INSERT/UPDATE/DELETE 회수 → **무료 구독 위조 차단**(결제 라우트가 `status='paid'`를
  믿고 청구를 건너뛰던 경로).
- `game_sessions` DELETE/UPDATE 회수 → **무한 무료체험 리셋 차단**.
- `credits` DELETE/UPDATE/INSERT + `children_insert_own` 회수 → **크레딧 무한 재발급 차단**
  (크레딧 행 삭제 후 아이 추가로 트리거 재발급하던 이중 경로 양쪽 다).
- `library_videos_select_published` + syllabus 카탈로그 3종 회수 → **페이월 우회 차단**
  (재생 가능한 서명 URL·스크립트 직접 열람).
- `waitlist_insert_own`(anon) 회수 → API IP 스로틀 우회 차단.

## 렌즈 2 — 머니 판정 신뢰 원천: 통과
머니 테이블의 client DML이 전부 사라졌다. 핸드오프가 "머니 테이블 정책과 두 RPC의 client
EXECUTE는 결제 신뢰 경계를 다시 설계하지 않는 한 복구 금지"를 명시한 것도 정확한 판단이다.

## 렌즈 3 — 기존 통제 보존: 통과
RLS를 끄지 않았고, service_role 접근을 막지 않았으며, 기존 마이그레이션을 수정하지 않았다.
`0099_rls_disable_rollback.sql`을 쓰지 않는다고 롤백 절에 명시.

## 리드가 직접 검증한 것 (워커 주장을 재확인)

1. **함수 시그니처** — 틀리면 마이그레이션이 통째로 ERROR 난다. 전수 대조:
   `0004:47`·`0017:145` `can_purchase(p_parent_id text)`, `0004:71` `consume_credit(p_parent_id text)`.
   `create or replace`라 오버로드 없음. `public.can_purchase(text)`·`public.consume_credit(text)` 정확.
   `0022`의 선례(`revoke ... from public, anon, authenticated` + `grant ... to service_role`)와 동일 형식.
2. **워커 조사의 빈틈을 메움** — 워커는 *브라우저* 클라이언트만 봤다. 그런데 `src/lib/supabase-server.ts`는
   **anon 키**를 쓰므로 RLS를 받는다. 전수 확인 결과 사용처 4곳(`src/proxy.ts`,
   `src/app/auth/callback/route.ts`, `src/app/subscribe/page.tsx`, `src/lib/auth.ts`) **전부 auth 전용,
   `.from()`/`.rpc()` 데이터 호출 0건**. 회수 전제가 양쪽 클라이언트 모두에서 성립한다.
3. **앱 무영향** — lint·tsc·test·build 전부 통과. 앱 코드 변경 0줄이므로 이게 정상이다.

## 워커가 스스로 찾아낸 것 (스펙보다 정확했던 부분)
- `view_events_insert_own_library`(`0011`)는 내 태스크에 없던 정책인데 마이그레이션 트리를 읽고
  찾아내 함께 회수했다. 빠뜨렸으면 구멍이 남았다.
- `syllabus_units_select_published`도 마찬가지. 카탈로그를 부분만 닫아 "불완전한 직접 경로"를
  남기지 않겠다는 판단 근거까지 적었다.

## critical
없음.

## should_fix
없음.

## 적용 시 주의 (사람 게이트 — 리드 책임)
- 워커가 임시 PostgreSQL로 문법·멱등성을 돌리려 했으나 샌드박스 공유메모리 제한(`shmget`)으로
  서버가 안 떴다. **따라서 이 SQL은 실 DB에서 실행된 적이 없다.** 다만 전 문장이
  `drop policy if exists` / `revoke` / `grant`뿐이고 유일한 실패 지점이던 함수 시그니처는 위에서
  수동 대조했다. 적용은 **트랜잭션 안에서, 스테이징 먼저**.
- 적용 후 검증은 핸드오프의 6단계 절차를 따른다. 핵심: **PostgREST의 200/204를 성공 증거로
  보지 말고 service-role로 전후 값을 다시 읽어 불변을 확인**할 것.
- 이 검증을 자동화하는 것이 `rls-verify-matrix` 태스크다. 그 전까지 `scripts/verify-rls.ts`
  단독으로는 이 네 취약점의 폐쇄를 증명할 수 없다(워커도 risks에 명시).
