# Review: onboarding-forest-journey--retry-1

## decision
approve

## critical
- (none — 반려 critical 2건 모두 구조적으로 해소됨. 아래 validation_notes에 코드 흐름 근거)

## should_fix
- (없음 — 차단성 아님) 크롬 숨김 방식(`JourneyChromeStyles`의 위치 기반 후손 셀렉터)은 *놀이 중* 라운드 번호/진행칩("퍼즐 N", "N/N짝", `role=progressbar`)을 가리는 용도로 여전히 남아 있다. 이번 retry는 지시대로 이 CSS를 **늘리지 않았고**(현재 셀렉터 = 원 반려 리뷰가 인용한 셀렉터와 동일), 완료 화면 누출은 CSS가 아니라 언마운트 타이밍으로 해소했다. 다만 재사용 게임의 마크업이 바뀌면 놀이 중 번호가 다시 샐 수 있는 결합은 존속 — 장기적으로 PuzzleGame/HiddenFriendGame/EmotionExpressionGame에 `data-*` 훅을 요청해 위치 셀렉터 의존을 줄이길 권장. (원 review should_fix 캐리포워드, 비차단.)
- game.ts `GameRoundParams` 확장(template_id/prompt_ko/items/categories/answer_token) 의존은 `6b29e06`에 이미 커밋되어 tsc 통과 — 해소됨. first-journey를 별도 PR로 랜딩할 경우 이 확장이 동반돼야 함은 유지.

## nice_to_have
- 네트워크가 지속 실패하면 `startGameSession`이 매 라운드 `game_started`를 재발행할 수 있음(`FirstJourneyShell.tsx:250-280` 실패 시 `sessionIdRef` null 유지). retry가 fire-and-forget로 바꿨어도 이 경로는 원본과 동일 — 데모 기준선에 무해하나 서버측 중복 세션 가능성. (원 review nice_to_have 그대로.)
- `word_image` 라운드 `response_payload.selected_answer`가 고정 문자열 `'그림과 말 연결'`(`FirstJourneyShell.tsx:492`) — MatchPuzzle이 실제 선택을 onComplete로 노출하지 않는 계약 한계. 정적값 인지 필요.
- 감정 단계 `emotion_choice`는 `button[aria-pressed]` textContent를 onClickCapture로 캡처(`FirstJourneyShell.tsx:660-665`) — 현재 EmotionFace가 aria-hidden이라 라벨만 잡히나, 버튼에 텍스트 노드가 추가되면 오염 가능. (원 review와 동일 결합.)

## validation_notes
- **게이트 ground truth 수용 + 자체 재확인**: 팀리드 제공(validation_exit=0). 본 리뷰에서 직접 재실행 → `npx tsc --noEmit` exit 0(무출력), `npm run lint`(eslint) 무경고. build는 ground truth 신뢰(handoff: sandbox turbopack이 로컬 포트 bind로 panic → 지원 옵션 `--webpack` 통과, `/play/first-journey` 라우트 포함). React/next 버전 확인: **react 19.2.4 / react-dom 19.2.4 / next ^16.2.3**.

- **critical 1 (영문 raw 칩) — 해소 확인**. `git diff src/lib/topic-label.ts` = 단 1줄 additive 삽입(`normalized === 'first_journey' → '모리와 첫 여행'`), 기존 매핑 전부 무변경. 삽입 위치가 `.includes()` 폴백들보다 위여서 exact match가 우선하고, 'first_journey'는 하위 include 패턴(science/english/emotion 등) 어디에도 걸리지 않아 오분류 없음. 감정 칩 경로 실검증: `FIRST_JOURNEY_EMOTION_SPEC.topic = FIRST_JOURNEY_TOPIC = 'first_journey'`(`first-journey.ts:36,118,208`) → `EmotionExpressionGame`이 `topicLabel(spec.topic)`을 칩(`:219`)과 `aria-label`(`:227`) 두 곳에 렌더 → 이제 둘 다 한국어. **영문 raw가 나올 경로 없음.** EmotionExpressionGame 자체는 git 무수정(재사용 금지 준수).

