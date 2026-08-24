# Review: t10-license-guard (attempt 1)

decision: approve
date: 2026-07-20
gate: validation_exit=0 scope_ok=1 high_risk=0 (lint·tsc·대상 테스트 8·--check·전체 테스트)

## 판정 근거 (리드 인라인)
- 금지 가드가 명시 sources·auto-classify 두 분기 공통의 `candidates` 경로로 이동 — 분류
  이전에 FORBIDDEN_CHILD_ASSET 검사. 어떤 config 구성에서도 금지 PNG가 통과 불가.
- 거부 회귀 테스트 2건(분기별 1건: Props/sword.png 명시, Enemies/Terrain.png 자동 분류).
- 동작 보존: 기존 검증(실존·PNG 확장자·id 중복 처리) 그대로, 산출물·src/ 불변.
