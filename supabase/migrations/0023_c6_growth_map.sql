-- C6 v1.0 성장지도 데이터 기반.
-- 축/스토리/성장 프로필/추천 로그를 추가하고 기존 라이브러리/게임 라운드에
-- 성장지도 진단에 필요한 선택 컬럼만 덧붙인다.

create table if not exists public.c6_axes (
  id text primary key,
  name_ko text not null,
  world_region text not null,
  parent_label text not null,
  child_label text not null,
  description text not null
);

create table if not exists public.story_seeds (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  world_region text not null,
  target_axis text references public.c6_axes(id),
  secondary_axis text references public.c6_axes(id),
  thinking_tools text[] not null default '{}',
  subject_domain text not null,
  age_band int4range not null,
  difficulty int not null default 1,
  approval_status text not null default 'draft',
  published boolean not null default false,
  created_at timestamptz not null default now()
);

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
  add column if not exists growth_processed_at timestamptz;

create table if not exists public.child_growth_profiles (
  child_id uuid not null references public.children(id) on delete cascade,
  axis_id text not null references public.c6_axes(id),
  current_level numeric not null default 50,
  confidence numeric not null default 0,
  evidence_count integer not null default 0,
  trend text,
  preferred_activity_type text,
  preferred_character_id text,
  last_evidence_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (child_id, axis_id)
);

create table if not exists public.recommendation_logs (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  recommended_story_seed_id uuid references public.story_seeds(id),
  reason_axis_id text references public.c6_axes(id),
  reason_summary_parent text not null,
  personalization_inputs jsonb not null default '{}'::jsonb,
  accepted boolean,
  completed boolean,
  created_at timestamptz not null default now()
);

create index if not exists idx_game_rounds_child_axis
  on public.game_rounds (child_id, axis_id)
  where axis_id is not null;

create index if not exists idx_child_growth_profiles_child
  on public.child_growth_profiles (child_id);

create index if not exists idx_recommendation_logs_child_created
  on public.recommendation_logs (child_id, created_at);

create index if not exists idx_story_seeds_target_axis_published
  on public.story_seeds (target_axis)
  where published;

alter table public.c6_axes enable row level security;
alter table public.story_seeds enable row level security;
alter table public.child_growth_profiles enable row level security;
alter table public.recommendation_logs enable row level security;

-- c6_axes: 콘텐츠 메타. 모든 클라이언트에서 읽을 수 있다.
drop policy if exists c6_axes_select_all on public.c6_axes;
create policy c6_axes_select_all
  on public.c6_axes for select
  using (true);

-- story_seeds: 승인되어 발행된 콘텐츠 메타만 읽는다.
drop policy if exists story_seeds_select_published_approved on public.story_seeds;
create policy story_seeds_select_published_approved
  on public.story_seeds for select
  using (published = true and approval_status = 'approved');

-- child_growth_profiles: child_id -> children.parent_id 소유권. 쓰기는 service_role 전용.
drop policy if exists child_growth_profiles_select_own on public.child_growth_profiles;
create policy child_growth_profiles_select_own
  on public.child_growth_profiles for select
  using (
    exists (
      select 1
      from public.children
      where children.id = child_growth_profiles.child_id
        and children.parent_id = auth.uid()::text
    )
  );

-- recommendation_logs: child_id -> children.parent_id 소유권. 쓰기는 service_role 전용.
drop policy if exists recommendation_logs_select_own on public.recommendation_logs;
create policy recommendation_logs_select_own
  on public.recommendation_logs for select
  using (
    exists (
      select 1
      from public.children
      where children.id = recommendation_logs.child_id
        and children.parent_id = auth.uid()::text
    )
  );

insert into public.c6_axes (
  id,
  name_ko,
  world_region,
  parent_label,
  child_label,
  description
) values
  (
    'C1_focus_flow',
    '집중·몰입',
    '별빛 언덕',
    '집중·몰입',
    '별빛 씨앗',
    '짧은 활동에 머물고 규칙을 기억하며 힌트 후 다시 시도해요'
  ),
  (
    'C2_observation_inquiry',
    '관찰·탐구',
    '숨은 관찰길',
    '관찰·탐구',
    '반짝 씨앗',
    '작은 차이·질감·소리·변화를 주의 깊게 발견해요'
  ),
  (
    'C3_pattern_problem',
    '패턴·문제해결',
    '물방울 실험터',
    '패턴·문제해결',
    '물방울 씨앗',
    '반복·순서·규칙을 알아차리고 예측하거나 새 규칙을 만들어요'
  ),
  (
    'C4_language_expression',
    '언어·표현',
    '말장원',
    '언어·표현',
    '말 씨앗',
    '단어·그림·소리·문장을 연결하고 자기 방식으로 설명해요'
  ),
  (
    'C5_imagination_analogy',
    '상상·유추',
    '거꾸로 시장',
    '상상·유추',
    '거꾸로 씨앗',
    '서로 다른 것을 연결하고 익숙한 것을 낯설게 봐요'
  ),
  (
    'C6_social_emotional',
    '마음·사회성',
    '마음 호수',
    '마음·사회성',
    '마음 씨앗',
    '캐릭터의 마음과 관점을 알아차리고 돕는 방법을 골라요'
  )
on conflict (id) do nothing;

comment on table public.c6_axes is 'C6 v1.0 성장지도 6축 정본. 콘텐츠/진단/추천/리포트가 공유하는 축 ID와 표면어.';
comment on table public.story_seeds is 'C6 성장지도 기반 스토리 씨앗. 승인 및 발행된 행만 클라이언트에 노출.';
comment on column public.library_videos.story_seed_id is '라이브러리 영상이 기반으로 삼은 C6 스토리 씨앗.';
comment on column public.library_videos.target_axis is '라이브러리 영상의 C6 v1.0 주요 성장축.';
comment on column public.library_videos.thinking_tools is '라이브러리 영상이 자극하는 13 생각도구 키 목록.';
comment on column public.library_videos.world_region is '라이브러리 영상이 속한 C6 성장지도 월드 지역.';
comment on column public.game_rounds.axis_id is '라운드에서 관찰한 C6 v1.0 성장축.';
comment on column public.game_rounds.story_seed_id is '라운드가 실행된 C6 스토리 씨앗.';
comment on column public.game_rounds.thinking_tool is '라운드에서 주로 사용한 13 생각도구 키.';
comment on column public.game_rounds.world_region is '라운드가 속한 C6 성장지도 월드 지역.';
comment on column public.game_rounds.elapsed_ms is '라운드 완료까지 걸린 시간(ms).';
comment on column public.game_rounds.hint_count is '라운드 중 사용된 힌트 횟수.';
comment on column public.game_rounds.retry_count is '라운드 중 다시 시도한 횟수.';
comment on column public.game_rounds.response_payload is '진단 에이전트가 소비하는 라운드별 원시 응답 JSON.';
comment on column public.game_rounds.growth_processed_at is '진단 에이전트의 멱등 처리를 위한 성장 프로필 반영 완료 시각.';
comment on table public.child_growth_profiles is '아이별 C6 성장축 현재 수준, 신뢰도, 증거 개수, 선호 신호.';
comment on table public.recommendation_logs is '아이별 C6 추천 결과와 부모 설명, 개인화 입력, 수락/완료 상태 로그.';
