# r0-hero PLAN — 상태판 (재진입점)

원천: docs/plan/04_R0_EXECUTION_PLAN.md (그리드·Exit 정본) · 02(스키마 SSOT)

| id | 내용 (04 매핑) | effort | deps | 상태 |
|---|---|---|---|---|
| t1-bootstrap | Task 1: 이어받기·CI·원격(GenTA-AI/kindy-web-v2 private)·원본 보관 | high | — | dispatched 2026-07-05 |
| t2-migrations | Task 2.1: 0024–0029 SQL(02에서 그대로)+verify 확장 | medium | t1 | pending(파일 작성 예정) |
| t3-worldstate-reducer | Task 2.2: E13-2 리듀서+session-config+골든테스트 12+CI 확장 | xhigh | t2 | pending |
| t4-avatar-spec | Task 2.3: E13-1 아바타 144 스틸 스펙+샘플 3조합 | medium | t1 | pending |
| t5-no-camera-test | Task 2.4: E13-10 사진·카메라 코드 부재 정적 스캔 테스트 | medium | t1 | pending |
| t6-landing | Task 2.5: E12-1' 랜딩 카피(기획서 W1 실문구) | medium | t1 | pending |
| t7-sim-scripts | Task 2.6: 시뮬 3종 scripts/sim/ 이식+재현 검증 | medium | t1 | pending |

[사람] 게이트(워커 태스크 아님 — 04 Task 4.x): Inngest Cloud 연결 · LoRA 생존 확인 · Phase B 공문 · DNS · Supertone · 연구소 신고(4.8) · 키오스크 발주(4.7) · **supabase db push(t2 머지 후)**

메모: t1은 non-git 시작이라 main-tree 실행(DEVTEAM_NO_WORKTREE=1, 리뷰 diff-blind — git log로 대체 검증). t1 머지 개념 없음(main 직작업, 문서화된 예외). t1 후 .dev-team/memory/invariants.md가 kindy-web 상속본으로 대체됨 → 리드가 미션 룰 병합 예정.
