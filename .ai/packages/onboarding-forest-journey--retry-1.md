# Package: onboarding-forest-journey--retry-1

## Objective
onboarding-forest-journey 반려 해소: 아이 표면 누출 2건(영문 raw "first_journey" 칩, PuzzleGame "N/N개 완성" 숫자 플래시)을 **구조적으로** 제거한다. 반려 상세와 유지 목록: `.ai/handoffs/onboarding-forest-journey.md` (필독).

## Scope
- `src/components/game/FirstJourneyShell.tsx`
- `src/data/onboarding/first-journey.ts` (필요 시)
- `src/lib/topic-label.ts` (additive 매핑 1건만)
- 읽기 전용: `src/components/game/PuzzleGame.tsx` `src/components/game/EmotionExpressionGame.tsx` `src/lib/game/events-client.ts` `.ai/reviews/onboarding-forest-journey.md`

## Constraints
- **critical 1**: `topic-label.ts`에 `first_journey: '모리와 첫 여행'`(또는 더 나은 5-7세 어휘) 매핑 추가 — 기존 매핑 무변경. 이로써 감정 칩이 한국어로 렌더됨을 확인.
- **critical 2**: 게임 단계 완료 시 재사용 컴포넌트의 자체 완료 화면("N/N개 완성했어요")이 렌더될 틈을 없앤다 — 완료 콜백 수신 즉시 shell이 해당 게임을 언마운트하고 다음 단계 뷰로 전환, 이벤트 emit은 await 없이 백그라운드 처리(실패 시 기존 recordingIssue류 조용한 상태만). **PuzzleGame 등 재사용 컴포넌트 수정 금지.** CSS 후손 셀렉터로 가리는 보정은 금지(취약) — 언마운트 타이밍으로 해소.
- 반려 리뷰(`.ai/reviews/onboarding-forest-journey.md`)의 critical 재현 조건(rule_switch/next_pattern/word_image 단계, emit 왕복 지연)을 수정 후 코드 흐름으로 반증할 것(핸드오프에 설명).
- 유지: 9단계 순서·axis/thinking_tool·response_payload 스키마, 씨앗 2개 산정, 숲길 발자국 진행표시, 온보딩 이동 경로, G1 폴백, 검사 어휘 0, 터치 ≥48px, 모리 톤.
- 시크릿/.env/db push 금지, 새 의존성 금지.

## Deliverables
- 5단계 감정 칩이 한국어 라벨로 렌더(영문 raw 0).
- 어떤 단계에서도 숫자 카운트/완료 스코어 화면이 렌더되지 않는다(즉시 전환).
- 이벤트는 여전히 단계당 1 round + 완료 1회 저장(fire-and-forget이어도 유실 시 조용한 경고 상태 유지).

## Validation
```bash
npm run lint && npx tsc --noEmit && npm run build
```

## Handoff requirements
Return:
- summary
- changed files
- validation result
- critical 2건이 코드 흐름상 재발 불가한 이유(언마운트 타이밍 설명)
- known risks
