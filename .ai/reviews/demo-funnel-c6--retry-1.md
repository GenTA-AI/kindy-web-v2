# Review: demo-funnel-c6--retry-1

## decision
approve

## critical
- (none — 이전 반려의 크리티컬 해소 확인)

## should_fix
- (none — 이전 should_fix 2건 모두 해소 확인)

## nice_to_have
- `STRENGTH_LINES.C2_observation_inquiry` 문구에 부사 "먼저"가 두 번 겹친다("작은 흔적을 **먼저** 바라보는 힘을 **먼저** 살펴봤어요."). 표시 정상·기능 무관, 카피 다듬기 여지. 다른 5개 라인은 "…힘을 먼저 살펴봤어요" 한 번만 붙어 자연스러움.
- creative 선택지 아이콘 키 스타일 불일치: 옵션A `icon:'gift'`(영문 키) vs 옵션B `icon:'말'`(한글 1자). 둘 다 `GameTokenVisual`에서 안전하게 렌더(gift→아트에셋 있으면 이미지, 없으면 라벨 '선물' 폴백; '말'→글자 '말' 폴백, `fallbackMark` len≤2 경로) — 크래시·빈칸 없음. 키 컨벤션만 통일하면 더 깔끔(선택).
- `STRENGTH_LINES.C1_focus_flow`는 dead code(강점 후보에 C1 없음 — `DEMO_AXIS_PRIORITY`에 C1 미포함)지만 `Record<C6AxisId,...>` 타입 완전성 위해 존재, 무해.
- (이전 리뷰 carry-over, 이번 retry Scope 밖) VTT 자막 구간(0–4.5/4.5–9/9–15)과 씬 컷 경계 여전히 불일치. creative endSec가 13.45로 당겨져 9–15 구간 자막이 선택 프롬프트와 겹쳐 보일 수 있음. 기능 결함 아님·자막 파일 비스코프.

## validation_notes
- **크리티컬 해소 — 8조합 코드 재검증(손 추적 8/8 일치):** 그래프 옵션→축 매핑 확인(`MORI_DEMO_OPTION_AXIS_BY_ID`): heart care→C6 / face→C2, clue leaf→C2 / light→C3, creative gift→C5 / story→C4. `pickStrengthAxis`는 `DEMO_AXIS_PRIORITY=[C5,C2,C3,C4,C6]` 순 reduce로 최빈값 산정(strict `>`만 교체 → 동점 시 우선순위 앞선 축, C1 미포함). `pickGrowthAxis`는 `DEMO_PRESENTED_AXIS_IDS`(=priority) 중 `!==strength && !selected` 첫 축(폴백 2단, 항상 도달 전 성공). 8행 전부 손 추적:
  - care/leaf/gift → 강점 C5, 자랄 C3 ✓
  - care/leaf/story → 강점 C2, 자랄 C5 ✓
  - care/light/gift → 강점 C5, 자랄 C2 ✓
  - care/light/story → 강점 C3, 자랄 C5 ✓
  - face/leaf/gift → 강점 C2, 자랄 C3 ✓
  - face/leaf/story → 강점 C2(C2 count2), 자랄 C5 ✓
  - face/light/gift → 강점 C5, 자랄 C4 ✓
  - face/light/story → 강점 C2, 자랄 C5 ✓
  워커 표 8행과 완전 일치. 고유 (강점,자랄) 쌍 6개: (C5,C3)(C2,C5)(C5,C2)(C3,C5)(C2,C3)(C5,C4) — ≥6 충족. **강점·자랄 어디에도 C1 부재 확인**(priority·presented 모두 C1 제외). 축 분포는 최대 (2,1) 또는 (1,1,1)만 가능(어떤 축도 3표 불가; C2만 최대 2표) → 최빈/동점 로직이 모든 경우 커버. `strength`는 항상 selected 원소(count≥1)이므로 growth 후보는 최소 2개 잔존 — 주석 명시대로 폴백 미도달, 크래시 없음. choices 빈 배열 극단(플레이어가 3선택 강제)에도 strength=C5·growth=C2로 무크래시.
