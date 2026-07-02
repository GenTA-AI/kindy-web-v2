# Package: demo-funnel-c6--retry-1

## Objective
demo-funnel-c6 반려 해소: 첫 관찰 카드가 아이의 **실제 선택 조합에 따라 달라지게** 만든다. 현재는 어떤 경로를 밟아도 강점=마음 씨앗(C6)·자랄=별빛 씨앗(C1)으로 고정 — 개인화 약속과 모순. 선행 런의 나머지 산출물(쿠키·redirect·플레이어 재사용)은 유지한다. 반려 상세: `.ai/handoffs/demo-funnel-c6.md` 참조(이 패키지 하단에도 요약).

## Scope
- `src/data/demo/mori-demo-graph.ts`
- `src/app/demo/mori/MoriDemoJourney.tsx`
- `src/app/demo/mori/page.tsx` (카피 미세 조정 필요 시에만)
- 읽기 전용: `src/lib/c6/axes.ts` `src/lib/demo-observation.ts` `src/types/interactive-session.ts` `src/components/game/InteractiveVideoPlayer.tsx`

## Constraints
- **변별 메커니즘 재설계 (핵심):**
  1. 각 선택의 **옵션들이 서로 다른 축**으로 매핑되게 그래프를 고친다(오답 개념은 그대로 없음 — 둘 다 좋은 선택, 성향 신호일 뿐):
     - emotion 선택: 옵션A "마음 알아주기" 계열 → `C6_social_emotional`, 옵션B "표정·몸짓 단서 살피기" 계열 → `C2_observation_inquiry`.
     - clue 선택: 기존 유지 — 잎/장소 단서 → `C2_observation_inquiry`, 반짝 순서/규칙 → `C3_pattern_problem`.
     - creative 선택: 옵션A 독창 변형("~가 될 거야", novelty) → `C5_imagination_analogy`, 옵션B 말로 표현/이야기 잇기 → `C4_language_expression`.
     - 라벨·아이콘은 5-7세 한 단어~짧은 구, 기존 톤 유지. `MORI_DEMO_OPTION_AXIS_BY_ID` Record 갱신.
  2. **강점 씨앗** = 3개 선택의 축 최빈값. 동점(3축 모두 1표)이면 우선순위 `C5 > C2 > C3 > C4 > C6`(차별화 축 우선)로 결정 — first-seen 고정 금지.
  3. **자랄 씨앗** = 데모에 옵션으로 **제시된 축 집합 {C2,C3,C4,C5,C6} 중 미선택 축**에서 선택(우선순위 동일 서열에서 강점과 다른 것). **C1은 데모에 등장하지 않으므로 후보에서 제외.** 미선택 축이 항상 ≥2개 존재(선택 3회, 후보 5축)함을 주석으로 명시.
  4. 결과: 서로 다른 선택 조합이 서로 다른 (강점, 자랄) 쌍을 만든다 — 최소 6가지 이상 조합이 실제로 나옴을 손으로 검증해 핸드오프에 표로 남겨라.
- **should_fix 처리:** creative 씬 endSec를 앞당겨(≈13.5s 이전) 선택 프롬프트가 영상 맥락 안에서 뜨게 하라. `mori-demo-ending` 빈 씬(14.9–15) 제거 — creative 최종 선택 후 바로 완료(플레이어의 isFinalChoice+빈 threshold ending 동작 활용).
- **유지(재작업 금지):** `src/lib/demo-observation.ts` 쿠키 스키마·파서 무수정(strength/growth 값만 새 로직 결과로 기록), `/demo/ai-diagnosis` redirect, 랜딩/데모 링크, 금지어 0 상태(진단/분석/평가/점수/등급/또래/부족/발달/AI — metadata 포함), 익명성(supabase/api 0), InteractiveVideoPlayer·타입 무수정, playsInline, 한 화면 한 행동.
- 시크릿/.env/db push 금지. 새 의존성 금지. animal-village.ts 수정·import 금지.

## Deliverables
- 선택 조합에 따라 (강점 씨앗, 자랄 씨앗)이 달라진다 — 예: 관찰 계열만 고르면 강점=반짝 씨앗, 표현을 고르면 강점 후보에 말 씨앗 등.
- 자랄 씨앗에 C1(별빛 씨앗)이 나오지 않는다.
- creative 선택이 영상이 끝나기 전에 노출된다. 빈 ending 플래시 없음.
- 쿠키에 새 strength/growth가 기록된다. 기존 하드 게이트(금지어·익명·재사용) 전부 유지.

## Validation
```bash
npm run lint && npx tsc --noEmit && npm run build
```

## Handoff requirements
Return:
- summary
- changed files
- validation result
- **선택 조합 → (강점, 자랄) 매핑 표** (모든 2^3=8 조합 또는 대표 6+ 조합)
- known risks
