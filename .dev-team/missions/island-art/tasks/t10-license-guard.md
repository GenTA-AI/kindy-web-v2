# t10-license-guard
effort: medium
high_risk: 0

## Goal
아동 정책 라이선스 가드 방어깊이 보강(t7 리뷰 should_fix): build-atlas.mjs의
FORBIDDEN_CHILD_ASSET 차단(Enemies/Goblins/Knights/Orcs/Military·weapon/sword/bow)이
resolveSources의 "명시 sources" 분기에서만 동작 — auto-classify 분기(config.sources 미제공)
로는 금지 PNG가 통과할 수 있다. 거부 회귀 테스트도 없다.

## Do
- 금지 가드를 두 분기(명시 sources·auto-classify) 공통 경로로 올려 어떤 입력 구성에서도
  금지 에셋이 아틀라스에 포함될 수 없게 한다.
- build-atlas.test.mjs에 rejection 테스트 추가: 금지 경로/이름의 소스가 주어지면 빌드가
  명시적 에러로 거부하는지(두 분기 각각 1케이스).
- 기존 산출물 불변 확인: node scripts/island/build-atlas.mjs --check 통과 유지.

## Scope
- scripts/island/build-atlas.mjs
- scripts/island/build-atlas.test.mjs

## Constraints
- 산출 아틀라스(public/island/tiles/) 재생성 금지(가드 로직만), src/ 수정 금지

## Validation
```bash
npm run lint
node --test scripts/island/build-atlas.test.mjs
node scripts/island/build-atlas.mjs --check
npm run test
```
