-- Distributed, key-scoped Wenit poll-start scheduler.
--
-- `credential_scope` is an opaque credential identity/key-version label (for
-- example, `wenit-primary-v1`), never an API key or a hash of an API key. Every
-- process and environment sharing one raw Wenit key must use the same scope.
-- The credential itself remains in Secret Manager and is not accepted by any
-- table or function in this migration.

-- ═══════════════════════════════════════════════════════
-- 1. Per-scope cursor and short-lived idempotency receipts
-- ═══════════════════════════════════════════════════════
create table if not exists public.wenit_poll_schedule_scopes (
  credential_scope text primary key
    check (
      char_length(credential_scope) between 1 and 96
      and credential_scope ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$'
    ),
  next_reservation_at timestamptz not null,
  next_claim_at       timestamptz not null,
  updated_at          timestamptz not null,
  expires_at          timestamptz not null,
  constraint wenit_poll_schedule_scopes_expiry_check
    check (expires_at = updated_at + interval '15 minutes')
);

create index if not exists idx_wenit_poll_schedule_scopes_expiry
  on public.wenit_poll_schedule_scopes (expires_at);

comment on table public.wenit_poll_schedule_scopes is
  'Wenit credential의 비밀값/해시가 아닌 opaque key-version scope별 다음 poll 시작 슬롯. 동일 raw key를 공유하는 모든 process/environment는 동일 scope를 써야 하며 API key, prompt, task id, child/user/network 식별자는 저장하지 않는다.';

create table if not exists public.wenit_poll_schedule_reservations (
  credential_scope text not null
    references public.wenit_poll_schedule_scopes(credential_scope)
    on delete restrict,
  reservation_id  uuid not null,
  start_after      timestamptz not null,
  claimed_at       timestamptz,
  reserved_at      timestamptz not null,
  expires_at       timestamptz not null,
  primary key (credential_scope, reservation_id),
  constraint wenit_poll_schedule_reservations_expiry_check
    check (expires_at = reserved_at + interval '15 minutes'),
  constraint wenit_poll_schedule_reservations_horizon_check
    check (
      start_after <= reserved_at + interval '30 seconds'
      and (
        claimed_at is null
        or (
          claimed_at >= start_after
          and claimed_at <= reserved_at + interval '30 seconds'
        )
      )
    )
);

create index if not exists idx_wenit_poll_schedule_reservations_expiry
  on public.wenit_poll_schedule_reservations (expires_at);

comment on table public.wenit_poll_schedule_reservations is
  '15분짜리 scheduler idempotency receipt. opaque scope, 무작위 UUID, 예약/claim 시각만 저장하며 Wenit task/API key/입력은 저장하지 않는다.';

-- ═══════════════════════════════════════════════════════
-- 2. Atomic queue reservation (fixed 1,100 ms reservation spacing)
-- ═══════════════════════════════════════════════════════
create or replace function public.reserve_wenit_poll_start(
  p_credential_scope text,
  p_reservation_id uuid,
  p_earliest_start_at timestamptz,
  p_deadline_at timestamptz
)
returns table (
  acquired boolean,
  start_after timestamptz,
  reservation_replay boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_next_reservation_at timestamptz;
  v_start_after timestamptz;
  v_existing_start_after timestamptz;
  v_spacing constant interval := interval '1100 milliseconds';
  v_ttl constant interval := interval '15 minutes';
begin
  if p_credential_scope is null
    or char_length(p_credential_scope) < 1
    or char_length(p_credential_scope) > 96
    or p_credential_scope !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$'
    or p_reservation_id is null
    or p_earliest_start_at is null
    or not pg_catalog.isfinite(p_earliest_start_at)
    or p_deadline_at is null
    or not pg_catalog.isfinite(p_deadline_at)
  then
    raise exception using errcode = '22023', message = 'WENIT_POLL_SCHEDULER_INVALID_REQUEST';
  end if;

  -- One transaction at a time may reserve a slot for a credential scope.
  -- Hash collisions only reduce throughput; they cannot reduce spacing.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'kindy:wenit-poll-scheduler:' || p_credential_scope,
      0
    )
  );
  v_now := pg_catalog.clock_timestamp();

  -- The application deadline is 15 seconds. A small clock-skew allowance is
  -- accepted at this trust boundary, but the RPC can never reserve a distant
  -- future slot that pins a credential scope indefinitely.
  if p_deadline_at > v_now + interval '30 seconds' then
    raise exception using errcode = '22023', message = 'WENIT_POLL_SCHEDULER_INVALID_HORIZON';
  end if;

  if p_deadline_at <= v_now or p_earliest_start_at >= p_deadline_at then
    return query select false, null::timestamptz, false;
    return;
  end if;

  select reservations.start_after
    into v_existing_start_after
    from public.wenit_poll_schedule_reservations as reservations
   where reservations.credential_scope = p_credential_scope
     and reservations.reservation_id = p_reservation_id
     and reservations.expires_at > v_now;

  if found then
    if v_existing_start_after >= p_deadline_at then
      return query select false, null::timestamptz, false;
    else
      return query select true, v_existing_start_after, true;
    end if;
    return;
  end if;

  -- An expired same-id receipt may still exist until bounded cleanup runs.
  delete from public.wenit_poll_schedule_reservations as reservations
   where reservations.credential_scope = p_credential_scope
     and reservations.reservation_id = p_reservation_id
     and reservations.expires_at <= v_now;

  select scopes.next_reservation_at
    into v_next_reservation_at
    from public.wenit_poll_schedule_scopes as scopes
   where scopes.credential_scope = p_credential_scope
   for update;

  v_start_after := greatest(
    v_now,
    p_earliest_start_at,
    coalesce(v_next_reservation_at, v_now)
  );

  -- A rejected reservation must not advance the global cursor.
  if v_start_after >= p_deadline_at then
    return query select false, null::timestamptz, false;
    return;
  end if;

  insert into public.wenit_poll_schedule_scopes (
    credential_scope,
    next_reservation_at,
    next_claim_at,
    updated_at,
    expires_at
  ) values (
    p_credential_scope,
    v_start_after + v_spacing,
    v_now,
    v_now,
    v_now + v_ttl
  )
  on conflict (credential_scope) do update
    set next_reservation_at = excluded.next_reservation_at,
        updated_at = excluded.updated_at,
        expires_at = excluded.expires_at;

  insert into public.wenit_poll_schedule_reservations (
    credential_scope,
    reservation_id,
    start_after,
    claimed_at,
    reserved_at,
    expires_at
  ) values (
    p_credential_scope,
    p_reservation_id,
    v_start_after,
    null,
    v_now,
    v_now + v_ttl
  );

  return query select true, v_start_after, false;
