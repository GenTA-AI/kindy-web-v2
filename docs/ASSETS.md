# 에셋 레지스트리 (2026-07-21)

> 구매·보유 에셋의 단일 장부. 새 에셋 추가 시 여기 기록 + `assets-inbox/atlas.config.json` 갱신.
> 팩 원본은 재배포 금지 라이선스 → git 제외(`assets-inbox/` gitignore), 가공 산출물(public/island/tiles/)만 추적.

## Kenmi — Cute Fantasy 번들 (2026-07-20 구매, $17.50, itch.io, j.lee@genta.co.kr)

라이선스(프리미엄 공통): **상용·비상용 프로젝트 사용 허용 · 수정 허용 · 재배포/재판매 금지** (각 팩 read_me.txt)

| 팩 | 용도 | 상태 |
|---|---|---|
| Cute Fantasy RPG (본팩) | 등대섬 지형·건물·동물·플레이어 | **t7에서 아틀라스 교체 예정** (현재는 무료 티어 기반 개발 중) |
| Cute Fantasy Characters | NPC(낚시하는 여인·마을 주민) | t7 |
| Cute Fantasy UI | 도트 UI 프레임·게이지·폰트 | t7 |
| Cute Fantasy Desert | 미래 "사막 섬" 테마 | 보관 |
| Cute Fantasy Shroomlands | 미래 "버섯 숲 섬" 테마 | 보관 |
| Cute Fantasy Volcano | 미래 "화산 섬" 테마 | 보관 |
| Cute Fantasy Dungeons | 미래 실내/동굴 테마 | 보관 |
| Cute Fantasy Christmas | 시즌 이벤트(겨울) | 보관 |
| Cute Fantasy Halloween | 시즌 이벤트 — **아동 정책 검토 후** | 보관 |
| Cute Fantasy Military War Camp | **사용 안 함** (아동 무전투 원칙) | 사용 금지 |
| Old_Sprites / Player_Aseprite_Files | 원본 작업 파일(참고용) | 보관 |

## 사용 금지 목록 (7~10세 불변 조항)
- 본팩 Enemies(슬라임·스켈레톤), Characters 팩의 Goblins/Knights 무기류, Military 팩 전체 — 전투·적 연출 금지.
- 천사·기사 등 캐릭터는 무기 없는 스프라이트만 선별 사용.

## 기타 보유 에셋
- 명화 원본: 시카고미술관 CC0(쇠라), Wikimedia PD(반 고흐·모네) — `mori-studio out/docent/*/input_refs.json`
- 음악: 생상스 〈백조〉 1925 PD 녹음 · 로시니 〈이발사 서곡〉 1929 PD 녹음 — 각 music/license.json
- 자체 생성(계약상 우리 소유): KINDYTOY 캐릭터·애니 캐스트(피가로 등)·키프레임 — mori-studio out/

## 등대섬 오디오 (2026-07-21)

- 파도·바닷새 앰비언스와 이동·편지·조각 배치·등대 점등 SFX는
  `src/components/island/island-audio.ts`의 Web Audio 합성 정의로 자체 생성한다. 외부 녹음·생성형 음원
  파일 및 신규 npm 패키지를 사용하지 않는다.
- 실키·용도·출처 장부는 `public/island/audio/LICENSE.md`에 기록한다.
- **무료 티어 에셋은 비상업 개발·시안에만 사용 가능하다. 실배포 전 상용 라이선스가 확인된 유료
  에셋으로 교체하고 장부를 갱신해야 한다.** 현재 런타임 합성 오디오에는 무료 티어 음원이 포함되지 않는다.
