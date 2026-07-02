# Review: parent-report-v2

## decision
approve

## critical
- (none) — 안전 핵심 5개 초점이 모두 통과. 숫자 노출·금지어·폴백 회귀·읽기전용 위반·비멱등 로그 중 어느 것도 발견되지 않음.

## should_fix
- **조사(josa) 문법 오류 — 실리포트에 상시 노출, 기존 `withJosa` 헬퍼로 즉시 수정 가능**:
  - `report-data.ts:250` `buildThinkingToolLines`: `${formatKoreanList(topTools)}이 자주 열렸어요.` — 주격 조사 "이"가 하드코딩. THINKING_TOOL_LABELS 13개가 전부 모음(받침 없음)으로 끝남(…살피기/…떠올리기/…보기/…하기). 따라서 문법상 "가"여야 하며 현재는 "떠올리기이 자주 열렸어요"처럼 렌더됨. `withJosa(label, '이/가')` 사용 권장.
  - `report-data.ts:132` `subjectName`: `return \`${trimmed}이는\`;` — "이는" 하드코딩. 모음으로 끝나는 아이 이름(지아·서우·모리 등)에서 "지아이는"으로 어색하게 렌더(정상: "지아는"). 받침 유무에 따라 diminutive "이" 부착 여부를 분기하거나 `withJosa(name, '은/는')` 사용 권장. `buildStrengthLine`이 이 함수를 그대로 상속.
  - 근거: 코드베이스에 `src/lib/josa.ts`의 `withJosa`가 정확히 이 목적(받침 판정 + 비한글 폴백)으로 존재하며 같은 파일(`report-data.ts:171,182`)에서 `withJosa(_, '을/를')`로 이미 사용 중 — 규칙 일관성 위반.
  - 패키지가 명시한 **HUMAN 단계("문구 톤 검수")에서 반드시 함께 교정**할 것. HITL 승인 전 실렌더로 재확인 필요.

## nice_to_have
- `lineWithClarityPrefix`(`report-data.ts:136`)는 `evidence_count<3`이면 stage와 무관하게 "성장지도가 더 선명해지는 중이에요." 접두를 붙임. confidence≥0.3·level≥70이지만 evidence_count가 1~2인 씨앗은 "성장지도가 더 선명해지는 중이에요. 요즘은 … 환하게 빛나요."로 두 톤이 겹칠 수 있음. 스펙 문구 규칙(evidence_count<3 → 선명해지는 중)에는 부합하므로 회귀 아님 — HUMAN 톤 검수 시 참고.
- 레거시 폴백 섹션(`page.tsx:753`)에 기존 문구 "빈칸은 부족 판정이 아니라…"의 "부족"이 남아 있음. 이번 패키지가 새로 추가한 텍스트가 아니고(부정문·기존 코드), growthReport 분기에서는 워커가 의도적으로 "부족"을 제거함 — 선행 정비 대상으로만 기록.

