# Package: c6-recommendation-agent

## Objective
추천 에이전트 v0.1: 성장 프로필(C6=what)로 다음 이야기 씨앗 top 2 + 보호자용 이유 문장을 만들고 recommendation_logs에 기록한다. `/play`의 선별(재정렬)을 기존 orderLibraryByWeakTool에서 새 축 기반으로 교체하되, 프로필이 없으면 기존 동작으로 폴백해 초개인화가 "쓸수록" 강해지게 한다.

## Scope
- NEW: src/lib/c6/recommendation.ts
- NEW: src/lib/c6/recommendation.test.ts
- NEW: src/lib/c6/library-order.ts
- `src/app/play/page.tsx` (선별 로직 교체 부분만)
- `src/types/library.ts` (LibraryVideo에 옵션 필드 추가 — 확장만)
- `src/lib/c6/axes.ts` / `src/lib/c6/evidence.ts` (읽기 전용)
- `src/lib/game/library-selection.ts` / `src/lib/game/learning-profile.ts` (읽기 전용 — 삭제·수정 금지, 폴백으로 계속 사용)

## Constraints
- **추천 규칙 v0.1 (스펙 §7 — 그대로):**
```
input = { c6: child_growth_profiles, recent: last_3_sessions, pool: approved story_seeds }
rule: 1) 근거 충분(evidence_count>=3 우선, 없으면 >=1)한 축 중 level 최저 = growth_axis 1개
      2) confidence>=0.3 중 level 최고 = strength_axis(다리) 1개
      3) story_seeds: published=true & approval_status='approved' & target_axis ∈ {growth, bridge}
      4) rank: preferred_activity_type 일치 > preferred_character 일치 > novelty(최근 추천/시청에 없음) > difficulty 낮은 순
      5) top 2 + parent_reason_summary
```
- parent_reason_summary 템플릿(부록 B 계열, 금지어 0): "{strength_label} 활동에서 오래 머문 강점을 활용해, 다음에는 {growth_label} 이야기를 짧은 놀이로 이어가요." 점수·등급·부족·또래·진단 단어 금지.
- **모든 추천은 recommendation_logs에 기록**(reason_axis_id=growth_axis, personalization_inputs에 입력 스냅샷 jsonb). 단 같은 child에 같은 날(KST 기준 날짜) 로그가 있으면 재기록하지 않고 기존 로그를 반환(렌더마다 로그 폭증 금지).
- 씨앗 풀이 비었거나 프로필이 비었으면 **null 반환** — 호출측은 기존 동작 유지. `/play`도 프로필 없으면 기존 `loadChildWeakTool`+`orderLibraryByWeakTool` 경로 그대로.
- `/play` 교체 규칙: `loadChildGrowthAxis(childId)`(child_growth_profiles에서 growth_axis 계산, evidence 없으면 null) → 있으면 `orderLibraryByGrowthAxis(videos, growthAxis, seenIds?)`로 정렬. 영상의 축 = `video.target_axis` 우선, 없으면 `LEGACY_TOOL_TO_AXIS[video.c6_focus]` 폴백. 랭크는 기존 orderLibraryByWeakTool과 동일 구조(① 미시청&축일치 ② 미시청 ③ 시청&축일치 ④ 나머지, 안정 정렬).
- recommendation.ts의 랭킹 코어는 **순수 함수**(`buildRecommendation(input)`)로 분리하고 상대 import 단위테스트. DB 접근 함수(`getTodayRecommendation(supabase, childId, age)`)는 서버 전용으로 같은 파일에 두되 테스트 대상 아님.
- 시크릿/.env/db push 금지. 새 의존성 금지. 머니코드·인증 경로 수정 금지. `src/lib/game/c6-profile.ts` 등 기존 모듈 삭제 금지(공존).
- 테스트는 node:test + 상대 import, 러너 `npx tsx --test`.

### 필수 테스트 케이스 (recommendation.test.ts)
1. growth/strength 축 선정: evidence 충분한 축 중 최저 level이 growth, confidence≥0.3 최고 level이 strength.
2. 풀 필터: 미승인/미발행 씨앗 제외, target_axis가 growth/bridge 밖이면 제외.
3. 랭킹: preferred_activity_type 일치가 최우선, novelty로 최근 씨앗 뒤로 밀림, top 2 반환.
4. 폴백: 프로필 빈 배열 → null; 승인 씨앗 0개 → null.
5. reason 문장에 금지어(점수/등급/부족/진단/또래) 미포함 assert.

## Deliverables
- `buildRecommendation` 순수 코어 + 테스트 green.
- `getTodayRecommendation`: 하루 1회 로그 기록 + 재호출 시 기존 로그 반환.
- `/play`가 프로필 있는 아이에게는 축 기반 재정렬, 없는 아이에게는 기존 동작 그대로(회귀 없음).
- `src/types/library.ts`에 `target_axis?/thinking_tools?/world_region?/story_seed_id?` 옵션 필드 추가.

## Validation
```bash
npm run lint && npx tsc --noEmit && npx tsx --test src/lib/c6/recommendation.test.ts && npm run build
```

## Handoff requirements
Return:
- summary
- changed files
- validation result
- known risks
- HUMAN 단계: story_seeds 첫 시드 데이터 작성·승인(HITL: draft→approve→published)은 콘텐츠/운영 작업 — 그 전까지 추천 카드는 폴백 문구로 동작함을 명시.
