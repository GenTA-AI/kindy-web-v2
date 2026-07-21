# p2-path-guidance
effort: high
high_risk: 0

## Goal
다음 할 일로 길 시각 유도 (표류병/오두막 이정표)

## Why
저학년 접근성 + 아이 흥미 — 3~4배 스크롤 월드에서 뭘 해야 할지 스스로 알게 한다(이용자 불변조항 '길이 목적지로 시각 유도'). 길찾기 퍼즐이 아니라 반짝이는 안내다.

## Do
src/components/island/props.ts + IslandClient.tsx: 현재 목표(미개봉=표류병, 조각 보유=오두막 격자)를 기존 save에서 파생해 그쪽으로 향하는 반짝 발자국/통통 튀는 화살표 표시. 오래 가만히 있으면 목표를 한 번 펄스. island-state 로직 변경 없음.

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
