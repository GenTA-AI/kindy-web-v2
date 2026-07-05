# 02. 스키마 접합 설계 + 마이그레이션 SQL (0024–0029 + 커머스 델타 003x)

**목적**: 기존 kindy-web 스키마(0001–0023) 위에 HERO 레이어와 Mori Story Studio 제작 레이어를 충돌 없이 증축하는 마이그레이션 6본(+커머스 델타 1본, §13)의 설계 근거와 실행 가능한 SQL 전문을 확정한다.

**원천 문서** (BASE = `/Users/jongwonlee/Downloads/아이별_문서세트_2026-07-05`. 우선순위 규칙: **HERO v1.1 > 기획서 v2.2 > 각 상세** — BASE/00_README_문서지도.md)
- HERO 개발실행계획서 v1.1 (`/Users/jongwonlee/Downloads/files/HERO_개발실행계획서_v1.1_통합정본.md`) — §2 world_state 요지, §4 마이그레이션(005 SQL 전문), §5 API ⑤, §6 백로그, §7 테스트, 부록 A
- **HERO 개발실행계획서 v1.0** (`BASE/03_이력보관/HERO_개발실행계획서_v1.0.md`) — §2 world_state 전문(v1.1이 "전문 유효"로 참조), §3 아바타·슬롯 규격, §4 004_hero.sql 전문, §5 API 4종, 부록 A 골든테스트 10 원문. **2026-07-05 수령 — §11 대조 완료(본 개정)**
- 통합 제품 마스터플랜 v1.0 (`BASE/01_현행정본/Kindy_통합_제품_마스터플랜_v1.0.md`) — §4.2 커머스 스키마(003_commerce), §4.3 API 4종, §4.4 이벤트 사전, §4.5 정본 백로그
- 통합 마스터플랜 v1.1 개정판 (`BASE/01_현행정본/Kindy_통합_마스터플랜_v1.1_개정판.md`) — P-1 얼리버드 도서관 한정 정책(12개월 락·200가구 하드캡)
- 플레이테스트 리포트 v2.1 (`BASE/01_현행정본/아이별_플레이테스트_리포트_설계개정_v2.1.md`) — §5 계측 7종 정의(assist_needed 원문), §6 Phase B 프로토콜 정본
- 아이별 제품기획서 v2.2 (`/Users/jongwonlee/Downloads/files/아이별_제품기획서_v2.2_통합정본.md`) — §3 연령 밴드, §4 화면 스펙, §8 콘텐츠 계약, §9 측정 계획
- Mori Story Studio 마스터플랜 v1.0 (`/Users/jongwonlee/Downloads/Mori_Story_Studio_마스터플랜_v1.0.md`) — §2 스테이트 머신, §6.1 model_registry/eval_runs SQL, §7 002_story_studio.sql 전문, 부록 A
- 갭 검증 애덴덤 (`(scratchpad)/survey-addendum.md`) — Q1 정합 제약 6건
- 기존 마이그레이션 원본: `/Users/jongwonlee/dev/kindy-web/supabase/migrations/0001_init.sql`, `0010_library_videos.sql`, `0015_kiosk_funnel.sql`, `0016_game_events.sql`, `0017_subscriptions.sql`, `0018_parent_consents.sql`, `0023_c6_growth_map.sql`
- 확정 결정 컨텍스트: `(scratchpad)/DECISIONS_CONTEXT.md` (§B-3, §C-1~C-8, §D) + 개정 스펙 `(scratchpad)/REVISION_SPEC.md` §D

**이 문서가 SSOT인 범위**: kindy-web.v2 Supabase 프로젝트(lzzaiqruxxfhhalgvejb)의 마이그레이션 0024–0029 + 커머스 델타(§13) 스키마 설계·SQL 전문·이벤트 사전 v2·골든테스트 CI 계획·API 인벤토리(§12). 화면·카피는 기획서 v2.2가, 릴리즈 일정·티켓은 HERO v1.1 §0·§6이 SSOT다.

---

## 1. 접합 원칙 — 애덴덤 6제약과 해결 매핑

애덴덤(survey-addendum.md Q1)이 검증한 정합 제약 6건을 아래 마이그레이션이 각각 해결한다.

| # | 애덴덤 제약 (근거 파일) | 해결 방식 | 해결 마이그레이션 |
|---|---|---|---|
| 1 | `parent_id`는 `text`, RLS는 `children.parent_id = auth.uid()::text` (0001_init.sql:10, 0016:57, 0023:112) | 신규 테이블은 전부 `child_id uuid → children` FK + children 조인 RLS. parent 직결 컬럼 신설 없음 | 0024·0025·0029 전체 RLS |
| 2 | 이벤트 소싱 기반이 이미 존재 — `game_rounds` + `growth_processed_at` 멱등 프로젝터 (0023:44, diagnosis-agent.ts:66-68) | 신규 이벤트 테이블을 만들지 않고 `game_rounds`에 `event_type` 판별자 + `world_processed_at` 클레임 컬럼 추가 (CTX §C-1) | 0024 |
| 3 | `world_region` 컬럼(C6 지도 지역)이 4개 테이블에 이미 존재 (0023 lines 8,17,33,39) | 신규 개념은 `world_states`(서사 누적 상태)로 명명, 테이블 코멘트에 개념 구분 명문화 | 0024 |
| 4 | "에피소드"는 이미 `library_videos`로 살아 있고 FK 2개(view_events 0011, syllabus_lessons 0014)가 물려 있음 | `episodes`는 제작측(producer) 테이블로 신설, 발행 시 `library_videos` 1행 미러 + `library_videos.episode_id` FK (CTX §C-2) | 0027 |
| 5 | 아바타는 그린필드 — children에 avatar 컬럼 0, 웹·iOS에 코드 0 | `avatars` 신설, 144조합은 CHECK 3개의 곱(3×8×6)으로 강제 | 0025 |
| 6 | 번호 체계 0001–0023, 파괴적 SQL은 `supabase/manual/` | `004_hero.sql`/`005_usability.sql`/`002_story_studio.sql` 파일명 폐기, 내용을 0024–0029로 재배치 (CTX §B-3) | 전체 |

애덴덤 Q1-7의 부수 지적(`story_seeds.age_band int4range` vs `library_videos.age_band text` 불일치)은 다음 원칙으로 처리한다: **신규 테이블은 전부 `int` 밴드(5|6|7, product_defaults.age_band와 동일)** 를 쓰고, 기존 두 컬럼의 타입 변환은 데이터 재작성이 필요한 파괴적 작업이므로 이번 증축 범위에서 제외하고 `supabase/manual/` 후보로만 기록한다(CTX §C-3).

## 2. 번호·실행 규칙과 의존성

- 파일 위치: `/Users/jongwonlee/dev/kindy-web.v2/supabase/migrations/0024_*.sql` ~ `0029_*.sql`. 적용은 `supabase db push` (CTX §C-3).
- 전 구문 멱등(`if not exists` / `drop policy if exists` / `on conflict do nothing`) — 0016·0017·0023의 기존 컨벤션 그대로.
- RLS 기본형: **owner-select(children 조인) / service-role-write**(insert·update·delete 정책 없음 = deny by default) — 0017 §5 주석의 컨벤션.
- 파일 번호가 고정되어 있어(과업 지시) 생기는 **전방 참조 3건은 FK를 뒤 파일에서 부착**한다:

| 컬럼 | 생성 | FK 부착 | 참조 대상 |
|---|---|---|---|
| `bookshelf.episode_id` | 0024 | 0027 | episodes (0027 생성) |
| `personal_renders.episode_id` | 0025 | 0027 | episodes |
| `personal_renders.model_registry_id` | 0025 | 0028 | model_registry (0028 생성) — HERO v1.0 §4 원문 컬럼 |
| `renders.model_registry_id` | 0027 | 0028 | model_registry (0028 생성) |

- **채번 유동 마이그레이션**: `003x_commerce_hero.sql`(§13)·`003x_parent_web_events`(§9)는 적용 시점의 다음 빈 번호(0030+)로 채번한다. 0024–0029는 아직 미적용 초안이므로, HERO v1.0 원문 대조(§11)의 수정분은 초안 SQL에 직접 반영했다 — 별도 보정 마이그레이션 불필요.
- 적용 후 검증 쿼리(런북용): `select count(*) from product_defaults;` = 3, `select conname from pg_constraint where conname like 'game_rounds_%_check';` 에 event_type/round_shape/metric_payload 3건, `select count(*) from c6_axes;` = 6 유지.

---

## 3. 0024_hero_world_state.sql

**해결하는 애덴덤 제약**: #1(text parent 컨벤션), #2(game_rounds 스트림 재사용), #3(world_region 혼동), #6(번호 재배치).

**HERO 원문과의 델타**

| 항목 | HERO v1.0/v1.1 원문 | 이 마이그레이션 | 이유 |
|---|---|---|---|
| 파일명 | `004_hero.sql` (v1.0 §4) | 0024/0025/0027로 3분할 | CTX §B-3 번호 재배치 + episodes가 스튜디오 레이어(0027)와 결합되므로 분리 |
| 이벤트 적재 | v1.0 §2 원문(2026-07-05 수령·대조 완료): "상태는 항상 이벤트 스트림(story_choice·episode_completed·expression_saved)에서 리듀서로 재구성 가능해야 한다" — **전용 이벤트 테이블 명세 없음(스트림 소스 무규정)** | 전용 이벤트 테이블 신설 없이 기존 `game_rounds` 스트림에 `event_type` 판별자 신설 | CTX §C-1 확정 결정 + 마스터플랜 §7 "동화 시청이 곧 game_round" 지시와 동일 — 원문과 충돌 없음(§11 판정: 일치). 멱등 프로젝터는 `growth_processed_at` 패턴(0023:44, diagnosis-agent.ts:63-73) 복제 = `world_processed_at` |
| game_rounds NOT NULL | 0016은 `game_session_id`·`round_index` not null | 두 컬럼 NULL 허용으로 완화 + `event_type='game_round'`일 때만 not null을 강제하는 CHECK로 기존 불변식 보존 | A0 탄생 의식(naming), A5 책장 회고(replay) 등 게임 세션 밖 이벤트가 같은 스트림에 실려야 함(기획서 §4 A0/A5) |
| world_region | (해당 없음) | 테이블 코멘트로 기존 `world_region`(C6 지도 지역, 0023)과 개념 분리 명문화 | 애덴덤 제약 #3 |
| digest 제약 | v1.0 §2 "`world_state_digest`(≤500자 자연어 요약 + open_threads 원본)" — 원문 DDL은 `digest text`(제약 없음) | `digest text not null default ''` + `check (char_length(digest) <= 500)` | 문서화된 강화 델타 — 브리프 주입 계약(≤500자)을 DB가 강제 |
| open_threads | v1.0 §2 world_state v1 스키마: open_threads는 **state 내 배열** `[{id, desc, opened_ep, resolve_by_ep}]` — 별도 컬럼 아님 | 초안의 별도 `open_threads` 컬럼 **제거**(원문 우선 — REVISION_SPEC §D-2), 조회는 `(state->'open_threads')` GIN 인덱스 | 원문 우선 권장 채택. 초안이 가정했던 `{id, kind, opened_at_version, due_by_version, summary}` 필드명도 원문으로 교체 |
| bookshelf 표지 | v1.0 §4 원문: `cover_url text` + `personal_assets jsonb default '{}'` | 초안의 `cover_render_id`(renders FK) → **`cover_url`로 교체** + `personal_assets` 추가 (REVISION_SPEC §D-3) | 원문 우선. 렌더 원장 추적은 personal_renders(0025) 경유로 충분. `library_video_id`·`cover_fallback`은 우리 추가 델타 유지(발행 미러·폴백 계측 — HERO §8 폴백률 >5% 경보) |
| 리듀서 매핑 | v1.0 §2 원문: story_choice(prosocial=help)→characters_met.append(relation:helped)+open_threads / expression_saved(T7)→items_invented / episode_completed→places·version++ / 무응답 기본경로→상태 변경 없음(중립 처리 — 아이 불이익 금지) | 테이블 코멘트에 원문 매핑 명기 — E13-2 리듀서 구현의 정본 | v1.0 §2 수령으로 확정 |

**프로젝터 수정 지침(코드 측, 이 SQL과 한 티켓 E13-2)**: `diagnosis-agent.ts`의 클레임 쿼리에 `event_type in ('game_round','story_choice')` 필터를 추가해야 한다 — 0029에서 추가되는 계측 이벤트(tap_miss 등)가 성장 프로필로 폴드되는 오염을 막는다. story_choice는 마스터플랜 §7 지시대로 `child_growth_profiles` 갱신에 포함한다.

