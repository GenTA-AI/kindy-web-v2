-- SSOT: docs/plan/02 §3
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
