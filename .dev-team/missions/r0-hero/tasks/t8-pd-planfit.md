# t8-pd-planfit: 저작권 만료(PD) 고전동화 전략 vs 현행 정본 정합성 분석 (조사 태스크)
effort: high

## Goal
대표가 컨설팅에서 받은 방향 — "자체 창작 동화 대신/병행하여 저작권 만료 고전(이솝우화·톨스토이·
국내 전래동화 등)을 원작으로 쓰되, 인터랙티브 분기(선택→결말 변화)는 유지" — 이 현행 정본 계획과
어디서 맞고 어디서 충돌하는지 문서 근거로 분석한 보고서를 작성한다. 웹 조사 아님 — 레포 문서만.

## Scope
- NEW: docs/research/pd-classics/01-plan-fit.md

## Constraints
- 근거 문서(전부 읽고 인용): docs/plan/00~05 전부, docs/research/original/문서세트_2026-07-05_현행정본/
  (마스터플랜 v1.0·제품기획서 v2.2·HERO 실행계획 v1.1), docs/BRAND_DNA.md(있으면).
- 반드시 답할 질문:
  ① 현행 플랜에서 "콘텐츠 원작"을 전제하는 지점 전수 목록(파일:절 인용) — 파일럿 "물방울이 사라진 날",
     동물마을 캐릭터 22종, C6 축, 브리프 원문(§8.1) 등이 PD 고전으로 바뀌면 각각 무엇이 흔들리는가.
  ② 유지되는 것 목록 — 인터랙티브 분기 구조(branching_script), 연령 큐레이션, 캐스트/LoRA,
     생산 파이프라인, 벤치 체계는 원작 교체와 무관함을 근거로 확인.
  ③ 캐스트 전략 옵션 2안 비교: (a) 우리 캐스트(모리 등 6인)가 고전을 "연기"(연극 프레임)
     (b) 고전 원작 캐릭터 신규 생성 — 각각 비용·일관성·브랜드 축적·기존 자산 재사용 관점.
  ④ 정본 개정이 필요한 문서·절 목록과 개정 방향 한 줄씩.
- 결론은 "권고"가 아니라 "결정 옵션 + 근거" 형식 — 결정은 대표.
- 모든 주장에 파일 경로·절 번호 인용. 추측이면 [추정] 표기.

## Validation
```bash
test -s docs/research/pd-classics/01-plan-fit.md && [ $(wc -c < docs/research/pd-classics/01-plan-fit.md) -gt 4000 ] && echo ok
```

## Handoff requirements
summary, files_changed, validation, risks, handoff_note.
