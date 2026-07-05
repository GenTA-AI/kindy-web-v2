# Mission brief: r0-hero
date: 2026-07-05
domain: fullstack

## What we're building
클라이언트 목표(원문): "04_R0_EXECUTION_PLAN.md Task 1(v2 부트스트랩)부터 시작하자. 이후 R0 태스크 연속 실행."
리드 재진술: **HERO R0(W1–2, ~7/19) 완주** — kindy-web@codex/ai-diagnosis-demo(26a5f5f)를 kindy-web.v2로 이어받아(git 히스토리 보존) GenTA-AI/kindy-web-v2(private)에 올리고, 그 위에 마이그레이션 0024–0029·world_state 리듀서+골든테스트 12본+CI·아바타 144 스펙·E13-10 안전 테스트·랜딩 개정·시뮬 스크립트 이식까지 완료한다. 절차 정본 = `docs/plan/04_R0_EXECUTION_PLAN.md`(그리드·Exit 체크리스트 포함), 스키마 정본 = `docs/plan/02_SCHEMA_RECONCILIATION.md`.

## Success criteria
- 04 문서 Task 5 Exit 체크리스트의 하드 게이트 항목 통과(#1 기반 그린, #1a~1h G0 매핑, 마이그레이션·리듀서·CI)
- `npm run lint` + `npx tsc --noEmit` 그린 유지, 골든테스트 12본 CI 배선(t3 이후 `npm run test` 포함)
- 원격 GenTA-AI/kindy-web-v2(private)에 main 존재, 이후 변경은 PR 경유(사람 리뷰 머지)

## Mission validation
```bash
npm run lint
npx tsc --noEmit
```

## Boundaries (out of scope / do not touch)
- **prod 조작 절대 금지**: `supabase db push`·Supabase 대시보드·Secret Manager·Inngest Cloud·Toss 설정은 [사람] 전용(04 §0). 워커는 SQL·코드·테스트 작성까지만.
- `.env.local` 값 읽기·출력 금지(파일 복사는 t1에서 경로 단위로만).
- `docs/plan/*.md` 내용 수정 금지(플랜 정본 — 리드만 개정).
- mori-studio(04 Task 3 계열)는 별도 레포 — 이 미션 범위 밖(후속 미션).
- 결제 코드(src/lib/toss.ts, api/payments/**, billing-crypto.ts) 수정 금지 — R0에 결제 변경 없음.

## Minefields (known risks, fragile areas)
- kindy-web 커밋 트리에 `.dev-team/`가 포함돼 있음(memory/c6-spec-v1.md 등) — reset --hard 시 우리 하네스 파일과 병합됨. 우리 미션 파일은 `missions/r0-hero/`라 충돌 없음. kindy-web의 **미추적** `.dev-team/MISSION`·`missions/first-content/tasks/*`는 v2로 복사하지 말 것(스테일 포인터).
- NEXT_PUBLIC_* 는 빌드타임 주입 — `npm run build`가 .env.local 없이는 결제 CTA 잠금 등 상태가 달라짐(문서화된 동작, 실패 아님).
- 아이 표면 카피는 금칙어 0(불변 ⑤) — 랜딩(t6) 작업 시 기획서 v2.2 §6 사전 준수.
- 마이그레이션 SQL은 02 문서에서 **그대로 복사**(재발명 금지 — 04 Task 2.1).

## Dials
- default effort: high (mechanical=medium, 리듀서·골든테스트=high)
- parallel cap: 3
- merge mode: merge (히스토리 보존 계보 유지)
