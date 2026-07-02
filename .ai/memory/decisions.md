# Decisions log

Append-only record of choices made across packages, so a fresh worker or a new
Claude session does not re-litigate settled questions. The integrator/reviewer
appends one entry per approved package. Newest at the bottom.

<!-- Format (append, do not rewrite history):
## <date> · <package-id>
- decision: <what was decided>
- why: <the reason / alternatives rejected>
-->

-

- 2026-07-02: `game_rounds.growth_processed_at` 컬럼 추가(스펙 §6 밖, 진단 에이전트 멱등 마커, additive) — 플래너 결정, 0023에 포함.
- 2026-07-02: 테스트 러너 = node:test + `npx tsx --test`, 테스트 파일은 상대 import (repo에 테스트 프레임워크 없음).
- 2026-07-02: `/demo/ai-diagnosis` URL은 금지어 포함 → `/demo/mori` 신설 + 서버 redirect. 어트리뷰션 값 `from=ai-diagnosis`는 호환 유지.
