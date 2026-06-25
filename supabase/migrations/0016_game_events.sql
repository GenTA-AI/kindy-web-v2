-- 인증된 가정 20분 게임 루프용 세션/라운드 이벤트.
-- 키오스크 익명 이벤트(kiosk_events)와 분리된 child-scoped 홈 데이터.

create table if not exists public.game_sessions (
  id               uuid primary key default gen_random_uuid(),
  child_id         uuid not null references public.children(id) on delete cascade,
  context          text not null default 'home' check (context in ('home','kiosk')),
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  rounds_total     int not null default 0,
  rounds_completed int not null default 0,
  created_at       timestamptz not null default now()
);

create table if not exists public.game_rounds (
  id              uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_sessions(id) on delete cascade,
  child_id        uuid not null references public.children(id) on delete cascade,
  round_index     int not null,
  game_type       text not null,
  difficulty      int not null default 1,
  objective_code  text,
  standard_anchor text,
  score           int,
  max_score       int,
  latency_ms      int,
  retried         boolean not null default false,
  reward_payload  jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_game_sessions_child
  on public.game_sessions (child_id, started_at);

create index if not exists idx_game_rounds_session
  on public.game_rounds (game_session_id, round_index);

create index if not exists idx_game_rounds_child
  on public.game_rounds (child_id, created_at);

alter table public.game_sessions enable row level security;
alter table public.game_rounds enable row level security;

-- game_sessions: child_id -> children.parent_id 소유권.
drop policy if exists game_sessions_select_own on public.game_sessions;
drop policy if exists game_sessions_insert_own on public.game_sessions;
drop policy if exists game_sessions_update_own on public.game_sessions;
drop policy if exists game_sessions_delete_own on public.game_sessions;

create policy game_sessions_select_own
  on public.game_sessions for select
  using (
    exists (
      select 1
      from public.children
      where children.id = game_sessions.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy game_sessions_insert_own
  on public.game_sessions for insert
  with check (
    exists (
      select 1
      from public.children
      where children.id = game_sessions.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy game_sessions_update_own
  on public.game_sessions for update
  using (
    exists (
      select 1
      from public.children
      where children.id = game_sessions.child_id
        and children.parent_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1
      from public.children
      where children.id = game_sessions.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy game_sessions_delete_own
  on public.game_sessions for delete
  using (
    exists (
      select 1
      from public.children
      where children.id = game_sessions.child_id
        and children.parent_id = auth.uid()::text
    )
  );

-- game_rounds: child_id -> children.parent_id 소유권.
drop policy if exists game_rounds_select_own on public.game_rounds;
drop policy if exists game_rounds_insert_own on public.game_rounds;
drop policy if exists game_rounds_update_own on public.game_rounds;
drop policy if exists game_rounds_delete_own on public.game_rounds;

create policy game_rounds_select_own
  on public.game_rounds for select
  using (
    exists (
      select 1
      from public.children
      where children.id = game_rounds.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy game_rounds_insert_own
  on public.game_rounds for insert
  with check (
    exists (
      select 1
      from public.children
      where children.id = game_rounds.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy game_rounds_update_own
  on public.game_rounds for update
  using (
    exists (
      select 1
      from public.children
      where children.id = game_rounds.child_id
        and children.parent_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1
      from public.children
      where children.id = game_rounds.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy game_rounds_delete_own
  on public.game_rounds for delete
  using (
    exists (
      select 1
      from public.children
      where children.id = game_rounds.child_id
        and children.parent_id = auth.uid()::text
    )
  );

comment on table public.game_sessions is '인증된 가정 게임 루프의 아이별 세션. 시작/완료 시각과 라운드 집계를 저장.';
comment on table public.game_rounds is '인증된 가정 게임 루프의 아이별 라운드 이벤트. 정확도, 속도, 난이도, 교육과정 태그, 보상 신호를 저장.';
