# t9-classic-canon: 고전 극장 라인 정본 개정 초안 (대표 채택 2026-07-07 — 리드 리뷰 후 확정)
effort: high

## Goal
대표 결정 3건을 정본 문서에 반영하는 개정 초안을 작성한다:
① "모리와 친구들의 고전 극장" 병행 라인 승격(옵션 B) ② 파일럿을 "물방울이 사라진 날"에서
**"아기돼지 삼형제"(글로벌 PD 고전) 각색판**으로 교체 ③ 저작권 안전 실무(자체 재화·원형 추출·
상표 검색) 절차화. 근거 정본: docs/research/pd-classics/00-synthesis.md + 01-plan-fit.md §4(개정 목록).

## Scope
- docs/BRAND_DNA.md
- docs/plan/00_LAUNCH_MASTER_PLAN.md
- docs/plan/03_MORI_STUDIO_PLAN.md
- NEW: docs/plan/06_CLASSIC_THEATER_LINE.md

## Constraints
- 06 신규 문서가 본체: 라인 정의(연극 프레임 캐스팅 규칙 상세 — 아기돼지 삼형제 배역안: 꾸미·방울·도토=삼형제,
  늑대=역할 연기 순화 원칙, 모리=호스트/내레이터), 원전 처리 실무(여러 원전 대조→공통 골격→자체 재화,
  번역본·각색본·삽화 차용 금지, KIPRIS 상표 검색 체크리스트), 파일럿 교체 명세(03 §6-1의 CP 구조를
  아기돼지 삼형제로 재매핑 — CP1/CP2/CP3=재료 선택·위기 대응·결말 분기 초안, C6 태깅 초안 포함).
- 기존 3개 문서는 **최소 수정**: 해당 절에 "2026-07-07 대표 결정" 표기와 06 문서 참조를 추가하는
  수준(01-plan-fit.md §4의 목록 항목별 한 곳씩). 기존 문구 대량 삭제 금지 — 이력 보존.
- "물방울이 사라진 날"은 폐기가 아니라 후순위 이동으로 기술(브리프 자산 유지).
- 모든 개정 지점에 근거(조사 보고서 절 번호) 인용.

## Validation
```bash
test -s docs/plan/06_CLASSIC_THEATER_LINE.md && [ $(wc -c < docs/plan/06_CLASSIC_THEATER_LINE.md) -gt 6000 ] && echo ok
grep -c "2026-07-07" docs/BRAND_DNA.md docs/plan/00_LAUNCH_MASTER_PLAN.md docs/plan/03_MORI_STUDIO_PLAN.md
```

## Handoff requirements
summary, files_changed, validation, risks, handoff_note.
