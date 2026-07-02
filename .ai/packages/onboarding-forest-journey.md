# Package: onboarding-forest-journey

## Objective
첫 사용 10분 "모리의 숲 입장 여행"(스펙 §5, 9단계)을 새 라우트 `/play/first-journey`로 구현한다. 검사가 아니라 모리와의 여행처럼 보여야 하고, 각 단계 로그가 표준 이벤트 필드(axis_id·thinking_tool·elapsed_ms·hint_count·retry_count·response_payload)로 저장되어 진단 에이전트의 기준선(baseline) 프로필이 된다. 마지막에 "오늘 빛난 씨앗 2개"를 보여준다.

## Scope
- NEW: src/app/play/first-journey/page.tsx
- NEW: src/components/game/FirstJourneyShell.tsx
- NEW: src/data/onboarding/first-journey.ts
- `src/app/onboarding/page.tsx` (완료 후 이동 경로만: 148행 근처 `router.push('/play?...')` → `/play/first-journey?childId=...`)
- 읽기 전용 재사용: `src/components/game/HiddenFriendGame.tsx` `src/components/game/PuzzleGame.tsx` `src/components/game/EmotionExpressionGame.tsx` `src/components/game/InteractiveVideoPlayer.tsx` `src/components/game/JuiceBurst.tsx` `src/components/game/Mascot.tsx` `src/components/MoriCharacter.tsx` `src/lib/game/events-client.ts` `src/lib/game/engine.ts` `src/lib/useVoice.ts` `src/types/interactive-session.ts` `src/lib/c6/axes.ts` `src/types/game.ts`

## Constraints
- **검사처럼 보이면 안 된다**: 문항 번호·정오답 표시·"검사/진단/평가" 단어 금지. 진행은 숲길 발자국 같은 시각 요소. 오답 개념 없음(다시 해보기만), 위협·재촉 없음. 글보다 이미지·음성, 터치 타깃 ≥48px, 한 화면 한 행동.
- **기존 컴포넌트 수정 금지** — props 범위 안에서 재사용만. InteractiveVideoPlayer의 playsInline 제거 금지. 새 npm 의존성 금지. 시크릿/.env 금지. Next.js 16 — 코드 전 `node_modules/next/dist/docs/` app router 페이지/클라이언트 컴포넌트 가이드 확인.
- 이벤트 전송은 기존 `emitGameEvent`(events-client) 사용: `game_started` → 단계마다 `game_round_completed`(result에 확장 필드 포함 — c6-diagnosis-agent가 서버 수용을 이미 구현) → `game_completed`. 라운드 result는 GameRoundResult 형태 + `axis_id`(정본 6 id), `thinking_tool`(13 상수), `elapsed_ms`, `hint_count`, `retry_count`, `response_payload`(아래 단계별 변수).
- **9단계 (스펙 §5 — 순서·측정 고정, 구현 게임은 정찰 후 폴백 허용):**

| # | 아이 경험 | axis / thinking_tool | 핵심 로그(response_payload) | 구현 |
|---|---|---|---|---|
| 1 | 모리 인사 "너에게 빛나는 씨앗을 찾아볼게" | 진입 | start_time, skip_intro | Mori 카드+시작 버튼(건너뛰면 skip_intro=true) |
| 2 | 숨은 반짝이 찾기 (T1) | C2_observation_inquiry / observation | found_count, elapsed_ms, hint_count | HiddenFriendGame |
| 3 | 색으로 찾기→모양으로 찾기 (T2) | C3_pattern_problem / pattern_recognition | rule_switch_success, attempts | PuzzleGame G2_sort 2연속(기준 전환) |
| 4 | 다음 무늬 고르기 (T3) | C3_pattern_problem / pattern_forming | accuracy, retry_count | PuzzleGame(G3_sequence 지원 여부를 engine/PuzzleGame에서 정찰, 미지원이면 G1_match 무늬 변형) |
| 5 | 캐릭터 마음 고르기 (T6) | C6_social_emotional / empathy | emotion_choice, response_time | EmotionExpressionGame |
| 6 | 그림에 맞는 단어 고르기 (T4) | C4_language_expression / visualization | selected_answer, confidence_proxy(선택까지 시간) | PuzzleGame G1_match |
| 7 | "이 구름은 무엇이 될 수 있을까?" (T5) | C5_imagination_analogy / analogy | idea_choice, novelty_tag | 2x2 큰 선택 카드(인라인 구현, 정답 없음, 한 옵션에 novelty_tag) |
| 8 | 짧은 이야기 영상 후 한 문제 | C1_focus_flow / play | video_completion, quiz_result | InteractiveVideoPlayer + 번들 영상 `/demo-videos/mori-starlight-seed.mp4`(+`.vtt`)로 미니 그래프(선택 1개) 구성 |
| 9 | 오늘 빛난 씨앗 2개 | 개인화 시작 | recommended_axis_ids, reason_codes (game_completed payload에) | 단계 결과에서 최고 성과 축 1 + 더 자랄 축 1을 골라 c6_axes child_label("반짝 씨앗" 등)로 표시 |
- 씨앗 문구는 `C6_AXES`의 child_label/parent_label 사용, 숫자·등급·비교 없음. 마무리 문구는 첫날 리포트 톤의 아이용 변형("모리가 OO의 반짝임을 봤어" 톤 — '관찰'은 보호자 표면어라 아이 화면에 쓰지 않음).
- 모리 톤: 평가보다 질문, 안정적·따뜻. 금지: "틀렸어", "빨리 해", "네가 안 하면 큰일 나".
- `/play/first-journey/page.tsx`는 `/play/page.tsx` 패턴(getCurrentParentId, loadChildren, redirect)을 따르되 `/play/page.tsx` 자체는 수정 금지(파일 충돌 방지 — c6-recommendation-agent가 편집).
- 데모 관찰 쿠키(`kindy_demo_observation`, demo-funnel-c6가 도입 예정)는 **읽지 않는다** — v0 결합 금지.

## Deliverables
- `/play/first-journey?childId=`에서 9단계 여행이 끝까지 진행되고, 각 단계가 axis_id/thinking_tool 포함 라운드로 저장된다.
- 마지막 화면에 씨앗 2개(강점 1·자랄 씨앗 1)와 "보호자에게 보여주기" CTA(→ `/dashboard/report?childId=`).
- 온보딩 완료 시 first-journey로 이동.
- 검사 어휘·문항 번호·정오답 UI 부재.

## Validation
```bash
npm run lint && npx tsc --noEmit && npm run build
```

## Handoff requirements
Return:
- summary
- changed files
- validation result
- known risks (특히 4단계 게임 타입 폴백 결정 내용)
- HUMAN 단계: 실기기(iPad 가로) QA — 영상 자동재생/음성/터치 크기 확인.
