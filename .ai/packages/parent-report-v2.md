# Package: parent-report-v2

## Objective
보호자 기록장에 성장지도 v1.0(스펙 §8 7섹션)을 반영한다: 6씨앗 상태, 생각도구 기록, 다음 추천+이유를 기존 리포트 구조 위에 얹는다. 숫자·등급 금지, confidence 낮으면 "선명해지는 중". child_growth_profiles가 없으면 기존 화면 그대로(공존·폴백).

## Scope
- NEW: src/lib/c6/report-data.ts
- `src/app/dashboard/report/page.tsx`
- 읽기 전용: `src/lib/c6/growth-view.ts` `src/lib/c6/recommendation.ts` `src/lib/c6/axes.ts` `src/lib/game/sel-report.ts` `src/lib/game/c6-profile.ts` `src/lib/supabase.ts` `src/lib/auth.ts`

## Constraints
- **7섹션 (스펙 §8)**: ① 이번 주 이야기(기존 weeklySummaryLine/highlight 재사용) ② C6 성장지도 — 씨앗 6개 상태 카드(stage: first_look/sprouting/growing/shining, growth-view.ts의 toSeedState 사용) ③ 잘 들어간 학습 문(강점 축 관찰 문장) ④ 더 자랄 씨앗(부족 단정 없이 — "다음에 함께 열어볼 문") ⑤ 생각도구 기록(최근 7일 game_rounds.thinking_tool 빈도 상위 2~3개를 문장으로; thinking_tool 없는 레거시 라운드는 LEGACY_TOOL_TO_THINKING으로 보충) ⑥ 다음 추천 + 이유(getTodayRecommendation의 parent_reason_summary; null이면 기존 c6HomeAssignments 폴백 유지) ⑦ 부모 대화 힌트(기존 dialogueStarters 유지).
- 문장 템플릿(부록 B): "OO이는 {activity}에서 작은 단서를 찾는 데 오래 머물렀어요. 다음에는 이 관찰 강점을 활용해 {next_concept}을 이어갈게요."
- **숫자·등급·백분위·또래비교 금지.** current_level/confidence 숫자는 서버(page.tsx는 서버 컴포넌트)에서만 읽고 문구/stage로 변환해 렌더. 활동 횟수("N번 완료")는 관찰 사실이므로 허용(기존 유지). confidence 낮음(evidence_count<3 또는 sprouting) → "성장지도가 더 선명해지는 중이에요".
- **공존/폴백(불변식)**: child_growth_profiles에 evidence가 하나도 없으면 기존 aggregateC6Profile 기반 화면을 지금 그대로 렌더(회귀 0). 프로필이 있으면 ②~⑥을 새 데이터로 렌더하되 기존 섹션(성장 하이라이트, 관찰 활동량, 대화 스타터, 가정 가이드)은 유지. 기존 sample/local-preview 모드(`?sample=1`, supabase 미설정)는 기존 경로 그대로 — 새 로더는 supabase 설정+실프로필일 때만.
- 데이터 적재는 `report-data.ts`로 분리(서버 전용): 프로필 6행 + 최근 7일 thinking_tool 카운트 + getTodayRecommendation을 한 번에 로드해 뷰모델(고객 안전 문자열만) 반환. page.tsx에는 숫자 로직을 두지 않는다.
- 고객 표면 금지어: 진단/평가/점수/등급/또래/부족/발달 지연/C1..C6 코드/커리큘럼/AI 언급. 씨앗 이름은 c6_axes child_label, 축 이름은 parent_label.
- `/api/dashboard/summary`·기존 c6-profile/learning-profile/sel-report 모듈 수정 금지. 시크릿/.env/db push 금지, 새 의존성 금지. Next.js 16 서버 컴포넌트 가이드(`node_modules/next/dist/docs/`) 확인.

## Deliverables
- 프로필 있는 아이: 리포트에 씨앗 6개 상태 + 강점 문 + 자랄 씨앗 + 생각도구 기록 + 추천 이유가 보인다(전부 문장, 숫자 지표 0).
- 프로필 없는 아이·sample 모드: 기존 화면과 시각적으로 동일(회귀 없음).
- recommendation_logs가 있는 날은 같은 추천·같은 이유가 재렌더에도 유지된다.

## Validation
```bash
npm run lint && npx tsc --noEmit && npm run build
```

## Handoff requirements
Return:
- summary
- changed files
- validation result
- known risks
- HUMAN 단계: 실데이터 아이 1명으로 7섹션 실렌더 확인 + 문구 톤 검수(HITL — 부모 리포트는 사람이 승인).
