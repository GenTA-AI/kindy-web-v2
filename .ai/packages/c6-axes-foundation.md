# Package: c6-axes-foundation

## Objective
C6 v1.0 성장지도의 데이터 기반을 만든다: 마이그레이션 0023(c6_axes·story_seeds·child_growth_profiles·recommendation_logs 신설 + library_videos·game_rounds 컬럼 추가 + RLS + c6_axes 시드)과 코드 정본 `src/lib/c6/axes.ts`(6축 정의, T1-T7 템플릿, 13 생각도구, 레거시 매핑). 이후 모든 패키지(증거 엔진·진단 에이전트·추천·리포트)가 이 축 id와 타입을 소비한다.

## Scope
- NEW: supabase/migrations/0023_c6_growth_map.sql
- NEW: src/lib/c6/axes.ts
- `src/lib/game/c6-profile.ts` (읽기 전용 참조 — C6ToolKey 타입 import만 허용, 수정 금지)
- `supabase/migrations/0016_game_events.sql` (읽기 전용 — RLS 패턴 참고)

## Constraints
- **기존 테이블을 갈아엎지 않는다.** 전부 `create table if not exists` / `add column if not exists`. 기존 RLS 약화 금지, `supabase/manual/` SQL을 migrations로 가져오지 말 것.
- **마이그레이션을 DB에 적용하지 말 것**(db push·psql 금지). SQL 파일 작성까지만. 적용은 사람 단계.
- 시크릿/.env 접근 금지. 새 npm 의존성 금지.
- axis id는 코드 정본으로 고정: `C1_focus_flow` `C2_observation_inquiry` `C3_pattern_problem` `C4_language_expression` `C5_imagination_analogy` `C6_social_emotional`.
- 기존 코드의 C6ToolKey(observe|imagine|pattern|transform|design|compose)는 "창의 6도구"로 새 정본과 다른 개념이다. 삭제·수정하지 말고 공존시키며, 이 패키지가 매핑만 제공한다.

### 마이그레이션 정본 (스펙 §6 — 이대로 구현, pk 축약은 유효한 SQL로 풀 것)
```sql
create table if not exists public.c6_axes (
  id text primary key, name_ko text not null, world_region text not null,
  parent_label text not null, child_label text not null, description text not null);

create table if not exists public.story_seeds (
  id uuid primary key default gen_random_uuid(), title text not null,
  world_region text not null,
  target_axis text references public.c6_axes(id),
  secondary_axis text references public.c6_axes(id),
  thinking_tools text[] not null default '{}',
  subject_domain text not null, age_band int4range not null,
  difficulty int not null default 1,
  approval_status text not null default 'draft',
  published boolean not null default false,
  created_at timestamptz not null default now());

alter table public.library_videos
  add column if not exists story_seed_id uuid references public.story_seeds(id),
  add column if not exists target_axis text references public.c6_axes(id),
  add column if not exists thinking_tools text[] default '{}',
  add column if not exists world_region text;

alter table public.game_rounds
  add column if not exists axis_id text references public.c6_axes(id),
  add column if not exists story_seed_id uuid references public.story_seeds(id),
  add column if not exists thinking_tool text,
  add column if not exists world_region text,
  add column if not exists elapsed_ms integer,
  add column if not exists hint_count integer default 0,
  add column if not exists retry_count integer default 0,
  add column if not exists response_payload jsonb default '{}'::jsonb,
  add column if not exists growth_processed_at timestamptz;  -- 진단 에이전트 멱등 처리 마커(계획 추가분)

create table if not exists public.child_growth_profiles (
  child_id uuid not null references public.children(id) on delete cascade,
  axis_id text not null references public.c6_axes(id),
  current_level numeric not null default 50,
  confidence numeric not null default 0,
  evidence_count integer not null default 0,
  trend text, preferred_activity_type text, preferred_character_id text,
  last_evidence_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (child_id, axis_id));

create table if not exists public.recommendation_logs (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  recommended_story_seed_id uuid references public.story_seeds(id),
  reason_axis_id text references public.c6_axes(id),
  reason_summary_parent text not null,
  personalization_inputs jsonb not null default '{}'::jsonb,
  accepted boolean, completed boolean,
  created_at timestamptz not null default now());
```
- 인덱스: `game_rounds (child_id, axis_id)` partial where axis_id is not null; `child_growth_profiles (child_id)`; `recommendation_logs (child_id, created_at)`; `story_seeds (target_axis)` partial where published.
- **RLS(0016_game_events.sql 패턴 그대로)**: 4개 신규 테이블 모두 `enable row level security`. `c6_axes`는 select `using (true)`(콘텐츠 메타). `story_seeds`는 select `using (published = true and approval_status = 'approved')`. `child_growth_profiles`·`recommendation_logs`는 select만, `exists(select 1 from public.children where children.id = <table>.child_id and children.parent_id = auth.uid()::text)`. **네 테이블 모두 insert/update/delete 정책은 만들지 않는다**(쓰기는 service-role 전용 — service-role은 RLS 우회).
- c6_axes 시드(마이그레이션 안 insert, `on conflict (id) do nothing`) — 스펙 §1 + 표면어 초안:

| id | name_ko | world_region | parent_label | child_label | description(행동 정의) |
|---|---|---|---|---|---|
| C1_focus_flow | 집중·몰입 | 별빛 언덕 | 집중·몰입 | 별빛 씨앗 | 짧은 활동에 머물고 규칙을 기억하며 힌트 후 다시 시도해요 |
| C2_observation_inquiry | 관찰·탐구 | 숨은 관찰길 | 관찰·탐구 | 반짝 씨앗 | 작은 차이·질감·소리·변화를 주의 깊게 발견해요 |
| C3_pattern_problem | 패턴·문제해결 | 물방울 실험터 | 패턴·문제해결 | 물방울 씨앗 | 반복·순서·규칙을 알아차리고 예측하거나 새 규칙을 만들어요 |
| C4_language_expression | 언어·표현 | 말장원 | 언어·표현 | 말 씨앗 | 단어·그림·소리·문장을 연결하고 자기 방식으로 설명해요 |
| C5_imagination_analogy | 상상·유추 | 거꾸로 시장 | 상상·유추 | 거꾸로 씨앗 | 서로 다른 것을 연결하고 익숙한 것을 낯설게 봐요 |
| C6_social_emotional | 마음·사회성 | 마음 호수 | 마음·사회성 | 마음 씨앗 | 캐릭터의 마음과 관점을 알아차리고 돕는 방법을 골라요 |

### `src/lib/c6/axes.ts` 요구 내용 (전부 순수 상수/타입/함수, 외부 의존 없음)
- `export type C6AxisId = 'C1_focus_flow' | ... | 'C6_social_emotional'` + `export const C6_AXIS_IDS: readonly C6AxisId[]`.
- `export interface C6AxisMeta { id; name_ko; world_region; parent_label; child_label; description }` + `export const C6_AXES: readonly C6AxisMeta[]`(위 표와 동일 값) + `export const C6_AXIS_BY_ID: ReadonlyMap<C6AxisId, C6AxisMeta>`.
- 13 생각도구: `export type ThinkingTool = 'observation'|'visualization'|'abstraction'|'pattern_recognition'|'pattern_forming'|'analogy'|'body_thinking'|'empathy'|'dimensional_thinking'|'modeling'|'play'|'transformation'|'synthesis'` + `export const THINKING_TOOLS: readonly ThinkingTool[]`.
- T1-T7: `export type TaskTemplateId = 'T1_HIDDEN_CLUE'|'T2_RULE_SWITCH'|'T3_SEQUENCE'|'T4_WORD_IMAGE'|'T5_ANALOGY_MARKET'|'T6_HEART_LAKE'|'T7_CREATE_SCENE'` + 메타(아이 이름, primary/secondary axis, 수집 변수 배열): T1 숨은 관찰길 C2/C1 (elapsed_ms, found_count, hint_count) · T2 반대로 찾기 C1/C3 (rule_switch_success, retry_count) · T3 물방울 길 만들기 C3 (sequence_order, retry_count) · T4 말장원 연결 C4 (selected_answer, exposure_count) · T5 거꾸로 시장 C5 (idea_choice, novelty_tag, reason_type) · T6 마음 호수 C6 (emotion_choice, prosocial_choice) · T7 별빛 작업실 C4/C5 (asset_count, saved, diversity_index).
- 레거시 매핑(문자열 키, c6-profile은 type import만):
  - `export const LEGACY_TOOL_TO_THINKING: Record<string, ThinkingTool>` = observe→observation, imagine→analogy, pattern→pattern_recognition, transform→transformation, design→modeling, compose→synthesis.
  - `export const LEGACY_TOOL_TO_AXIS: Record<string, C6AxisId>` = observe→C2, imagine→C5, pattern→C3, transform→C3, design→C4, compose→C4.
  - `export function inferAxisFromLegacyRound(input: { game_type: string; objective_code: string | null }): C6AxisId | null` — 우선순위: objective_code가 `sel_`로 시작→C6_social_emotional; `creativity_observe`→C2, `creativity_pattern`→C3, `creativity_imagine`→C5, `creativity_transform`→C3, `creativity_design`→C4, `creativity_compose`→C4; 없으면 game_type으로 hidden_friend/G5_find/G4_listen→C2, G3_sequence→C3, G2_sort→C3, G1_match/Q_quiz→C5, emotion_expression→C6, decorate→C4; 그 외 null.
- 이벤트 표준 필드 문서 주석: event_type, child_id, session_id, round_id, axis_id, thinking_tool, story_seed_id, elapsed_ms, hint_count, retry_count, is_correct(boolean|null), response_payload(jsonb).

## Deliverables
- 0023 마이그레이션 파일: 위 스키마·인덱스·RLS·시드 insert 포함, 기존 테이블 파괴 없음.
- `src/lib/c6/axes.ts`: 위 타입·상수·매핑 전부 export, 순수 모듈.
- lint/typecheck 통과.

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
- HUMAN 단계 명시: `supabase db push`(또는 대시보드 SQL)로 0023 적용은 사람이 수행 — c6-diagnosis-agent 배포 전에 반드시 선행.