```sql
-- 0024_hero_world_state.sql
-- HERO v1.0 §2 world_state 명세(전문 — v1.1 이 "전문 유효"로 참조)의 스키마화 + game_rounds 스트림 확장.
-- 이벤트: 기존 game_rounds 에 event_type 판별자를 신설해 적재(신규 이벤트 테이블 없음 — CTX §C-1,
--         v1.0 §2 원문은 스트림 소스를 규정하지 않음 — §11 대조 판정: 일치).
-- 리듀서: game_rounds(world_processed_at is null) 를 클레임해 world_states(child_id, version) 스냅샷 생성.
-- 멱등 패턴은 0023 의 growth_processed_at / diagnosis-agent.ts 와 동일.

-- ═══════════════════════════════════════════════════════
-- 1. world_states — 아이별 서사 세계 상태 스냅샷 (버전 누적)
-- ═══════════════════════════════════════════════════════
create table if not exists public.world_states (
  child_id   uuid not null references public.children(id) on delete cascade,
  version    int not null check (version >= 1),
  digest     text not null default '' check (char_length(digest) <= 500),
  state      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (child_id, version)
);

create index if not exists idx_world_states_child_latest
  on public.world_states (child_id, version desc);

-- open_threads 는 state 내 배열(HERO v1.0 §2 원문 — 별도 컬럼 아님). 기한 도래 스레드 조회용 GIN 인덱스.
create index if not exists idx_world_states_open_threads
  on public.world_states using gin ((state -> 'open_threads') jsonb_path_ops);

comment on table public.world_states is
  'HERO v1.0 §2 world_state 스냅샷. 리듀서가 game_rounds 이벤트(story_choice/episode_completed/expression_saved)와 avatars·bookshelf 를 폴드해 version+1 로 append. '
  '리듀서 매핑(v1.0 §2 원문): story_choice(prosocial=help)→characters_met.append(relation:helped)+open_threads 생성 / expression_saved(T7)→items_invented / '
  'episode_completed→places·version++ / 무응답 기본경로→상태 변경 없음(중립 처리 — 아이 불이익 금지). '
  '⚠️ 기존 world_region 컬럼(c6_axes/story_seeds/library_videos/game_rounds, 0023)과 무관 — world_region 은 "콘텐츠가 속한 C6 지도 지역", world_states 는 "아이 서사의 누적 상태"다.';
comment on column public.world_states.digest is
  '브리프 주입 계약: Story Smith 에게 주입되는 ≤500자 자연어 요약 + open_threads 원본 (HERO v1.0 §2). 실패 시 "연속성 중립판"(재등장 요소 제거) 폴백 — 에피소드는 항상 나간다. '
  'Story Smith 의무 3규칙(v1.0 §2): ① resolve_by_ep 도래 스레드 반드시 회수 ② characters_met 재등장 시 relation 모순 금지 ③ items_invented 는 소품으로 최소 1회/3에피 재등장.';
comment on column public.world_states.state is
  'world_state v1 스키마(HERO v1.0 §2 원문): {companion: {id, named_by_child}, characters_met: [{id, relation, ep, choice_node}], '
  'items_invented: [{id, name, ep, asset_ref}], places_visited: [], open_threads: [{id, desc, opened_ep, resolve_by_ep}], '
  'mood_pref: {gacs: [4]}, safety_flags: []}. Guardian 연속성 5룰(관계 모순/사망·퇴장 재등장/아이템 존재 모순/지명 모순/미회수 스레드 방치 >6에피) 자동 반려의 대조 원본.';

-- ═══════════════════════════════════════════════════════
-- 2. game_rounds 확장 — 이벤트 스트림 승격
-- ═══════════════════════════════════════════════════════
alter table public.game_rounds
  add column if not exists event_type text not null default 'game_round',
  add column if not exists world_processed_at timestamptz;

-- 세션 밖 이벤트(A0 이름 짓기, A5 책장 회고 등) 허용을 위해 NOT NULL 완화.
alter table public.game_rounds alter column game_session_id drop not null;
alter table public.game_rounds alter column round_index drop not null;
alter table public.game_rounds alter column game_type set default 'event';

-- event_type 사전 v1 (0029 에서 계측 7종으로 확장 — 0017 의 purchases_bundle_type_check 재정의 패턴).
alter table public.game_rounds drop constraint if exists game_rounds_event_type_check;
alter table public.game_rounds
  add constraint game_rounds_event_type_check
  check (event_type in ('game_round', 'story_choice', 'episode_completed', 'expression_saved'));

-- 기존 불변식 보존: 게임 라운드 행은 반드시 세션·라운드 번호를 가진다.
alter table public.game_rounds drop constraint if exists game_rounds_round_shape_check;
alter table public.game_rounds
  add constraint game_rounds_round_shape_check
  check (event_type <> 'game_round' or (game_session_id is not null and round_index is not null));

-- world_state 리듀서 클레임용 부분 인덱스 (growth 인덱스 0023:72 패턴).
create index if not exists idx_game_rounds_world_unprocessed
  on public.game_rounds (child_id, created_at)
  where world_processed_at is null
    and event_type in ('story_choice', 'episode_completed', 'expression_saved');

comment on column public.game_rounds.event_type is
  '스트림 레코드 종별 판별자. game_round=기존 게임 라운드(기본값), story_choice=CP 선택(마스터플랜 §7: response_payload={"node":"CP1","choice":"b"}), '
  'episode_completed=에피소드 완주, expression_saved=A3 별빛 작업실 창작 저장. 기존 game_type 은 활동 종별(G1_match 등, src/types/game.ts)로 유지 — '
  '비라운드 이벤트는 game_type 기본값 event. 0029 에서 관찰 계측 7종이 이 CHECK 에 추가된다.';
comment on column public.game_rounds.world_processed_at is
  'world_state 리듀서의 멱등 클레임 시각. growth_processed_at(0023, diagnosis-agent.ts) 과 동일 패턴이며 서로 독립 — 한 이벤트가 성장 프로젝터와 세계 리듀서에 각각 1회씩 폴드된다.';

-- ═══════════════════════════════════════════════════════
-- 3. bookshelf — 내 책장 (완주한 에피소드의 회고 항목, 기획서 §4 A1/A4/A5)
-- ═══════════════════════════════════════════════════════
create table if not exists public.bookshelf (
  id               uuid primary key default gen_random_uuid(),
  child_id         uuid not null references public.children(id) on delete cascade,
  episode_id       uuid,                      -- FK 는 0027 에서 부착 (episodes 가 0027 에서 생성됨)
  library_video_id uuid references public.library_videos(id),
  path_taken       jsonb not null default '[]'::jsonb,
  cover_url        text,
  personal_assets  jsonb not null default '{}'::jsonb,
  cover_fallback   boolean not null default false,
  completed_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index if not exists idx_bookshelf_child_completed
  on public.bookshelf (child_id, completed_at desc);

comment on table public.bookshelf is
  '내 책장(HERO v1.0 §4 원문 컬럼: episode_id/path_taken/cover_url/personal_assets/completed_at). 완주 1회 = 1행("다르게 골라볼래" 재진입 시 새 행 — E13-6). '
  'path_taken 은 회고 고정 재생용 노드 경로 배열(v1.0 §4 원문 주석 "선택 경로 기록 = 회고 재생 키", 기획서 §4 A5).';
comment on column public.bookshelf.library_video_id is
  '재생 진입점(우리 추가 델타 — 발행 미러 접합). 아이/부모 읽기는 published=true 인 library_videos 경유(0010 RLS) — 제작측 episodes 는 service-role 전용이므로 직접 참조하지 않는다.';
comment on column public.bookshelf.cover_url is
  '표지 이미지 URL(HERO v1.0 §4 원문 — 초안의 cover_render_id FK 를 원문 우선으로 교체, REVISION_SPEC §D-3). '
  '개인 스틸 성공 시 개인화 표지, 실패 시 공유 표지 URL. 렌더 원장 추적은 personal_renders(0025, kind=avatar_still) 경유.';
comment on column public.bookshelf.personal_assets is
  '완주 시점의 개인화 자산 스냅샷(HERO v1.0 §4 원문, 예: {"cover": "...", "stills": ["..."]}) — 회고 재생(A5)이 재조회 없이 사용.';
comment on column public.bookshelf.cover_fallback is
  '표지 개인 스틸 폴백 여부(우리 추가 델타 — 기획서 §4 A4 "폴백 시 공유 표지 — 아이는 인지 불가"). HERO §8 폴백률 >5% 경보의 입력.';

-- ═══════════════════════════════════════════════════════
-- 4. RLS — owner-select / service-role-write (0016·0017 컨벤션)
-- ═══════════════════════════════════════════════════════
alter table public.world_states enable row level security;
alter table public.bookshelf enable row level security;

drop policy if exists world_states_select_own on public.world_states;
create policy world_states_select_own
  on public.world_states for select
  using (
    exists (
      select 1 from public.children
      where children.id = world_states.child_id
        and children.parent_id = auth.uid()::text
    )
  );

drop policy if exists bookshelf_select_own on public.bookshelf;
create policy bookshelf_select_own
  on public.bookshelf for select
  using (
    exists (
      select 1 from public.children
      where children.id = bookshelf.child_id
        and children.parent_id = auth.uid()::text
    )
  );

-- insert/update/delete 정책 없음 = service-role 전용 (리듀서·세션 API 가 RLS 우회로 기록).
```

## 4. 0025_hero_avatars.sql

**해결하는 애덴덤 제약**: #1, #5(아바타 그린필드), #6.

**HERO 원문과의 델타**

| 항목 | HERO v1.0/v1.1 원문 | 이 마이그레이션 | 이유 |
|---|---|---|---|
| 파일명 | `004_hero.sql`의 avatars/personal_renders (v1.0 §4) | 0025로 분리 | CTX §B-3 |
| avatars 인코딩 | v1.0 §4 원문: `config jsonb not null -- {base, palette, companion, companion_name}` **단일 컬럼** + `photoreal_check text not null default 'n/a'` + `version int not null default 1` | config 를 base/palette/companion/companion_name 컬럼으로 **분해 유지**(문서화된 강화 델타 — REVISION_SPEC §D-1) + 원문의 `photoreal_check`·`version` 컬럼 추가(수정 적용) | 분해는 144 조합 무결성을 DB CHECK 로 강제하기 위함. photoreal_check 는 v1.0 §3 "실사 유사 금지: 스타일화 3D만, QC에 실사 유사도 판정 추가"(E13-10)의 기록 컬럼 |
| 144조합 | v1.0 §3 "베이스 3 × 팔레트 8 × 단짝 6 = 144 조합" | `base 1–3`·`palette 1–8`·`companion 1–6` CHECK 3개의 곱 = 144. 별도 조합 테이블 없음 | 스틸 배치(E13-5)는 Storage 경로 키 `b{base}-p{palette}-c{companion}` 로 충분, DB는 무결성만 담당 |
| personal_renders kind | v1.0 §4 원문: `kind text not null -- name_tts \| avatar_still \| moving_cut \| recap \| birthday` (5종) + `status default 'queued'` + `model_registry_id` + `cost` + `fallback_used` + `output_url` | 초안의 `'still'` 단일 kind → **원문 5종으로 확장** + status/model_registry_id/cost/fallback_used/output_url 컬럼 보강(수정 적용 — REVISION_SPEC §D-4) | 원문 우선. `slot` 컬럼과 unique 키는 우리 추가 델타(사전조합 해석 키 — E13-5) 유지. 렌더 잡 SLA(v1.0 §5 ④): still<2m, moving<15m, recap<60m |
| 이름 풀 | E13-17 "이름 추천 풀 100 큐레이션+금칙·발음 검사 파이프" | `name_pool` 테이블만 생성, 100행 시드는 마이그레이션에 넣지 않음 | 큐레이션·금칙·발음 검사는 R1 파이프라인 산출물(E13-17, CC 오너)이지 DDL이 아니다. 시드는 `scripts/seed-name-pool.ts`(service-role)로 적재 — story_seeds 도 마이그레이션 시드 없이 운영되는 기존 방식(애덴덤 Q3 "no script seeds story_seeds")과 동일 계보 |
| 사진·카메라 | v1.0 §3 "사진 업로드 경로는 코드베이스에 존재하지 않는다(안전 원칙 — E13-10이 테스트로 보증)" | 이미지 업로드류 컬럼 자체를 두지 않음 + 테이블 코멘트 명시 | DB 레벨에서도 수집 경로 원천 제거 |

