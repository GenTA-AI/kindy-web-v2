# p8-living-island
effort: high
high_risk: 0

## Goal
살아있는 섬: 낚시 여인 소품 재부착 + NPC idle 애니

## Why
아이 흥미 — 첫인상 생동감. RETRO 후속(Characters 팩에 낚시 여성 부재로 낚싯대·바위 소품이 빠진 상태) 해결.

## Do
npc.ts/props.ts: 낚시 여인 낚싯대·바위 소품 재부착, 잔잔한 idle bob. 금지 에셋 가드(Enemies류 차단)·'아틀라스 JSON이 진실' 실프레임 assert 테스트 규칙 준수.

## Scope
- src/components/island/npc.ts
- src/lib/island/island-state.test.ts

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