- **should_fix 해소:** creative 씬 `endSec:13.45`(< 13.5) — 플레이어 `onTimeUpdate`가 `currentTime >= endSec-0.05`(≈13.40s)에서 pause+`finishCurrentScene`→choice 노출, 영상 종료(15s) 전 맥락 안에서 뜸 ✓. `mori-demo-ending` 씬·ending rule 제거(`endings:[]`) 확인. 최종선택 흐름: creative 옵션에 `branchScenes` 없음→`isFinalChoice`=true→`chooseEnding` 실행→`graph.endings.find`=undefined, `endings[0]`=undefined→`null` 반환→`else` 분기 `completeOnce()`→`onComplete`→카드 전환. 빈 ending 플래시 제거·안전 폴백 확인. `selectOption`은 `await onRoundResult()`(choicesRef에 creative 기록) 후 completeOnce → handleComplete의 `buildObservation(choicesRef.current)`에 3선택 모두 반영.
- **이전 승인분 유지:** `demo-observation.ts` — working tree에서 untracked(`??`, 선행 런 생성분·미커밋)로 git-diff 불가하나 on-disk 내용이 승인 스키마와 동일: `{v:1, choices:[{choiceId,optionId,axisId}], strength_axis, growth_axis, created_at}`, Max-Age 30일, Path=/, SameSite=Lax, 파서 try/catch + `isObservationCookie/Choice/isAxisId` 형태검증(잘못된 쿠키 null 반환, throw 없음). retry 워커 자기보고상 이 파일 무수정, 내용 일치로 수용. `InteractiveVideoPlayer.tsx`·`types/interactive-session.ts`·`data/game/animal-village.ts`·`c6/axes.ts`·`MoriCharacter.tsx` — `git status --porcelain` 무출력(tracked-clean, 워킹트리 무변경) 확인. `playsInline` 플레이어 L367 존치.
- **금지어 0(최중요):** 새 표면 전체(그래프 라벨·프롬프트, MoriDemoJourney의 STRENGTH_LINES/GROWTH_LINES·카드 카피, page.tsx metadata) `grep -rnE '진단|분석|평가|점수|등급|또래|부족|발달'` → 0건. 영문 `AI|diagnos|analy|score|rank|grade|develop|peer` 매치 1건은 `START_HREF='/start?from=ai-diagnosis'`의 `diagnos`(URL 어트리뷰션 쿼리, 고객 가시 텍스트 아님) — 이전 리뷰가 이미 수용한 동일 문자열. 막대·카운트·순위 UI 없음.
- **익명성:** 변경 두 파일 `grep -rnE 'supabase|createClient|fetch\(|/api/|axios|process\.env'` → 0건. MoriDemoJourney는 `document.cookie`만 사용(로컬), 서버 전송 없음. `animal-village` import 0건.
- **라벨 톤(5-7세):** 마음 듣기/표정 몸짓/잎 그림자/반복된 빛/선물별/말로 잇기 — 짧은 구·구체 어휘, 오답 뉘앙스 없음(둘 다 성향 신호). emotion 두 옵션은 EmotionChoiceFace(sad/worried)로 꾸미의 마음을 함께 살피는 프레이밍 — 옳고그름 없음.
- **한 화면 한 행동:** 카드=주 CTA `/start?from=ai-diagnosis` 1 + 보조 링크 `/sample/report` 1, 시청 화면=시작 버튼 1. 유지.
- 게이트 ground truth 수용(재도출 안 함): team-lead 확인 — validation_exit=0(lint+tsc+turbopack build 이 환경 통과). scope_ok=0 flagged는 병렬 diagnosis 패키지 산출물+선행 런 파일+무관 사용자 문서로 게이트 귀속 한계이며 이 패키지 실변경 2파일과 무관. HEAD 3c4a474.