```sql
-- 0025_hero_avatars.sql
-- HERO v1.0 §3·§4 아바타·이름 시스템: avatars(144조합) / personal_renders(개인화 렌더 원장) / name_pool(추천 풀).

-- ═══════════════════════════════════════════════════════
-- 1. avatars — 아이당 1행 (상시 개명·재조합 = update)
-- ═══════════════════════════════════════════════════════
create table if not exists public.avatars (
  child_id        uuid primary key references public.children(id) on delete cascade,
  base            int not null check (base between 1 and 3),
  palette         int not null check (palette between 1 and 8),
  companion       int not null check (companion between 1 and 6),
  companion_name  text not null default '단짝아',
  name_mode       text not null default 'default'
                    check (name_mode in ('recommend', 'voice', 'chosung', 'default')),
  photoreal_check text not null default 'n/a',
  version         int not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.avatars is
  'HERO v1.0 §3 아바타. 원문 §4 의 config jsonb 단일 컬럼을 base/palette/companion 으로 분해(문서화된 강화 델타 — REVISION_SPEC §D-1): '
  'CHECK 3개의 곱 = 144 조합 전량을 DB 가 강제. '
  '사진·카메라·이미지 업로드 컬럼은 의도적으로 없음 — 코드 부재를 테스트로 보증(E13-10, v1.0 §3, 기획서 §4 A0 AC).';
comment on column public.avatars.companion_name is
  '단짝 이름. 무입력 기본 "단짝아", 상시 개명 가능(HERO §3 결정 D5).';
comment on column public.avatars.name_mode is
  '이름 확정 경로: recommend=추천 3택, voice=음성(재시도 1회), chosung=초성(6·7세 판정 시만), default=무입력 기본값.';
comment on column public.avatars.photoreal_check is
  '실사 유사도 판정 결과(HERO v1.0 §4 원문: default ''n/a''). v1.0 §3 "실사 유사 금지: 스타일화 3D만" — E13-10 판정기가 144조합 전수 통과 결과를 기록.';
comment on column public.avatars.version is
  '아바타 구성 버전(HERO v1.0 §4 원문). 재조합·개명 update 시 +1 — world_state 리듀서가 아바타 변경 이벤트를 폴드할 때의 참조점.';

-- ═══════════════════════════════════════════════════════
-- 2. personal_renders — 아이별 개인화 렌더 원장 (HERO v1.0 §4 원문 5-kind)
-- ═══════════════════════════════════════════════════════
create table if not exists public.personal_renders (
  id                uuid primary key default gen_random_uuid(),
  child_id          uuid not null references public.children(id) on delete cascade,
  episode_id        uuid,                     -- FK 는 0027 에서 부착
  slot              text,
  kind              text not null default 'avatar_still'
                      check (kind in ('name_tts', 'avatar_still', 'moving_cut', 'recap', 'birthday')),
  status            text not null default 'queued'
                      check (status in ('queued', 'running', 'succeeded', 'failed')),
  model_registry_id uuid,                     -- FK 는 0028 에서 부착 (model_registry 가 0028 에서 생성됨)
  output_url        text,
  cost              numeric,
  fallback_used     boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (child_id, episode_id, slot, kind),
  constraint personal_renders_slot_required_check
    check (kind not in ('avatar_still', 'moving_cut') or slot is not null)
);

create index if not exists idx_personal_renders_child
  on public.personal_renders (child_id, created_at desc);

comment on table public.personal_renders is
  '아이별 개인화 렌더 원장(HERO v1.0 §4 원문). kind 5종 = name_tts | avatar_still | moving_cut | recap | birthday. '
  '티어A 사전조합(avatar_still): 에피소드당 주인공 스틸 2컷×144 조합(공유 자산, Storage 경로 키 b{base}-p{palette}-c{companion})을 '
  '아이 조합으로 해석해 1행 기록(E13-5). 실패 시 fallback_used=true + 지정 폴백 URL. '
  'moving_cut(티어B, E13-11)·recap(티어C, E13-12)·birthday(E13-13)는 온디맨드 잡 — 피처 플래그 tier_b/tier_c 뒤(v1.0 §0). '
  '잡 SLA(HERO v1.0 §5 ④): still<2m, moving<15m, recap<60m.';
comment on column public.personal_renders.slot is
  '개인화 슬롯 키(우리 추가 델타 — 사전조합 해석 키). avatar_still/moving_cut 은 episodes.avatar_slots[].shot_id(v1.0 §3 슬롯 규격)와 일치, '
  'name_tts/recap/birthday 는 null.';
comment on column public.personal_renders.status is
  '잡 상태(v1.0 §4 원문 default ''queued''). CHECK 값 집합은 우리 강화 델타 — POST /internal/renders/personal(§12 ④) 잡 큐의 라이프사이클.';
comment on column public.personal_renders.model_registry_id is
  '렌더에 사용한 모델(HERO v1.0 §4 원문) — 0028 model_registry 조인으로 개인 레이어 비용·품질 추적.';

-- ═══════════════════════════════════════════════════════
-- 3. name_pool — 이름 추천 풀 (E13-17: 큐레이션 100 + 금칙·발음 검사)
-- ═══════════════════════════════════════════════════════
create table if not exists public.name_pool (
  name           text primary key,
  banned         boolean not null default false,
  phonetic_check text not null default 'pending'
                   check (phonetic_check in ('pending', 'pass', 'fail')),
  source         text not null default 'curated',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_name_pool_servable
  on public.name_pool (name)
  where banned = false and phonetic_check = 'pass';

comment on table public.name_pool is
  'A0 이름 추천 3택의 풀(목표 100행 — E13-17 큐레이션 파이프가 scripts/seed-name-pool.ts 로 적재). '
  '추천 서빙 조건: banned=false and phonetic_check=pass. 클라이언트 직접 읽기 금지(금칙 목록 노출 방지) — API route 가 service-role 로 3개 샘플링.';

-- ═══════════════════════════════════════════════════════
-- 4. RLS
-- ═══════════════════════════════════════════════════════
alter table public.avatars enable row level security;
alter table public.personal_renders enable row level security;
alter table public.name_pool enable row level security;

drop policy if exists avatars_select_own on public.avatars;
create policy avatars_select_own
  on public.avatars for select
  using (
    exists (
      select 1 from public.children
      where children.id = avatars.child_id
        and children.parent_id = auth.uid()::text
    )
  );

drop policy if exists personal_renders_select_own on public.personal_renders;
create policy personal_renders_select_own
  on public.personal_renders for select
  using (
    exists (
      select 1 from public.children
      where children.id = personal_renders.child_id
        and children.parent_id = auth.uid()::text
    )
  );

-- name_pool: 정책 없음 = service-role 전용 (select 포함 — 금칙/검사 상태 비노출).
-- avatars/personal_renders 쓰기: 정책 없음 = service-role 전용 (A0 저장은 API route 경유).
```

## 5. 0026_product_defaults.sql

**해결하는 애덴덤 제약**: #6(005_usability.sql → 0026 재배치).

**HERO 원문과의 델타** — HERO v1.1 §4의 `005_usability.sql` 전문을 이식하되:

| 항목 | HERO §4 원문 | 이 마이그레이션 | 이유 |
|---|---|---|---|
| `create table product_defaults` | CHECK·RLS 없음 | `age_band in (5,6,7)`·옵션 범위 CHECK + `if not exists` + RLS 추가 | 기존 레포 컨벤션(0016·0023: 멱등 + RLS 전 테이블) |
| `insert into product_defaults values (...)` | 컬럼명 생략, 멱등 아님 | 명시적 컬럼 리스트 + `on conflict (age_band) do nothing` | `supabase db push` 재실행 안전성 |
| `alter table episodes add column cp_options_variants` | 005에 포함 | **0027로 이동** — episodes 테이블이 0027에서 비로소 생성되므로 이 파일에서는 실행 불가 | 파일 순서 제약(§2 의존성 표). 원문 의도(노드별 2택 서브셋)는 0027의 컬럼 정의·코멘트로 보존 |

시드 3행의 값은 HERO §4 원문 그대로이며 기획서 §3 표(세션 14/17/20분·리드 2/1/0·TTS 0.9/1.0/1.0·탭/탭/탭+드래그실험·환기 6/5/5)와 1:1이다. CP 옵션 수만 예외 — 기획서 6세는 2–3 범위이며 기본값은 HERO §4 시드의 2를 채택(3옵션 노출은 cp_options_variants 콘텐츠 측 실험).

```sql
-- 0026_product_defaults.sql
-- HERO v1.1 §4 "005_usability.sql" 이식: 연령 밴드 기본값 (기획서 §3 표와 1:1).
-- 소비자: GET /api/children/[id]/session-config (HERO §5 ⑤, CTX §C-12). 캐시 24h.

create table if not exists public.product_defaults (
  age_band        int primary key check (age_band in (5, 6, 7)),
  session_len_min int not null check (session_len_min between 10 and 30),
  cp_options      int not null check (cp_options between 2 and 3),
  cp_lead_count   int not null check (cp_lead_count between 0 and 2),
  tts_rate        numeric not null check (tts_rate between 0.5 and 1.5),
  workshop_mode   text not null check (workshop_mode in ('tap', 'tap_drag_exp')),
  refresh_points  int not null check (refresh_points between 1 and 10),
  updated_at      timestamptz not null default now()
);

insert into public.product_defaults
  (age_band, session_len_min, cp_options, cp_lead_count, tts_rate, workshop_mode, refresh_points, updated_at)
values
  (5, 14, 2, 2, 0.9, 'tap', 6, now()),
  (6, 17, 2, 1, 1.0, 'tap', 5, now()),
  (7, 20, 3, 0, 1.0, 'tap_drag_exp', 5, now())
on conflict (age_band) do nothing;

comment on table public.product_defaults is
  '연령 밴드(출생연월 판정) 기본값 — HERO §4 005 / 기획서 §3. 무언 적용: 아이·부모 화면 어디에도 "연령 맞춤" 문구 없음(기획서 §3 R6). '
  '홀드아웃 배정은 0029 holdout_assignments. cp_options 는 콘텐츠의 cp_options_variants(0027)에서 서브셋을 고른다.';
comment on column public.product_defaults.cp_lead_count is
  '5세 음성 리드 횟수(6s/11s — 기획서 §6 리드 스크립트). cp_timeout 이벤트의 lead_shown 과 대조.';

alter table public.product_defaults enable row level security;

-- 비식별 제품 구성값 — c6_axes(0023:93) 패턴의 읽기 개방. 정식 소비는 session-config API.
drop policy if exists product_defaults_select_all on public.product_defaults;
create policy product_defaults_select_all
  on public.product_defaults for select
  to authenticated
  using (true);

-- 쓰기 정책 없음 = service-role 전용 (Phase B 결과로 파라미터 v2 교체 — E15-2).
```

## 6. 0027_studio_episodes.sql

**해결하는 애덴덤 제약**: #4(episodes vs library_videos — 발행 미러로 해소), #6.

**마스터플랜/HERO 원문과의 델타** — 마스터플랜 §7 `002_story_studio.sql` 전문 기반:

| 항목 | 원문 | 이 마이그레이션 | 이유 |
|---|---|---|---|
| 파일명 | `002_story_studio.sql` (마스터플랜 §7) | 0027 | CTX §B-3 |
| episodes 테이블명 | episodes | **episodes 유지, 개명 없음** — 단 제작측 테이블로 신설하고 소비 표면은 library_videos 미러 | 애덴덤 제약 #4: library_videos 에 FK 2개(0011, 0014)와 /library RLS 표면이 물려 있어 대체 불가. CTX §C-2 확정 |
| approval_status | `default 'draft'`(제약 없음) | `check in ('draft','in_review','approved')` + `published → approved` 하드게이트 CHECK | 마스터플랜 §2 "approval_status: draft → in_review → approved 는 story_seeds 와 동일 상태 모델" + 불변 조항 ②(휴먼 QA 게이트 없는 published=true 금지, CTX §D) |
| 파이프라인 상태 | (§2 스테이트 머신은 서술만) | `episodes.status` CHECK 로 §2 스테이트 머신 12단계 명문화 | CTX §C-4 "상태는 Postgres(episodes.status + pipeline_runs)" |
| cp_options_variants | HERO §4 005 (episodes alter) | 컬럼 정의로 흡수 (0026에서 이동) | §5 델타 표 참조 |
| avatar/companion 슬롯 | HERO v1.0 §4 원문 alter(`avatar_slots`·`companion_slots jsonb default '[]'`) + v1.0 §3 슬롯 규격 원문 `[{shot_id, kind: still\|moving, duration_s, fallback_shot_id}]` + 기획서 §8 필수 메타 | `avatar_slots`·`companion_slots jsonb` + `replay_value 1–3`. 슬롯 형식은 원문 §3 규격으로 확정(대조 완료 — §11, 초안의 `[{slot, node_id, fallback_url}]` 가정 교체) | E5-2' 주인공 포맷(슬롯+재시청가치 태깅). "모든 slot 은 fallback 필수"(v1.0 §3) |
| format·personalizable | HERO v1.0 §4 원문 alter: `episodes.format text default 'hero' -- hero \| legacy`, `shots.personalizable boolean default false` | 컬럼 정의로 흡수(0027 생성 시점 병합, REVISION_SPEC §D-5) + not null·CHECK 강화 | 004_hero.sql 의 episodes/shots alter 는 두 테이블이 0027에서 비로소 생성되므로 생성 컬럼으로 병합 |
| FK on delete | 미지정 | episode_nodes/shots 에 `on delete cascade`, shots→episode_nodes 복합 FK 추가 | 제작 재실행 시 고아 행 방지(스테이지 멱등 — 마스터플랜 §2) |
| renders.model_registry_id FK | `references model_registry(id)` | 컬럼만 생성, FK 는 0028에서 부착 | 파일 순서(§2 의존성 표) |
| 아티팩트 저장 | 마스터플랜 §2 "아티팩트: GCS" | output_url/video_url 은 Supabase Storage 경로(기존 videos 버킷 패턴) | CTX §C-5: GCS 도입하지 않음 |
| RLS | (원문 없음) | 4개 테이블 전부 enable + 정책 없음 = service-role 전용. 아이/부모 읽기는 library_videos 경유 | 제작측 데이터(프롬프트·비용·QC 점수)는 고객 표면 비노출 — 불변 조항 ③과 정합 |

