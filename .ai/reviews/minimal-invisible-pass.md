# Review: minimal-invisible-pass

## decision
request_changes

## critical
- **어트리뷰션 회귀 (라우팅 변경 금지 위반) — `MoriDemoJourney.tsx`**: `START_HREF`을 `/start?from=ai-diagnosis` → `/start`로 바꿔 마케팅 소스 파라미터를 완전히 제거했다(대체값 없음). 이 값은 고객에게 렌더되는 문자열이 아니라 소스 코드(UTM 성격)이며, demo-funnel-c6 스펙이 `normalizeMarketingSource` 호환을 위해 보존을 요구한 값이다. 제거의 실제 영향 2가지를 diff·코드로 확인:
  1. `src/app/start/page.tsx:25` `normalizeMarketingSource(firstParam(params.from))`가 이제 항상 `null` → `AttributionTracker`(`src/app/start/AttributionTracker.tsx:27-30`)가 `kindy_source`(MARKETING_SOURCE_COOKIE) 쿠키를 **더 이상 기록하지 않음** → 데모→가입 마케팅 소스 캡처가 끊긴다(현재 소비처는 write-only 배선이지만, 캡처 지점 자체가 사라지므로 향후 분석 데이터가 0이 됨).
  2. `src/app/start/page.tsx:26` `isAiDiagnosis`가 항상 `false` → 데모에서 넘어온 사용자가 데모-연결 카피("방금 본 영상 다음 / 다음 영상으로 놀이를 이어가요")가 아니라 **일반 카피("모리와 더 놀아볼까요?")를 보게 되는 라이브 UX 회귀**.
  - 이는 패키지 제약 "라우팅·이벤트 로깅 변경 금지"에도 정면 위반이다. 워커 감사표가 이 제거를 "삭제 문구"로 분류한 것 자체가 오분류(쿼리 파라미터는 카피가 아님).
  - **해소책(둘 중 하나)**: (a) `START_HREF = '/start?from=ai-diagnosis'` 원복(권장 — 고객 비가시 소스 코드, 최소 변경) 또는 (b) "ai" 토큰이 정말 걸린다면 `MarketingSource` 유니온 값·`normalizeMarketingSource`·`start/page.tsx` 세 곳을 동시에 새 값으로 리네임(라우팅/타입 동시 변경 → 이 패키지 스코프를 벗어나므로 (a) 우선).

## should_fix
- `src/lib/c6/report-data.ts` `buildStrengthLine`: 조사 2건 외에 카피 1줄("이 관찰 강점을 활용해" → "이 잘 들어온 힘을 살려")도 함께 바뀌었다. 목표(보이지 않는 AI·"관찰" 완화)에는 부합하나 report-data.ts에 대해 선언된 "조사 교정 2건만" 범위를 살짝 넘는다. 로직/타입/숫자 변화는 없으므로 회귀는 아님 — 승인 시 인지만.

## nice_to_have
- 스코프 밖 라우트 `/demo/ai-diagnosis`가 빌드 출력에 계속 노출됨(워커 known-risk에 명시). 이 패키지 파일 범위 밖이므로 별도 티켓으로 추적.

## validation_notes
- **게이트 그라운드 트루스(재도출 안 함)**: validation_exit=0(lint+tsc+turbopack build 통과, 팀리드 확인). `out-of-scope.txt` = 미추적 사용자 문서 2건(`키오스크_앱_개발플랜.md`, `KIOSK_하드웨어_제작계획.md`)뿐 — 이 패키지 실코드 스코프는 클린. (로컬 `.ai/state.sh get`은 이 셸에서 미동작해 팀리드 제공 값을 사용.)
- **어트리뷰션 체인 추적**: `MoriDemoJourney.tsx` diff 확인 → `START_HREF` 파라미터 제거. `src/lib/attribution.ts` 읽음(`normalizeMarketingSource`는 `'ai-diagnosis'`만 인식, 그 외 `null`). `start/page.tsx`·`AttributionTracker.tsx`·`api/attribution/claim/route.ts` 읽어 소스 쿠키가 `source` truthy일 때만 기록됨을 확인. 파라미터 제거 시 (a) 쿠키 캡처 중단 (b) `isAiDiagnosis` 분기 사멸 둘 다 실재함을 확인.
- **금지어·AI 언급 0(렌더 문자열)**: 6개 스코프 파일 grep(진단/평가/점수/등급/또래/부족/발달지연/커리큘럼/AI/인공지능/알고리즘). 히트 2건 모두 허용 대상 — `page.tsx:74`(내부 주석), `report-data.ts:101`(FORBIDDEN_SURFACE_PATTERN 정규식 리터럴). 렌더 문자열 히트 0.
- **LibraryPlayer 법정 라벨**: `src/components/LibraryPlayer.tsx:99` "모리 이야기는 AI로 만들고, 사람이 한 편씩 살펴봐요." 그대로 존재, git status상 파일 무수정 확인.
- **로직 무변경(라우팅 제외)**: `report/page.tsx` diff = REPORT_FLOW 섹션 삭제·설명 단락 삭제·라벨 카피 변경·놀이지도 설명 ternary 1개를 단일 문자열로 축약(데이터/로깅/게임로직 변화 없음). `report-data.ts` diff = FORBIDDEN_SURFACE_PATTERN에 `인공지능|알고리즘|모델|분석` 추가(safeText 이유 필터 강화, line 126) + 조사 2건 + strength 카피 1줄. 뷰모델 타입·클라이언트 숫자 노출 변화 없음.
- **조사 교정 정확성**(`src/lib/josa.ts` 구현 대조): `subjectName`=`withJosa(name,'은/는')` → 받침○ "지안은"/받침✗ "지아는"(구코드 "지아이는" 오류 교정). `buildThinkingToolLines`=`withJosa(formatKoreanList(topTools),'이/가')` → `formatKoreanList`는 마지막 항목으로 종결(line 228), 도구 라벨이 모음 종결이면 '가' 선택 → "…읽기가 자주 열렸어요"(구코드 하드코딩 '이' 교정). 두 건 모두 하드코딩보다 엄격히 정확.
- **과삭제 판단**: 랜딩 3스텝·최종 중복 CTA·nav CTA·설명 단락 삭제 후에도 hero 본문("모리의 짧은 이야기를 보고, 바로 이어지는 질문과 놀이를 해요…"), ENTRY_FLOW("시작부터 기록까지"), DiagnosisPreview, /start "처음이라면" FIRST_LOOK 카드가 잔존 → 첫 방문 부모가 5초 내 서비스 이해 가능. 과삭제 아님.
