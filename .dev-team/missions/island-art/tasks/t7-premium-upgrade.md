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
- 7~10세 불변 조항 준수(탭 조작·전투 금지·큰 타깃).

## Scope
- assets-inbox/atlas.config.json
- public/island/tiles/
- NEW: public/island/tiles/ui.png
- src/components/island/
- src/app/globals.css

## Constraints
- island-state.ts 스키마 필드 삭제 금지(추가만 허용), IslandClient 루프 로직 유지, 새 의존성 금지

## Validation
```bash
npm run lint
npx tsc --noEmit
node scripts/island/build-atlas.mjs --check
npm run test
```