**발행 미러 계약(코드 측)**: `status='published'` 전이 시 서비스가 ① `library_videos` 1행 upsert(`episode_id` FK, published=true 는 HITL#3 승인 후에만 — 불변 ②), ② 분기 그래프(episode_nodes)를 `library_videos.scenes jsonb`(0013 기존 컬럼)로 스냅샷 미러한다. `InteractiveVideoPlayer`(kindy-web `src/components/game/InteractiveVideoPlayer.tsx`)는 이 스냅샷/`episode_nodes` 매핑을 소비한다(CTX §C-10 필드 매핑 표는 03 문서 §2 player-map.ts 담당).

```sql
-- 0027_studio_episodes.sql
-- Mori 마스터플랜 §7 "002_story_studio.sql" 이식 + library_videos 발행 미러 접합(애덴덤 제약 #4).
-- 제작측(producer) 테이블 — 아이/부모 표면은 library_videos(0010 RLS) 경유로만 읽는다.

-- ═══════════════════════════════════════════════════════
-- 1. episodes — 에피소드 원장 (제작 상태 + 분기 스크립트)
-- ═══════════════════════════════════════════════════════
create table if not exists public.episodes (
  id                  uuid primary key default gen_random_uuid(),
  story_seed_id       uuid references public.story_seeds(id),
  title               text not null,
  target_axis         text references public.c6_axes(id),
  branching_script    jsonb not null,
  duration_path_s     integer,
  duration_total_s    integer,
  approval_status     text not null default 'draft'
                        check (approval_status in ('draft', 'in_review', 'approved')),
  published           boolean not null default false,
  status              text not null default 'brief_accepted'
                        check (status in (
                          'brief_accepted', 'motif_report', 'script_draft', 'script_review',
                          'shotlist', 'keyframes', 'shot_generation', 'auto_qc',
                          'assembly', 'dubbing_mix', 'final_qc', 'published')),
  cp_options_variants jsonb not null default '{}'::jsonb,
  format              text not null default 'hero'
                        check (format in ('hero', 'legacy')),
  avatar_slots        jsonb not null default '[]'::jsonb,
  companion_slots     jsonb not null default '[]'::jsonb,
  replay_value        int check (replay_value between 1 and 3),
  budget_cap_usd      numeric not null default 400,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 불변 조항 ②: 휴먼 QA(HITL) 승인 없는 발행 금지 — DB 레벨 하드게이트.
alter table public.episodes drop constraint if exists episodes_publish_gate_check;
alter table public.episodes
  add constraint episodes_publish_gate_check
  check (published = false or approval_status = 'approved');

create index if not exists idx_episodes_status on public.episodes (status, created_at desc);
create index if not exists idx_episodes_seed on public.episodes (story_seed_id);

comment on table public.episodes is
  'Story Studio 제작 원장(마스터플랜 §7). branching_script = 부록 A JSON 스키마. status = §2 스테이트 머신. '
  '발행 시 library_videos 1행 미러(episode_id FK) — /library·bookshelf 표면은 미러만 읽는다.';
comment on column public.episodes.cp_options_variants is
  'HERO §4 005 이식(0026에서 이동): 노드별 CP 2택 서브셋. 형식 {"CP1": {"2": ["a","b"], "3": ["a","b","c"]}} — '
  '키=product_defaults.cp_options 값, 값=해당 밴드에 노출할 옵션 id 배열. 2택 서브셋 필수(E5-2'', 기획서 §8 하드게이트).';
comment on column public.episodes.format is
  '에피소드 포맷(HERO v1.0 §4 원문): hero=주인공 포맷(avatar/companion_slots 포함 제작 — E5-2''), legacy=기존 포맷(옛이야기 등 슬롯 없는 재고).';
comment on column public.episodes.avatar_slots is
  '주인공 개인화 슬롯 목록 [{shot_id, kind: still|moving, duration_s, fallback_shot_id}] (HERO v1.0 §3 개인 레이어 슬롯 규격 원문 — companion_slots 동일 형식). '
  '모든 slot 은 fallback 필수: 렌더 실패 시 공유 컷+호명만으로 재생(v1.0 §3, 기획서 §8).';
comment on column public.episodes.replay_value is
  '재시청가치 태깅 1–3 (E5-2'', 기획서 §3 재시청 계수 계획의 콘텐츠측 입력).';
comment on column public.episodes.budget_cap_usd is
  '에피소드 예산 상한(마스터플랜 §6.3 기본 $400, CTX §E). 소진 80% 도달 시 하위 티어 강등.';

-- ═══════════════════════════════════════════════════════
-- 2. episode_nodes — 세그먼트·선택 노드 (분기 그래프)
-- ═══════════════════════════════════════════════════════
create table if not exists public.episode_nodes (
  id            text not null,                 -- 'S0', 'CP1', 'E2' ...
  episode_id    uuid not null references public.episodes(id) on delete cascade,
  node_type     text not null check (node_type in ('segment', 'choice')),
  axis_id       text references public.c6_axes(id),
  thinking_tool text,
  video_url     text,
  duration_s    integer,
  next_nodes    jsonb not null default '[]'::jsonb,
  primary key (episode_id, id)
);

comment on table public.episode_nodes is
  '다이아몬드 분기 그래프(마스터플랜 §1.1). segment: video_url = Supabase Storage 최종 인코딩 산출물(CTX §C-5 — GCS 미도입). '
  'choice: axis_id/thinking_tool 필수(부록 A 검증 규칙). 발행 시 그래프 스냅샷이 library_videos.scenes(0013)로 미러됨.';

-- ═══════════════════════════════════════════════════════
-- 3. shots — 샷리스트 (콘티 에이전트 산출)
-- ═══════════════════════════════════════════════════════
create table if not exists public.shots (
  id              text not null,               -- 'S2a_03'
  episode_id      uuid not null references public.episodes(id) on delete cascade,
  node_id         text not null,
  seq             integer not null,
  tier            text not null default 'standard'
                    check (tier in ('hero', 'standard', 'filler')),
  duration_s      numeric not null,
  keyframe_prompt text,
  motion_prompt   text,
  characters      text[] default '{}',
  dialogue        jsonb default '[]'::jsonb,   -- [{char, text, name_slot}]
  personalizable  boolean not null default false,
  status          text not null default 'pending',
  primary key (episode_id, id),
  foreign key (episode_id, node_id) references public.episode_nodes (episode_id, id) on delete cascade
);

create index if not exists idx_shots_node on public.shots (episode_id, node_id, seq);

comment on table public.shots is
  '샷 분해(마스터플랜 §4.1 콘티). tier 는 §6.3 비용 라우팅 입력(히어로 10–15%·필러 30–40%). dialogue.name_slot=true 구간이 L2 호명 세그먼트(E13-4: 외부 미전송).';
comment on column public.shots.personalizable is
  '개인화 대상 샷 여부(HERO v1.0 §4 원문). true = episodes.avatar_slots[].shot_id 로 참조되는 샷 — E13-5 사전조합 배치의 대상 선별 키.';

-- ═══════════════════════════════════════════════════════
-- 4. renders — 생성 호출 원장 (키프레임/클립/TTS/음악/L3)
-- ═══════════════════════════════════════════════════════
create table if not exists public.renders (
  id                uuid primary key default gen_random_uuid(),
  episode_id        uuid references public.episodes(id) on delete cascade,
  shot_id           text,
  kind              text not null
                      check (kind in ('keyframe', 'clip', 'tts', 'music', 'l3_personal')),
  model_registry_id uuid,                      -- FK 는 0028 에서 부착 (model_registry 가 0028 에서 생성됨)
  seed              bigint,
  input_refs        jsonb,
  output_url        text,
  cost              numeric,
  latency_ms        integer,
  qc_result         text check (qc_result in ('pass', 'regenerate', 'reroute', 'human_review')),
  qc_scores         jsonb,
  attempt           integer not null default 1,
  created_at        timestamptz not null default now(),
  foreign key (episode_id, shot_id) references public.shots (episode_id, id) on delete cascade
);

create index if not exists idx_renders_episode on public.renders (episode_id, created_at desc);
create index if not exists idx_renders_qc on public.renders (qc_result) where qc_result <> 'pass';

comment on table public.renders is
  '생성 호출 1건 = 1행(마스터플랜 §7). model_id+version+seed 로깅으로 품질 변동 원인 추적(§6.2-5). '
  'output_url 은 Supabase Storage videos 버킷 경로(CTX §C-5). 샷 없는 kind(tts/music)는 shot_id null — 복합 FK 는 null 시 검사 생략(MATCH SIMPLE).';

-- ═══════════════════════════════════════════════════════
-- 5. library_videos 접합 — 발행 미러 (애덴덤 제약 #4 해결)
-- ═══════════════════════════════════════════════════════
alter table public.library_videos
  add column if not exists episode_id uuid references public.episodes(id);

-- 에피소드 1편 = 미러 1행 보장.
create unique index if not exists idx_library_videos_episode_unique
  on public.library_videos (episode_id)
  where episode_id is not null;

comment on column public.library_videos.episode_id is
  'Story Studio 제작 원본 추적 FK. 발행 플로우: episodes.status=published 전이 시 library_videos 1행 upsert(published 게이트는 기존 0010 RLS 그대로) '
  '+ episode_nodes 그래프를 scenes(0013)에 스냅샷. view_events(0011)·syllabus_lessons(0014) FK 표면은 무변경.';

-- ═══════════════════════════════════════════════════════
-- 6. 0024·0025 전방 참조 FK 부착
-- ═══════════════════════════════════════════════════════
alter table public.bookshelf drop constraint if exists bookshelf_episode_id_fkey;
alter table public.bookshelf
  add constraint bookshelf_episode_id_fkey
  foreign key (episode_id) references public.episodes(id);

-- (bookshelf.cover_render_id FK 는 폐기 — HERO v1.0 §4 원문 우선으로 cover_url text 채택, REVISION_SPEC §D-3)

alter table public.personal_renders drop constraint if exists personal_renders_episode_id_fkey;
alter table public.personal_renders
  add constraint personal_renders_episode_id_fkey
  foreign key (episode_id) references public.episodes(id);

-- ═══════════════════════════════════════════════════════
-- 7. RLS — 제작측 테이블은 service-role 전용 (정책 없음 = deny)
-- ═══════════════════════════════════════════════════════
alter table public.episodes enable row level security;
alter table public.episode_nodes enable row level security;
alter table public.shots enable row level security;
alter table public.renders enable row level security;
-- 정책 의도적으로 없음: 프롬프트·비용·QC 점수는 고객 표면 비노출(불변 ③).
-- 아이/부모 읽기는 published=true 인 library_videos(0010 정책) 경유가 유일 경로.
```

## 7. 0028_studio_model_registry.sql

**해결하는 애덴덤 제약**: #6 + Q2 "Model registry: none — 모델이 settings.py·video-providers/ 에 하드코딩" 갭 해소.

**마스터플랜 원문과의 델타** — §6.1 SQL 전문 이식:

| 항목 | 마스터플랜 §6.1 원문 | 이 마이그레이션 | 이유 |
|---|---|---|---|
| status enum | `candidate | benchmark | canary | prod | retired` | + `'fallback'` 추가 | §5 표가 "2군(fallback/필러)"을 명시적 열로 두는데 §6.1 enum에는 없음 — 라우터의 2군 폴백 상태를 표현 |
| 중복 방지 | 없음 | `unique (capability, model_id)` 인덱스 | 시드 멱등(`on conflict do nothing`) + Scout 자동 등록의 중복 방지 |
| 초기값 시드 | §5 표 (2026-07 기준) | **CTX §C-7/C-8 로 조정된 시드** — ElevenLabs 미등록(한국어 아동 보이스 정책 차단, kindy-web docs/10 3중 검증), video_i2v 1군 = Seedance 1.5 Pro(docs/10), keyframe 1군 = FLUX.2+KINDYTOY LoRA v1 | CTX §C-7(TTS 필수 수정)·§C-8(레지스트리 초기값). 최종 확정은 T3 골든셋 벤치 |
| 시드 범위 | §5 표 일부만 예시 | **시드 범위 = 03 §1-5 초기값 전체** — wan-2.5(benchmark)·lipsync 2군(veed-fabric-1.0/sync-lipsync-v2)·sfx/music 1군(mmaudio-v2/minimax-music) 포함 | 03 §7-4 벤치 명령·eval_runs FK 가 registry 행에 조인되도록 model_id 사전을 이 시드로 정본화 |
| pipeline_runs | 없음 (§2 "상태/로그: Postgres" 서술만) | 신설 — Inngest 스텝 상태 미러 + `output_ref text` 컬럼 | CTX §C-4: BullMQ/Celery 대신 Inngest, 상태는 episodes.status + pipeline_runs. output_ref 는 Inngest 재실행 시 결과 재사용 참조(03 §4-2 계약) |
| RLS | 없음 | 3개 테이블 enable + 정책 없음 = service-role 전용 | 제작 인프라 데이터 비노출 |

```sql
-- 0028_studio_model_registry.sql
-- 마스터플랜 §6.1 Model Registry & Eval Harness 이식 + Inngest 파이프라인 상태 미러(CTX §C-4).

-- ═══════════════════════════════════════════════════════
-- 1. model_registry — capability 별 모델 라우팅 원장
-- ═══════════════════════════════════════════════════════
create table if not exists public.model_registry (
  id             uuid primary key default gen_random_uuid(),
  capability     text not null,        -- 'video_i2v' | 'keyframe_image' | 'tts_ko' | 'lipsync' | 'music' | ...
  provider       text not null,        -- 'fal', 'google', 'supertone', 'self-hosted' ...
  model_id       text not null,        -- 'seedance-1.5-pro', 'kling-3.0-elements' ...
  version        text,
  status         text not null default 'candidate'
                   check (status in ('candidate', 'benchmark', 'canary', 'prod', 'fallback', 'retired')),
  tier           text check (tier in ('hero', 'standard', 'filler')),
  unit_price     numeric,              -- $/sec 또는 $/장
  avg_latency_ms integer,
  quality_score  numeric,              -- 최근 골든셋 종합점수 0-100 (부록 C 루브릭)
  safety_score   numeric,
  policy_notes   text,                 -- 라이선스/상업사용/데이터보존 조항 요약
  benchmarked_at timestamptz,
  created_at     timestamptz not null default now()
);

create unique index if not exists idx_model_registry_cap_model
  on public.model_registry (capability, model_id);

comment on table public.model_registry is
  '마스터플랜 §6.1. 모델 교체 = 라우팅 행 하나 변경. status=fallback 은 §5 표의 2군(원문 §6.1 enum 에 없어 추가한 델타). '
  '승격/롤백 규칙은 §6.2 (canary=필러샷 10%, 롤백: QC -10%p·단가 +30%·안전 실패 1건).';

-- 초기값 시드 — CTX §C-7/C-8 확정. T3 골든셋 벤치가 최종 확정하며, 이 시드는 출발점이다.
insert into public.model_registry
  (capability, provider, model_id, status, tier, unit_price, policy_notes)
values
  ('video_i2v', 'fal', 'seedance-1.5-pro', 'prod', 'standard', 0.052,
   'docs/10 지정 1군(~$0.26/5s, start/end-frame 비트 그리드). T3 에서 seedance-2.0 과 대결 확정.'),
  ('video_i2v', 'fal', 'seedance-2.0', 'benchmark', 'standard', null,
   'T3 벤치 대상(1.5 Pro vs 2.0 — CTX §C-8). 네이티브 오디오는 docs/10 에서 기각($0.30/s).'),
  ('video_i2v', 'fal', 'seedance-2.0-fast', 'fallback', 'filler', 0.022,
   '마스터플랜 §5 필러 2군(~$0.022/s).'),
  ('video_i2v', 'fal', 'kling-3.0-elements', 'prod', 'hero', null,
   '히어로 컷 1군(CTX §C-8, Elements 1–4 ref). docs/10: 2배 과금 주의.'),
  ('video_i2v', 'fal', 'veo-3.1-quality', 'candidate', 'hero', 0.40,
   '마케팅 히어로 전용(docs/10, CTX §C-8) — 에피소드 예산 라우팅에서 제외.'),
  ('keyframe_image', 'fal', 'flux-2-kindytoy-lora-v1', 'prod', 'standard', null,
   'KINDYTOY 룩 LoRA v1(kindy-web/tmp/studio/lora-result.json, src/content/studio/lora/kindytoy-v1.json). 아티팩트 URL 생존 확인 = R0 체크(CTX §C-6).'),
  ('keyframe_image', 'fal', 'nano-banana-gemini-3-pro-image', 'fallback', 'standard', null,
   '2군(CTX §C-8). 기존 어댑터 보유(kindy-app pipeline gemini-3-pro-image 계보).'),
  ('tts_ko', 'google', 'gemini-2.5-flash-tts', 'prod', null, null,
   '현행 캐스팅 22개 mp3 검증(kindy-web/public/audio/village/). Sona 2 파운더 게이트 통과 전까지 1군(CTX §C-7).'),
  ('tts_ko', 'supertone', 'sona-2', 'candidate', null, null,
   '1군 후보 — 한국어 아동 보이스 가용성 확인 = 파운더 게이트(CTX §C-7). ElevenLabs 는 아동 보이스 정책 차단(docs/10 3중 검증)으로 미등록.'),
  ('tts_ko', 'self-hosted', 'qwen3-tts', 'candidate', null, null,
   'L2 호명(name_slot) 전용 후보 — 이름 외부 미전송 원칙(HERO E13-4, 마스터플랜 §1.3).'),
  ('lipsync', 'fal', 'omnihuman', 'candidate', null, 0.14,
   'VEED Fabric 대체 검증 대기(docs/10, 애덴덤 Q2). 클로즈업 선별 적용만(마스터플랜 §4.3).'),
  ('video_i2v', 'fal', 'wan-2.5', 'benchmark', 'filler', null,
   'T3 벤치 대상(03 §1-5 필러 후보) — 03 §7-4 벤치 명령의 wan-2.5 와 조인되는 행.'),
  ('lipsync', 'fal', 'veed-fabric-1.0', 'fallback', null, null,
   '2군(03 §1-5). omnihuman 검증 결과에 따라 폴백 — 클로즈업 선별 적용만(마스터플랜 §4.3).'),
  ('lipsync', 'fal', 'sync-lipsync-v2', 'fallback', null, null,
   '2군(03 §1-5). 클로즈업 선별 적용만(마스터플랜 §4.3).'),
  ('sfx', 'fal', 'mmaudio-v2', 'prod', null, null,
   '1군(03 §1-5). 상업 라이선스 조항 확인 = W1-2 파운더 게이트(03 §9) — 확인 결과를 이 policy_notes 에 기록.'),
  ('music', 'fal', 'minimax-music', 'prod', null, null,
   '1군(03 §1-5). 상업 라이선스 확인 = W1-2 파운더 게이트(03 §9). 곡별 출처·라이선스는 renders(kind=music).input_refs 의 license 필드로 기록.')
on conflict (capability, model_id) do nothing;

-- ═══════════════════════════════════════════════════════
-- 2. eval_runs — 골든셋 벤치 실행 로그 (마스터플랜 §6.1 원문 그대로)
-- ═══════════════════════════════════════════════════════
create table if not exists public.eval_runs (
  id                uuid primary key default gen_random_uuid(),
  model_registry_id uuid references public.model_registry(id),
  golden_task_id    text not null,
  output_url        text,
  scores            jsonb not null,    -- {consistency: 27, adherence: 22, motion: 18, child_safety: 15, artifact: 9}
  total             numeric not null,
  cost              numeric,
  latency_ms        integer,
  judge_model       text,
  human_override    numeric,           -- 인간 스팟체크 점수(있을 때)
  created_at        timestamptz not null default now()
);

create index if not exists idx_eval_runs_model
  on public.eval_runs (model_registry_id, created_at desc);

comment on table public.eval_runs is
  '골든셋 20태스크 × 후보 모델 벤치 로그(마스터플랜 §6.2·부록 C 루브릭 100점). prod 모델도 주간 재실행(T6 회귀: -3점 초과 시 알림).';

-- ═══════════════════════════════════════════════════════
-- 3. pipeline_runs — Inngest 스텝 상태 미러 (CTX §C-4)
-- ═══════════════════════════════════════════════════════
create table if not exists public.pipeline_runs (
  id             uuid primary key default gen_random_uuid(),
  episode_id     uuid not null references public.episodes(id) on delete cascade,
  stage          text not null
                   check (stage in (
                     'motif_report', 'script_draft', 'script_review', 'shotlist',
                     'keyframes', 'shot_generation', 'auto_qc', 'assembly',
                     'dubbing_mix', 'final_qc', 'publish')),
  status         text not null default 'running'
                   check (status in ('running', 'succeeded', 'failed', 'canceled')),
  output_ref     text,
  error          text,
  inngest_run_id text,
  attempt        int not null default 1,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz
);

create index if not exists idx_pipeline_runs_episode
  on public.pipeline_runs (episode_id, started_at desc);

comment on table public.pipeline_runs is
  'Inngest 스텝 함수 실행 1회 = 1행(CTX §C-4: BullMQ/Celery 대신 Inngest, 동시 제작 3편 초과 시 Temporal 재검토). '
  '각 스테이지는 멱등 — 실패 시 해당 스테이지만 재실행(마스터플랜 §2). episodes.status 는 최신 성공 스테이지를 따른다.';
comment on column public.pipeline_runs.output_ref is
  '스테이지 산출물 참조(Storage 경로·렌더 id 등). Inngest 재실행 시 status=succeeded 스테이지의 결과 재사용 입력(03 §4-2 계약).';

-- ═══════════════════════════════════════════════════════
-- 4. renders·personal_renders 전방 참조 FK 부착 (§2 의존성 표)
-- ═══════════════════════════════════════════════════════
alter table public.renders drop constraint if exists renders_model_registry_id_fkey;
alter table public.renders
  add constraint renders_model_registry_id_fkey
  foreign key (model_registry_id) references public.model_registry(id);

alter table public.personal_renders drop constraint if exists personal_renders_model_registry_id_fkey;
alter table public.personal_renders
  add constraint personal_renders_model_registry_id_fkey
  foreign key (model_registry_id) references public.model_registry(id);

-- ═══════════════════════════════════════════════════════
-- 5. RLS — 전부 service-role 전용
-- ═══════════════════════════════════════════════════════
alter table public.model_registry enable row level security;
alter table public.eval_runs enable row level security;
alter table public.pipeline_runs enable row level security;
-- 정책 없음 = deny by default. 소비자는 mori-studio(CTX §B-2)와 오케스트레이터 다이제스트뿐.
```

## 8. 0029_hero_metrics.sql

**해결하는 애덴덤 제약**: #2(스트림 재사용 — 계측 7종도 신규 테이블 없이 game_rounds 에 적재), #6.

**HERO 원문과의 델타**

| 항목 | HERO v1.1 원문 | 이 마이그레이션 | 이유 |
|---|---|---|---|
| 계측 7종 (E15-1) | "game_rounds 적재"라는 명시는 없고 "전부 비식별"만 | `game_rounds.event_type` CHECK 확장 + `response_payload` 필수 키 CHECK + 뷰 2본 — **테이블 신설 없음** | 과업 지시 + 애덴덤 제약 #2(단일 스트림 유지). response_payload 는 0023:43 기존 컬럼 재사용 |
| 데모 v2 (E13-7') | "2스텝(단짝+색), 호명 친구야, 관 A/B 플래그" | `kiosk_sessions` 에 demo_version/venue_arm/companion/palette 컬럼 추가. kiosk_events.event_type 은 0015 원문대로 CHECK 없는 자유 텍스트 유지 + 코멘트로 사전 확장 | 0015 컨벤션 보존. **이름 컬럼은 추가하지 않음** — 키오스크 이름 미수집(결정 D6)은 컬럼 부재 + 코드 부재 테스트로 보증 |
| 홀드아웃 | §1 "홀드아웃 배정 포함", §5 holdout_arm, E13-8·기획서 §7 | `holdout_assignments(child_id, experiment, arm)` 신설 | session-config 1콜 응답(HERO §5 ⑤)의 저장소 |
| 홀드아웃 RLS | — | **owner-select 없이 service-role 전용** (컨벤션 예외) | 기획서 §3 R6 "무언 적용, 아이 고지 없음": 배정 사실 자체를 고객 표면에 비노출. 소비자는 session-config API(service-role)뿐 |

```sql
-- 0029_hero_metrics.sql
-- E15-1 아동 관찰 계측 7종(전부 비식별) + E13-7' 키오스크 데모 v2 + 홀드아웃 배정.
-- 계측 이벤트는 테이블 신설 없이 game_rounds(event_type + response_payload) 로 적재 — CHECK 와 뷰로 사전을 강제한다.

-- ═══════════════════════════════════════════════════════
-- 1. event_type 사전 v2 — 0024 CHECK 를 계측 7종으로 확장
--    (0017 의 purchases_bundle_type_check drop/재정의 패턴)
-- ═══════════════════════════════════════════════════════
alter table public.game_rounds drop constraint if exists game_rounds_event_type_check;
alter table public.game_rounds
  add constraint game_rounds_event_type_check
  check (event_type in (
    -- 0024 정의분
    'game_round', 'story_choice', 'episode_completed', 'expression_saved',
    -- E15-1 관찰 계측 7종
    'cp_timeout', 'passive_first_cp', 'tap_miss', 'assist_needed',
    'replay_view', 'naming_mode_used', 'session_fatigue_exit'
  ));

-- 계측 이벤트별 response_payload 필수 키 (이벤트 사전 v2 표와 1:1 — 본 문서 §9).
alter table public.game_rounds drop constraint if exists game_rounds_metric_payload_check;
alter table public.game_rounds
  add constraint game_rounds_metric_payload_check
  check (
        (event_type <> 'cp_timeout'           or (response_payload ? 'node' and response_payload ? 'lead_shown'))
    and (event_type <> 'passive_first_cp'     or response_payload ? 'node')
    and (event_type <> 'tap_miss'             or (response_payload ? 'x' and response_payload ? 'y'))
    and (event_type <> 'assist_needed'        or response_payload ? 'context')
    and (event_type <> 'replay_view'          or response_payload ? 'bookshelf_id')
    and (event_type <> 'naming_mode_used'     or response_payload ? 'mode')
    and (event_type <> 'session_fatigue_exit' or response_payload ? 'elapsed_min')
  );

comment on constraint game_rounds_metric_payload_check on public.game_rounds is
  'E15-1 계측 7종의 최소 페이로드 계약. 전체 필드 정의는 docs/plan/02_SCHEMA_RECONCILIATION.md §9 이벤트 사전 v2.';

-- ═══════════════════════════════════════════════════════
-- 2. 계측 뷰 — 대시보드·모니터링 (HERO §8: passive_first_cp 추이·tap_miss 핫스팟·fatigue 분포)
--    security_invoker: 부모는 자기 아이 행만(0016 RLS 상속), service-role 은 전체.
-- ═══════════════════════════════════════════════════════
create or replace view public.hero_metric_events
with (security_invoker = true) as
select
  id,
  child_id,
  event_type,
  (response_payload ->> 'node')        as cp_node,
  (response_payload ->> 'lead_shown')  as lead_shown,
  (response_payload ->> 'x')::numeric  as tap_x,
  (response_payload ->> 'y')::numeric  as tap_y,
  (response_payload ->> 'mode')        as naming_mode,
  (response_payload ->> 'elapsed_min') as fatigue_elapsed_min,
  response_payload,
  created_at
from public.game_rounds
where event_type in (
  'cp_timeout', 'passive_first_cp', 'tap_miss', 'assist_needed',
  'replay_view', 'naming_mode_used', 'session_fatigue_exit'
);

create or replace view public.hero_metric_daily
with (security_invoker = true) as
select
  date_trunc('day', created_at) as day,
  event_type,
  count(*)                      as events
from public.game_rounds
where event_type not in ('game_round')
group by 1, 2;

-- 폴백률 모니터링 (HERO §8: 폴백률 >5% 경보) — personal_renders(0025) 기반.
create or replace view public.hero_fallback_daily
with (security_invoker = true) as
select
  date_trunc('day', created_at)                       as day,
  count(*)                                            as renders,
  count(*) filter (where fallback_used)               as fallbacks,
  round(100.0 * count(*) filter (where fallback_used) / greatest(count(*), 1), 2) as fallback_pct
from public.personal_renders
group by 1;

-- ═══════════════════════════════════════════════════════
-- 3. 키오스크 데모 v2 (E13-7': 2스텝 단짝+색, 관 A/B 플래그)
-- ═══════════════════════════════════════════════════════
alter table public.kiosk_sessions
  add column if not exists demo_version text not null default 'v1'
    check (demo_version in ('v1', 'v2')),
  add column if not exists venue_arm text
    check (venue_arm in ('A', 'B')),
  add column if not exists companion int
    check (companion between 1 and 6),
  add column if not exists palette int
    check (palette between 1 and 8);

comment on column public.kiosk_sessions.demo_version is
  '데모 버전. v2 = 2스텝(단짝+색) "네가 주인공"(기획서 §4 K1). 기존 행은 v1.';
comment on column public.kiosk_sessions.venue_arm is
  '설치처(관) 단위 A/B 배정 — 데모 v2 vs v1 스캔율 실험(E13-7'', 기획서 §9 "주인공 데모=QR").';
comment on column public.kiosk_sessions.companion is
  'v2 1스텝 "함께 갈 단짝은?" 선택(1–6, avatars.companion 과 동일 코드). 호명은 "친구야" 고정 — 이름 수집 없음(결정 D6): '
  '이름 컬럼은 이 테이블에 의도적으로 부재하며 수집 코드 부재를 테스트로 보증(E13-7'' AC).';
comment on column public.kiosk_sessions.palette is
  'v2 2스텝 "좋아하는 색은?" 선택(1–8, avatars.palette 와 동일 코드).';

comment on table public.kiosk_events is
  '익명 키오스크 행동 이벤트(0015). 데모 v2 추가 event_type: step_companion_select | step_palette_select '
  '(payload {companion|palette}). event_type 은 0015 원문대로 CHECK 없는 자유 텍스트 — 사전은 docs/plan/02 §9.';

-- ═══════════════════════════════════════════════════════
-- 4. holdout_assignments — 실험 홀드아웃 배정 (HERO §1·§5, E13-8, 기획서 §7)
-- ═══════════════════════════════════════════════════════
create table if not exists public.holdout_assignments (
  child_id    uuid not null references public.children(id) on delete cascade,
  experiment  text not null
                check (experiment in ('ageband_defaults', 'tier_a', 'gacs_optimization')),
  arm         text not null check (arm in ('control', 'treatment')),
  assigned_at timestamptz not null default now(),
  primary key (child_id, experiment)
);

create index if not exists idx_holdout_experiment_arm
  on public.holdout_assignments (experiment, arm);

comment on table public.holdout_assignments is
  '실험 배정: ageband_defaults(연령 기본값 홀드아웃 — HERO §1·E13-16), tier_a(온/오프 50:50 — E13-8), '
  'gacs_optimization(홀드아웃 10% — 기획서 §7). 신규 실험은 CHECK 확장 마이그레이션으로 추가. '
  'RLS 는 service-role 전용(컨벤션 예외) — 무언 적용 원칙(기획서 §3 R6)상 배정 사실을 고객 표면에 비노출. 소비는 session-config API(HERO §5 ⑤).';

alter table public.holdout_assignments enable row level security;
-- 정책 의도적으로 없음 = service-role 전용 (예외 근거는 테이블 코멘트).
```

---

## 9. 이벤트 사전 v2 (HERO §7·§8 계측 × 기획서 §9 1:1)

기획서 §9 말미 "이벤트 사전 v2(개발계획서 §8)와 1:1 매핑 — 계측 없는 화면은 머지 불가(R11)"의 그 사전이 아래 표다. 적재처 열의 CHECK 는 0024·0029가 강제한다.

| 이벤트 | 적재처 (판별자) | 필수 페이로드 | 발생 화면 (기획서 §4) | 근거 | 기획서 §9 가설 매핑 |
|---|---|---|---|---|---|
| story_choice | game_rounds (event_type) | response_payload {node, choice} + axis_id·thinking_tool·elapsed_ms (0023 컬럼) | A2 CP, CP0(practice:true 병기) | 마스터플랜 §7, HERO E13-15 | 최적화=학습·유지 / 연령 기본값=완주 |
| episode_completed | game_rounds | {episode_id, path_taken} | A4 클로저 | CTX §C-1 | 연령 기본값=완주(첫 정규 세션 ≥65%) |
| expression_saved | game_rounds | {slots} | A3 별빛 작업실 | CTX §C-1, 결정 D7 | 작업실 실패 25%→12% (기획서 §3) |
| cp_timeout | game_rounds | {node, lead_shown(0–2)} | A2/CP0 15s 무응답 | E15-1 (리드 노출 포함) | 5세 첫 CP 무응답 ≤25% |
| passive_first_cp | game_rounds | {node} | CP0·첫 정규 CP | E13-15·E15-1, HERO §8 추이 모니터링 | 연령 기본값=완주 |
| tap_miss | game_rounds | {x, y} (+target 권장) | 아이 표면 전체 | E15-1, HERO §8 핫스팟 | 미니멀=도달 (터치 규격 QA §11) |
| assist_needed | game_rounds | {context} — 정의(플레이테스트 v2.1 §5 원문): "부모 개입 감지: 온보딩 중 성인 패턴 입력". context 예: 'onboarding_adult_pattern'(입력 속도·정확도가 성인 패턴), 'repeated_help_call'(도움 반복 요청) | 아이 표면 전체 (1차 표면: A0 온보딩) | E15-1, 플레이테스트 v2.1 §5 | Phase B 행동 코딩 "보조요청"(v2.1 §6 관찰 코딩 시트) 대응 |
| replay_view | game_rounds | {bookshelf_id} (+cp_reentered 권장) | A5 회고 재생 | E13-6·E15-1 | 책장=회고 (replay_view/주, "다르게" 진입률) |
| naming_mode_used | game_rounds | {mode: recommend\|voice\|chosung\|default} (+retries 권장) | A0 탄생 의식 | E15-1, 결정 D5 | 이름 성공 ≥90% |
| session_fatigue_exit | game_rounds | {elapsed_min} (+band 권장) | A2 세션 중 이탈 | E15-1, HERO §8 분포→밴드 튜닝 | 연령 기본값=완주 |
| episode_exhaustion_signal | 서버 배치 산출 시그널 — game_rounds **미적재**(아이 행동 이벤트 아님). E5-3 주간 배치가 아이별 미시청 신선 재고를 산출해 경보 채널(퍼널 대시보드·일간 다이제스트)로 발행. 스키마 변경 없음(0024–0029 밖) | {child_id, fresh_remaining} | (화면 없음 — 운영 경보) | 통합 제품 마스터플랜 §4.4(원문 행: "child_id, fresh_remaining — F5 콘텐츠 소진 조기경보"), E5-3(정본 백로그 §4.5) | F5 소진 경보(첫 코호트 집중 구간 조기 탐지) |
| step_companion_select / step_palette_select | kiosk_events (event_type, CHECK 없음 — 0015 원문 유지) | payload {companion} / {palette} | K1 데모 v2 2스텝 | E13-7' | 주인공 데모=QR (관 A/B = kiosk_sessions.venue_arm) |
| k2_completed | kiosk_events (event_type, CHECK 없음 — 0015 원문 유지) | payload {elapsed_s} (권장) | K2 3분 체험 완주(영상 90s+미니게임+모리 칭찬) | E13-7' (K2 편입 — 01 §2.2) | 주인공 데모=QR (K2 완주 ≥70% AC 판정) |
| demo_started·video_*·qr_shown 등 | kiosk_events — 0015 기존 사전 그대로 | 0015 주석 참조 | K1–K3 | 0015_kiosk_funnel.sql | 주인공 데모=QR |
| 시청 이벤트(play/complete 등) | view_events — 0001·0011 기존 사전 그대로 | — | 재생 전반 | 0001_init.sql:50 | 최적화=학습·유지 |
| 결제·구독 전환 (checkout_started/payment_succeeded/subscription_canceled — 통합마스터플랜 §4.4) | 신규 이벤트 없음 — purchases(0004/0017)·subscriptions(0017 + §13 커머스 델타: price_locked·cancel_effective_at·next_billing_notice_sent_at) 행에서 직접 산출 | — | W4 | 0017_subscriptions.sql, §13 | 비노출+투명=신뢰(전환) |
| report_opened / card_expanded | **이번 범위(0024–0029) 밖** — 부모 웹 이벤트 테이블이 현재 없음(view_events 는 video-scoped, 0001). R1 리포트 티켓(E4-1 주간 리포트 API, 정본 백로그 §4.5 — E12-3은 paid IG A/B·오너 CMO)에서 003x_parent_web_events(채번은 적용 시점) 로 신설하고 본 사전에 편입 | {report_id} / {card_id} | W3 첫 리포트 | 기획서 §9 "리포트 열람 ≥60%" | 비노출+투명=신뢰 |
| onboarding_step_completed | **이번 범위(0024–0029) 밖** — report_opened 와 동일 처리: R1 온보딩 티켓(E1-2 확장 = 온보딩 5단계 개정, 기획서 W2 — E1-3~6은 해지·D-3 알림·얼리버드 락·영수증)에서 003x_parent_web_events(채번은 적용 시점) 로 신설하고 본 사전에 편입 | {step(1–5)} | W2 온보딩 5단계 | E1-2 확장 AC "완료율 ≥60%" | 미니멀=도달 (설치→첫 세션 <90s·온보딩 완료 ≥60% — W3 실측) |

각주(오프라인 큐잉 규약): story_choice 와 계측 이벤트(E15-1 7종 포함)는 오프라인 재생 시 클라이언트 로컬 큐잉 후 재접속 동기화를 허용한다 — 클라이언트 규약(03 §5 W7–8 플레이어 계약), 유실 <0.1% 예산 내. 수집 엔드포인트 계약은 §12 ⑥(POST /v1/events — Idempotency-Key·batch·멱등키).

각주(7세 18분 가설): 플레이테스트 v2.1 F1 "7세도 20분 완주 69%로 70% 게이트에 미달하므로 7세 상한도 18분 검토를 Phase B 가설로"(§4 표 표기 "20분(18분 가설)"). 이는 **Phase B 가설 목록 항목이지 골든테스트 대상이 아니다** — 0026 시드(7세 session_len_min=20)와 골든테스트 케이스 11은 20분 유지, Phase B 실측 후 파라미터 v2(E15-2)로 시드 UPDATE 시 케이스 11 기대 상수를 함께 갱신한다.

운영 모니터링 산출(HERO §8): passive_first_cp 추이·session_fatigue_exit 분포 = `hero_metric_daily`, tap_miss 핫스팟 = `hero_metric_events`(tap_x/tap_y), 폴백률 >5% 경보 = `hero_fallback_daily` (전부 0029 뷰).

## 10. 골든테스트 12본 CI 계획

HERO §2 "골든테스트 10케이스(부록 A)가 CI 필수" + §7 신규 2건(연령 기본값 3밴드, CP 2택 서브셋). **케이스 1–10의 시나리오 문구는 HERO v1.0 부록 A 원문(2026-07-05 수령) 그대로다** — REVISION_SPEC §D-9. 러너는 기존 `evidence.test.ts` 패턴(node:test + node:assert/strict, DB 무접속 순수 함수 검증 — kindy-web `src/lib/c6/evidence.test.ts:1-2`) 그대로, 실행은 기존 스모크 컨벤션(tsx — kindy-web package.json scripts)의 `npx tsx --test`.

**전제 구현(순수 함수)**: 리듀서 `foldWorldState(events, prev): WorldState`(src/lib/hero/world-state.ts), Guardian 연속성 검사 `checkContinuity(script, worldState): Rejection[]`, 세션 설정 `resolveSessionConfig(birthYm, defaultsRows, holdoutArm, moodState?) → {age_band, defaults, holdout_arm, mood_preset}`(HERO §5 ⑤ 4필드 응답 계약 — mood_preset 은 GACS 무드 사전에서 파생하며 저장 테이블 불필요, 콜드스타트 첫 주 'gentle' — 기획서 §7), 서브셋 검증 `validateCpVariants(branchingScript, cpOptionsVariants)`. 전부 DB 입력을 인자로 받아 픽스처(JSON)로 테스트한다 — evidence.ts/evidence.test.ts 와 동일 구조.

| # | 케이스 (HERO v1.0 부록 A 원문 인용) | 파일 | 기대 |
|---|---|---|---|
| 1 | ① "helped 관계 캐릭터가 적대적으로 재등장" | src/lib/hero/world-state.golden.test.ts | Guardian 반려 |
| 2 | ② "open_thread 기한 도과 미회수" | 〃 | 반려 |
| 3 | ③ "발명 아이템 존재 부정 대사" | 〃 | 반려 |
| 4 | ④ "미방문 지명을 '다시 왔다'고 서술" | 〃 | 반려 |
| 5 | ⑤ "단짝 이름 오기" (avatars.companion_name 불일치) | 〃 | 반려 |
| 6 | ⑥ "기한 내 스레드 회수" | 〃 | 통과 |
| 7 | ⑦ "아이템 자연 재등장" | 〃 | 통과 |
| 8 | ⑧ "신규 캐릭터 도입" | 〃 | 통과 |
| 9 | ⑨ "world_state 공백(신규 가입)→중립판 통과" | 〃 | 통과(중립 digest) |
| 10 | ⑩ "digest 실패 폴백→중립판 통과" | 〃 | 통과(폴백 경로 — v1.0 §2 "연속성 중립판" 브리프: 재등장 요소 제거) |
| 11 | **신규** 연령 기본값 3밴드: 출생연월 3종 → 밴드 5/6/7 판정, 반환값이 0026 시드 3행과 전 컬럼 일치 + holdout arm=control 시 기본값 고정 + 반환값에 mood_preset 포함(무드 입력 없는 콜드스타트 = 'gentle') | src/lib/hero/session-config.golden.test.ts | E13-16 AC "3밴드 E2E 검증"의 단위 레이어 |
| 12 | **신규** CP 2택 서브셋: cp_options_variants 의 "2" 서브셋이 각 choice 노드 options 의 진부분집합(길이 2)이고 timeout_default 포함, 서브셋 적용 후에도 전 노드 도달 가능(부록 A 검증 규칙) — 위반 픽스처는 실패 판정 | src/lib/hero/cp-variants.golden.test.ts | E5-2' "2택 서브셋 필수" 하드게이트 |

**실행 배선**: kindy-web.v2 package.json 에 `"test:golden": "tsx --test src/lib/hero/world-state.golden.test.ts src/lib/hero/session-config.golden.test.ts src/lib/hero/cp-variants.golden.test.ts"`, `"test": "tsx --test src/lib/c6/evidence.test.ts src/lib/c6/recommendation.test.ts && npm run test:golden"`. CI(PR 필수 체크)에서 `npm run test` — 골든 실패 = 머지 불가(HERO §2 + 불변 ⑧ "테스트 없는 PR 금지"). 케이스 11의 기대값은 0026 시드를 복사한 상수(src/lib/hero/product-defaults.ts)와 비교하고, 시드 SQL 변경 시 테스트가 함께 깨지도록 값을 하드코딩 비교한다(스키마-코드 드리프트 감지). 스튜디오측 골든셋 벤치(T3, 부록 C 20태스크)는 CI 가 아니라 eval_runs(0028) 배치로 돈다 — 이 절의 CI 는 결정 로직 회귀 전용.

## 11. HERO v1.0 원본 대조 체크리스트 — **대조 완료 (2026-07-05)**

HERO v1.0(`BASE/03_이력보관/HERO_개발실행계획서_v1.0.md`)·플레이테스트 v2.1(`BASE/01_현행정본/아이별_플레이테스트_리포트_설계개정_v2.1.md`)을 2026-07-05 수령해 아래 대조를 실행했다(REVISION_SPEC §B D-D·§D). **C6 원본 PDF도 동일 수령·대조 완료**(`~/Documents/GenTA/연구자료/Mori_C6_창의성장지도_연구_및_서비스적용_명세서_v1.0.pdf` — 하단 C6 대조 표). 0024–0029는 미적용 초안이므로 "수정 적용" 판정분은 전부 본 문서의 초안 SQL에 직접 반영했다 — 보정 마이그레이션(0031+) 불필요.

판정 사전: **일치** = 원문과 우리 SQL이 동등 / **문서화된 델타** = 의도적 차이(근거를 델타 표·코멘트에 명기) / **수정 적용** = 원문 우선으로 초안을 고침(본 개정에서 실행).

**§2 world_state (v1.0 §2 전문 — v1.1이 "전문 유효"로 참조)**

| 대조 항목 | 원문 인용 (HERO v1.0) | 우리 SQL | 판정 |
|---|---|---|---|
| digest 규격 | §2 "`world_state_digest`(≤500자 자연어 요약 + open_threads 원본)" — DDL은 `digest text`(제약 없음), ≤500자 외 형식 제약 없음 | 0024 `digest text not null default '' check (char_length(digest) <= 500)` | **일치**(≤500자) + **문서화된 델타**(not null·CHECK 강화 — §3 델타 표) |
| open_threads 스키마 | §2 스키마 원문 `"open_threads": [{"id":"bo_promise","desc":"보 고래가 은혜 갚기로 약속","opened_ep":3,"resolve_by_ep":9}]` — **state 내 배열** | 초안의 별도 `open_threads jsonb` 컬럼과 `{id, kind, opened_at_version, due_by_version, summary}` 필드 가정 → 컬럼 제거, state 내 원문 필드(`{id, desc, opened_ep, resolve_by_ep}`)로 교체, 조회는 `idx_world_states_open_threads` GIN | **수정 적용** (REVISION_SPEC §D-2 원문 우선 권장 채택) |
| state 정식 필드 | §2 world_state v1 스키마 원문: `{companion, characters_met[{id,relation,ep,choice_node}], items_invented[{id,name,ep,asset_ref}], places_visited[], open_threads[…], mood_pref{gacs[4]}, safety_flags[]}` | 0024 `state jsonb` 컬럼 코멘트에 원문 스키마 전량 명기 | **수정 적용**(초안의 "관계·아이템·지명·단짝 + last_event_id" 약술을 원문으로 교체) |
| 이벤트 원 정의 | §2 "상태는 항상 이벤트 스트림(story_choice·episode_completed·expression_saved)에서 리듀서로 재구성 가능해야 한다" — **전용 이벤트 테이블 명세 없음** | game_rounds 스트림 + event_type 판별자(CTX §C-1) | **일치**(구조 유지 — 원문은 스트림 소스를 규정하지 않음) |
| 리듀서 매핑 | §2 원문: "story_choice(prosocial=help) → characters_met.append(relation:helped) + open_threads 생성 규칙표 참조 / expression_saved(T7) → items_invented / episode_completed → places·version++ / 무응답 기본경로 선택 → 상태 변경 없음(중립 처리 — 아이 불이익 금지)" | 0024 world_states 테이블 코멘트에 원문 전사 — E13-2 리듀서 구현 정본 | **수정 적용**(코멘트 명세 추가) |
| Story Smith 3규칙·Guardian 5룰 | §2 원문: "① open_threads 중 resolve_by_ep 도래분은 반드시 회수 ② characters_met 재등장 시 relation과 모순 금지 ③ items_invented는 소품으로 최소 1회/3에피 재등장" / 5룰: "관계 모순 / 사망·퇴장 캐릭터 재등장 / 아이템 존재 모순 / 지명 모순 / 미회수 스레드 방치(>6에피)" | 0024 digest·state 컬럼 코멘트 + §10 `checkContinuity` 규칙 상수의 정본 | **일치**(초안 요지와 동일 — 원문 문구로 코멘트 교체) |
| 중립판 폴백 정의 | §2 "world_state 조회 실패 또는 digest 생성 실패 시 '연속성 중립판' 브리프(재등장 요소 제거)로 강등 — 에피소드는 항상 나간다" | §10 골든테스트 #9·#10 픽스처 정의 + 0024 digest 코멘트 | **수정 적용**(픽스처 기대를 "재등장 요소 제거" 원문 정의로 갱신) |
| 골든테스트 10 원문 | 부록 A 원문 10케이스(①~⑩) | §10 표 1–10행을 원문 인용으로 교체 | **수정 적용** (REVISION_SPEC §D-9) |

**§4 004_hero.sql 전문 + §3 규격**

| 대조 항목 | 원문 인용 (HERO v1.0 §4/§3) | 우리 SQL | 판정 |
|---|---|---|---|
| avatars 인코딩 | §4 `config jsonb not null -- {base, palette, companion, companion_name}` 단일 + `photoreal_check text not null default 'n/a'` + `version int not null default 1` | 0025: 컬럼 분해(base/palette/companion CHECK 3개 = 144 강제) 유지 + photoreal_check·version 컬럼 추가 | **문서화된 델타**(분해 — REVISION_SPEC §D-1 "유지" 확정) + **수정 적용**(photoreal_check·version 추가). name_mode 는 우리 추가 델타(E13-17 3모드 기록) |
| world_states 컬럼·PK | §4 `create table world_states (child_id uuid references children(id), version int not null, state jsonb not null, digest text, updated_at …, primary key (child_id, version))` | 0024: PK(child_id, version) 동일, state/digest 동일 개념 | **일치**(PK·구조) + **문서화된 델타**(created_at 채택, on delete cascade, child_id not null, digest 강화 — 인덱스 2본은 우리 추가) |
| bookshelf | §4 `episode_id uuid references episodes(id), path_taken jsonb not null -- 선택 경로 기록 = 회고 재생 키, cover_url text, personal_assets jsonb default '{}', completed_at …` | 0024: 초안 cover_render_id → **cover_url 교체** + personal_assets 추가. path_taken·completed_at 일치 | **수정 적용**(REVISION_SPEC §D-3). library_video_id·cover_fallback = **문서화된 델타**(발행 미러 접합·폴백 계측 — §3 델타 표) |
| personal_renders | §4 `kind text not null -- name_tts \| avatar_still \| moving_cut \| recap \| birthday, status default 'queued', model_registry_id uuid, cost numeric, fallback_used boolean default false, output_url text` | 0025: 초안 'still' 단일 → 원문 5종 CHECK, status/model_registry_id/cost 추가, fallback→fallback_used·render_url→output_url 원문 명칭으로 개명(0029 뷰 동기 수정) | **수정 적용**(REVISION_SPEC §D-4). slot 컬럼·unique(child_id,episode_id,slot,kind)·status CHECK 값 집합 = **문서화된 델타**(사전조합 해석 키·잡 라이프사이클) |
| episodes·shots alter | §4 `alter table episodes add column format text default 'hero' -- hero \| legacy, avatar_slots jsonb default '[]', companion_slots jsonb default '[]'; alter table shots add column personalizable boolean default false;` | 0027: format·avatar_slots·companion_slots·personalizable 전부 생성 컬럼으로 병합(+not null·CHECK 강화) | **수정 적용**(format·personalizable 추가 — REVISION_SPEC §D-5). alter→create 병합은 파일 순서상 필연(§2) |
| 슬롯 형식 | §3 원문 "episodes.avatar_slots = [{shot_id, kind: still\|moving, duration_s, fallback_shot_id}], companion_slots 동일. **모든 slot은 fallback 필수**" | 0027 avatar_slots 코멘트를 초안 가정 `[{slot, node_id, fallback_url}]` 에서 원문 형식으로 교체 | **수정 적용** |
| RLS/인덱스/트리거 지시 | §4 원문에 없음 | 우리: 전 테이블 RLS enable + owner-select/service-role-write, 인덱스 부여 | **문서화된 델타**(기존 레포 컨벤션 — §1 제약 #1·0017 §5) |
| §5 API 4종 | §5 원문 ①PUT avatar ②GET world-state ③GET bookshelf ④POST /internal/renders/personal (SLA: still<2m, moving<15m, recap<60m) | §12 API 인벤토리 신설 — Next.js route 매핑 + 0025 SLA 코멘트. bookshelf 응답의 `cover_url` 필드가 0024 컬럼과 1:1(cover_url 교체 판정의 교차 근거) | **수정 적용**(§12 신설 — REVISION_SPEC §D-6) |
| Phase B 계측 1:1 | 플레이테스트 v2.1 §6 과업 6: "①키오스크 2스텝 ②A0(이름 3모드 무작위) ③입장 여행 10분 ④CP0→CP1 ⑤작업실 탭 배치 ⑥회고 재생 선택. 관찰 코딩 시트: 완료/보조요청/이탈시점/발화. 합격선 = 시뮬 예측 ±10%p" | 0029 payload 대응: ①step_companion_select/step_palette_select ②naming_mode_used{mode,+retries} ④cp_timeout{node,lead_shown}·passive_first_cp{node} ⑤tap_miss{x,y} ⑥replay_view{bookshelf_id} / 보조요청=assist_needed{context} / 이탈시점=session_fatigue_exit{elapsed_min} | **일치**(1:1 매핑) + **수정 적용**(assist_needed 정의 보강 — §9, 플레이테스트 v2.1 §5 원문) |

**C6 원본 PDF 대조 (2026-07-05 수령·완료)**

| 대조 항목 | 원문 (C6 v1.0) | 우리 측 | 판정 |
|---|---|---|---|
| §10.1 마이그레이션 SQL | `001_c6_growth_map.sql` 원문: c6_axes(id/name_ko/world_region/parent_label/child_label/description), story_seeds(age_band **int4range**…), library_videos·game_rounds alter(axis_id/story_seed_id/thinking_tool/world_region/elapsed_ms/hint_count/retry_count/response_payload), child_growth_profiles(current_level numeric default 50…PK(child_id,axis_id)), recommendation_logs | kindy-web `0023_c6_growth_map.sql` (기적용·상속) | **일치** — 증류판 경유 이식이 원문과 동등함을 원문으로 재확인 |
| §7.2 축 업데이트 공식 v0.1 | pseudo-code 원문: base=0.30P+0.25Pr+0.20Pe+0.10Pf+0.15T, level=round(100·(0.85·prev/100+0.15·ageAdjusted)), confidenceGain=min(0.08, 0.02+q·0.06) | `src/lib/c6/evidence.ts`(+test) | **일치** |
| §10.2 이벤트 표준 | event_type/child_id/session_id/round_id/axis_id/thinking_tool/story_seed_id/elapsed_ms/hint_count/retry_count/is_correct/response_payload | §9 이벤트 사전 v2의 기반 필드 | **일치** |
| §6 입장 여행 9단계 로그 | 단계별 핵심 로그 원문: start_time/skip_intro, found_count/elapsed_ms/hint_count, rule_switch_success/attempts, accuracy/retry_count, emotion_choice/response_time, selected_answer/confidence_proxy, idea_choice_diversity/novelty_tag, video_completion/quiz_result, recommended_seed_ids/reason_codes | `/play/first-journey` 기구현(01 문서) — **Usability Gate "입장 여행 완주 ≥85%" 판정 계측의 필드 정본** | **일치**(기구현 대조는 R1 W3 E13-16 배선 시 필드명 검증 1회) |
| §12 HITL 검수 6항목 | 세계관/C6 축/생각도구/모리 톤/부모 리포트/문화·정서 안전 — 승인·반려 기준 표 | 03 §9-1 게이트 + E11-2 검수 폼 | **일치** |
| 부록 C 브리프 15필드 | episode_title~HITL_notes 15필드 | 03 §6-1 브리프 스키마 계약(`src/schemas/brief.ts`) — 세션 구조 4필드는 다이아몬드 구조로 대체(문서화된 델타), world_state_digest 추가 | **일치 + 문서화된 델타** |
| §8.1 물방울 브리프 | 8세션 시리즈 원문 | 03 §6-1 재구성 브리프 — 마스터플랜 §1.2 압축 해석과 일치, 잔여 7세션은 에피소드 2~8 소재 백로그 | **일치** |
| §13 타당화 Phase A~F | Phase C 베타 신뢰도(가정 50, 4주)·D 준거·E 예측·F 공정성 | Phase B만 플랜 반영돼 있었음 → 00 §9 타당화 연구 트랙 절 신설(C=R3 베타 통합, D~F=R4+ 연구 트랙) | **수정 적용**(00 문서) |

**대조 후 처리 규칙(존속)**: 향후 문서 개정판 수령 시 동일 절차 — (a) 값·집합 차이 = 초안 미적용 상태면 초안 직접 수정, 적용 후면 `alter ... drop constraint/add constraint` 1파일, (b) 컬럼 추가 = `add column if not exists`, (c) 개명·타입 변경 = `supabase/manual/` + 코드 배포 동기화 창구(불변 ⑥ main 직푸시 금지), (d) CTX §B·§C 확정 결정과 충돌하는 원문은 결정이 우선하며 차이를 본 문서 델타 표에 추기한다.

---

## 12. API 인벤토리 — HERO §5 + 통합마스터플랜 §4.3 ↔ Next.js 경로 매핑

원문 API 계약 9종(HERO v1.0 §5 ①–④ + v1.1 §5 ⑤ + 통합 제품 마스터플랜 §4.3 ①–④)을 kindy-web.v2 Next.js API route 로 매핑한다(REVISION_SPEC §D-6). 구현 컨벤션: 쓰기·민감 조회는 service-role(RLS 우회, 0017 §5 컨벤션), 아이 표면 응답에 점수·등급 노출 금지(불변 ③).

| # | 원문 계약 (인용) | 원천 | Next.js route | 접합점 (이 문서) |
|---|---|---|---|---|
| ① | `PUT /v1/children/{id}/avatar {base, palette, companion, companion_name} → 200 (photoreal_check 자동)` | HERO v1.0 §5 ① | `PUT /api/children/[id]/avatar` | avatars upsert(0025) + version++ + photoreal_check 자동 기록. 저장 <1s(E13-3 AC) |
| ② | `GET /v1/children/{id}/world-state → 최신 스냅샷 (부모 웹 '어떻게 알았나요' 근거에도 사용)` | HERO v1.0 §5 ② | `GET /api/children/[id]/world-state` | `world_states order by version desc limit 1`(idx_world_states_child_latest, 0024) |
| ③ | `GET /v1/children/{id}/bookshelf → [{episode_id, title, cover_url, path_taken, completed_at}]` | HERO v1.0 §5 ③ | `GET /api/children/[id]/bookshelf` | bookshelf(0024) — 응답 `cover_url` 필드가 컬럼과 1:1(§11 cover_url 교체 판정의 교차 근거). title 은 library_videos 미러 조인 |
| ④ | `POST /internal/renders/personal {child_id, kind, episode_id} → 잡 큐 (SLA: still<2m, moving<15m, recap<60m)` | HERO v1.0 §5 ④ | `POST /api/internal/renders/personal` (service-role 인증 전용, 고객 비노출) | personal_renders(0025) status='queued' insert → Inngest 잡(CTX §C-4). SLA 는 0025 테이블 코멘트에 명기 |
| ⑤ | `GET /v1/children/{id}/session-config → {age_band, defaults, holdout_arm, mood_preset} — 아이 앱 부트스트랩 1콜` | HERO v1.1 §5 ⑤ | `GET /api/children/[id]/session-config` (CTX §C-12) | product_defaults(0026) + holdout_assignments(0029) + mood_preset 파생(§10 resolveSessionConfig). 캐시 24h |
| ⑥ | `POST /v1/events (Idempotency-Key 헤더 필수)` — batch(≤100), 멱등키 = (child_id, session_id, round_id), 오프라인 큐 재전송 허용, 응답 202 | 통합마스터플랜 §4.3 ① (+ REVISION_SPEC §D-6 멱등·batch 규약, 유실 <0.1% = 마스터플랜 §4.6 "오프라인 큐잉+재전송") | `POST /api/events` | game_rounds 적재 — event_type 사전은 §9(CHECK 는 0024·0029). 키오스크 익명 이벤트는 기존 `/api/kiosk/events`(0015) 유지 — 두 게이트웨이 분리(비식별 D-8) |
| ⑦ | `GET /v1/children/{id}/reports/weekly?week=2026-W32 — 숫자 점수 미노출(밴드만)` | 통합마스터플랜 §4.3 ② | `GET /api/children/[id]/reports/weekly` | child_growth_profiles(0023)·game_rounds 근거카드 산출(E4-1 placeholder 제거). 응답은 E4-2 금지카피 린터 통과본만(발송 게이트) — 불변 ③ |
| ⑧ | `GET /v1/episodes/{id}/manifest — 분기 그래프 (스튜디오 플랜 부록 A 스키마)` | 통합마스터플랜 §4.3 ③ | `GET /api/episodes/[id]/manifest` | episode_nodes(0027) → 부록 A 직렬화(nodes/options/timeout_default/wait_loop_hls). 미공개 에피소드 403 — published 게이트(0027 미러 계약) |
| ⑨ | `POST /v1/checkout {"plan","child_count"} → {"toss_url"}` · `POST /v1/subscriptions/{id}/cancel → 즉시 접수, {"effective_end":"기간말"} — 1탭, 사유 입력 강제 금지` | 통합마스터플랜 §4.3 ④ | `POST /api/checkout` · `POST /api/subscriptions/[id]/cancel` | subscriptions(0017) + §13 델타: cancel → canceled_at(신청)·cancel_effective_at(기간말) 기록, sync_entitlement() 호출(0017). E1-3 1탭 해지 |

미포함(의도): `003x_parent_web_events`(report_opened 등 부모 웹 이벤트)는 §9 표의 별도 채번 항목 — 이 인벤토리는 원문 계약 9종만 다룬다.

## 13. 003x_commerce_hero.sql — 커머스 델타 (채번 유동, 0030 예상)

통합 제품 마스터플랜 §4.2 의 `003_commerce.sql` 원문을 기존 0017_subscriptions.sql·0018_parent_consents.sql 과 대조해 **부족분만 증축**한다(REVISION_SPEC §D-7). 원문 신설 테이블 2본은 기존물이 커버하므로 만들지 않는다: 원문 `consents` ≈ parent_consents(0018, 버전 3필드가 원문 policy_version 단일보다 강함 — 강화 델타로 유지), 원문 `payments` ≈ purchases(0004/0017, toss 결제 기록 기존 적재처. E1-6 현금영수증·세금계산서의 receipt_url 등 추가 컬럼은 E1-6 티켓에서 판단). 원문 consents 의 `ip inet` 은 **미채택** — 0018 머리 주석 "개인정보 최소화를 위해 IP/user-agent 는 저장하지 않고" 원칙 우선(문서화된 델타, PIPA 최소수집).

| 항목 | 원문 (통합마스터플랜 §4.2) | 기존(0017/0018) | 이 델타 |
|---|---|---|---|
| price_locked | `add column if not exists price_locked int -- 얼리버드 락인가` | 없음(price_krw 만) | 추가 + P-1 정책 주석(마스터플랜 v1.1: ks 경유 한정·12개월 락·200가구 하드캡) |
| cancel_effective_at | `add column if not exists cancel_effective_at timestamptz` | canceled_at(신청 시각)만 존재 | 추가 — E1-3 1탭 해지의 기간말 효력 시각(§12 ⑨ 응답 effective_end) |
| next_billing_notice_sent_at | `add column if not exists next_billing_notice_sent_at timestamptz -- D-3 알림 증적` | 없음 | 추가 — E1-4 결제 D-3 알림 발송 증적 |
| 동의 범위 사전 | consent_type `'guardian_u14' \| 'overseas_transfer' \| 'sensitive_gacs'` | consent_scope 자유 텍스트(default 'child_profile_activity', CHECK 없음) | CHECK 로 값 사전 명세(기존 기본값 포함 4종) — E1-2 PIPA 3동의(법정대리인·국외이전·GACS 민감정보) |
| 철회 경로 | consents `revoked_at timestamptz` | 없음 | 추가 — E1-2 AC "consents 기록+철회 경로" |

```sql
-- 003x_commerce_hero.sql (채번 유동 — 적용 시점의 다음 빈 번호, 0030 예상. §2 채번 규칙)
-- 통합 제품 마스터플랜 §4.2 "003_commerce.sql" 원문 대비 0017/0018 부족분 증축.
-- 원문 consents/payments 테이블은 신설하지 않음 — parent_consents(0018)/purchases(0004/0017) 가 커버(§13 본문).

-- ═══════════════════════════════════════════════════════
-- 1. subscriptions 델타 — §4.2 alter 원문 3컬럼 (E1-3·E1-4·E1-5)
-- ═══════════════════════════════════════════════════════
alter table public.subscriptions
  add column if not exists price_locked int,
  add column if not exists cancel_effective_at timestamptz,
  add column if not exists next_billing_notice_sent_at timestamptz;

comment on column public.subscriptions.price_locked is
  '얼리버드 락인가(원) — E1-5. P-1 정책(통합 마스터플랜 v1.1): ₩19,000 은 도서관 키오스크 QR(ks 파라미터) 경유 가입에만 적용, '
  '12개월 후 정가 전환(무기한 락 금지), 200가구 하드캡. null = 정가 가입.';
comment on column public.subscriptions.cancel_effective_at is
  'E1-3 1탭 해지의 효력 시각(기간말). canceled_at(0017, 해지 신청 시각)과 구분 — §4.3 ④ 응답 {"effective_end":"기간말"} 의 저장 컬럼. '
  '해지 접수 시 sync_entitlement()(0017) 재계산과 한 트랜잭션.';
comment on column public.subscriptions.next_billing_notice_sent_at is
  'E1-4 결제 D-3 알림 발송 증적(§4.2 원문 주석 "D-3 알림 증적"). 배치가 current_period_end - 3일 도달 행에 발송 후 기록 — 재발송 멱등 키.';

-- P-1 200가구 하드캡 카운트·정가 전환 배치용 부분 인덱스.
create index if not exists idx_subscriptions_price_locked
  on public.subscriptions (created_at)
  where price_locked is not null;

-- ═══════════════════════════════════════════════════════
-- 2. parent_consents 델타 — 동의 범위 사전 + 철회 경로 (E1-2 PIPA 3동의)
-- ═══════════════════════════════════════════════════════
alter table public.parent_consents
  add column if not exists revoked_at timestamptz;

alter table public.parent_consents drop constraint if exists parent_consents_scope_check;
alter table public.parent_consents
  add constraint parent_consents_scope_check
  check (consent_scope in ('child_profile_activity', 'guardian_u14', 'overseas_transfer', 'sensitive_gacs'));

comment on column public.parent_consents.consent_scope is
  '동의 범위 사전(통합마스터플랜 §4.2 consent_type 원문): guardian_u14=법정대리인 동의, overseas_transfer=국외이전, '
  'sensitive_gacs=GACS 민감정보(E1-2 3동의 — REVISION_SPEC 표기 gacs_sensitive 와 동일 개념, 정본 §4.2 토큰 채택). '
  'child_profile_activity=기존(0018) 기본 범위. 동의 1건 = 1행 — 3동의는 3행 적재, 철회는 revoked_at 기록(행 삭제 금지 — 증적 보존).';
comment on column public.parent_consents.revoked_at is
  '동의 철회 시각(§4.2 consents.revoked_at 원문, E1-2 "철회 경로"). null = 유효. '
  '철회 후속 처리(수집 중단·30일 삭제 파이프)는 E1-3+D-4 파이프 소관.';
```
