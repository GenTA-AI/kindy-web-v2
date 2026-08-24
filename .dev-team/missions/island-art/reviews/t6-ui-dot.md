# Review: t6-ui-dot (attempt 1)

decision: request_changes
date: 2026-07-20
gate: validation_exit=0 scope_ok=1 high_risk=0 (lint·tsc·test 48개·build·prod /island 200)
screenshot: 확인함 — HUD 게이지·조각 카운터·꾸미기 툴바 도트 프레임 정상, 단 모든 스프라이트 슬롯이 텍스트 폴백

## Critical
- AtlasSprite 후보 매칭(영문 시맨틱명+이모지 fuzzy)이 실제 팩 아틀라스의 프레임 키 네이밍(`oak-tree__r000_c000` 시트좌표 형식)과 원천 불일치 → 병합 대상 아틀라스 기준 매칭 교집합 0.
  - props.json: oak-tree/chest/fences/house/bridge/outdoor-decor 뿐 → 가구 6종(소파·화분·의자·책장·꽃밭·등불) 전부 라벨 첫 글자 폴백.
  - character.json: player+농장동물 뿐 → NPC 초상 "사절" 텍스트 폴백.
  - props에 boat 없음 → 출항 배 아이콘 텍스트 폴백.
  - 이전 pixel-art 가구 아이콘 대비 시각적 회귀. LEAD override(도트 정합·월드 서사) 위배.

## Should fix
- NPC 카드 role="dialog" aria-modal인데 포커스 트랩 없음 — Tab이 스크림 뒤 배경 컨트롤로 탈출.
- AtlasSprite 하드코딩 폴백 `'props.png'` — meta.image 정규식 실패 시 캐릭터 슬롯에 props 픽셀 로드 위험.
- 가구 id → 실프레임 해석 검증 단위 테스트 부재.

## Nice to have
- reducedMotion 런타임 토글 시 Phaser 전체 재부팅([openNpc, reducedMotion] effect deps) — ref로 회피 가능.
- 전환 오버레이 role="status"+aria-live="assertive" 의미 충돌.
- NPC 닫을 때 포커스 복원 없음(경미).

## 통과 확인
스코프 2파일 준수(.dot-* 한정), island-state.ts·engine/map/props/npc.ts 불변, 신규 의존성 없음,
pixel-art.ts 신규 사용 없음, 색 전부 기존 토큰 파생, 랭킹·타이머·소멸보상·전투 요소 없음,
Strict Mode 멱등 마커·ssr:false 유지. 상태 처리(로딩/에러/폴백)·코드 품질 자체는 높음.

## 리드 처분 (partial re-scope)
- 가구 6종 실프레임 매핑 + should_fix 3건 → t6 attempt 2 (handoffs/t6-ui-dot.md, effort xhigh).
- fisherwoman·boat: 무료 팩에 부재 — docs/ASSETS.md상 Characters/UI 유료팩이 t7 교체 대상이므로
  t7-premium-upgrade로 명시 이관(태스크 파일에 반영). t6는 매핑 테이블에 키만 예약하고 폴백 유지.

---

# Review: t6-ui-dot (attempt 2)

decision: approve
date: 2026-07-20
gate: validation_exit=0 scope_ok=1 high_risk=0 (lint·tsc·test 49·build) — 테스트 파일은 리드 Scope 정정 승인분
screenshot: 리드 워크트리 빌드 검수 — HUD(등대 게이지 3분절·조각 카운터), 툴바 6종 전부
실팩 도트 아이콘(글자 폴백 0), NPC 카드(초상 t7 예약 폴백·타이핑·배경 딤) 확인. 콘솔 에러 0.

## 판정 근거 (리뷰 에이전트 attempt 2 재검토)
- attempt 1 크리티컬 해소: 툴바는 t4의 propCatalogIconStyle + 실프레임 FURNITURE.emoji 사용,
  단위 테스트로 6종 키 실존 고정.
- should_fix 3건 전부 반영: inert+수동 포커스 트랩+Escape+returnFocus 복원 / AtlasSprite·하드코딩
  경로 제거(ReservedPackSprite frame=null 폴백) / 매핑 실존 테스트.
- attempt 1 nice_to_have 반영: reducedMotion ref화(Phaser 재부팅 회피), aria-live polite 일치.
- fisherwoman·boat: RESERVED_PACK_FRAMES null 예약 + t7 주석 — 의도된 폴백.
- 회귀 없음: .dot-* 한정 CSS, 기존 토큰만, 금지 요소 0, Strict Mode·ssr:false 유지, 탭 타깃 44px+.

## Nice to have (비차단, t7 이후 여지)
- polite live-region 3곳 동시 갱신 수다스러움, 카드 오픈 포커스를 제목으로, 타이핑 setInterval churn.
