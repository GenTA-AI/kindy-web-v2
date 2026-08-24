# handoff: rls-verify-matrix (attempt 2)

## 상황

이전 워커의 **구조는 맞다. 다시 쓰지 마라.** 16개 쓰기 공격이 전부
`unchangedAfterAttack`(service-role 전후 스냅샷 값 비교)를 거치는 설계는 정확하고,
`expectedBefore` 가드·종료코드·시크릿 비출력·FK 순서 정리·잔존 ID 출력도 정상이다.

문제는 **"이 스크립트가 초록불인데 실은 아무것도 검사하지 않았을 수 있는" 경로 2개**와
**커버리지 구멍**이다. 아래만 고쳐라.

---

## CRITICAL 1 — 인증이 실제로 붙었는지 증명하라

`createActor`(248–283)는 `signedIn.session?.access_token`이 존재하는지, subject가 맞는지만 본다.
그건 **로컬 객체 검사**다. PostgREST가 그 JWT를 실제로 받고 `authenticated` 역할로 처리했는지는
확인하지 않는다.

세션이 조용히 안 붙으면 모든 요청이 `anon`으로 나가고 — anon은 어차피 전부 거부되므로 —
**16개 공격 + SELECT 검사 + RPC 검사가 전부 PASS**한다. `authenticated` 역할을 한 번도 안 건드리고
전 항목 초록불이 된다. 이 스크립트의 존재 이유가 정확히 그 역할을 검사하는 것이므로 치명적이다.

**고치는 법 (positive control)**: `children_select_own` 정책은 `0030`이 **의도적으로 남겨뒀다**
(`0030:28-33` 주석, 원본 정책 `0006_rls_policies.sql:19-21`). 그러니 `createFixtures` 직후:

- `actorA.client.from('children').select('id').eq('id', ids.childA)` → **정확히 1행**이어야 한다.
- `actorB`도 자기 child에 대해 동일하게 1행.

anon이면 0행이 나온다. **1행이 아니면 즉시 중단**하라(개별 FAIL이 아니라 run abort — 이후 결과가
전부 무의미하므로). 출력에 "authenticated positive control" 같은 이름으로 남겨서, 다음 사람이
이 줄의 목적을 알게 하라.

가능하면 두 번째 positive control도 넣어라: 같은 클라이언트가 **actorB의 child**를 SELECT하면
0행이어야 한다. 이러면 "JWT가 붙었고, 게다가 올바른 사용자로 붙었다"가 동시에 증명된다.

## CRITICAL 2 — 레거시 읽기 검사를 fixture 뒤로 옮기고, 공허한 통과를 없애라

`main`이 `runExistingReadChecks`를 862행에서 부르는데 `createFixtures`는 885행이다. 빈 DB에서
`anonCount === 0`은 **RLS를 완전히 꺼도 참**이라 아무것도 증명하지 못한다.

- `runExistingReadChecks` 호출을 `createFixtures` **뒤로** 옮겨라.
- `children` 검사는 `serviceRoleCount > 0`을 **단언**한 뒤에만 `anonCount === 0`을 PASS로 인정하라
  (fixture가 있으니 이제 참이다).
- 시드되지 않는 13개 테이블 루프(230–238)는 **PASS가 아니라 SKIP/inconclusive로 표기**하라.
  실패할 수 없는 초록불은 없는 것만 못하다. SKIP은 종료코드에 영향을 주지 않되 출력에는 남긴다.

## S1 — "아무 에러나 = 거부"를 없애라

세 곳이 에러의 종류를 안 보고 PASS 처리한다: `selectMustBeEmpty`(467–469),
`library_videos` SELECT(743–745), `can_purchase` RPC(757–759).

`PGRST202`(함수가 스키마 캐시에 없음)·`42P01`(테이블 없음)·`42703`(컬럼 없음)까지 통과로 먹는다.
**`can_purchase`(756)가 최악**이다 — 데이터 기반 대체 판정이 없어서 함수 이름이나 인자가 바뀌면
영원히 PASS다.

