# review: test-wiring
decision: approve

## 목표 달성
테스트 **92개 → 115개(+23)**, 전부 통과. 편입된 5개:
- `src/lib/launch-surface.test.ts` — 라우트 폐쇄·배포 판별자 (이 미션 산출물, 고아였음)
- `src/lib/subscription-pricing.test.ts` — 가격 단일 출처 (이 미션 산출물, 고아였음)
- `src/content/studio/animal-village-bible.test.ts` — 미션 이전부터 방치
- `scripts/island/build-atlas.test.mjs` — **아동 금지 에셋 차단 게이트**(불변조항 19), 방치돼 있었음
- `scripts/test-josa.ts` — assertion 25개

## 판단이 정확했던 것
- **`scripts/verify-rls.ts`는 제외.** 실 키가 필요하고 쓰기를 시도하는 파괴적 스크립트다.
  제약을 정확히 지켰다.
- `scripts/test-josa.ts`는 `node:test`를 직접 선언하지 않는데, `tsx --test`에서 파일 단위로
  실행되며 25개 assertion이 통과하는 것을 확인하고 편입했다. 형식이 다르면 억지로 끼우지
  말라는 지시에 대해 **확인 후 판단**한 것 — 맞는 처리.
- 편입으로 새로 실패한 테스트 없음. 등록만 안 돼 있었을 뿐 전부 통과하는 테스트였다는
  전제가 맞았다.

## 재발 방지
`.github/workflows/ci.yml`에 "새 테스트 파일은 `package.json`의 test 스크립트 목록에 등록해야
한다" 주석. glob 도입 같은 구조 변경은 안 했다 — 범위 준수.

## critical / should_fix
없음.

## 이월 (Scope 밖 — 별도 태스크)
- CI가 `npx tsc --noEmit`만 돌린다. 이 저장소는 `next typegen && tsc --noEmit`이어야 하고
  (stale `.next` 혼재 시 plain tsc는 실패), **CI가 `npm run build`를 아예 안 돌린다.**
  Next 16의 빌드 전용 실패(RSC 경계·standalone·`NEXT_PUBLIC_` 인라인)가 Cloud Build 20분 뒤에야
  드러난다. 8/31 일정을 감안하면 값싼 보험.
