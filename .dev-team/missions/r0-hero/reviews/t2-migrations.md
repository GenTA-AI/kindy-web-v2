# review: t2-migrations
decision: approve
date: 2026-07-05
reviewer: 서브에이전트(정본 대조 전담) + 리드 확인

## 판정 근거
- **정본 일치(렌즈 #1)**: 6본 전부 02 문서 §3~§8 SQL 블록과 **byte-identical**(diff -u 기계 대조) — 유일한 추가는 태스크가 요구한 헤더 `-- SSOT: docs/plan/02 §N`. 0026 시드 3행·0028 시드 16행·pipeline_runs.output_ref·리듀서 매핑/SLA 코멘트 전부 원문 그대로.
- verify 스크립트: 기존 헬퍼 패턴 내 확장, "db push 이후 실행" 주석 있음, prod 접속 추가 없음.
- 게이트: validation_exit=0, scope_ok=1. db push/link 실행 흔적 없음.

## should_fix (처리 완료)
- 워커 샌드박스가 worktree 커밋을 거부(index.lock 생성 불가) → **리드가 커밋 대행**(4a6d29f, 내용 무변경). 환경 제약 패턴으로 기록 — 이후 태스크 공통.

## nice_to_have (이월)
- verify-rls.ts의 anon 카운트 방식은 "RLS 거부"와 "빈 테이블" 구분 불가 — product_defaults=3행 단언 추가 검토(R1에서).
- t2 task 파일의 0026 grep이 `public.` 프리픽스 미포함 — 워커가 헤더 토큰으로 정직하게 해소(공시됨). 스펙 쪽 수정이 원론적으론 맞음.
