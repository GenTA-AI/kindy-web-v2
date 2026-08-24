# p6-reward-fx
effort: medium
high_risk: 0

## Goal
보상·상호작용 연출 강화 (편지 열기·조각 배치)

## Why
아이 흥미 — 편지 개봉과 조각 배치에 만족감을 준다. 지금은 카드가 그냥 뜨고 가구가 툭 나타날 뿐이라 '보상'으로 안 느껴진다.

## Do
props.ts renderPlaced: 신규 아이템 팝/스케일/반짝, 표류병 개봉 버스트, HUD 조각 카운터 증감 애니. 점등 celebrate 연출은 유지. reduced-motion 분기, 로직 불변.

## Scope
- src/components/island/props.ts

## Constraints
- island-state.ts 로직·스키마 불변(연출·안내·오디오·DOM 계층으로만).
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
