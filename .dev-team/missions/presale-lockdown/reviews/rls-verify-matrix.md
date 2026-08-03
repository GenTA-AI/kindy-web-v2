# review: rls-verify-matrix
decision: request_changes

리뷰 방식: 885줄 diff라 general-purpose 서브에이전트에 정밀 검토를 붙이고, 리드가 핵심 주장 3건을
코드에서 직접 재확인했다.

## 구조는 맞다 (유지할 것)

16개 쓰기 공격(own-row 10 + cross-tenant 6) 전부가 `unchangedAfterAttack`를 거친다 —
service-role 스냅샷 → 공격 → 재조회 → **값 비교**. PostgREST 에러는 판정이 아니라 detail 문자열에만
쓰인다. **응답 코드로 판정하는 쓰기 공격은 하나도 없다.** 내가 가장 걱정한 지점이고, 여기는 통과다.
`expectedBefore: 'present'|'absent'` 가드가 공허한 통과(없는 행 공격, 이미 있는 행 INSERT)도 막는다.
종료코드·시크릿 비출력(이름만)·FK 순서 정리·부분 실패 시 잔존 ID 출력도 정상.
fixture payload를 실제 스키마 제약과 대조한 결과 전부 유효 — 정책이 되살아나면 공격이 진짜로 성공한다.

## CRITICAL 1 — 인증이 실제로 붙었는지 증명하는 장치가 없다 (거짓 초록불)

`createActor`(248–283)는 **로컬 세션 객체만** 검사한다: `access_token`이 있는지(275), subject가
일치하는지(278). PostgREST가 그 JWT를 **실제로 받았는지는 한 번도 확인하지 않는다.**

세션이 조용히 안 붙으면(클라이언트 설정 오류·supabase-js 버전 변화·만료) 모든 요청이 `anon`으로
나가고, 그러면:
- 16개 쓰기 공격 → anon 거부 → 행 불변 → **PASS**
- `selectMustBeEmpty`(636, 684), `library_videos` SELECT(738) → anon 0행 → **PASS**
- `can_purchase`(755)·`consume_credit`(762) → anon EXECUTE 없음 → 에러 → **PASS**

**`authenticated` 역할을 한 번도 안 건드리고 전 항목 초록불이 된다.** 이 스크립트의 존재 이유가
정확히 그 역할을 검사하는 것이므로, 이건 치명적이다. 리드 직접 확인 완료(275–279행).

## CRITICAL 2 — 레거시 읽기 검사가 fixture보다 먼저 돌아 공허하다

`main`이 `runExistingReadChecks`를 **862행**에서 부르고 `createFixtures`는 **885행**이다(리드 확인).
빈 DB에서 `anonCount === 0`은 **RLS를 완전히 꺼도 참**이다. `serviceRoleCount`는 출력만 하고
`> 0`을 단언하지 않는다. 13개 테이블 루프는 시드조차 안 되므로 더 공허하다.
**실패할 수 없는 초록불은 없는 것만 못하다.**

## should_fix

**S1 — 세 검사가 "아무 에러나 = 거부"로 취급한다**(467–469, 743–745, 757–759).
`PGRST202`(함수 없음)·`42P01`(테이블 없음)·`42703`(컬럼 없음)도 PASS로 먹는다.
`can_purchase`(756)가 최악이다 — 데이터 기반 대체 판정이 없어서 **함수 이름이나 인자만 바뀌어도
영원히 PASS**다. 바로 아래 `consume_credit`(762–793)은 스냅샷 비교 + 에러 요구로 올바르게 짜여
있으므로 그 패턴을 그대로 쓰면 된다.

**S2 — `purchases` INSERT 공격이 없다** (리드 직접 확인: 481·669행 UPDATE만).
이게 `0030`이 존재하는 이유 그 자체인데 가장 직접적인 형태가 미검증이다. INSERT로
`{parent_id: 본인, bundle_type:'subscription', status:'paid', order_id: 임의}`를 넣으면
결제 라우트의 `alreadyPaid` 판정과 `grant_credits_on_purchase`(`0004:91-108`)가 둘 다 걸린다.
`0030` 헤더 주석(3–6행)이 막는다고 선언한 바로 그 공격이다.

그 외 `0030`이 회수했는데 미검증: syllabus 카탈로그 3종 SELECT, `children` UPDATE/DELETE,
`emoji_reactions`·`word_profiles`·`syllabus_enrollments`·`lesson_progress` 전체, `waitlist` INSERT,
`credits` INSERT, `videos` DELETE, `game_sessions` INSERT/UPDATE.

## nice_to_have
- staging 게이트가 운영자를 신뢰한다(135–149) — `RLS_VERIFY_ENVIRONMENT=staging` +
  `RLS_VERIFY_EXPECTED_HOST=<프로덕션 호스트>`면 프로덕션에 파괴적 매트릭스가 돈다.
  프로덕션 호스트 하드코딩 거부 목록으로 닫을 것.
- `product_defaults`(240–245)가 "authenticated SELECT 기대"라고 출력하면서 service-role 읽기만 단언.
- 두 GoTrueClient가 storage key를 공유해 경고가 뜬다 — actor별 `auth.storageKey` 분리.

## README
정확하다. 변수 이름만 문서화하고 2xx/204를 판정에 안 쓴다는 것까지 코드와 일치.
사소한 오류 하나: 정리는 `finally`(893)라 실패 시에도 돈다 — "정상 종료 시"는 과소 서술.
