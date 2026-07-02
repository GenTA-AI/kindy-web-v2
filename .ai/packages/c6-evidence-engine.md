# Package: c6-evidence-engine

## Objective
라운드 행동 로그를 5증거묶음(Performance/Process/Persistence/Preference/Transfer, 각 0..1)으로 정규화하고 축 레벨을 갱신하는 순수 증거 엔진을 만든다. 스펙 §3 공식을 그대로 구현하고 단위테스트로 고정한다. 이후 진단 에이전트(서버)는 이 모듈을 배선만 한다.

## Scope
- NEW: src/lib/c6/evidence.ts
- NEW: src/lib/c6/evidence.test.ts
- `src/lib/c6/axes.ts` (읽기 전용 — 타입 import만, 수정 금지)

## Constraints
- **순수 함수만.** supabase/next/react import 금지. 부수효과 없음.
- 테스트는 node:test(`node:test` + `node:assert/strict`)로 작성하고 **상대 import**(`./evidence`) 사용 — tsconfig alias에 의존하지 않는다(러너: `npx tsx --test`).
- 새 npm 의존성 금지. 시크릿/.env 접근 금지.
- **축 업데이트 공식 v0.1 (스펙 §3 — 가중치·캡 숫자 변경 금지):**
```ts
base = 0.30*performance + 0.25*process + 0.20*persistence + 0.10*preference + 0.15*transfer; // 각 0..1
ageAdjusted = clamp(base + age_band_adjustment, 0, 1);
confidenceGain = Math.min(0.08, 0.02 + quality * 0.06);
next = {
  level: Math.round(100 * (0.85 * previous.level/100 + 0.15 * ageAdjusted)),
  confidence: clamp(previous.confidence + confidenceGain, 0, 1),
  evidence_count: previous.evidence_count + 1,
};
```
- 프로필 기본값(첫 관찰 이전): level 50, confidence 0, evidence_count 0.

### 정규화 규칙(이 숫자 그대로 구현 — 모든 묶음 최종 clamp 0..1)
입력 타입 `RoundEvidenceInput`: `{ axis_id: C6AxisId; is_correct: boolean|null; completed: boolean; abandoned: boolean; elapsed_ms: number|null; hint_count: number; retried: boolean; retry_count: number; preferred_character_match: boolean; activity_type_revisit: boolean; transfer_success: boolean|null; age_band_adjustment?: number }`
- **performance**: is_correct===true → 1.0 · is_correct===false → 0.25 · is_correct===null && completed → 0.6(정답 없는 개방 과제 완료) · completed 아님 → 0.0.
- **process**: 1.0에서 시작, 힌트 `-0.2 * min(hint_count, 3)`; elapsed_ms가 null이면 -0.1, 800ms 미만이면 -0.3(찍기 신호), 45000ms 초과면 -0.2.
- **persistence**: abandoned → 0.0 · (retried || retry_count>0) && is_correct===true → 1.0(재도전 후 성공) · 재시도했으나 미성공 → 0.6 · 재시도 없이 성공 → 0.7 · 그 외 0.4.
- **preference**: 0.5 기본 + preferred_character_match면 +0.25 + activity_type_revisit면 +0.25.
- **transfer**: transfer_success===true → 1.0 · false → 0.3 · null → 0.5(중립).
- **quality**(confidenceGain용, 0..1): 실신호가 있는 묶음 수 / 5. 실신호 판정 — performance: is_correct!==null || completed · process: elapsed_ms!==null || hint_count>0 · persistence: retried || retry_count>0 || abandoned · preference: 두 플래그 중 하나라도 true · transfer: transfer_success!==null.
- **age_band_adjustment**: 기본 0, v0.1 규칙 `ageBandAdjustment(age: number|null): number` = age!==null && age<=5 → +0.05, 그 외 0.

### 필수 export
- `buildEvidence(input: RoundEvidenceInput): AxisEvidence`(5묶음 + quality + age_band_adjustment).
- `updateAxis(previous: AxisProfileState, evidence: AxisEvidence): AxisProfileState` — 위 공식 그대로.
- `evidenceFromRound(round, ctx)`: game_rounds 형태 레코드(`{ game_type, objective_code, score, max_score, latency_ms, retried, axis_id?, is_correct?, elapsed_ms?, hint_count?, retry_count?, abandoned? }`) + ctx(`{ preferredCharacterMatch?, activityTypeRevisit?, transferSuccess?, age? }`) → RoundEvidenceInput. is_correct 우선순위: 명시 is_correct → score!=null&&max_score!=null이면 score>=max_score → null. elapsed_ms 없으면 latency_ms 사용. completed는 라운드 레코드 존재=true 기본, abandoned 플래그로 반전.
- `planSessionAxes(growthAxis: C6AxisId): [C6AxisId, C6AxisId, C6AxisId]` — Assembly(스펙 §2): growthAxis ∈ {C1,C2,C3} → [C1_focus_flow, C2_observation_inquiry, C3_pattern_problem], 그 외(C4/C5/C6) → [C1_focus_flow, C5_imagination_analogy, C6_social_emotional].
- `trendFrom(previousLevel: number, nextLevel: number): 'up'|'steady'|'down'`(±1 초과 변화 기준).

### 필수 테스트 케이스 (evidence.test.ts)
1. 첫 관찰: 기본 프로필(50/0/0) + 정답·무힌트 → 공식으로 손계산한 기대 level/confidence와 일치, evidence_count 1.
2. 재시도 성공: retried+정답이 무재시도 정답보다 base가 높다(persistence 1.0 vs 0.7).
3. 힌트 과다: hint_count 3이 hint_count 0보다 process·최종 level이 낮다.
4. 이탈: abandoned → performance 0·persistence 0, level이 50 아래로 내려간다.
5. transfer: transfer_success true가 null보다 base가 높다.
6. 경계: confidenceGain 상한 0.08(quality=1), confidence는 1을 넘지 않고 level은 0..100.

## Deliverables
- `src/lib/c6/evidence.ts` 순수 모듈 + 위 export 전부.
- `src/lib/c6/evidence.test.ts` 6개 이상 테스트, 전부 green.

## Validation
```bash
npm run lint && npx tsc --noEmit && npx tsx --test src/lib/c6/evidence.test.ts
```

## Handoff requirements
Return:
- summary
- changed files
- validation result (테스트 출력 포함)
- known risks (정규화 상수의 튜닝 필요 지점 명시)