end;
$$;

comment on function public.reserve_wenit_poll_start(
  text, uuid, timestamptz, timestamptz
) is
  'Service-role-only Wenit queue reservation. DB clock plus a scope advisory lock atomically fixes initial slots 1,100 ms apart; application code waits outside PostgreSQL, then the scheduler must call claim_wenit_poll_start immediately before starting GET.';

-- ═══════════════════════════════════════════════════════
-- 3. Atomic actual-start claim after the process-side wait
-- ═══════════════════════════════════════════════════════
create or replace function public.claim_wenit_poll_start(
  p_credential_scope text,
  p_reservation_id uuid,
  p_deadline_at timestamptz
)
returns table (
  claim_status text,
  start_after timestamptz,
  claim_replay boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_reserved_start_after timestamptz;
  v_claimed_at timestamptz;
  v_receipt_expires_at timestamptz;
  v_next_claim_at timestamptz;
  v_candidate timestamptz;
  -- A claim response may arrive up to 250 ms late and still be used by the
  -- adapter. 1,350 ms claim slots therefore preserve 1,100 ms between GET
  -- operation dispatches while a very late initial reservation is re-queued.
  v_claim_spacing constant interval := interval '1350 milliseconds';
  v_ttl constant interval := interval '15 minutes';
begin
  if p_credential_scope is null
    or char_length(p_credential_scope) < 1
    or char_length(p_credential_scope) > 96
    or p_credential_scope !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$'
    or p_reservation_id is null
    or p_deadline_at is null
    or not pg_catalog.isfinite(p_deadline_at)
  then
    raise exception using errcode = '22023', message = 'WENIT_POLL_SCHEDULER_INVALID_CLAIM';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'kindy:wenit-poll-scheduler:' || p_credential_scope,
      0
    )
  );
  v_now := pg_catalog.clock_timestamp();

  if p_deadline_at > v_now + interval '30 seconds' then
    raise exception using errcode = '22023', message = 'WENIT_POLL_SCHEDULER_INVALID_HORIZON';
  end if;
  if p_deadline_at <= v_now then
    return query select 'deadline'::text, null::timestamptz, false;
    return;
  end if;

  select
    reservations.start_after,
    reservations.claimed_at,
    reservations.expires_at
    into
      v_reserved_start_after,
      v_claimed_at,
      v_receipt_expires_at
    from public.wenit_poll_schedule_reservations as reservations
   where reservations.credential_scope = p_credential_scope
     and reservations.reservation_id = p_reservation_id;
  if not found or v_receipt_expires_at <= v_now then
    raise exception using errcode = 'P0002', message = 'WENIT_POLL_SCHEDULER_RESERVATION_NOT_FOUND';
  end if;

  if v_claimed_at is not null then
    if v_claimed_at >= p_deadline_at then
      return query select 'deadline'::text, null::timestamptz, false;
    else
      return query select 'claimed'::text, v_claimed_at, true;
    end if;
    return;
  end if;

  select scopes.next_claim_at
    into strict v_next_claim_at
    from public.wenit_poll_schedule_scopes as scopes
   where scopes.credential_scope = p_credential_scope
   for update;

  v_candidate := greatest(v_now, v_reserved_start_after, v_next_claim_at);
  if v_candidate >= p_deadline_at then
    return query select 'deadline'::text, null::timestamptz, false;
    return;
  end if;

  -- A future claim is not consumed. The process waits outside PostgreSQL and
  -- calls this RPC again at the returned instant, so a late old reservation
  -- moves newer contenders instead of issuing beside them.
  if v_candidate > v_now then
    return query select 'wait'::text, v_candidate, false;
    return;
  end if;

  update public.wenit_poll_schedule_reservations
     set claimed_at = v_now
   where credential_scope = p_credential_scope
     and reservation_id = p_reservation_id;

  update public.wenit_poll_schedule_scopes
     set next_claim_at = v_now + v_claim_spacing,
         updated_at = v_now,
         expires_at = v_now + v_ttl
   where credential_scope = p_credential_scope;

  return query select 'claimed'::text, v_now, false;
