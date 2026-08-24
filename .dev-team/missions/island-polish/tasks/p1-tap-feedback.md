# p1-tap-feedback
effort: medium
high_risk: 0

## Goal
목적지 탭 피드백 + 막힌 탭 시각 신호

## Why
저학년 접근성 — 탭이 먹혔는지, 왜 안 움직이는지 몰라 헤매는 것을 없앤다(RETRO 후속 '막히는 탭 시각 피드백' 명시 항목). 아이가 물/절벽을 눌렀을 때 아무 반응이 없으면 고장으로 오해한다.

## Do
src/components/island/engine.ts moveAvatarTo: 도달 지점에 통통 튀는 링/발자국 마커, 이동 불가(물·절벽) 탭 시 그 지점에 부드러운 '여기는 못 가요' 바운스(실패 연출·경고음·붉은색 금지 — 위협·재촉 없음 유지). island-state 로직 불변, engine.test 400회 이동 불변식 유지.

## Scope
- src/components/island/engine.ts
- src/components/island/engine.test.ts
- src/components/island/map.ts

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