## validation_notes
- **게이트 지상값 신뢰**(재도출 안 함, 팀리드 제공): validation_exit=0(lint+tsc+turbopack build 이 환경 통과), high_risk=1. scope_ok=0 플래그는 병렬 `onboarding-forest-journey` 리트라이 산출물 + 선행 런 파일 + 사용자 문서(KIOSK/키오스크 .md)로 확인됨 — 귀속 한계. `git status`로 실변경 자기보고 검증: 이 패키지 실변경은 `src/lib/c6/report-data.ts`(신규) + `src/app/dashboard/report/page.tsx`(수정) 2개뿐, 둘 다 Scope 내. (onboarding/page.tsx·topic-label.ts·first-journey·FirstJourneyShell·data/onboarding = 병렬 저니 런, 본 패키지 무관.)
- **① 숫자 미노출(invariant 5) — PASS**: 뷰모델 타입 3종 전수 정독. `ParentReportGrowthData`(seeds/strengthLine/growthLine/thinkingToolLines/recommendation), `ReportSeedCard`(childLabel/parentLabel/worldRegion/stage/stageLabel/parentLine), `ReportRecommendation`(storyTitles/reason) — 전 필드 string 또는 GrowthStage 유니온. current_level/confidence/evidence_count 숫자는 `report-data.ts` 서버 함수 내부(numberValue/toProfileSnapshot/lineWithClarityPrefix)에서만 소비되어 stage·문장으로 변환됨. page.tsx는 growthReport를 GrowthMapSections/GrowthRecommendationPanel의 문자열 필드로만 렌더 — 숫자 경로 없음. stage 변환 규칙(growth-view.ts `stageFor`): evidence_count 0→first_look, confidence<0.3→sprouting, level≥70→shining, else growing. 정확.
- **② 폴백 회귀 0 — PASS**: `page.tsx` diff 확인. `growthReport?.recommendation ? <GrowthRecommendationPanel/> : (원본 "이번 주 추천" 섹션 그대로)` — else 분기는 원본과 verbatim 일치. 신규 섹션은 `{growthReport && <GrowthMapSections/>}`로만 게이팅. 텍스트 스왑(성장 하이라이트/놀이 관찰 지도/대화 힌트)은 `growthReport ? 신규 : 원본`으로 null일 때 원본 문구 유지. 로더 진입 가드 `!sampleMode && report.child && isSupabaseServiceConfigured()` → sample(`?sample=1`)·supabase 미설정은 로더를 아예 건너뛰어 기존 화면 동일. child_growth_profiles 없음/에러 시 `throw`→page.tsx try/catch→growthReport=null→레거시 렌더(공존 견고). evidence>0 없으면 `loadParentReportGrowthData`가 null 반환(`report-data.ts:352`).
- **③ 7섹션 정합 — PASS**: ①이번 주 이야기(기존 highlight 재사용, 라벨만 스왑) ②씨앗 6개 상태(C6_AXES 전체 map, toSeedState) ③잘 들어간 학습 문(buildStrengthLine, 부록 B 템플릿 "…에서 작은 단서를 찾는 데 오래 머물렀어요. 다음에는 이 관찰 강점을 활용해 …이어갈게요") ④더 자랄 씨앗(buildGrowthLine, "다음에 함께 열어볼 문", 부족 단정 없음) ⑤생각도구 기록(최근 7일 game_rounds, thinking_tool 직접값 우선 + 없으면 LEGACY_TOOL_TO_THINKING 보충, 상위 3개 → 2문장) ⑥다음 추천+이유(getTodayRecommendation→parent_reason_summary/reason_summary_parent, null→기존 c6HomeAssignments 폴백 유지) ⑦부모 대화 힌트(기존 dialogueStarters 유지). 전부 존재·정상 배선.
- **④ 금지어 0 — PASS**: 신규 정적 문자열(STAGE_LABELS, THINKING_TOOL_LABELS, growth-view 3종 라인, buildStrengthLine/buildGrowthLine 템플릿, GrowthMapSections/GrowthRecommendationPanel JSX 카피) 전수 확인 — 진단/평가/점수/등급/또래/부족/발달지연/C1..C6/커리큘럼/AI 없음. 동적 문자열(추천 이유·스토리 제목)은 `safeText()`가 `FORBIDDEN_SURFACE_PATTERN`(`report-data.ts:101`)으로 필터 → 금지어 포함 시 null 반환. `loadRecommendation`은 reason가 없으면(=safeText가 전부 걸러내면) null 반환하여 레거시 추천 폴백으로 회귀 — 워커가 언급한 "추천 문구 금지어 시 기존 폴백" 가드 실구현 확인.
- **⑤ 읽기전용 무수정 + 멱등 — PASS**: git diff에 /api/dashboard/summary·c6-profile·learning-profile·sel-report·growth-view·recommendation·axes·supabase·auth 전부 부재(무수정). `getTodayRecommendation`(recommendation.ts:277) 멱등성: 당일(KST) recommendation_logs 존재 시 즉시 `source:'existing'` 반환·insert 안 함(:294), 로그 없을 때만 1회 build+insert. 리포트 재렌더는 같은 날 기존 로그·이유·제목 재사용(storyTitlesForLogs로 제목 복원) → deliverable "recommendation_logs 있는 날 동일 추천 유지" 충족. 첫 렌더 시 1회 write-on-GET 발생하나 §7("모든 추천 recommendation_logs 기록")·deliverable 의도 내. loadRecommendation은 `.catch(()=>null)`로 감싸 실패 시 레거시 폴백.
- 신규 의존성 0, 시크릿/console 0. report-data.ts import는 전부 기존 내부 모듈 + @supabase/supabase-js 타입.
- 미검증: 실데이터 7섹션 실렌더·문구 톤(HUMAN 단계 소관, 위 should_fix 조사 교정 포함). full `npm run build`는 게이트 지상값(validation_exit=0)에 위임 — 이 환경에서 직접 재실행하지 않음.
