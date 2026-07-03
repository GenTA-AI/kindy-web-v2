# Task: script-repair-retry

## Goal
작가(디렉터) 대본이 구조 검증에 실패하면(예: totalDurationSec 80 < 85) 파이프라인 전체를 죽이지 말고,
**검증 오류 메시지를 작가에게 피드백해 1회 자가수정 재생성**한 뒤 재검증한다. 2회째도 실패하면 기존처럼 명확히 throw.
실사례: 2026-07-03 run — "EpisodeScript: totalDurationSec must be 85-95 (got 80)"로 $0.5 대본비만 낭비.

## Scope
- src/lib/episode-pipeline.ts (대본 생성·검증 지점만 — TTS/키프레임/편집 스테이지 수정 금지)
- src/lib/video-providers/claude-director.ts (재생성 지원이 필요하면 — 기존 시그니처 하위호환)

## Approach
- validateEpisodeScript 실패 시: 실패 사유 + 현재 스크립트 JSON을 포함한 repair 프롬프트로 디렉터 1회 재호출
  ("아래 검증 오류만 고쳐서 같은 JSON 스키마로 전체 대본을 다시 출력하라. 씬 추가/waitBeat/씬 길이 미세 조정으로 총길이를 85-95초에 맞춰라").
- 재시도는 정확히 1회. 비용은 cost ledger의 director 항목에 합산. 로그에 "[director-repair] reason=..." 남길 것.
- duration 외 다른 검증 실패도 동일 경로로 처리(오류 메시지를 그대로 피드백).

## Validation
```bash
npm run lint && npx tsc --noEmit
```

## Out of scope / 금지
- 검증 룰(85-95초 등) 완화 금지. 새 의존성 금지. 키/.env 접근 금지(코드 경로만).
