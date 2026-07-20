# t4-props-ambience
effort: high
high_risk: 0

## Goal
지물과 공기감 — "살아 있는 섬"의 마감.

## Do
- props.ts: 팩 프롭으로 등대(곶 위, 점등 상태 반영)·오두막·부두 말뚝·표류병(빛나는 이펙트)·울타리·나무·덤불 배치, y-기반 깊이 정렬(아바타가 뒤/앞으로 지나감).
- 앰비언트: 파도 거품 가장자리 애니, 갈매기 1~2마리 비행 루프, 표류병 반짝임, 등대 빔 회전(점등 시). 전부 팩 프레임 또는 절제된 트윈 — prefers-reduced-motion 시 정적.
- 꾸미기 가구를 팩 프롭 스프라이트로 교체(카탈로그 아이콘 포함 — island-state 카탈로그의 아이콘 참조만 갱신).

## Scope
- src/components/island/props.ts
- src/lib/island/island-state.ts (FURNITURE 카탈로그 아이콘 참조 문자열만 — BRIEF 허용 예외)
- src/components/island/IslandClient.tsx (카탈로그 아이콘 렌더 치환만 — pixel-art 폐기)

<!-- 2026-07-20 리드 정정: 최초 Scope가 자체 Do 항목("카탈로그 아이콘 포함 — island-state
카탈로그의 아이콘 참조만 갱신") 및 Constraints의 허용 예외와 모순되게 props.ts만 나열해
게이트가 오탐(exit 2). Do가 지시한 파일을 Scope에 명시하는 스펙 버그 수정. -->

## Constraints
- engine.ts, map.ts, npc.ts 수정 금지, island-state.ts 로직 수정 금지(아이콘 참조 문자열만 허용)

## Validation
```bash
npm run lint
npx tsc --noEmit
npm run test
```
