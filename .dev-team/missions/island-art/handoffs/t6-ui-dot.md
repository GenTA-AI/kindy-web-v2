# Handoff: t6-ui-dot → attempt 2 (2026-07-20 갱신 — t4·t5 머지 반영)

## Objective
attempt 1의 도트 UI(HUD 게이지·조각 카운터·NPC 카드 타이핑·꾸미기 툴바·수업 전환 연출)는
구조·상태 처리·토큰 규율이 좋았으나, 스프라이트 매칭이 지어낸 후보어 기반이라 전부 텍스트
폴백으로 렌더돼 반려됐다(reviews/t6-ui-dot.md). 그 후 t4가 머지되면서 **가구 카탈로그
아이콘은 이미 해결됐다**: island-state의 FURNITURE.emoji가 실프레임 키를 갖고, IslandClient가
props.ts의 propCatalogIconStyle()로 팩 스프라이트를 렌더 중이다. attempt 2는 이 위에서 도트
UI 업그레이드를 재구현한다.

## 베이스에서 반드시 지킬 것 (이번 베이스 = t4·t5 머지 후)
- 꾸미기 툴바의 아이콘 렌더는 **현행 propCatalogIconStyle(f.emoji) 방식을 유지**하라.
  fuzzy 매칭·후보어 검색·자체 매핑 테이블 재도입 금지. 프레임 키의 단일 소스는
  island-state FURNITURE(값)와 props.ts(위치)다. 툴바를 도트 스타일로 다듬되(44px+ 탭 타깃,
  선택 상태, disabled) 아이콘 소스는 그대로.
- 프레임 키를 코드에서 지어내지 마라. 필요하면 public/island/tiles/*.json을 열어 실존 키만.

## Do
1. HUD: 등대 게이지(불빛 레벨)·조각 카운터를 상용 게임 톤 도트 프레임으로. 기존 토큰만.
2. NPC 카드: 초상 슬롯 + 대사 타이핑 효과. 초상은 `fisherwoman` 키 예약(값 null →
   현행 우아한 텍스트 폴백 유지, `// t7-premium-upgrade에서 채움` 주석). 지어낸 초상 금지.
3. 수업 이동 전 짧은 전환(페이드): 배 아이콘은 `boat` 키 예약(null → 폴백), t7에서 채움.
   복귀 시 축하 연출 유지.
4. 리뷰 should_fix 반영:
   - NPC 카드(role=dialog·aria-modal)에 포커스 트랩 또는 배경 inert + 닫을 때 포커스 복원.
   - 전환 오버레이 aria-live는 "polite"(role=status와 일치).
   - reducedMotion은 ref로 읽어 런타임 토글 시 Phaser 재부팅 회피([openNpc, reducedMotion]
     effect deps에서 reducedMotion 제거).
5. 단위 테스트: FURNITURE 6종의 emoji 프레임 키가 props.json에 실존하는지 assert하는
   테스트 추가(t4 리뷰의 매핑 실존 검증 요구 통합).

## 금지 (불변)
랭킹·타이머·소멸 보상·전투 요소 금지. island-state.ts 로직·engine/map/props/npc.ts 수정 금지.
pixel-art.ts 사용 금지. 신규 색 금지(기존 토큰 파생만). 신규 npm 의존성 금지.
Strict Mode celebrated 멱등 마커·IslandView ssr:false 경계 유지.

## Scope
- src/components/island/IslandClient.tsx
- src/app/globals.css (.dot-* 블록만)
- 단위 테스트 1개 추가 허용(기존 테스트 관례 위치)

## Validation
```bash
npm run lint
npx tsc --noEmit
npm run test
npm run build
```

## Note to the next worker
아틀라스 JSON이 진실이고, 가구 아이콘은 이미 된다 — 부수지 마라. 네 일은 HUD·카드·전환의
"상용 게임 톤" 마감과 접근성이다. fisherwoman·boat는 일부러 비워 두는 것이다(t7).
