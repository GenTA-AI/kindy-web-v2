# t3-map-design
effort: xhigh
high_risk: 0

## Goal
등대섬 세계관(docs/plan/11 §1 필독)을 실제 지형으로 — 상용 게임처럼 읽히는 대형 섬 맵 디자인.

## Do
- map.ts의 지형 데이터를 팩 타일셋 기반으로 재설계: 남쪽 해변(표류병 밀려오는 모래톱·바위) → 중앙 오두막 마당(울타리·텃밭 자리=꾸미기 격자) → 북동 등대 곶(절벽·오르막 길) → 서쪽 숲 가장자리 → 남서 부두(미래 섬으로 뻗다 만 다리). 구역 간 자연스러운 길 연결.
- 해안선은 곡선(직사각형 금지), 물가 전이 타일(모래-물 blend), 풀·꽃·바위 산포로 빈 땅 제거.
- 물 애니메이션(팩 프레임), 지형별 충돌 데이터 갱신(engine의 충돌 맵 인터페이스 사용).

## Scope
- src/components/island/map.ts
- NEW: src/components/island/map-data.ts

## Constraints
- engine.ts, props.ts, npc.ts, IslandClient.tsx 수정 금지

## Validation
```bash
npm run lint
npx tsc --noEmit
npm run test
```
