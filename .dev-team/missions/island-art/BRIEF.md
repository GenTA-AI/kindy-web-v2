# Mission brief: island-art
date: 2026-07-20
domain: uiux (픽셀 게임 아트·월드)

## What we're building
클라이언트: "도트 섬이 말도 안 되게 구려. 목업이 아니라 실제 배포 수준의 세계관과 구체적 디자인으로."
리드 재정의: /island를 스타듀밸리급 프로 픽셀아트의 **스크롤 대형 등대섬**으로 재작업. 프로 에셋팩 기반(구매 확정), 카메라 팔로우, 세계관 정본(docs/plan/11: 등대·해변 표류병·오두막·미래 섬 부두) 반영. 기존 루프(표류병→수업→조각→꾸미기)와 상태 로직은 불변.

## Success criteria
- 첫 화면에서 "상용 게임" 첫인상 — 프로 타일셋, 깊이 정렬, 물 애니, 앰비언트
- 화면 3~4배 크기 월드를 카메라가 아바타 따라 스크롤, 물·지형 충돌
- 등대 곶/해변/오두막 마당/숲 가장자리/부두 구역이 뚜렷한 지형 서사
- 아바타·NPC(낚시하는 여인)가 팩 스타일과 한 세계로 보임, 팔레트 스왑 유지
- 기존 수업 연결·꾸미기·상태(kindy:island) 회귀 없음

## Mission validation
```bash
npm run lint
npx tsc --noEmit
npm run test
```

## Boundaries (out of scope / do not touch)
- src/lib/island/island-state.ts 로직 변경 금지(카탈로그 아이콘 교체는 허용)
- /lesson, /world, 랜딩, 결제 코드 금지
- 새 npm 의존성 금지(phaser·sharp 기설치분만)

## Minefields
- Phaser는 SSR 불가 — IslandView의 dynamic(ssr:false) 경계 유지
- 도트는 비정수 스케일에서 뭉개짐 — pixelArt:true·정수 줌·roundPixels 유지
- 에셋 라이선스: 팩 출처·조건을 public/island/tiles/LICENSE.md에 기록(input_refs 관행)
- Strict Mode 이중 마운트(celebrated 마커 패턴 참조)

## Dials
- default effort: high
- parallel cap: 3
- merge mode: merge
