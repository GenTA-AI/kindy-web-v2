# t6-ui-dot
effort: high
high_risk: 0

## Goal
React 오버레이(HUD·NPC 카드·꾸미기 툴바)를 게임과 한 몸으로.

## Do
- IslandClient.tsx: 상용 게임 톤의 도트 UI로 정리 — 등대 게이지(불빛 레벨), 조각 카운터, NPC 카드(초상+대사 타이핑 효과), 꾸미기 툴바(팩 프롭 아이콘). 탭 타깃 44px+.
- 수업 이동 전 짧은 전환(페이드+배 아이콘), 복귀 시 축하 연출 유지.
- 랭킹·타이머·소멸 보상 요소 금지(docs/plan/11 §9).

## Scope
- src/components/island/IslandClient.tsx
- src/app/globals.css
- src/lib/island/island-state.test.ts (attempt 2 핸드오프 허용 — 가구 프레임 실존 단위 테스트만)

<!-- 2026-07-20 리드 정정: attempt 2 핸드오프가 "기존 테스트 관례 위치" 테스트 추가를
허용했으나 Scope 미반영으로 게이트 오탐(exit 2). 핸드오프와 일치하도록 명시. -->


## Constraints
- engine/map/props/npc.ts, island-state.ts 로직 수정 금지. globals.css는 .dot-* 블록만

## Validation
```bash
npm run lint
npx tsc --noEmit
npm run test
```