end;
$$;

comment on function public.claim_wenit_poll_start(
  text, uuid, timestamptz
) is
  'Service-role-only actual-start claim. Rechecks the shared scope cursor with DB clock immediately after application wait; late contenders receive a new future instant. Claimed starts use 1,350 ms slots plus a 250 ms monotonic claim-to-GET-dispatch ceiling to preserve at least 1,100 ms.';

-- ═══════════════════════════════════════════════════════
-- 4. Bounded operational cleanup
-- ═══════════════════════════════════════════════════════
create or replace function public.cleanup_wenit_poll_scheduler(
  p_batch_size integer default 1000
)
returns table (
  reservations_deleted integer,
  scopes_deleted integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_reservations_deleted integer;
  v_scopes_deleted integer;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 10000 then
    raise exception using errcode = '22023', message = 'WENIT_POLL_SCHEDULER_INVALID_CLEANUP_BATCH';
  end if;

  with targets as (
    select reservations.ctid
      from public.wenit_poll_schedule_reservations as reservations
     where reservations.expires_at <= v_now
     order by reservations.expires_at
     limit p_batch_size
     for update skip locked
  )
  delete from public.wenit_poll_schedule_reservations as reservations
  using targets
  where reservations.ctid = targets.ctid;
  get diagnostics v_reservations_deleted = row_count;

  -- A scope is deleted only after all its receipts are gone. This avoids an
  -- ON DELETE cascade turning one bounded cleanup call into an unbounded one.
  with targets as (
    select scopes.ctid
      from public.wenit_poll_schedule_scopes as scopes
     where scopes.expires_at <= v_now
       and scopes.next_reservation_at <= v_now
       and scopes.next_claim_at <= v_now
       and not exists (
         select 1
           from public.wenit_poll_schedule_reservations as reservations
          where reservations.credential_scope = scopes.credential_scope
       )
     order by scopes.expires_at
     limit p_batch_size
     for update skip locked
  )
  delete from public.wenit_poll_schedule_scopes as scopes
  using targets
  where scopes.ctid = targets.ctid;
  get diagnostics v_scopes_deleted = row_count;

  return query select v_reservations_deleted, v_scopes_deleted;
end;
$$;

comment on function public.cleanup_wenit_poll_scheduler(integer) is
  'Bounded service-role cleanup for expired scheduler receipts and inactive opaque credential scopes; each table deletes at most p_batch_size rows.';

-- ═══════════════════════════════════════════════════════
-- 5. No browser or direct service-role table access
-- ═══════════════════════════════════════════════════════
alter table public.wenit_poll_schedule_scopes enable row level security;
alter table public.wenit_poll_schedule_reservations enable row level security;

revoke all on table
  public.wenit_poll_schedule_scopes,
  public.wenit_poll_schedule_reservations
from public, anon, authenticated, service_role;

revoke execute on function public.reserve_wenit_poll_start(
  text, uuid, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.reserve_wenit_poll_start(
  text, uuid, timestamptz, timestamptz
) to service_role;

revoke execute on function public.claim_wenit_poll_start(
  text, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.claim_wenit_poll_start(
  text, uuid, timestamptz
) to service_role;

revoke execute on function public.cleanup_wenit_poll_scheduler(integer)
from public, anon, authenticated;
grant execute on function public.cleanup_wenit_poll_scheduler(integer)
to service_role;
