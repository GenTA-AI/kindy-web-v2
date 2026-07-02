# Handoff: onboarding-forest-journey (attempt 1 → retry 필요)

## 이전 런 요약
9단계 여행 구조·측정 정합·이벤트 순서·씨앗 2개 로직·인증·기존 컴포넌트 무수정 전부 리뷰 통과. 검사 어휘 0, 숲길 발자국 진행표시. 4단계는 G3_sequence 미지원으로 G1_match 무늬 변형 폴백(사유 로그 기록됨 — 유지).

## 반려 사유 (critical 2 — 아이 표면 누출)
재사용 컴포넌트를 **위치 기반 후손 CSS로 가리는 방식의 빈틈** 2건:
1. heart_choice(5단계) 감정 칩이 `topicLabel('first_journey')` 미매핑으로 영문 raw "first_journey"를 그대로 노출 — 크롬 숨김 CSS가 이 span은 안 가림.
2. PuzzleGame 완료 화면 "N/N개 완성했어요"(숫자)가 emit 왕복 동안 rule_switch/next_pattern/word_image 단계에서 잠깐 노출 — 숨김 셀렉터에 안 걸림.

## should_fix
- first-journey.ts가 의존하는 `GameRoundParams` 확장(template_id/prompt_ko/items/categories/answer_token)은 `6b29e06`에 이미 커밋됨 — 해소.

## 오케스트레이터 지시 (수정 방향)
- CSS 후손 셀렉터 가리기를 늘리지 말 것 — **구조적으로 해소**하라:
  (a) `src/lib/topic-label.ts`에 `first_journey` 매핑 추가(예: '모리와 첫 여행') — additive 1줄.
  (b) 각 게임 단계는 완료 콜백을 받는 즉시 **UI를 다음 단계로 전환**하고 이벤트 emit은 백그라운드(fire-and-forget + 실패 시 조용한 경고 상태)로 — 재사용 컴포넌트의 자체 완료 화면이 렌더될 틈을 없앤다. (기존 컴포넌트 수정 금지 원칙 유지.)

## 유지할 것 (재작업 금지)
9단계 순서·측정 스키마, 씨앗 2개 산정, 숲길 발자국 진행, 온보딩 이동 경로, G1 폴백.

## retry-1 해소 기록
- critical 1: `src/lib/topic-label.ts`에 `first_journey -> 모리와 첫 여행` 매핑을 추가했다. `EmotionExpressionGame`의 우측 topic chip은 계속 `topicLabel(spec.topic)` 경로를 타지만, 이제 fallback raw 문자열로 내려가지 않는다.
- critical 2: `FirstJourneyShell`의 라운드 완료 흐름을 `await completeRound(...) -> goToStage(...)`에서 `goToStage(...) -> completeRound(...)`로 바꿨다. `completeRound`는 로컬 결과/씨앗 계산용 ref를 즉시 기록하고 `enqueueJourneyEvent`에 저장 이벤트를 넘긴다. 저장 큐는 직렬 실행되지만 UI 콜백에서는 await하지 않는다.
- rule_switch 1차 완료는 같은 stage 안에서 `setRuleSwitchPhase(1)`를 즉시 실행하므로 `PuzzleGame` key가 `rule-switch-0`에서 `rule-switch-1`로 바뀌어 이전 퍼즐 인스턴스가 언마운트된다. rule_switch 2차, next_pattern, word_image 완료는 콜백 동기 구간에서 각각 다음 stage로 이동한다. 따라서 `PuzzleGame` 내부 `setCompleted(true)`와 shell의 stage/key 변경이 같은 React 배치에 들어가며, 다음 렌더에는 완료 화면 인스턴스가 존재하지 않는다.
- 이벤트 저장은 `eventQueueRef`로 직렬 fire-and-forget 처리한다. 실패는 기존처럼 `savingIssue`만 켜서 "보호자 화면 반영이 조금 늦을 수 있어요." 조용한 상태로 남긴다. `recordedRoundKeysRef`로 라운드별 중복 저장도 막는다.
- 검증: `npm run lint` 통과, `npx tsc --noEmit` 통과. `npm run build`는 sandbox에서 Turbopack이 CSS 처리 중 local port bind를 시도하다 `Operation not permitted`로 panic. 같은 Next CLI의 지원 옵션인 `npm run build -- --webpack`은 통과했고 `/play/first-journey` 라우트가 빌드 목록에 포함됨.
