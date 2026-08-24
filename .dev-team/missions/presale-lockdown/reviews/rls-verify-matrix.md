# review: rls-verify-matrix (attempt 2)
decision: approve

## CRITICAL 2건 해소 확인 — 리드 직접

**C1 인증 positive control**: 구현됨. `createFixtures` 직후 actor A·B가 각각 자기 child를
**정확히 1행** SELECT하는지, actor A가 B의 child에 대해 **0행**인지 확인하고, 아니면 run을 중단한다
(585–593행). 중단 메시지가 이유까지 설명한다:
> "Authenticated positive control failed: PostgREST did not return exactly one own child for
> actor A and actor B and zero cross-tenant children; authenticated attack results would be
> meaningless, so the run was aborted."

이제 JWT가 안 붙으면 전 항목 초록불이 되는 대신 **run이 죽는다.** 요구한 그대로다.
게다가 cross-tenant 0행까지 확인해 "붙었고, 게다가 올바른 사용자로 붙었다"를 동시에 증명한다.

**C2 호출 순서**: `createFixtures`(1044) → `runExistingReadChecks`(1048). 뒤집혔다.
빈 DB에서 공허하게 통과하던 경로가 사라졌다.

## should_fix 해소 확인

**S1**: `42501`(권한 거부) 요구가 5곳에 들어갔다. `can_purchase`가 함수 이름만 바뀌어도 영원히
PASS하던 경로가 닫혔다.

**S2 커버리지 — `0030`이 회수한 정책과 1:1 대조, 빠짐 없음**:

| 0030이 회수한 것 | 검증 |
|---|---|
| `children` INSERT/UPDATE/DELETE | ✓ own 3종 + cross SELECT/INSERT |
| `videos`·`credits`·`purchases` DML | ✓ 각 INSERT/UPDATE/DELETE |
| **`purchases` INSERT(paid 위조)** | ✓ **추가됨 — 이 미션의 핵심 공격** |
| `view_events`·`emoji_reactions`·`quiz_results`·`word_profiles` | ✓ 각 3종 |
| `syllabus_enrollments`·`lesson_progress` | ✓ 각 3종 |
| `game_sessions`·`game_rounds` | ✓ 각 3종 + cross DELETE |
| `library_videos` SELECT | ✓ 미디어 로케이터·스크립트 |
| syllabus 카탈로그 3종 SELECT | ✓ 전부 |
| `waitlist` anon INSERT | ✓ |
| `can_purchase`·`consume_credit` EXECUTE | ✓ (후자는 크레딧 스냅샷까지) |

`unchangedAfterAttack` 호출이 16 → **31개**로 늘었고, 전부 service-role 전후 값 비교를 거친다.
`expectedBefore: absent/present`로 fixture 유효성을 먼저 단언하는 구조도 유지됐다.

## nice_to_have 반영
현재 프로덕션 Supabase 호스트를 **명시적 차단 목록**에 넣었다. 운영자가 `RLS_VERIFY_EXPECTED_HOST`에
프로덕션을 넣어도 파괴적 매트릭스가 안 돈다. 워커가 risks에 "호스트가 바뀌면 목록도 갱신해야 한다"고
정직하게 남긴 것도 맞다.

## critical
없음.

## should_fix
없음.

## 사람 게이트 (리드 대행 — 대표 승인 필요)
이 스크립트는 **아직 실행되지 않았다**(실 Supabase 키 + 적용된 `0030`이 필요). 실행 명령:
```
RLS_VERIFY_ENVIRONMENT=local \
RLS_VERIFY_ALLOW_WRITES=I_ACKNOWLEDGE_THIS_IS_NOT_PRODUCTION \
npx tsx --env-file=.env.local scripts/verify-rls.ts
```
**순서가 중요하다**: `0030` 적용(스테이징 먼저) → 이 스크립트 실행 → 전 항목 PASS 확인.
이걸 통과해야 "네 구멍이 실제로 막혔다"고 말할 수 있다. 그전까지는 코드상 막았을 뿐이다.
