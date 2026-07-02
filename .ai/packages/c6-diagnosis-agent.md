# Package: c6-diagnosis-agent

## Objective
진단(관찰) 에이전트 서버 파이프라인: `/api/game/events`가 확장 필드(axis_id·thinking_tool·elapsed_ms·hint_count·retry_count·response_payload 등)를 수용·저장하고, 라운드 저장 직후 증거 엔진으로 child_growth_profiles를 멱등 갱신한다. 성장 상태를 숫자 없이 문구로 반환하는 `/api/agents/growth`를 추가한다. "진단"은 내부 언어 — 고객 표면은 성장/씨앗 문구만.

## Scope
- `src/types/game.ts` (GameRoundResult에 옵션 필드 추가 — 확장만)
- `src/app/api/game/events/route.ts` (확장만)
- NEW: src/lib/c6/diagnosis-agent.ts
- NEW: src/lib/c6/growth-view.ts
- NEW: src/app/api/agents/growth/route.ts
- `src/lib/c6/axes.ts` (읽기 전용)
- `src/lib/c6/evidence.ts` (읽기 전용)
- `src/lib/auth.ts` / `src/lib/supabase.ts` (읽기 전용 — 기존 패턴 사용)

## Constraints
- **기존 `game_rounds` 저장 계약은 확장만, 파괴적 변경 금지** — 보호자 기록장이 소비 중. 기존 필드 파싱·응답 형태·에러 메시지·local-preview 폴백을 바꾸지 말 것. 새 필드는 전부 optional이며 없으면 기존과 동일하게 동작해야 한다.
- **진단 후크는 best-effort**: 프로필 갱신 실패가 라운드 저장 응답(200)을 절대 바꾸면 안 된다. try/catch + `console.error('[growth-agent]', ...)`.
- **점수는 서버 전용**: current_level/confidence/evidence_count 숫자를 어떤 API 응답에도 그대로 싣지 않는다. `/api/agents/growth`는 문구·단계(stage)만 반환.
- 고객 노출 문구 금지어: 진단, 평가, 점수, 등급, 또래비교, 부족, 발달 지연, "AI가 …", C1..C6 코드. confidence 낮으면 "성장지도가 더 선명해지는 중" 계열 문구.
- 시크릿/.env 접근 금지, db push 금지, 새 의존성 금지. `@/lib/supabase`는 server 전용(클라이언트 번들 금지).
- Next.js 16: route handler 작성 전 `node_modules/next/dist/docs/`의 route-handlers 가이드 확인. 기존 라우트처럼 `export const runtime = 'nodejs'`.
- 0023 마이그레이션이 선행 적용된다고 가정하되, **새 컬럼은 값이 있을 때만 insert 객체에 포함**(undefined 키 제거)해 미적용 DB에서도 기존 경로가 깨지지 않게.

### 구현 상세
1) `src/types/game.ts` — GameRoundResult에 추가(전부 optional, DB snake_case 유지):
```ts
axis_id?: string | null; thinking_tool?: string | null; story_seed_id?: string | null;
world_region?: string | null; elapsed_ms?: number | null; hint_count?: number | null;
retry_count?: number | null; is_correct?: boolean | null;
response_payload?: Record<string, unknown> | null;
```
2) `/api/game/events` parseRoundResult 확장: axis_id는 6개 정본 id만(부재는 통과, 무효값은 400), thinking_tool은 13개 상수만, hint_count/retry_count 0..50, elapsed_ms 0..3600000, story_seed_id는 UUID 형식 검사, response_payload는 jsonObject. is_correct는 컬럼이 없으므로 저장하지 않고 evidence 계산에만 사용.
3) round insert를 `.select('id').single()`로 바꿔 round id 확보 → `processRoundGrowth(supabase, { roundId, childId, round, age })` 호출(응답 반환 전, try/catch).
4) `diagnosis-agent.ts` — `processRoundGrowth`:
   - 멱등 클레임: `update game_rounds set growth_processed_at = now() where id = :roundId and growth_processed_at is null` → 영향 0행이면 skip.
   - axis 결정: round.axis_id ?? `inferAxisFromLegacyRound(round)`; null이면 종료.
   - transfer v0.1: 이번 라운드가 성공이고 최근 14일 같은 axis에 실패 라운드가 있으면 transfer_success=true, 실패면 null.
   - activity_type_revisit: 최근 14일 같은 game_type 라운드 존재 여부.
   - `evidenceFromRound` → `buildEvidence` → 현재 프로필 로드(없으면 기본 50/0/0) → `updateAxis` → `child_growth_profiles` upsert(onConflict 'child_id,axis_id'): current_level/confidence/evidence_count/trend(`trendFrom`)/last_evidence_at/updated_at + performance≥0.7이면 preferred_activity_type=round.game_type.
   - 아이 age는 children.age 조회(이미 소유 검증된 childId).
5) `growth-view.ts` — 순수 변환(서버에서만 숫자를 봄): `toSeedState(profile, axisMeta)` → `{ axis_id, child_label, parent_label, world_region, stage, parent_line }`. stage 규칙: evidence_count===0 → 'first_look'("아직 처음 만나는 씨앗이에요") · confidence<0.3 → 'sprouting'("성장지도가 더 선명해지는 중이에요") · level≥70 → 'shining'(강점 문구) · 그 외 'growing'. parent_line은 axis별 따뜻한 관찰 문장(금지어 0, 단정 없음). `pickStrengthAxis`(confidence≥0.3 중 최고 level)·`pickGrowthAxis`(evidence≥1 중 최저 level) export.
6) `/api/agents/growth/route.ts` — GET `?childId=`: getCurrentParentId(request) 인증 → children 소유 검증(기존 라우트 패턴) → 프로필+C6_AXES 조인 → `{ childId, overall_line, seeds: SeedState[6](프로필 없는 축은 first_look), strength_axis_id, growth_axis_id }`. 숫자 필드 없음. supabase 미설정이면 6축 전부 first_look 반환.

## Deliverables
- 새 필드가 포함된 라운드 이벤트가 저장되고, 저장 직후 해당 axis의 child_growth_profiles가 갱신된다(같은 round 재처리 없음 — growth_processed_at 멱등).
- 레거시 라운드(새 필드 없음)도 objective_code/game_type 추론으로 프로필 증거가 쌓인다.
- `/api/agents/growth` 응답에 current_level/confidence/evidence_count 키가 존재하지 않는다.
- 기존 이벤트 payload(새 필드 없는 요청)의 동작·응답이 이전과 동일.

## Validation
```bash
npm run lint && npx tsc --noEmit
```

## Handoff requirements
Return:
- summary
- changed files
- validation result
- known risks
- HUMAN 단계: 0023 마이그레이션이 라이브 DB에 적용된 뒤에만 이 패키지를 배포. 적용 후 실제 플레이 1회 → child_growth_profiles 행 생성 확인(사람이 수행).
