-- Distributed abuse limits for protected world-chat mutations.
--
-- The limiter keys only authenticated parent, owned room, fixed action, and a
-- client-generated UUID. It deliberately stores no child text, request body,
-- IP address, device identifier, fingerprint, user agent, or arbitrary JSON.

-- ═══════════════════════════════════════════════════════
-- 1. Fixed-window counters and short-lived idempotency receipts
-- ═══════════════════════════════════════════════════════
create table if not exists public.world_chat_parent_rate_limits (
  parent_id         text primary key
                      check (char_length(parent_id) between 1 and 128),
  window_started_at timestamptz not null,
  hit_count         integer not null check (hit_count between 0 and 45),
  expires_at        timestamptz not null,
  updated_at        timestamptz not null,
  constraint world_chat_parent_rate_limits_window_check
    check (expires_at = window_started_at + interval '60 seconds')
);

create index if not exists idx_world_chat_parent_rate_limits_expiry
  on public.world_chat_parent_rate_limits (expires_at);

comment on table public.world_chat_parent_rate_limits is
  '60초당 보호자 전체 world-chat mutation 45회 상한. parent auth subject 외 네트워크·기기 식별자는 저장하지 않는다.';

create table if not exists public.world_chat_room_rate_limits (
  parent_id         text not null
                      check (char_length(parent_id) between 1 and 128),
  room_id           uuid not null
                      references public.world_chat_rooms(id) on delete cascade,
  action            text not null
                      check (action in ('session_open', 'authored_turn')),
  window_started_at timestamptz not null,
  hit_count         integer not null check (hit_count between 0 and 30),
  expires_at        timestamptz not null,
  updated_at        timestamptz not null,
  primary key (parent_id, room_id, action),
  constraint world_chat_room_rate_limits_window_check
    check (expires_at = window_started_at + interval '60 seconds')
);

create index if not exists idx_world_chat_room_rate_limits_expiry
  on public.world_chat_room_rate_limits (expires_at);

comment on table public.world_chat_room_rate_limits is
  '방·행동별 60초 counter. session_open 8회, authored_turn 30회 상한은 consume RPC 내부 서버 상수다.';

create table if not exists public.world_chat_rate_limit_receipts (
  parent_id      text not null
                   check (char_length(parent_id) between 1 and 128),
  room_id        uuid not null
                   references public.world_chat_rooms(id) on delete cascade,
  action         text not null
                   check (action in ('session_open', 'authored_turn')),
  idempotency_key uuid not null,
  consumed_at    timestamptz not null,
  expires_at     timestamptz not null,
  primary key (parent_id, room_id, action, idempotency_key),
  constraint world_chat_rate_limit_receipts_expiry_check
    check (expires_at = consumed_at + interval '15 minutes')
);

create index if not exists idx_world_chat_rate_limit_receipts_expiry
  on public.world_chat_rate_limit_receipts (expires_at);

comment on table public.world_chat_rate_limit_receipts is
  '15분 UUID 멱등 receipt. 동일 session-open/turn 재전송과 동시 요청의 이중 차감을 막으며 요청 내용이나 hash는 저장하지 않는다.';

-- ═══════════════════════════════════════════════════════
-- 2. Atomic two-axis consume
-- ═══════════════════════════════════════════════════════
create or replace function public.consume_world_chat_rate_limit(
  p_parent_id text,
  p_child_id uuid,
  p_room_id uuid,
  p_action text,
  p_idempotency_key uuid
)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  idempotent_replay boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_window interval := interval '60 seconds';
  v_receipt_ttl interval := interval '15 minutes';
  v_parent_limit constant integer := 45;
  v_room_limit integer;
  v_parent_bucket public.world_chat_parent_rate_limits%rowtype;
  v_room_bucket public.world_chat_room_rate_limits%rowtype;
