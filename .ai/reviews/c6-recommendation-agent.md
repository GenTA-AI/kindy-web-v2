# Review: c6-recommendation-agent

## decision
approve

## critical
- (none)

## should_fix
- (none blocking)

## nice_to_have
- `personalization_inputs` 스냅샷에 **전체 pool(최대 100개 seed 행)** 을 그대로 담고, 이를 삽입되는 **두 로그 행 모두에 중복** 저장한다(`recommendation.ts:363-375`). PII·점수 유출 위험은 없음(서버 전용 `recommendation_logs` jsonb, 클라 응답 경로 아님) — invariant #5 준수. 다만 저장 중복이므로, 후속 패스에서 pool을 추천에 관여한 필드/축으로 트리밍하거나 행당 중복을 제거하면 로그 부피가 준다.
- `getTodayRecommendation(client, childId, age)`의 `age`는 로직에 쓰이지 않고 스냅샷에만 에코된다. 패키지 §7 rule 텍스트에 age 밴드 필터가 없으므로 v0.1 스펙 준수이나(정본 §7의 "age 5-7"은 이번 패키지 rule에서 빠져 있음), seed age_band 필터는 시드 데이터 확보 후 별도 패스로 남겨두는 게 맞다. 워커의 known-risks도 이를 인지.

## validation_notes
- **게이트 그라운드 트루스 수용**: validation_exit=0(lint+tsc+테스트 5/5+turbopack build 이 환경 통과). 핵심 딜리버러블 재확인 위해 `npx tsx --test src/lib/c6/recommendation.test.ts` 직접 재실행 → **5/5 pass**.
- **스코프 이탈 1건(`src/types/game.ts`) 판정 = 무해**. `git diff HEAD -- src/types/game.ts`: `GameRoundParams`에 `template_id?/prompt_ko?/items?/categories?/answer_token?/option_tokens?` **옵션 필드만 추가**. 기존 필드(asset_pool_id/item_count/time_limit_sec 등) 무변경 → diagnosis-agent 커밋(8833269) 계약 및 invariant #10(game_rounds 저장 계약 확장만 허용) 준수. `grep` 결과 이 필드들의 실사용처는 `src/data/onboarding/first-journey.ts`(병렬 온보딩/first-journey 패키지)뿐이고, 추천 패키지 파일(recommendation.ts/library-order.ts/play/page.tsx) 어디도 참조하지 않음 → **귀속 오류(병렬 패키지 산출물)이며 추천 패키지 정확성에 영향 0**. 팀리드 지시대로 approve에 명시 기록.
- 나머지 out-of-scope(kiosk 문서 2건·onboarding/page.tsx·first-journey.*·FirstJourneyShell)은 병렬 온보딩 패키지 산출물 — 이 워커 귀속 아님.
- **추천 규칙 v0.1 정확성(테스트 고정 확인)**: 5케이스를 코드에 대조 트레이스. ①growth=evidence≥3 우선(폴백≥1) 중 level 최저, strength=confidence≥0.3 중 level 최고 — 테스트1이 C3(level 30이지만 evidence 1)을 growth에서 배제하고 C4를 선택하게 하여 "evidence≥3 우선" 규칙을 실제로 고정. ②풀 필터(published+approved+target_axis∈{growth,bridge}) — 테스트2가 draft/unpublished/off-axis 각각 배제 검증. ③랭킹 순서(activity_type>character>novelty>difficulty) — 테스트3이 활동일치가 difficulty 9에도 1위, novelty가 최저 difficulty(recent) 앞서기 확인, top2 반환. ④빈 프로필/0 승인시드 → null(테스트4). ⑤금지어 정규식 assert(테스트5). recommendation.ts:185-256 랭킹 코어는 순수 함수, 상대 import 단위테스트.
- **폴백 회귀 0(최중요)**: `/play` diff 정독. profile(evidence) 없는 아이 → `growthAxis=null` → `weakTool = loadChildWeakTool(...)` → `orderLibrary`가 기존 `orderLibraryByWeakTool` 그대로 호출(경로 이전과 동일). `loadChildGrowthAxis`는 기존 `loadChildWeakTool`과 **에러 처리 패리티**: 둘 다 `isSupabaseServiceConfigured()` 가드 + `const { data } =`로 error 무시 → 0023 미적용(테이블 부재)시 Supabase는 throw 아닌 `{data:null,error}` 반환 → `data ?? []` → `pickGrowthAxisFromProfiles([]) = null` → weak-tool 폴백. 새 실패 모드 도입 없음. `orderLibraryByGrowthAxis`(library-order.ts:50-68) 랭크 구조 ①미시청&축일치=0 ②미시청=1 ③시청&축일치=2 ④나머지=3 + `[...videos].sort`(안정 정렬)로 기존 `orderLibraryByWeakTool`(library-selection.ts:24-40)과 **구조 동일**. `deriveLibraryVideoAxis`가 `target_axis` 우선, 없으면 `LEGACY_TOOL_TO_AXIS[c6_focus]` 폴백(스펙대로). `src/lib/game/library-selection.ts`·`learning-profile.ts`는 **무변경**(읽기 전용 준수).
- **로그 멱등**: `kstDayUtcRange`가 (now+9h) 기준 KST 날짜키 → `T00:00:00.000+09:00` 자정을 UTC instant로 환산, +24h. 조회는 child_id + `created_at ∈ [start,end)`. 오늘 로그 존재시 재기록 없이 기존 반환(source 'existing'), 없을 때만 top2 insert(created_at=DB now()). 렌더당 로그 폭증 없음. novelty용 recent seed id 공간 일치 확인(recommendation_logs.recommended_story_seed_id / game_rounds.story_seed_id ↔ pool seed.id).
- **서버 전용 분리**: recommendation.ts는 supabase를 `import type`(타입 전용, 컴파일 소거)으로만 사용, buildRecommendation 순수. `/play`는 `@/lib/c6/library-order`+`@/lib/c6/axes`만 import(둘 다 supabase 없음) — 클라이언트 번들에 supabase 유입 경로 없음. axis level/confidence 숫자는 클라 응답 어디에도 노출 안 됨(RecommendedStorySeed에 미포함, personalization_inputs는 DB 전용) → invariant #5 준수.
- **types/library.ts 확장 = optional-only**: `target_axis?/thinking_tools?/world_region?/story_seed_id?` 4개 모두 `?` 옵션. 기존 필드 무변경.
- **의존성/시크릿**: 새 의존성 0, 시크릿·.env·db push 0, 머니코드·인증 경로 무변경.
