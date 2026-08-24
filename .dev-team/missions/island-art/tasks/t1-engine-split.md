# t1-engine-split
effort: xhigh
high_risk: 0

## Goal
island-game.ts(단일 파일 Phaser 씬)를 모듈로 분할하고 스크롤 대형 월드로 개편한다. 이후 태스크들이 파일 단위로 병렬 작업할 수 있는 경계를 만든다.

## Do
- src/components/island/ 아래로 분할: engine.ts(씬 부팅·카메라·입력·이동·충돌) / map.ts(지형 데이터+타일 배치) / props.ts(등대·오두막·표류병·가구 렌더) / npc.ts(NPC 자리, 지금은 빈 스텁) — island-game.ts는 이들을 조립하는 엔트리로 축소.
- 월드를 약 60x80 타일(16px)로 확장, 카메라 아바타 팔로우(부드러운 lerp), 월드 경계 클램프, **물 타일 충돌**(바다 위 이동 금지 — 현재 버그).
- 기존 표류병·수업 트리거·꾸미기 격자·상태 연동은 그대로 동작해야 함(회귀 금지). 아트는 기존 코드 도트 그대로 두되(교체는 후속 태스크) 모듈 경계만 깨끗하게.

## Scope
- src/components/island/island-game.ts
- NEW: src/components/island/engine.ts
- NEW: src/components/island/map.ts
- NEW: src/components/island/props.ts
- NEW: src/components/island/npc.ts

## Constraints
- IslandClient.tsx, island-state.ts, pixel-art.ts, public/ 수정 금지

## Validation
```bash
npm run lint
npx tsc --noEmit
npm run test
```
