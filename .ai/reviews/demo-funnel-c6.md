# Review: demo-funnel-c6

## decision
request_changes

## critical
- **첫 관찰 카드가 모든 사용자에게 완전히 동일 — 선택을 전혀 반영하지 못함.** `MoriDemoJourney.tsx`의 `pickStrengthAxis`/`pickGrowthAxis`와 데모 그래프의 축 설계가 맞물려, 어떤 경로를 밟아도 강점=`C6_social_emotional`(마음 씨앗), 자랄=`C1_focus_flow`(별빛 씨앗)로 고정된다.
  - 근거(축 순서 `C6_AXIS_IDS = [C1,C2,C3,C4,C5,C6]` 확인):
    - 세 선택 슬롯의 축이 고정(emotion→C6, clue→C2|C3, creative→C5)이라 기록된 3개 선택은 항상 서로 다른 축·각 count 1 → "가장 몰린 axis"가 성립하지 않음. `pickStrengthAxis`는 동점 시 first-seen이 빠른 축을 고르는데, emotion 선택이 재생 순서상 항상 먼저 기록됨 → **강점은 언제나 C6**.
    - `pickGrowthAxis`는 `C6_AXIS_IDS` 순서로 첫 미선택 축을 찾음. C1은 데모에 선택지로 등장하지 않아 항상 미선택 → **자랄 씨앗은 언제나 C1**.
  - 영향: 스펙이 변별을 위해 의도한 clue 옵션별 C2/C3 매핑이 카드에서 완전히 사장된다. 또 자랄 씨앗(C1·집중몰입)은 여정에서 한 번도 제시되지 않은 차원이다. 페이지 카피("모리가 작은 씨앗을 함께 살펴봤어요")·메타데이터 설명("아이가 고른 작은 씨앗을 따뜻하게 이어 봅니다")은 카드가 아이의 선택을 반영한다고 약속하지만 실제 출력은 입력과 무관하게 바이트 단위로 동일하다. 신뢰 자산 기반 SNS 퍼널의 최상단 표면으로서 "가짜로 느껴지는" 리스크가 크다.
  - 참고: 코드 자체는 스펙 문구("몰린 axis"/"미선택 axis 중 1")를 문자 그대로 충족하며 하드 게이트는 모두 통과한다. 근본 원인은 3슬롯·고정축 설계가 변별을 만들 수 없다는 스펙 메커니즘에 있음. 해소안 택1: (a) 카드 로직이 실제 선택에 반응하도록 수정(예: clue C2/C3 결과를 강점/자랄에 반영, 또는 미선택 후보를 실제로 제시된 축들에서 산정), 또는 (b) 정본 데모가 canned 카드를 의도한다면 카피/설명에서 "아이가 고른" 개인화 약속을 완화. 다음 Codex 런 핸드오프에 이 결정 포인트를 넘길 것.

## should_fix
- creative 선택이 영상 마지막 프레임(≈14.95s)에 뜬다. creative 씬 클립이 12.2–15로, 선택 프롬프트가 재생이 사실상 끝난 직후에만 노출돼 선택의 영상 맥락이 부족하다. 클립 컷을 앞당겨(예: creative 씬 endSec를 더 이르게) 선택 전 시각 단서를 주는 편이 애플급 UX 취지에 맞다.
- 자막(VTT)과 씬 컷 경계 불일치: VTT는 0–4.5 / 4.5–9.0 / 9.0–15.0 3구간인데 씬 컷은 0–4.8 / 4.8–7.2 / 7.2–11.4 / 11.4–12.2 / 12.2–15 / 14.9–15. 기본 노출 자막(`default` 트랙)이 씬·선택 프롬프트와 어긋나 보일 수 있다(기능 결함 아님, 표시 정합성).

## nice_to_have
- `mori-demo-ending`(14.9–15)은 creative 씬(12.2–15) 꼬리 0.1s를 다시 재생하는 사실상 빈 마감 씬이다. 별도 ending 없이 creative 최종 선택 후 바로 `completeOnce`로 마감해도 되며(플레이어의 `isFinalChoice`+빈 threshold ending이 이미 처리), 불필요한 0.1s 플래시를 제거할 수 있다.
- 프로덕션 하드닝: 데모 쿠키에 `Secure` 부재(스펙 미요구·SameSite=Lax는 Secure 없이 동작하므로 필수 아님). HTTPS 전용 배포라면 추후 추가 고려.

