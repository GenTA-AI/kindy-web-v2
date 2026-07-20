# Handoff: t6-ui-dot → attempt 2

## Objective
attempt 1의 도트 UI 오버레이(HUD·NPC 카드·꾸미기 툴바)는 구조·상태 처리·토큰 규율이 좋았으나,
AtlasSprite의 스프라이트 매칭이 실제 아틀라스 프레임 키와 안 맞아 **모든 스프라이트가 텍스트
폴백으로 렌더**된다(리뷰 reviews/t6-ui-dot.md). attempt 2는 기존 코드를 유지·보수하되 매칭을
실존 프레임 기반으로 고친다. 처음부터 다시 짜지 말 것 — attempt 1 diff가 이미 머지 안 된 채
브랜치에 있지 않으므로, 이번 워크트리 베이스(현 HEAD)에서 같은 설계로 재구현하되 아래를 반영.

## 핵심 사실 (이번 베이스에는 아틀라스가 실존한다)
- public/island/tiles/{terrain,water,props,character}.{png,json} 이 워크트리에 있음. **매칭 로직을
  추측으로 쓰지 말고 이 JSON들을 열어 실제 프레임 키를 확인**할 것.
- 프레임 키는 시맨틱명이 아니라 시트좌표 형식: 예 `oak-tree__r000_c000`. props.json 그룹:
  oak-tree/chest/fences/house/bridge/outdoor-decor. character.json: player+닭·소·돼지·양.
- fisherwoman(낚시하는 여인 초상)·boat(배 아이콘)는 무료 팩에 **없음** — t7(유료 Characters/UI
  팩 교체)에서 공급됨. 이번엔 만들지 말 것.

## Do (attempt 1과의 차이만)
1. 가구 6종(소파·화분·의자·책장·꽃밭·등불) → **명시적 매핑 테이블**로 실존 프레임 키 지정.
   fuzzy 후보어 매칭 삭제. props.png를 직접 열어 보고 각 가구에 시각적으로 가장 걸맞은
   프레임(r/c 좌표)을 골라 상수로 박을 것(예: 책장→chest 프레임, 꽃밭→outdoor-decor의 꽃 타일).
   6종 전부 실제 도트 아이콘이 떠야 한다 — 첫 글자 폴백이 하나라도 남으면 실패.
2. 매핑 테이블에 `fisherwoman`·`boat` 키를 예약하되 값은 null → 현행 우아한 폴백 유지.
   `// t7-premium-upgrade에서 채움` 주석 명기.
3. should_fix 반영:
   - NPC 카드(dialog·aria-modal)에 포커스 트랩(또는 배경 inert) + 닫을 때 포커스 복원.
   - AtlasSprite 하드코딩 `'props.png'` 폴백 제거 — 검증된 meta.image 또는 아틀라스 이름에서 파생.
   - 가구 id → 실프레임 해석 단위 테스트 추가(6종 각각 매핑 키가 해당 아틀라스 JSON에
     실존하는지 assert).
4. nice_to_have(여유 있으면): reducedMotion을 ref로 읽어 런타임 토글 시 Phaser 재부팅 회피,
   전환 오버레이 aria-live를 "polite"로.

## Scope (불변)
- src/components/island/IslandClient.tsx
- src/app/globals.css (.dot-* 블록만)
- 단위 테스트 파일 1개 추가 허용: src/components/island/__tests__/ 또는 기존 테스트 관례 위치

## Validation
```bash
npm run lint
npx tsc --noEmit
npm run test
npm run build
```

## Note to the next worker
아틀라스 JSON이 진실이다. 코드에서 프레임 키를 지어내지 말고, JSON에서 확인한 키만 상수로
써라. 랭킹·타이머·소멸 보상·전투 요소 금지, 탭 타깃 44px+, 기존 토큰만 사용(신규 색 금지),
island-state.ts·engine/map/props/npc.ts 수정 금지, pixel-art.ts 사용 금지는 그대로다.