begin
  if p_parent_id is null
    or char_length(p_parent_id) < 1
    or char_length(p_parent_id) > 128
    or p_child_id is null
    or p_room_id is null
    or p_action is null
    or p_action not in ('session_open', 'authored_turn')
    or p_idempotency_key is null
  then
    raise exception using errcode = '22023', message = 'CHAT_RATE_LIMIT_INVALID_REQUEST';
  end if;

  v_room_limit := case p_action
    when 'session_open' then 8
    when 'authored_turn' then 30
  end;

  -- Match mutation RPC lock order: room -> child -> consent. The route/service
  -- already checked these boundaries, but the service-role-only limiter
  -- rechecks them so a direct or raced invocation cannot create foreign keys or
  -- counters for a different family.
  perform 1
    from public.world_chat_rooms as rooms
   where rooms.id = p_room_id
     and rooms.child_id = p_child_id
   for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'CHAT_ROOM_NOT_FOUND';
  end if;

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

  -- One parent-global advisory lock serializes all rooms for that parent. The
  -- second key documents and protects the room/action axis independently. Hash
  -- collisions only over-serialize; they can never increase the allowance.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('kindy:world-chat-rate:parent:' || p_parent_id, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'kindy:world-chat-rate:room:' || p_parent_id || ':' || p_room_id::text || ':' || p_action,
      0
    )
  );
  v_now := clock_timestamp();

  insert into public.world_chat_parent_rate_limits (
    parent_id, window_started_at, hit_count, expires_at, updated_at
  ) values (
    p_parent_id, v_now, 0, v_now + v_window, v_now
  ) on conflict (parent_id) do nothing;

  select buckets.*
    into strict v_parent_bucket
    from public.world_chat_parent_rate_limits as buckets
   where buckets.parent_id = p_parent_id
   for update;

  if v_parent_bucket.expires_at <= v_now then
    update public.world_chat_parent_rate_limits
       set window_started_at = v_now,
           hit_count = 0,
           expires_at = v_now + v_window,
           updated_at = v_now
     where parent_id = p_parent_id
    returning * into v_parent_bucket;
  end if;

  -- Parent-global is an abuse-attempt ceiling, so every request reaching this
  -- point counts, including an idempotent transport replay or a request later
  -- rejected by the narrower room-action bucket. Persisted turn replays are
  -- resolved by the service before this RPC and do not arrive here.
  if v_parent_bucket.hit_count >= v_parent_limit then
    return query
      select
        false,
        greatest(
          1,
          ceil(extract(epoch from (v_parent_bucket.expires_at - v_now)))::integer
        ),
        false;
    return;
  end if;

  update public.world_chat_parent_rate_limits
     set hit_count = hit_count + 1,
         updated_at = v_now
   where parent_id = p_parent_id;

  -- The room-action axis counts logical UUID actions, not retries. This keeps
  -- transport retries from spending the smaller action allowance while the
  -- parent-global attempt ceiling prevents one UUID from becoming a bypass.
  perform 1
    from public.world_chat_rate_limit_receipts as receipts
   where receipts.parent_id = p_parent_id
     and receipts.room_id = p_room_id
     and receipts.action = p_action
     and receipts.idempotency_key = p_idempotency_key
     and receipts.expires_at > v_now;
  if found then
    return query select true, 0, true;
    return;
  end if;

  delete from public.world_chat_rate_limit_receipts as receipts
   where receipts.parent_id = p_parent_id
     and receipts.room_id = p_room_id
     and receipts.action = p_action
     and receipts.idempotency_key = p_idempotency_key
     and receipts.expires_at <= v_now;

  insert into public.world_chat_room_rate_limits (
    parent_id, room_id, action, window_started_at, hit_count, expires_at, updated_at
  ) values (
    p_parent_id, p_room_id, p_action, v_now, 0, v_now + v_window, v_now
  ) on conflict (parent_id, room_id, action) do nothing;

  select buckets.*
    into strict v_room_bucket
    from public.world_chat_room_rate_limits as buckets
   where buckets.parent_id = p_parent_id
     and buckets.room_id = p_room_id
     and buckets.action = p_action
   for update;

  if v_room_bucket.expires_at <= v_now then
    update public.world_chat_room_rate_limits
       set window_started_at = v_now,
           hit_count = 0,
           expires_at = v_now + v_window,
           updated_at = v_now
     where parent_id = p_parent_id
       and room_id = p_room_id
       and action = p_action
    returning * into v_room_bucket;
  end if;

  if v_room_bucket.hit_count >= v_room_limit then
    return query
      select
        false,
        greatest(
          1,
          ceil(extract(epoch from (v_room_bucket.expires_at - v_now)))::integer
        ),
        false;
    return;
  end if;

  update public.world_chat_room_rate_limits
     set hit_count = hit_count + 1,
         updated_at = v_now
   where parent_id = p_parent_id
     and room_id = p_room_id
     and action = p_action;

  insert into public.world_chat_rate_limit_receipts (
    parent_id, room_id, action, idempotency_key, consumed_at, expires_at
  ) values (
    p_parent_id,
    p_room_id,
    p_action,
    p_idempotency_key,
    v_now,
    v_now + v_receipt_ttl
  );

  return query select true, 0, false;
