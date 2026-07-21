# p9-forgiving-decorate
effort: high
high_risk: 1

## Goal
관용적 꾸미기 (실수해도 조각 안 잃기)

## Why
저학년 접근성 — 오배치해도 좌절 없이 옮기거나 되돌리게 한다(실패·재촉 없음 원칙). 저학년은 오탭이 잦다.

## Do
배치된 아이템 재선택 → 이동/회수(조각 반환). island-state 재화 로직 확장이 필요 → BRIEF의 island-state.ts 동결 경계 밖. 리드 승인 + 별도 스코프 필요(플래그). engine.test·island-state.test 확장.

## Scope
- src/lib/island/island-state.ts
- src/lib/island/island-state.test.ts

## Constraints
- island-state.ts 로직·스키마 불변(이 태스크는 리드 승인 하 예외 — 재화(조각) 반환 로직만, 필드 삭제 금지).
- 이용자 불변조항: 탭 이동 하나·실패/경고음/붉은오류 없음·재촉 없음·큰 타깃(≥120pt 지향)·라이브 TTS 금지.
- 새 프레임/오디오 키는 실키만 + 실존 assert 테스트. Phaser 키는 모듈 접미사. engine.test 이동 불변식 유지.
- reduced-motion·음소거 존중. 새 에셋은 docs/ASSETS.md·LICENSE.md 장부 갱신(무료 티어 비상업 명기).

## Validation
```bash
npm run lint
npx tsc --noEmit
npm run test
npm run build
```
