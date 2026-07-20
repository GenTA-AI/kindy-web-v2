# t9-move-stuck
effort: xhigh
high_risk: 0

## Goal
탭 이동 함정 버그 수정: 아바타가 울타리 레일·절벽 등 장애물 경계 칸에 "정지"한 뒤로는 모든
탭이 무시돼 영구 이동 불능이 된다(새로고침 외 복구 불가). 리드 실기기 QA에서 밭 울타리
북측 레일·절벽 포켓 등 3개 지점에서 재현(2026-07-20, t7 워크트리·머지 전 루트 빌드 공통 —
이번 미션 회귀 아님, 기존 엔진 동작).

## 진단 가설 (워커가 검증할 것)
- moveAvatarTo(직선 이동)가 충돌로 중단될 때 아바타 최종 위치가 비보행 칸(또는 비보행 칸에
  걸친 위치)으로 남는다. 이후 이동 시작 판정이 현재 칸 기준으로 실패해 전면 무시.
- 추가 관찰: 목표 직선 경로에 장애물이 있으면 부분 이동 없이 전체 무시되는 것도 7~10세
  체감 문제(탭했는데 아무 일도 안 일어남).

## Do
1. 재현 테스트 먼저: engine의 이동 로직을 순수 함수로 검증 가능한 지점에서 물어
   "이동 종료 위치는 항상 보행 가능 칸"을 assert하는 단위 테스트 작성(map-data 실충돌행렬
   사용, 밭 울타리·절벽 경계 근방 무작위 탭 시뮬레이션 포함). 실패 확인 후 수정.
2. 수정: (a) 이동 종료 위치를 항상 보행 가능 칸으로 클램프(비보행 칸에 정지 금지),
   (b) 현재 위치가 비보행 칸에 걸쳐 있어도 탈출 이동은 허용(안전 탈출),
   (c) 가능하면 장애물에 막힌 탭도 막히기 직전까지 부분 이동(아이 체감 개선 — 구현 부담이
   크면 (a)(b)만 필수, (c)는 여력 시).
3. 경로 탐색(A*) 전면 도입은 이번 태스크 범위 아님 — 최소 수정 원칙.

## Scope
- src/components/island/engine.ts
- src/components/island/map.ts (isWalkableWorld 보조 함수 추가 필요 시)
- src/components/island/engine.test.ts (신규 또는 기존 테스트 관례 위치)

## Constraints
- 카메라·줌·pixelArt 설정 불변, 탭 이동 외 조작 추가 금지(7~10세 불변), island-state.ts 금지
- npc.ts·props.ts·map-data.ts·IslandClient.tsx 수정 금지

## Validation
```bash
npm run lint
npx tsc --noEmit
npm run test
npm run build
```