end;
$$;

comment on function public.consume_world_chat_rate_limit(text, uuid, uuid, text, uuid) is
  'Service-role-only atomic limiter. Rechecks room/ownership/active consent; parent-global counts at most 45 transport attempts/min while room session_open 8/min and authored_turn 30/min count unique UUID actions. Same UUID never spends the room-action allowance twice.';

-- ═══════════════════════════════════════════════════════
-- 3. Bounded operational cleanup
-- ═══════════════════════════════════════════════════════
create or replace function public.cleanup_world_chat_rate_limits(
  p_batch_size integer default 1000
)
returns table (
  receipts_deleted integer,
  parent_buckets_deleted integer,
  room_buckets_deleted integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_receipts_deleted integer;
  v_parent_deleted integer;
  v_room_deleted integer;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 10000 then
    raise exception using errcode = '22023', message = 'CHAT_RATE_LIMIT_INVALID_CLEANUP_BATCH';
  end if;

  with targets as (
    select receipts.ctid
    from public.world_chat_rate_limit_receipts as receipts
    where receipts.expires_at <= v_now
    order by receipts.expires_at
    limit p_batch_size
    for update skip locked
  )
  delete from public.world_chat_rate_limit_receipts as receipts
  using targets
  where receipts.ctid = targets.ctid;
  get diagnostics v_receipts_deleted = row_count;

  with targets as (
    select buckets.ctid
    from public.world_chat_parent_rate_limits as buckets
    where buckets.expires_at <= v_now
    order by buckets.expires_at
    limit p_batch_size
    for update skip locked
  )
  delete from public.world_chat_parent_rate_limits as buckets
  using targets
  where buckets.ctid = targets.ctid;
  get diagnostics v_parent_deleted = row_count;

  with targets as (
    select buckets.ctid
    from public.world_chat_room_rate_limits as buckets
    where buckets.expires_at <= v_now
    order by buckets.expires_at
    limit p_batch_size
    for update skip locked
  )
  delete from public.world_chat_room_rate_limits as buckets
  using targets
  where buckets.ctid = targets.ctid;
  get diagnostics v_room_deleted = row_count;

  return query select v_receipts_deleted, v_parent_deleted, v_room_deleted;
end;
$$;

comment on function public.cleanup_world_chat_rate_limits(integer) is
  'Bounded service-only cleanup for expired 15-minute receipts and 60-second buckets. Run repeatedly from an authenticated operator scheduler until all returned counts are below the batch size.';

-- ═══════════════════════════════════════════════════════
-- 4. No browser access; service uses RPCs only
-- ═══════════════════════════════════════════════════════
alter table public.world_chat_parent_rate_limits enable row level security;
alter table public.world_chat_room_rate_limits enable row level security;
alter table public.world_chat_rate_limit_receipts enable row level security;

revoke all on table
  public.world_chat_parent_rate_limits,
  public.world_chat_room_rate_limits,
  public.world_chat_rate_limit_receipts
from public, anon, authenticated, service_role;

grant select on table
  public.world_chat_parent_rate_limits,
  public.world_chat_room_rate_limits,
  public.world_chat_rate_limit_receipts
to service_role;

revoke execute on function public.consume_world_chat_rate_limit(
  text, uuid, uuid, text, uuid
) from public, anon, authenticated;
grant execute on function public.consume_world_chat_rate_limit(
  text, uuid, uuid, text, uuid
) to service_role;

revoke execute on function public.cleanup_world_chat_rate_limits(integer)
from public, anon, authenticated;
grant execute on function public.cleanup_world_chat_rate_limits(integer)
to service_role;
