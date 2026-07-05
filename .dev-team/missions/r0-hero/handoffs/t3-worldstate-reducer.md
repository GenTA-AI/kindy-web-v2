# handoff: t3-worldstate-reducer (attempt 1 → 2) — 리뷰 should_fix 3건, 외과 수정만

## 상태
gate 통과·리뷰 approve-with-should_fix. **기존 작업(worktree에 미커밋 상태로 있음)은 정본 일치 확인 완료 — 아래 3건 외 일절 수정 금지.**

## 고칠 것 (정확히 이 3건)
1. **시간 의존 골든테스트 제거** — `src/lib/hero/session-config.ts:35` `resolveAgeBand`의 `asOf`가 `new Date()` 고정이라 2027-07부터 골든테스트가 저절로 실패한다. `resolveSessionConfig`에 옵셔널 `asOf?: Date`(또는 `'YYYY-MM'` 문자열) 파라미터를 추가해 주입 가능하게 하고(4필드 반환 계약 불변), `session-config.golden.test.ts`의 픽스처에 고정 기준일(예: '2026-07')을 명시하라.
2. **발명 규칙 제거** — `session-config.ts:45-53`의 GACS 평균 임계(<0.4/>0.7)와 `'balanced'`/`'bright'` 프리셋은 SSOT에 없다. **명세된 경로만 남겨라**: moodState 미제공(콜드스타트) → `'gentle'`(02 §10), moodState 제공 시의 매핑은 `// TODO: 기획서 §7 무드 사전 확정 시 구현(R1)` 주석과 함께 입력 passthrough 또는 'gentle' 유지로 축소. 관련 테스트가 있으면 함께 정리.
3. **projector version 의미 명시** — `world-state.ts:513-519` `projectWorldStateBatch`가 `folded.version`을 버리고 `prev.version+1`을 쓴다. `folded.version`을 사용하도록 통일하고, 주석으로 "스냅샷 version = 리듀서 산출(episode_completed당 ++), 배치 단위 아님 — 02 §3 매핑 원문" 명시. 골든테스트 기대값에 영향 있으면 원문 규칙(episode_completed→version++) 기준으로 맞춰라.

## 검증
태스크 파일 Validation 블록 전체 재실행(12/12 + lint + tsc). worktree에 node_modules 있음.

## 금지
world-state 리듀서 4규칙·필드명·product-defaults 상수·cp-variants 로직·ci.yml·package.json 변경 금지(1·2·3에 필요한 최소 변경 제외).
