-- Distributed fixed-window abuse limits for the server-rendered chat GET API.
--
-- These read counters are deliberately separate from the 0033 mutation
-- counters: opening a timeline must never consume or relax an authored action
-- budget. Persistence contains only the authenticated parent subject, owned
-- child UUID, a finite server action, and bounded timestamps/counters. It
-- stores no child content, request payload, IP address, device identifier,
-- fingerprint, user agent, or arbitrary JSON.

-- ═══════════════════════════════════════════════════════
-- 1. Separate parent-global and child/action read buckets
-- ═══════════════════════════════════════════════════════
create table if not exists public.world_chat_read_parent_rate_limits (
  parent_id         text primary key
                      check (char_length(parent_id) between 1 and 128),
  window_started_at timestamptz not null,
  hit_count         integer not null check (hit_count between 0 and 90),
  expires_at        timestamptz not null,
  updated_at        timestamptz not null,
  constraint world_chat_read_parent_rate_limits_window_check
    check (expires_at = window_started_at + interval '60 seconds')
);

create index if not exists idx_world_chat_read_parent_rate_limits_expiry
  on public.world_chat_read_parent_rate_limits (expires_at);

comment on table public.world_chat_read_parent_rate_limits is
  '0033 mutation budget과 분리된 보호자 전체 story-chat GET 90회/60초 상한. 네트워크·기기 식별자나 요청 내용은 저장하지 않는다.';

create table if not exists public.world_chat_read_child_rate_limits (
  parent_id         text not null
                      check (char_length(parent_id) between 1 and 128),
  child_id          uuid not null
                      references public.children(id) on delete cascade,
  action            text not null
                      check (action in ('rooms_read', 'messages_read')),
  window_started_at timestamptz not null,
  hit_count         integer not null check (hit_count between 0 and 60),
  expires_at        timestamptz not null,
  updated_at        timestamptz not null,
  primary key (parent_id, child_id, action),
  constraint world_chat_read_child_rate_limits_window_check
    check (expires_at = window_started_at + interval '60 seconds')
);

create index if not exists idx_world_chat_read_child_rate_limits_expiry
  on public.world_chat_read_child_rate_limits (expires_at);

comment on table public.world_chat_read_child_rate_limits is
  '아이·GET 행동별 60초 counter. rooms_read 12회, messages_read 60회 상한은 service-only consume RPC 내부 상수다.';

-- ═══════════════════════════════════════════════════════
-- 2. Atomic two-axis read consume with access recheck
-- ═══════════════════════════════════════════════════════
create or replace function public.consume_world_chat_read_rate_limit(
  p_parent_id text,
  p_child_id uuid,
  p_action text
)
returns table (
  allowed boolean,
  retry_after_seconds integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_window interval := interval '60 seconds';
  v_parent_limit constant integer := 90;
  v_child_limit integer;
  v_parent_bucket public.world_chat_read_parent_rate_limits%rowtype;
  v_child_bucket public.world_chat_read_child_rate_limits%rowtype;
begin
  if p_parent_id is null
    or char_length(p_parent_id) < 1
    or char_length(p_parent_id) > 128
    or p_child_id is null
    or p_action is null
    or p_action not in ('rooms_read', 'messages_read')
  then
    raise exception using errcode = '22023', message = 'CHAT_READ_RATE_LIMIT_INVALID_REQUEST';
  end if;

  v_child_limit := case p_action
    when 'rooms_read' then 12
    when 'messages_read' then 60
  end;

  -- The server route already checked access, but this SECURITY DEFINER RPC
  -- rechecks and row-locks the exact owned child and active activity consent.
  -- A concurrent revocation cannot commit until this consume transaction ends.
  perform 1
    from public.children as children
   where children.id = p_child_id
     and children.parent_id = p_parent_id
   for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'CHAT_CHILD_ACCESS_DENIED';
  end if;

  perform 1
    from public.parent_consents as consents
   where consents.parent_id = p_parent_id
     and consents.child_id = p_child_id
     and consents.consent_scope = 'child_profile_activity'
     and consents.revoked_at is null
   order by consents.created_at desc
   limit 1
   for share;
  if not found then
    raise exception using errcode = '42501', message = 'CHAT_CONSENT_REQUIRED';
  end if;

  -- Parent-global then child/action is the universal lock order. Hash
  -- collisions can only reduce concurrency; they cannot increase allowance.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('kindy:world-chat-read:parent:' || p_parent_id, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'kindy:world-chat-read:child:' || p_parent_id || ':' || p_child_id::text || ':' || p_action,
      0
    )
  );
  v_now := clock_timestamp();

  insert into public.world_chat_read_parent_rate_limits (
    parent_id, window_started_at, hit_count, expires_at, updated_at
  ) values (
    p_parent_id, v_now, 0, v_now + v_window, v_now
  ) on conflict (parent_id) do nothing;

  select buckets.*
    into strict v_parent_bucket
    from public.world_chat_read_parent_rate_limits as buckets
   where buckets.parent_id = p_parent_id
   for update;

  if v_parent_bucket.expires_at <= v_now then
    update public.world_chat_read_parent_rate_limits
       set window_started_at = v_now,
           hit_count = 0,
           expires_at = v_now + v_window,
           updated_at = v_now
     where parent_id = p_parent_id
    returning * into v_parent_bucket;
  end if;

  if v_parent_bucket.hit_count >= v_parent_limit then
    return query
      select
        false,
        greatest(
          1,
          ceil(extract(epoch from (v_parent_bucket.expires_at - v_now)))::integer
        );
    return;
  end if;

  -- Every eligible request reaching the limiter spends the parent-global
  -- attempt budget, including a request denied by the narrower child bucket.
  update public.world_chat_read_parent_rate_limits
     set hit_count = hit_count + 1,
         updated_at = v_now
   where parent_id = p_parent_id;

  insert into public.world_chat_read_child_rate_limits (
    parent_id, child_id, action, window_started_at, hit_count, expires_at, updated_at
  ) values (
    p_parent_id, p_child_id, p_action, v_now, 0, v_now + v_window, v_now
  ) on conflict (parent_id, child_id, action) do nothing;

  select buckets.*
    into strict v_child_bucket
    from public.world_chat_read_child_rate_limits as buckets
   where buckets.parent_id = p_parent_id
     and buckets.child_id = p_child_id
     and buckets.action = p_action
   for update;

  if v_child_bucket.expires_at <= v_now then
    update public.world_chat_read_child_rate_limits
       set window_started_at = v_now,
           hit_count = 0,
           expires_at = v_now + v_window,
           updated_at = v_now
     where parent_id = p_parent_id
       and child_id = p_child_id
       and action = p_action
    returning * into v_child_bucket;
  end if;

  if v_child_bucket.hit_count >= v_child_limit then
    return query
      select
        false,
        greatest(
          1,
          ceil(extract(epoch from (v_child_bucket.expires_at - v_now)))::integer
        );
    return;
  end if;

  update public.world_chat_read_child_rate_limits
     set hit_count = hit_count + 1,
         updated_at = v_now
   where parent_id = p_parent_id
     and child_id = p_child_id
     and action = p_action;

  return query select true, 0;