권한 거부는 `42501`이다. RPC 검사는 **`error.code === '42501'`을 요구**하고, 다른 코드는 FAIL 또는
inconclusive로 처리하라. 바로 아래 `consume_credit`(762–793)이 이미 올바른 패턴(스냅샷 비교 + 에러
요구)이니 그걸 따라라. 두 SELECT 헬퍼도 같은 원칙을 적용하라(데이터 판정은 유지하되, 예상 밖
에러 코드를 성공으로 삼지 말 것).

## S2 — 커버리지 구멍을 메워라

**최우선: `purchases` INSERT 공격이 없다.** 현재 481·669행의 UPDATE만 있다. INSERT가
**`0030`이 존재하는 이유 그 자체**이고 더 직접적인 공격이다:

```
actorA.client.from('purchases').insert({
  parent_id: <actorA 본인>, bundle_type: 'subscription',
  credits_added: 0, status: 'paid', order_id: <임의 문자열>, ...
})
```

이게 통하면 결제 라우트의 `alreadyPaid` 판정과 `grant_credits_on_purchase`
(`0004_credits_purchases.sql:91-108`, `where id = ... and status = 'paid'`)가 둘 다 걸린다.
`expectedBefore: 'absent'` + 공격 후 해당 `order_id` 행이 여전히 없음을 service-role로 확인하는
형태로 넣어라.

그 밖에 `0030`이 회수했는데 미검증인 것 (전부 추가):
- syllabus 카탈로그 SELECT 3종 — `syllabuses` · `syllabus_units` · `syllabus_lessons` (`0030:88-90`)
- `children` UPDATE / DELETE (`0030:32-33`) — 주석이 DELETE의 cascade 위험을 명시했는데 INSERT만 테스트됨
- `emoji_reactions` · `word_profiles` · `syllabus_enrollments` · `lesson_progress` (`0030:56-74`) — 전무
- `waitlist` INSERT (`0030:93`) — anon 경로였으므로 anon 클라이언트로도 시도할 것
- `credits` INSERT (`0030:43`) · `videos` DELETE · `game_sessions` INSERT/UPDATE

추가하는 공격도 **반드시 기존 `unchangedAfterAttack` 패턴**을 쓰고, fixture payload가 현재 CHECK
제약을 통과하는지 확인하라(통과하지 못하면 RLS 이전에 막혀 공격이 공허해진다).

## nice_to_have (여유 있으면)
- staging 게이트(135–149)가 운영자를 신뢰한다. `RLS_VERIFY_EXPECTED_HOST`에 프로덕션 호스트를
  넣으면 프로덕션에 파괴적 매트릭스가 돈다. 프로덕션 호스트 하드코딩 거부를 추가하라.
- `product_defaults`(240–245)가 "authenticated SELECT 기대"라고 출력하면서 service-role만 단언한다.
  이제 actor가 있으니 실제로 검사하라.
- actor별 `auth.storageKey` 분리(GoTrueClient 중복 경고 제거).
- README의 "정상 종료 시 정리"는 과소 서술 — `finally`(893)라 실패 시에도 돈다. 문구 수정.

## 유지할 것 (건드리지 마라)
- `unchangedAfterAttack`의 전후 스냅샷 값 비교 구조와 `expectedBefore` 가드.
- 프로덕션 방지 4중 장치(환경값 거부·local 루프백 제한·staging HTTPS 호스트 일치·명시적 ack 문자열).
- 시크릿을 이름으로만 출력하는 규칙.
- `finally` 정리와 잔존 ID 출력.
- 이 스크립트를 `npm test`나 CI에 넣지 않는 것(실 키 필요 — 사람 게이트).

## 검증
기존 Validation(lint / typegen+tsc / test) 그대로. **스크립트는 실행하지 마라**(실 DB 키 필요).
핸드오프에 아래를 반드시 적어라:
- positive control이 실패할 때 출력되는 메시지 전문.
- 최종 공격 목록(테이블 × 커맨드)을 표로. 리드가 `0030`이 회수한 정책과 1:1 대조한다.
