# rls-verify-matrix: RLS 검증 스크립트에 인증 세션 쓰기 시도 매트릭스 추가
effort: high

## Goal

`scripts/verify-rls.ts`는 이 프로젝트의 공식 RLS 검증 게이트인데, **한 번도 로그인해본 적이 없다.**
anon 키와 service-role 키로만 SELECT를 세어보고 "통과"라고 말한다.

이번 미션에서 찾은 결함 — 무료 구독 위조, 무한 무료체험, 크레딧 무한 재발급, 페이월 우회 —
**전부 이 사각지대에 있었다.** 그래서 마이그레이션 `0029`까지 살아남았다.

이 태스크는 그 사각지대를 없앤다. 스크립트가 **실제 인증 세션으로 쓰기를 시도**하고, 거부되지
않으면 실패해야 한다. 그래야 누군가 `0031`에서 정책을 다시 열었을 때 잡힌다.

## Scope
- `scripts/verify-rls.ts` 기존 검증 스크립트 확장
- `supabase/manual/README.md` 실행 절차 갱신이 필요하면 여기

## Constraints
- **PostgREST의 2xx/204만으로 성공·실패를 판정하지 마라.** RLS가 막으면 UPDATE/DELETE는 에러가
  아니라 "0행 영향"으로 조용히 성공한다. 반드시 **공격 전후로 실제 값을 스냅샷해서 불변임을 확인**하라.
  이 한 가지가 이 태스크의 핵심이다.
- 스크립트는 **읽기 전용 검증 도구가 아니다** — 쓰기를 시도한다. 그러므로:
  - 프로덕션 DB를 향해 돌지 않도록 안전장치를 넣어라(대상 URL 확인 또는 명시적 플래그).
  - 테스트로 만든 사용자·행은 끝나고 정리하거나, 최소한 무엇이 남는지 출력하라.
- **`.env`를 읽거나 시크릿 값을 출력하지 마라.** 기존 스크립트가 환경변수를 읽는 방식을 그대로 따르고,
  값은 절대 로그에 찍지 마라(존재 여부만).
- 실행에 실제 Supabase 키가 필요하므로 **`npm test`나 CI에 넣지 마라.** 사람 게이트로 남긴다.
  Validation에도 이 스크립트 실행을 넣지 마라.
- 기존 anon/service-role 검사를 지우지 마라. 추가하는 것이다.

## Deliverables

1. **인증 세션 획득 경로** — 두 개의 일회용 테스트 사용자로 로그인해서 각자의 JWT를 얻는다.
   생성 방법은 판단해서 정하라(service-role admin API가 자연스럽다). 두 개가 필요한 이유는
   cross-tenant 공격을 재현하기 위해서다.

2. **own-row 쓰기 거부 매트릭스** — 사용자 A가 자기 소유 행에 대해 시도했을 때 전부 거부되어야 한다.
   최소한 이번 미션이 막은 것들을 덮어라:
   - `purchases` UPDATE (status를 'paid'로) → 값이 안 바뀌어야 한다
   - `game_sessions` DELETE → 행이 남아 있어야 한다
   - `credits` UPDATE (balance 증액) / DELETE → 값이 안 바뀌어야 한다
   - `children` INSERT → 생성되면 안 된다
   - `game_rounds` / `view_events` / `quiz_results` INSERT → 생성되면 안 된다
   - `videos` INSERT/UPDATE → 안 되어야 한다

3. **cross-tenant 거부** — 사용자 A가 사용자 B의 `parent_id`/`child_id`로 SELECT·INSERT·UPDATE·DELETE를
   시도했을 때 전부 실패하거나 0행이어야 한다.

4. **페이월 원본 차단 확인** — 인증 사용자가 `library_videos`를 직접 SELECT했을 때 미디어 로케이터와
   스크립트를 얻지 못해야 한다.

5. **함수 EXECUTE 거부** — 인증 세션에서 `can_purchase`·`consume_credit` RPC 호출이 거부되어야 한다.

6. **출력 형식** — 각 항목을 `PASS`/`FAIL`로 한 줄씩 찍고, 하나라도 FAIL이면 **0이 아닌 종료코드**로
   끝난다. FAIL 줄에는 무엇이 어떻게 뚫렸는지(전/후 값) 적는다.

7. 스크립트 상단 주석에 **이 매트릭스가 왜 존재하는지** 적어라 — 2026-08-03 감사에서 발견된
   네 가지 결함이 anon/service-role 검사만으로는 안 잡혔다는 사실. 다음 사람이 지우지 않게.

## Validation

```bash
npm run lint
npx next typegen && npx tsc --noEmit
npm test
```

이 스크립트 자체는 실 DB 키가 필요하므로 **실행하지 않는다.** 대신 타입체크와 린트로 정적 정합성만
확인한다. 실제 실행은 리드가 사람 게이트에서 대행한다.

## Handoff requirements

최종 메시지 끝에: summary, files_changed, validation(명령어 + **실제 출력**), risks, handoff_note.

`handoff_note`에 반드시:
- **리드가 이 스크립트를 실행할 정확한 명령어와 필요한 환경변수 이름**(값 말고 이름만).
- 프로덕션 오작동 방지를 어떻게 구현했는가.
- 테스트 사용자·행이 남는다면 무엇이 남고 어떻게 지우는가.
- "0행 영향"을 성공으로 오판하지 않기 위해 어떤 방식으로 전후 값을 대조했는가.
