-- SSOT: docs/plan/02 §6
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