## validation_notes
- 게이트 ground truth 수용(재도출 안 함): team-lead 확인 — validation_exit=0 (lint+tsc+`npm run build` turbopack 이 환경 통과). worker 로그의 turbopack 실패는 로컬 샌드박스 포트바인딩 한계, webpack 빌드는 `/demo/mori`·`/demo/ai-diagnosis` 포함 통과.
- scope: `git status --porcelain`로 이 패키지 실제 변경이 선언 Scope와 정확히 일치 확인 — 신규 `src/app/demo/mori/{page,MoriDemoJourney}.tsx`, `src/data/demo/mori-demo-graph.ts`, `src/lib/demo-observation.ts`; 수정 `src/app/demo/ai-diagnosis/page.tsx`(redirect 축소), `src/app/demo/page.tsx`(href 1곳), `src/app/page.tsx`(DEMO_HREF 1줄만); 삭제 `AiDiagnosisDemo.tsx`. scope_ok=0의 flagged 파일(`src/lib/c6/evidence.ts`·`.test.ts`)은 공유 워킹트리를 쓰는 병렬 패키지(c6-evidence-engine) 산출물로, 이 패키지가 import하지 않음(grep 확인) — 게이트 귀속 한계, 실제 scope 위반 아님.
- 금지어 0(최중요): 새 데모 표면 전체(page/MoriDemoJourney/그래프 데이터의 모든 문자열 리터럴 + metadata title·description) `grep -rnE '진단|분석|평가|점수|등급|또래|부족|발달|AI'` → 0건. 영문 diagnos/analy/score/rank/grade/develop/peer도 0건. 유일 매치는 `/start?from=ai-diagnosis`(URL 쿼리·어트리뷰션 소스 유지, 고객 가시 텍스트 아님)와 함수명 `AiDiagnosisDemoPage`(내부). 막대·"N개 단서" 카운트·순위 UI 없음 확인.
- 익명성: 새 파일 전체에서 `supabase|createClient|fetch\(|/api/|axios` 0건. 쿠키 `kindy_demo_observation`: JSON `{v:1,choices:[{choiceId,optionId,axisId}],strength_axis,growth_axis,created_at}`, `Max-Age=2592000`(30일), `Path=/`, `SameSite=Lax`, PII 없음 — 스펙 그대로. `parseDemoObservationCookie`는 null/undefined·JSON.parse·decodeURIComponent를 try/catch로 감싸고 `isObservationCookie`/`isObservationChoice`/`isAxisId`로 형태 검증 → 잘못된 쿠키에 크래시·throw 없음(null 반환). 파서/시리얼라이저 export 확인.
- 재사용 규율: `git status`로 `InteractiveVideoPlayer.tsx`·`types/interactive-session.ts`·`MoriCharacter.tsx`·`c6/axes.ts`·`data/game/animal-village.ts` 워킹트리 무변경 확인. playsInline 유지(InteractiveVideoPlayer L367). animal-village import 0건. 축 매핑은 데모 그래프 옆 별도 Record(`MORI_DEMO_OPTION_AXIS_BY_ID`)로 구현 — emotion→C6, clue leaf→C2/light→C3, creative→C5, 스펙 일치. onRoundResult는 `choicesRef` 로컬 수집만·서버 전송 없음, onComplete에서 카드 전환 확인.
- 그래프 흐름 수기 추적: opening(0–4.8, heart choice)→heart-branch(4.8–7.2)→clue(7.2–11.4, clue choice)→clue-branch(11.4–12.2)→creative(12.2–15, final choice)→ending(14.9–15)→onComplete. `branchScenes`+`rejoin`+`routeQueue`가 각 분기에서 정확히 재합류, `isFinalChoice`(creative 옵션 branchScenes 없음)→빈 threshold ending 매칭→completeOnce. ffprobe로 mp4 정확히 15.000s, 자산(mp4·vtt·poster) 존재 확인 — endSec 15 정합. 존재하지 않는 씬 참조 시 completeOnce로 안전 마감(플레이어 goToScene). `result.objective_code`는 `string|null`이며 카드 측 `if(!optionId) return` 가드로 처리.
- 퍼널 무결성: `/demo/ai-diagnosis/page.tsx`는 `redirect('/demo/mori')`만(next/navigation), 구 metadata·컴포넌트 제거. `/demo/page.tsx`·`src/app/page.tsx`(DEMO_HREF만) 링크 갱신, 그 외 침습 diff 없음. START CTA `/start?from=ai-diagnosis` 어트리뷰션 유지. 카드=주 CTA 1 + 보조 링크 1(`/sample/report`), 시청 화면=시작 버튼 1 — "한 화면 한 행동" 준수.
- 회귀: 삭제된 `AiDiagnosisDemo` 참조 잔존 import 0건(grep, 남은 매치는 redirect 페이지 함수명뿐). `/demo/ai-diagnosis` 코드 내 잔여 링크 0건.
