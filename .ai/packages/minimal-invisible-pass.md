# Package: minimal-invisible-pass

## Objective
3기준(① 애플급 간결·미니멀 ② 보이지 않는 AI ③ 초개인화 문구 정합) 최종 정비. 랜딩·데모·플레이(첫 여행 포함)·보호자 기록장에서 AI 언급 제거(법정 라벨 1곳 제외), 화면당 주 행동 1개 감사, 남는 설명 문구 삭제. 마지막 실행 패키지 — 앞선 패키지들이 만든 표면을 다듬는다.

## Scope
- `src/app/page.tsx`
- `src/app/start/page.tsx`
- `src/app/demo/page.tsx`
- `src/app/demo/mori/page.tsx`
- `src/app/demo/mori/MoriDemoJourney.tsx`
- `src/app/play/first-journey/page.tsx`
- `src/components/game/FirstJourneyShell.tsx`
- `src/app/dashboard/report/page.tsx`
- `src/lib/c6/report-data.ts` (조사 교정 2건만)
- `src/components/LibraryPlayer.tsx` (읽기 전용 — 법정 라벨 확인만, 수정 금지)

## Constraints
- **카피·삭제·경량 마크업 변경만.** 데이터 로딩·이벤트 로깅·라우팅·게임 로직 변경 금지. 컴포넌트 구조 개편 금지(섹션 삭제는 허용, 추가는 금지).
- **보이지 않는 AI**: 고객 표면에서 "AI/인공지능/알고리즘/모델이 분석·추천" 류 문구 0. 유일한 예외 = LibraryPlayer.tsx의 법정 라벨 "모리 이야기는 AI로 만들고, 사람이 한 편씩 살펴봐요."(그대로 보존, 위치 이동 금지). 개인화는 "모리가 OO에게 맞는 이야기를 남겨둘게요"처럼 모리의 행동으로 표현.
- **용어 가드레일**: 고객 화면 문자열에서 진단/평가/점수/등급/또래비교/부족/발달 지연/C1..C6 코드/커리큘럼 금지(내부 코드·주석은 허용 — 문자열 리터럴만 감사). 금지 카피: "부족합니다" "발달 지연" "또래보다 낮음" "상상력 42점" "AI가 진단했습니다" "놓치면 뒤처집니다".
- **한 화면 한 행동**: 각 스코프 화면에서 primary CTA(채움 버튼)가 2개 이상이면 1개로 줄이고 나머지는 텍스트 링크/보조 스타일로 강등. 같은 목적지 중복 링크 제거.
- **설명 문구 다이어트**: 화면의 기능을 다시 설명하는 단락("이 화면은 ~를 보여줘요" 류), 3열 스텝 안내 중 중복분을 삭제. 삭제가 애매하면 유지(과삭제 금지) — 판단 기준: 그 문장이 없어도 5초 안에 행동이 명확한가.
- 아이 화면 원칙 유지: 글보다 이미지·음성, 터치 ≥48px, 오답·위협·재촉 없음.
- 시크릿/.env/db push 금지. 새 의존성 금지. `/subscribe`·결제·인증 화면은 범위 밖.

### 추가 교정 (parent-report-v2 리뷰 should_fix — 반드시 처리)
- `src/lib/c6/report-data.ts`: 조사 하드코딩 2건 교정 — buildThinkingToolLines의 "…이 자주 열렸어요"(라벨이 모음 종결이라 '가'가 맞음; 같은 파일의 withJosa 활용), subjectName의 "이는" 하드코딩(모음 종결 이름에서 '지아이는'처럼 렌더 — withJosa로 교체).

## Deliverables
- 스코프 파일들의 고객 노출 문자열에 AI 언급 0(법정 라벨 제외)·금지어 0.
- 화면별 감사표(핸드오프에 포함): 파일 × {AI 언급, 금지어, primary CTA 수 before→after, 삭제한 문구}.
- 시각 회귀 최소화: 레이아웃 구조 유지, 빌드 통과.

## Validation
```bash
npm run lint && npx tsc --noEmit && npm run build
```

## Handoff requirements
Return:
- summary
- changed files
- validation result
- 감사표(위 Deliverables 형식)
- known risks (문구 삭제로 의미가 약해진 지점)
