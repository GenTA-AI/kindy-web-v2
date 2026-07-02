# Review: c6-evidence-engine

## decision
approve

## critical
- (none)

## should_fix
- (none blocking)

## nice_to_have
- `evidence.ts`가 `LEGACY_OBJECTIVE_TO_AXIS`/`LEGACY_GAME_TYPE_TO_AXIS`/`inferAxisId` 로직을 `axes.ts`의 기존 `inferAxisFromLegacyRound`와 **중복 선언**한다. 현재 두 맵은 값이 완전히 동일해 드리프트는 없으나, 유지보수 시 한쪽만 바뀌면 어긋난다. 단, 이 중복은 스코프 제약("axes.ts는 타입 import만, 수정 금지") 때문에 런타임 export를 못 끌어와서 생긴 것 — 배선 패키지에서 `axes.ts`의 `inferAxisFromLegacyRound`로 일원화 권장(워커도 known-risk로 명시함).
- `performanceScore`가 스펙에 없는 방어 가드 `completed = input.completed && !input.abandoned`를 둔다. 실제 파이프라인 경로(`evidenceFromRound`)는 항상 `completed = !abandoned`라 둘이 동시에 true가 될 수 없어 무해하지만, `buildEvidence`를 모순 입력(completed=true & abandoned=true)으로 직접 호출하면 스펙의 0.6 대신 0을 반환한다. 방어적으로는 오히려 타당하나 스펙 문언과는 미세하게 다름.

## validation_notes
- **공식 정확성(손계산 검증)**: 케이스 1을 직접 산술로 검증 — performance 1·process 1·persistence 0.7·preference 0.5·transfer 0.5 → base = 0.30+0.25+0.14+0.05+0.075 = **0.815**(테스트 하드코딩 0.815 일치). level = round(100·(0.85·0.5 + 0.15·0.815)) = round(54.725) = **55**(일치). quality = 실신호 2/5 = 0.4 → confidenceGain = min(0.08, 0.02+0.4·0.06) = **0.044**(일치). evidence_count 1(일치).
- **updateAxis 가중치·캡**(`evidence.ts:161-230`): base 계수 0.30/0.25/0.20/0.10/0.15 정확, level 식 `round(100*(0.85*prev/100 + 0.15*ageAdjusted))` 정확, confidenceGain `min(0.08, 0.02+quality*0.06)` 정확, confidence/ageAdjusted clamp01 정확, evidence_count +1 정확. 스펙 §3·패키지 명세와 숫자 단위까지 일치.
- **정규화 규칙**(`evidence.ts:102-159`): performance(1.0/0.25/0.6/0.0)·process(1 − 0.2·min(hint,3), null −0.1, <800 −0.3, >45000 −0.2)·persistence(abandoned 0 / retried&정답 1 / retried 0.6 / 무재시도 정답 0.7 / else 0.4)·preference(0.5+0.25+0.25)·transfer(1/0.3/0.5)·quality(5묶음 실신호/5)·ageBandAdjustment(age<=5 → 0.05) 전부 명세와 일치.
- **케이스 6 경계 재검증**: quality=1 → confidenceGain 0.08, prev conf 0.98+0.08 → clamp 1(일치), level(prev 100, base 0.925) = round(98.875) = 99 ∈ [0,100], evidence_count 8. 테스트 어서션과 일치.
- **테스트 8개 전부 의미 있는 assert**: 필수 6케이스(첫관찰/재시도우위/힌트하락/이탈/전이/경계) 모두 실제 값 검증 + evidenceFromRound 정규화(명시 is_correct 우선·latency_ms 폴백·abandoned 반전·axis 추론 C2·age 0.05) + 헬퍼(ageBandAdjustment·planSessionAxes 두 갈래·trendFrom ±1 경계). 하드코딩 기대값이 손계산과 일치함을 확인.
- **순수성**: `evidence.ts`는 `import type { C6AxisId } from './axes'` 단 하나 — supabase/next/react import 0, 부수효과 0. 테스트는 node:test + node:assert/strict + 상대 import('./evidence')로 tsconfig alias 비의존. 새 npm 의존성/시크릿 접근 없음.
- **axes.ts 무수정 확인**: `git diff --stat -- src/lib/c6/axes.ts` 빈 결과(변경 없음). `git status --porcelain` 상 axes.ts 미표시. 신규 파일은 evidence.ts/evidence.test.ts 둘뿐.
- **스코프 오탐 확인**: out-of-scope.txt의 플래그 파일(demo/ai-diagnosis, demo/mori, demo/page, page.tsx, data/demo, lib/demo-observation.ts) 전부 병렬 demo-funnel-c6 산출물. src/lib/c6/ 밖. evidence.ts/evidence.test.ts 내부에 demo 관련 코드 혼입 없음 확인 → scope_ok=0은 게이트 귀속 한계이지 이 패키지의 위반 아님.
- **게이트 재확인**: validation.log — lint clean, tsc --noEmit 무출력 통과, `npx tsx --test` → 1..8 / pass 8 / fail 0 (이 환경 실행). validation_exit=0.
- **불변식**: invariants.md 위반 없음(순수 서버측 로직, 고객표면 카피/점수노출/머니코드/RLS/게임_rounds 계약 미접촉).