- **critical 2 (N/N개 완성 플래시) — 언마운트 타이밍으로 재발 불가 확인(정독)**:
  - 재사용 완료 콜백 경로: PuzzleGame(Quiz/Match/Sort 3변형 모두) 완료는 `delay(() => completeRound(...), 650)` = `useTimerQueue`의 `setTimeout`. `completeRound`(`PuzzleGame.tsx:609-627`)는 `setCompleted(true)` **직후 동기로** `onComplete(...)` 호출.
  - 셸 핸들러는 전부 **동기 함수**(async/await 없음): `onComplete → handleX`가 `goToStage(next)`(또는 rule_switch 1차의 `setRuleSwitchPhase(1)`)를 `await` 개입 없이 즉시 실행. 반려 원인이던 `await emitJourneyEvent → goToStage` 순서는 제거됐고, 지금은 `goToStage`가 셸 `completeRound`(ref기록+`setJuiceKey`+`enqueue`, 논-await)보다 먼저 실행됨.
  - **React 19 자동 배칭**: `setCompleted(true)`(PuzzleGame)와 `setStage`/`setRuleSwitchPhase`(셸)이 동일 setTimeout tick 안에서 발생 → 단일 렌더로 커밋. 그 렌더에서 셸의 puzzle 스테이지 서브트리가 사라지거나(스테이지 전환) key가 바뀌어(rule_switch 0→1) 이전 PuzzleGame 파이버가 삭제됨 → **삭제되는 파이버의 대기 setCompleted는 커밋되지 않고 `CompletedState`(`{score}/{maxScore}개 완성했어요`)는 렌더 함수 자체가 호출되지 않음.**
  - 4개 완료 지점 각각 검증: rule_switch 1차(key `rule-switch-0`→`rule-switch-1` 언마운트), rule_switch 2차(→`next_pattern`), next_pattern(→`heart_choice`), word_image(→`cloud_idea`). 650ms 지연 구간 동안은 `completed=false`라 완료 화면이 아니라 퍼즐 그리드가 유지되고, 그 진행칩/번호는 기존 크롬 CSS가 가림. **완료 화면이 커밋되는 타이밍 창 없음.**
  - CSS 후손 셀렉터 미증가: `JourneyChromeStyles`(`FirstJourneyShell.tsx:863-890`) 셀렉터가 원 반려 리뷰가 인용한 것과 동일(신규 추가 0). 파일이 untracked라 retry 델타 git-diff는 불가(귀속 한계) — self-report(핸들러만 변경)와 CSS 내용 일치로 교차 확인.

- **회귀 0 확인**:
  - 이벤트 1 round/단계 + game_completed 1회: 셸 `completeRound`가 `recordedRoundKeysRef`로 라운드 중복 방지(`:325-326`), `finishJourney`는 `completedRef` 가드(`:360-361`). `enqueueJourneyEvent`는 `eventQueueRef` 프라미스 체인으로 **직렬 순서 보장**(game_started는 첫 라운드 emit 시 `startGameSession`으로 지연 1회 → 라운드 순서대로 → game_completed 마지막). 실패 시 `savingIssue`만 켜는 조용한 경고 유지("보호자 화면 반영이 조금 늦을 수 있어요.").
  - 9단계 순서·axis/thinking_tool·씨앗 2개·G1 폴백·영상 그래프: `FIRST_JOURNEY_ROUND_META`/`STEP_ORDER`/`chooseSeeds`/`FIRST_JOURNEY_SEQUENCE_FALLBACK`(next_pattern=G1_match) 전부 원 승인 로직과 일치. 진행표시는 숲길 발자국 점(`nav aria-label="숲길 발자국"`) — 퍼센트/카운터 아님.
  - 재사용 컴포넌트 무수정: `git status` — PuzzleGame/EmotionExpressionGame/HiddenFriendGame/InteractiveVideoPlayer/events-client.ts 전부 unmodified.
  - 검사 어휘 grep(검사/진단/평가/점수/등급/또래/틀렸/오답/정답/문항/percentile) 0건. 아이 표시 문자열에 raw 축 id/영문 0건(shell의 `first_journey` 출현은 전부 `source`/`objective_code`/`standard_anchor` 이벤트 메타필드 — 렌더 안 됨). 시크릿 0, 신규 npm 의존성 0(package.json diff 없음).

- **완료 전 이탈 안전성**: PuzzleGame `useTimerQueue`(`:637-656`)와 HiddenFriendGame(`:143-164`) 모두 언마운트 시 자체 setTimeout을 clear → dangling 콜백 크래시 없음. 셸 `eventQueueRef` 체인은 `fetch(keepalive:true)`로 in-flight 유지, `.catch`의 `setSavingIssue`는 언마운트 후 호출돼도 React 19에서 no-op(경고/크래시 없음). 안전.

- **스코프**: 실변경 in-scope = `topic-label.ts`(additive 1줄), `FirstJourneyShell.tsx`, `first-journey.ts`(내용 정합, retry에서 실질 변경 징후 없음). 트리 내 out-of-scope(`report/page.tsx`·`onboarding/page.tsx`·`c6/report-data.ts`·KIOSK .md 문서)는 팀리드 ground truth대로 병렬 report 패키지 + 선행 런 파일 + 사용자 문서 — 귀속 한계이며 본 retry 산출물 아님. 반려 근거 아님.