end;
$$;

comment on function public.consume_world_chat_read_rate_limit(text, uuid, text) is
  'Service-role-only fixed-window GET limiter. Rechecks owned child and active child_profile_activity consent; separate read-global 90/min plus rooms_read 12/min or messages_read 60/min per child.';

-- ═══════════════════════════════════════════════════════
-- 3. Bounded cleanup (operator scheduler is configured separately)
-- ═══════════════════════════════════════════════════════
create or replace function public.cleanup_world_chat_read_rate_limits(
  p_batch_size integer default 1000
)
returns table (
  parent_buckets_deleted integer,
  child_buckets_deleted integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_parent_deleted integer;
  v_child_deleted integer;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 10000 then
    raise exception using errcode = '22023', message = 'CHAT_READ_RATE_LIMIT_INVALID_CLEANUP_BATCH';
  end if;

  with targets as (
    select buckets.ctid
      from public.world_chat_read_child_rate_limits as buckets
     where buckets.expires_at <= v_now
     order by buckets.expires_at
     limit p_batch_size
     for update skip locked
  )
  delete from public.world_chat_read_child_rate_limits as buckets
  using targets
  where buckets.ctid = targets.ctid;
  get diagnostics v_child_deleted = row_count;

  with targets as (
    select buckets.ctid
      from public.world_chat_read_parent_rate_limits as buckets
     where buckets.expires_at <= v_now
     order by buckets.expires_at
     limit p_batch_size
     for update skip locked
  )
  delete from public.world_chat_read_parent_rate_limits as buckets
  using targets
  where buckets.ctid = targets.ctid;
  get diagnostics v_parent_deleted = row_count;

  return query select v_parent_deleted, v_child_deleted;
end;
$$;

comment on function public.cleanup_world_chat_read_rate_limits(integer) is
  'Bounded service-only cleanup for expired 60-second read buckets. Hosted activation must configure and monitor the scheduler separately.';

-- ═══════════════════════════════════════════════════════
-- 4. RPC-only backend access; no browser or direct table surface
-- ═══════════════════════════════════════════════════════
alter table public.world_chat_read_parent_rate_limits enable row level security;
alter table public.world_chat_read_child_rate_limits enable row level security;

revoke all on table
  public.world_chat_read_parent_rate_limits,
  public.world_chat_read_child_rate_limits
from public, anon, authenticated, service_role;

revoke execute on function public.consume_world_chat_read_rate_limit(
  text, uuid, text
) from public, anon, authenticated;
grant execute on function public.consume_world_chat_read_rate_limit(
  text, uuid, text
) to service_role;

revoke execute on function public.cleanup_world_chat_read_rate_limits(integer)
from public, anon, authenticated;
grant execute on function public.cleanup_world_chat_read_rate_limits(integer)
to service_role;
