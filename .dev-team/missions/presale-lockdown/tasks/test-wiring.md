# test-wiring: 고아 테스트를 npm test에 편입
effort: medium

## Goal

**돌지 않는 회귀 감시 장치는 없는 것과 같다.**

이 저장소의 `npm test`는 테스트 파일 목록을 `package.json`에 하드코딩한다. 그래서 새 테스트를
만들어도 그 목록에 등록하지 않으면 **영원히 안 돌고, CI도 통과시킨다.** 실제로 지금 그런 파일이
여러 개 있다.

이번 미션이 만든 것 중:
- `src/lib/launch-surface.test.ts` — 프리세일 라우트 폐쇄 판정
- `src/lib/subscription-pricing.test.ts` — 가격 단일 출처

미션 이전부터 방치된 것:
- `src/content/studio/animal-village-bible.test.ts`
- `scripts/island/build-atlas.test.mjs` — 아동 금지 에셋 차단 게이트(불변조항 19)
- `scripts/test-josa.ts` — 조사 처리 (테스트 러너 형식이 다를 수 있음, 확인 필요)

전부 **현재 통과하는 테스트**다. 실패해서 빠진 게 아니라 등록을 안 해서 빠졌다.

이 태스크가 끝나면 저장소의 모든 테스트가 `npm test` 한 번으로 돈다.

## Scope
- `package.json` test 스크립트
- `.github/workflows/ci.yml` CI가 전체 테스트를 돌리는지 확인·정정

## Constraints
- **테스트 내용을 고치지 마라.** 등록만 한다. 편입했더니 실패하는 테스트가 있으면
  **고치지 말고 핸드오프에 보고**하라(별도 태스크로 분리한다).
- `scripts/verify-rls.ts`는 **절대 넣지 마라.** 실 Supabase 키가 필요하고 쓰기를 시도하는
  파괴적 스크립트다. 사람 게이트로 남는다.
- 실 키·네트워크·DB가 필요한 스크립트는 어느 것도 넣지 마라. 순수 단위 테스트만.
- `scripts/test-josa.ts`는 `node:test` 형식이 아닐 수 있다. 형식이 다르면 억지로 끼워넣지 말고
  현재 어떻게 실행되는지 확인해서 **적합하면 편입, 아니면 그 이유를 핸드오프에 적어라.**
- 새 의존성·새 테스트 러너 도입 금지. 기존 `tsx --test` 방식 그대로.
- `test:golden`을 없애거나 합치지 마라 — 기존 구조 유지.

## Deliverables
1. `package.json`의 `test`가 위 파일들을 포함한다(`verify-rls.ts` 제외, josa는 판단 결과대로).
2. `npm test`가 전부 통과한다.
3. CI(`.github/workflows/ci.yml`)가 그 `npm test`를 돌린다. 이미 돌고 있으면 확인만 하고 그대로 둔다.
4. 향후 같은 누락이 재발하지 않도록, `package.json`의 test 스크립트 근처나 CI에
   **"새 테스트 파일은 이 목록에 등록해야 한다"는 한 줄 주석/메모**를 남겨라
   (glob 도입 같은 구조 변경은 하지 마라 — 범위 밖).

## Validation

```bash
npm run lint
npx next typegen && npx tsc --noEmit
npm test
npm run build
```

## Handoff requirements

최종 메시지 끝에: summary, files_changed, validation(명령어 + **실제 출력**, 편입 후 늘어난
테스트 총 개수가 보이게), risks, handoff_note.

`handoff_note`에 반드시:
- 편입 전/후 테스트 개수.
- 편입한 파일 목록과 **편입하지 않은 파일 + 그 이유**.
- 편입했더니 실패한 테스트가 있으면 어느 것이 왜 실패하는지(고치지 말고 보고만).
