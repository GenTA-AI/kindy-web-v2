# t7-premium-upgrade
effort: xhigh
high_risk: 0

## Goal
아틀라스를 무료 티어 → 유료 번들(상용 라이선스)로 교체하고, 팩 내장 파츠 시스템으로 아바타 커스터마이징을 실구현한다. docs/ASSETS.md(사용 금지 목록 포함) 필독.

## Do
- assets-inbox/의 Cute_Fantasy.zip(본팩)·Cute_Fantasy_Characters.zip·Cute_Fantasy_UI.zip 기준으로 atlas.config.json 재작성: terrain/water/props/character 소스를 유료판 상위 호환 파일로 교체(가능한 한 기존 타일 의미 유지), NEW: ui 아틀라스(UI 팩 프레임·게이지·폰트), NEW: avatar-parts 아틀라스(Player 베이스 + Accessories 모자 + Chest 셔츠 색상 변형).
- build-atlas.mjs 실행 → 산출물 검증. 타일 인덱스가 바뀌면 map-data/props/npc의 프레임 참조를 전수 갱신(빌드가 내는 index map 활용 또는 스크립트로 대조).
- 아바타 커스터마이징 v2: kindy:world의 커스텀(몸색 등)을 팩 파츠 선택(셔츠 색·모자)으로 매핑 확장 — engine/npc의 아바타 로더가 베이스+파츠 레이어를 합성 렌더. IslandClient의 "내 캐릭터" 편집 화면도 파츠 선택형으로 확장.
- LICENSE.md가 프리미엄 조건("commercial 허용")으로 기록되는지 확인. Enemies·Goblins·무기류·Military는 아틀라스에서 제외(ASSETS.md 금지 목록).
- [t6 리뷰 이관] IslandClient의 스프라이트 매핑 테이블에서 null로 예약된 `fisherwoman`(NPC 초상, Characters 팩)·`boat`(출항 배 아이콘, 본팩/UI 팩) 키를 유료 아틀라스 실프레임으로 채워 폴백을 제거(reviews/t6-ui-dot.md 참조).
- [통합 QA 이관 — 등대] 현행 "등대"는 무료 팩 가로등 4타일 + 부유 등불 프레임 조합이라 등대로 안 읽힘(2026-07-20 통합 스크린샷). 본팩 등대/타워 에셋 우선, 없으면 본팩 파츠 합성으로 곶 정상에 **등대로 읽히는 구조물**을 세우고 beam·lamp 위치를 새 구조물에 정합. 부유 등불 제거. 이것이 t7의 시각 성공 기준 1순위.
- [t3 리뷰 이관 — 절벽] 등대 곶 절벽이 잔디 위 얇은 윤곽으로 읽힘 — 절벽 밴드를 두껍게 하거나 플라토 정상 타일 분리로 높이감 부여(reviews/t3-map-design.md should_fix).
- [t4 리뷰 이관 — 매핑 정리] CATALOG_FRAME_POSITION 픽셀 좌표 하드코딩과 FURNITURE_FRAME/island-state emoji 이중 매핑을 아틀라스 교체 전수 갱신 시 단일 소스로 정리. 밭 주변 부유 울타리 조각(t4 좌표가 t3 맵과 어긋난 잔재)도 정돈(reviews/t4-props-ambience.md).
- 7~10세 불변 조항 준수(탭 조작·전투 금지·큰 타깃).

## Scope
- assets-inbox/atlas.config.json
- assets-inbox/README.md (팩 사용 문서만)
- scripts/island/build-atlas.mjs (신규 아틀라스 2종·차단 목록 지원 — Do가 요구)
- scripts/island/build-atlas.test.mjs
- public/island/tiles/
- NEW: public/island/tiles/ui.png
- src/components/island/
- src/app/globals.css
- src/lib/island/island-state.ts (Constraints 허용 예외 — 필드 추가·아이콘 참조만)
- src/lib/island/island-state.test.ts

<!-- 2026-07-20 리드 정정: Do("build-atlas.mjs 실행·NEW 아틀라스")·Constraints("island-state.ts
추가만 허용")가 전제한 파일들이 Scope에 누락돼 게이트 오탐(exit 2). 미션 3번째 동일 패턴 —
리트로에 기록할 것: Scope는 Do·Constraints가 암시하는 파일을 전부 명시해야 한다. -->


## Constraints
- island-state.ts 스키마 필드 삭제 금지(추가만 허용), IslandClient 루프 로직 유지, 새 의존성 금지

## Validation
```bash
npm run lint
npx tsc --noEmit
node scripts/island/build-atlas.mjs --check
npm run test
```
