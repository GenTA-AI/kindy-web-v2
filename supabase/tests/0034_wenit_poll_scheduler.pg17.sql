\set ON_ERROR_STOP on

create function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if p_condition is not true then
    raise exception 'ASSERTION FAILED: %', p_message;
  end if;
end;
$$;

create function pg_temp.expect_sqlstate(
  p_role text,
  p_statement text,
  p_expected_sqlstate text,
  p_message text
) returns void
language plpgsql
as $$
declare
  v_actual_sqlstate text;
begin
  execute pg_catalog.format('set local role %I', p_role);
  begin
    execute p_statement;
    raise exception 'EXPECTED SQLSTATE %: %', p_expected_sqlstate, p_message;
  exception
    when others then
      get stacked diagnostics v_actual_sqlstate = returned_sqlstate;
      if v_actual_sqlstate <> p_expected_sqlstate then
        raise exception 'EXPECTED SQLSTATE %, GOT %: %',
          p_expected_sqlstate, v_actual_sqlstate, p_message;
      end if;
  end;
  execute 'reset role';
exception
  when others then
    execute 'reset role';
    raise;
end;
$$;

select pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.reserve_wenit_poll_start(text,uuid,timestamp with time zone,timestamp with time zone)',
    'execute'
  ),
  'service_role must be able to reserve a poll slot'
);
select pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.claim_wenit_poll_start(text,uuid,timestamp with time zone)',
    'execute'
  ),
  'service_role must be able to claim an actual poll start'
);
select pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.cleanup_wenit_poll_scheduler(integer)',
    'execute'
  ),
  'service_role must be able to run bounded cleanup'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'anon',
    'public.reserve_wenit_poll_start(text,uuid,timestamp with time zone,timestamp with time zone)',
    'execute'
  )
    and not has_function_privilege(
      'authenticated',
      'public.reserve_wenit_poll_start(text,uuid,timestamp with time zone,timestamp with time zone)',
      'execute'
    )
    and not has_function_privilege(
      'anon',
      'public.claim_wenit_poll_start(text,uuid,timestamp with time zone)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.claim_wenit_poll_start(text,uuid,timestamp with time zone)',
      'execute'
    ),
  'browser roles must not execute reservation or actual-start claim RPCs'
);
select pg_temp.assert_true(
  not has_table_privilege(
    'service_role', 'public.wenit_poll_schedule_scopes', 'select'
  )
    and not has_table_privilege(
      'service_role', 'public.wenit_poll_schedule_scopes', 'insert'
    )
    and not has_table_privilege(
      'service_role', 'public.wenit_poll_schedule_reservations', 'select'
    )
    and not has_table_privilege(
      'service_role', 'public.wenit_poll_schedule_reservations', 'insert'
    ),
  'service_role must use SECURITY DEFINER RPCs instead of direct tables'
);
select pg_temp.assert_true(
  (
    select relrowsecurity
      from pg_catalog.pg_class
     where oid = 'public.wenit_poll_schedule_scopes'::regclass
  )
    and (
      select relrowsecurity
        from pg_catalog.pg_class
       where oid = 'public.wenit_poll_schedule_reservations'::regclass
    ),
  'both scheduler tables must have RLS enabled'
);
select pg_temp.assert_true(
  not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name in (
         'wenit_poll_schedule_scopes',
         'wenit_poll_schedule_reservations'
       )
       and (
         column_name ilike '%api_key%'
         or column_name ilike '%prompt%'
         or column_name ilike '%task_id%'
         or column_name ilike '%child%'
         or column_name ilike '%user%'
       )
  ),
  'scheduler persistence must contain no API key, prompt, task, child, or user column'
);
select pg_temp.assert_true(
  (
    select prosecdef
      from pg_catalog.pg_proc
     where oid = 'public.reserve_wenit_poll_start(text,uuid,timestamp with time zone,timestamp with time zone)'::regprocedure
  ),
  'reservation RPC must be SECURITY DEFINER'
);
select pg_temp.assert_true(
  (
    select proconfig @> array['search_path=""']
      from pg_catalog.pg_proc
     where oid = 'public.reserve_wenit_poll_start(text,uuid,timestamp with time zone,timestamp with time zone)'::regprocedure
  ),
  'reservation RPC must pin an empty search_path'
);
select pg_temp.assert_true(
  (
    select prosecdef and proconfig @> array['search_path=""']
      from pg_catalog.pg_proc
     where oid = 'public.claim_wenit_poll_start(text,uuid,timestamp with time zone)'::regprocedure
  ),
  'actual-start claim RPC must be SECURITY DEFINER with empty search_path'
);

select pg_temp.expect_sqlstate(
  'anon',
  $$select * from public.reserve_wenit_poll_start(
    'kindy-test',
    '018f60f7-f9c2-7d61-8e61-8fbffef932a1',
    clock_timestamp(),
    clock_timestamp() + interval '10 seconds'
  )$$,
  '42501',
  'anon reservation must be denied'
);
select pg_temp.expect_sqlstate(
  'anon',
  $$select * from public.claim_wenit_poll_start(
    'kindy-test',
    '018f60f7-f9c2-7d61-8e61-8fbffef932a1',
    clock_timestamp() + interval '10 seconds'
  )$$,
  '42501',
  'anon actual-start claim must be denied'
);
select pg_temp.expect_sqlstate(
  'service_role',
  $$select * from public.wenit_poll_schedule_scopes$$,
  '42501',
  'service_role direct table read must be denied'
);
select pg_temp.expect_sqlstate(
  'service_role',
  $$select * from public.reserve_wenit_poll_start(
    'not/a/safe/scope',
    '018f60f7-f9c2-7d61-8e61-8fbffef932a2',
    clock_timestamp(),
    clock_timestamp() + interval '10 seconds'
  )$$,
  '22023',
  'credential scope grammar must reject secret-like free-form input'
);
select pg_temp.expect_sqlstate(
  'service_role',
  $$select * from public.reserve_wenit_poll_start(
    'kindy-test',
    '018f60f7-f9c2-7d61-8e61-8fbffef932a3',
    clock_timestamp(),
    clock_timestamp() + interval '31 seconds'
  )$$,
  '22023',
  'distant future reservations must be rejected'
);

do $$
declare
  v_first record;
  v_replay record;
  v_second record;
  v_denied record;
  v_third record;
begin
  select * into strict v_first
    from public.reserve_wenit_poll_start(
      'kindy-sequential',
      '018f60f7-f9c2-7d61-8e61-8fbffef932b1',
      clock_timestamp(),
      clock_timestamp() + interval '12 seconds'
    );
  if not v_first.acquired or v_first.reservation_replay then
    raise exception 'ASSERTION FAILED: first reservation must acquire once';
  end if;

  select * into strict v_replay
    from public.reserve_wenit_poll_start(
      'kindy-sequential',
      '018f60f7-f9c2-7d61-8e61-8fbffef932b1',
      clock_timestamp(),
      clock_timestamp() + interval '12 seconds'
    );
  if not v_replay.acquired
    or not v_replay.reservation_replay
    or v_replay.start_after <> v_first.start_after
  then
    raise exception 'ASSERTION FAILED: same reservation UUID must replay the exact slot';
  end if;

  select * into strict v_second
    from public.reserve_wenit_poll_start(
      'kindy-sequential',
      '018f60f7-f9c2-7d61-8e61-8fbffef932b2',
      clock_timestamp(),
      clock_timestamp() + interval '12 seconds'
    );
  if not v_second.acquired
    or v_second.start_after - v_first.start_after < interval '1100 milliseconds'
  then
    raise exception 'ASSERTION FAILED: sequential reserved slots must be at least 1,100 ms apart';
  end if;

  select * into strict v_denied
    from public.reserve_wenit_poll_start(
      'kindy-sequential',
      '018f60f7-f9c2-7d61-8e61-8fbffef932b3',
      v_second.start_after,
      v_second.start_after + interval '1 second'
    );
  if v_denied.acquired or v_denied.start_after is not null then
    raise exception 'ASSERTION FAILED: slot at/after deadline must be denied';
  end if;

  select * into strict v_third
    from public.reserve_wenit_poll_start(
      'kindy-sequential',
      '018f60f7-f9c2-7d61-8e61-8fbffef932b4',
      clock_timestamp(),
      clock_timestamp() + interval '12 seconds'
    );
  if not v_third.acquired
    or v_third.start_after <> v_second.start_after + interval '1100 milliseconds'
  then
    raise exception 'ASSERTION FAILED: denied reservation must not advance the cursor';
  end if;
end;
$$;

-- Eight independent sessions race for one scope. The advisory transaction lock
-- must assign eight unique, globally spaced slots rather than eight "now"s.
create temporary table wenit_concurrency_window as
select
  clock_timestamp() as earliest_start_at,
  clock_timestamp() + interval '15 seconds' as deadline_at;

-- This is the fixed password of the disposable PG17 test container documented
-- with this harness; it is not an application or hosted-database credential.
select dblink_connect('wenit01', 'host=127.0.0.1 dbname=' || current_database() || ' user=supabase_admin password=kindy_test_only');
select dblink_connect('wenit02', 'host=127.0.0.1 dbname=' || current_database() || ' user=supabase_admin password=kindy_test_only');
select dblink_connect('wenit03', 'host=127.0.0.1 dbname=' || current_database() || ' user=supabase_admin password=kindy_test_only');
select dblink_connect('wenit04', 'host=127.0.0.1 dbname=' || current_database() || ' user=supabase_admin password=kindy_test_only');
select dblink_connect('wenit05', 'host=127.0.0.1 dbname=' || current_database() || ' user=supabase_admin password=kindy_test_only');
select dblink_connect('wenit06', 'host=127.0.0.1 dbname=' || current_database() || ' user=supabase_admin password=kindy_test_only');
select dblink_connect('wenit07', 'host=127.0.0.1 dbname=' || current_database() || ' user=supabase_admin password=kindy_test_only');
select dblink_connect('wenit08', 'host=127.0.0.1 dbname=' || current_database() || ' user=supabase_admin password=kindy_test_only');

select dblink_send_query(
  'wenit01',
  format(
    'select * from public.reserve_wenit_poll_start(%L,%L,%L,%L)',
    'kindy-concurrent', '018f60f7-f9c2-7d61-8e61-8fbffef932c1',
    earliest_start_at, deadline_at
  )
) from wenit_concurrency_window;
select dblink_send_query(
  'wenit02',
  format(
    'select * from public.reserve_wenit_poll_start(%L,%L,%L,%L)',
    'kindy-concurrent', '018f60f7-f9c2-7d61-8e61-8fbffef932c2',
    earliest_start_at, deadline_at
  )
) from wenit_concurrency_window;
select dblink_send_query(
  'wenit03',
  format(
    'select * from public.reserve_wenit_poll_start(%L,%L,%L,%L)',
    'kindy-concurrent', '018f60f7-f9c2-7d61-8e61-8fbffef932c3',
    earliest_start_at, deadline_at
  )
) from wenit_concurrency_window;
select dblink_send_query(
  'wenit04',
  format(
    'select * from public.reserve_wenit_poll_start(%L,%L,%L,%L)',
    'kindy-concurrent', '018f60f7-f9c2-7d61-8e61-8fbffef932c4',
    earliest_start_at, deadline_at
  )
) from wenit_concurrency_window;
select dblink_send_query(
  'wenit05',
  format(
    'select * from public.reserve_wenit_poll_start(%L,%L,%L,%L)',
    'kindy-concurrent', '018f60f7-f9c2-7d61-8e61-8fbffef932c5',
    earliest_start_at, deadline_at
  )
) from wenit_concurrency_window;
select dblink_send_query(
  'wenit06',
  format(
    'select * from public.reserve_wenit_poll_start(%L,%L,%L,%L)',
    'kindy-concurrent', '018f60f7-f9c2-7d61-8e61-8fbffef932c6',
    earliest_start_at, deadline_at
  )
) from wenit_concurrency_window;
select dblink_send_query(
  'wenit07',
  format(
    'select * from public.reserve_wenit_poll_start(%L,%L,%L,%L)',
    'kindy-concurrent', '018f60f7-f9c2-7d61-8e61-8fbffef932c7',
    earliest_start_at, deadline_at
  )
) from wenit_concurrency_window;
select dblink_send_query(
  'wenit08',
  format(
    'select * from public.reserve_wenit_poll_start(%L,%L,%L,%L)',
    'kindy-concurrent', '018f60f7-f9c2-7d61-8e61-8fbffef932c8',
    earliest_start_at, deadline_at
  )
) from wenit_concurrency_window;

create temporary table wenit_concurrent_results (
  acquired boolean,
  start_after timestamptz,
  reservation_replay boolean
);
insert into wenit_concurrent_results
select * from dblink_get_result('wenit01')
  as result(acquired boolean, start_after timestamptz, reservation_replay boolean);
insert into wenit_concurrent_results
select * from dblink_get_result('wenit02')
  as result(acquired boolean, start_after timestamptz, reservation_replay boolean);
insert into wenit_concurrent_results
select * from dblink_get_result('wenit03')
  as result(acquired boolean, start_after timestamptz, reservation_replay boolean);
insert into wenit_concurrent_results
select * from dblink_get_result('wenit04')
  as result(acquired boolean, start_after timestamptz, reservation_replay boolean);
insert into wenit_concurrent_results
select * from dblink_get_result('wenit05')
  as result(acquired boolean, start_after timestamptz, reservation_replay boolean);
insert into wenit_concurrent_results
select * from dblink_get_result('wenit06')
  as result(acquired boolean, start_after timestamptz, reservation_replay boolean);
insert into wenit_concurrent_results
select * from dblink_get_result('wenit07')
  as result(acquired boolean, start_after timestamptz, reservation_replay boolean);
insert into wenit_concurrent_results
select * from dblink_get_result('wenit08')
  as result(acquired boolean, start_after timestamptz, reservation_replay boolean);

select pg_temp.assert_true(
  (select count(*) = 8 from wenit_concurrent_results)
    and (select bool_and(acquired) from wenit_concurrent_results)
    and (select not bool_or(reservation_replay) from wenit_concurrent_results),
  'all eight concurrent first-time reservations must acquire exactly once'
);
select pg_temp.assert_true(
  (
    select bool_and(previous_start is null or start_after - previous_start >= interval '1100 milliseconds')
      from (
        select
          start_after,
          lag(start_after) over (order by start_after) as previous_start
        from wenit_concurrent_results
      ) as ordered
  ),
  'all concurrently reserved slots must remain at least 1,100 ms apart'
);
select pg_temp.assert_true(
  (select count(distinct start_after) = 8 from wenit_concurrent_results),
  'concurrent reservations must receive unique slots'
);

-- Adversarial late-wake regression: both queue reservations are already due
-- before these two sessions race. Exactly one may claim "now". The other must
-- be moved to the DB actual-start cursor instead of issuing beside it.
create temporary table wenit_late_claim_window (
  deadline_at timestamptz not null
);
insert into wenit_late_claim_window
values (clock_timestamp() + interval '12 seconds');

select * from public.reserve_wenit_poll_start(
  'kindy-late-claim',
  '018f60f7-f9c2-7d61-8e61-8fbffef932e1',
  clock_timestamp(),
  (select deadline_at from wenit_late_claim_window)
);
select * from public.reserve_wenit_poll_start(
  'kindy-late-claim',
  '018f60f7-f9c2-7d61-8e61-8fbffef932e2',
  clock_timestamp(),
  (select deadline_at from wenit_late_claim_window)
);
select pg_sleep(
  greatest(
    0,
    extract(epoch from (
      (
        select max(start_after)
          from public.wenit_poll_schedule_reservations
         where credential_scope = 'kindy-late-claim'
      ) - clock_timestamp()
    )) + 0.05
  )
);

select dblink_connect('wenitclaim01', 'host=127.0.0.1 dbname=' || current_database() || ' user=supabase_admin password=kindy_test_only');
select dblink_connect('wenitclaim02', 'host=127.0.0.1 dbname=' || current_database() || ' user=supabase_admin password=kindy_test_only');

select dblink_send_query(
  'wenitclaim01',
  format(
    'select * from public.claim_wenit_poll_start(%L,%L,%L)',
    'kindy-late-claim', '018f60f7-f9c2-7d61-8e61-8fbffef932e1', deadline_at
  )
) from wenit_late_claim_window;
select dblink_send_query(
  'wenitclaim02',
  format(
    'select * from public.claim_wenit_poll_start(%L,%L,%L)',
    'kindy-late-claim', '018f60f7-f9c2-7d61-8e61-8fbffef932e2', deadline_at
  )
) from wenit_late_claim_window;

create temporary table wenit_late_claim_results (
  label text not null,
  claim_status text not null,
  start_after timestamptz,
  claim_replay boolean not null
);
insert into wenit_late_claim_results
select 'a', result.* from dblink_get_result('wenitclaim01')
  as result(claim_status text, start_after timestamptz, claim_replay boolean);
insert into wenit_late_claim_results
select 'b', result.* from dblink_get_result('wenitclaim02')
  as result(claim_status text, start_after timestamptz, claim_replay boolean);

select pg_temp.assert_true(
  (select count(*) = 1 from wenit_late_claim_results where claim_status = 'claimed')
    and (select count(*) = 1 from wenit_late_claim_results where claim_status = 'wait')
    and (select not bool_or(claim_replay) from wenit_late_claim_results),
  'late concurrent reservations must produce one actual claim and one DB wait'
);
select pg_temp.assert_true(
  (
    select waiting.start_after - claimed.start_after >= interval '1350 milliseconds'
      from wenit_late_claim_results as waiting
      cross join wenit_late_claim_results as claimed
     where waiting.claim_status = 'wait'
       and claimed.claim_status = 'claimed'
  ),
  'late contender must move at least 1,350 ms after the actual claimed start'
);

do $$
declare
  v_waiting_id uuid;
  v_first_claim_at timestamptz;
  v_wait_until timestamptz;
  v_second_claim record;
  v_replay record;
begin
  select
    case waiting.label
      when 'a' then '018f60f7-f9c2-7d61-8e61-8fbffef932e1'::uuid
      else '018f60f7-f9c2-7d61-8e61-8fbffef932e2'::uuid
    end,
    waiting.start_after,
    claimed.start_after
    into strict v_waiting_id, v_wait_until, v_first_claim_at
    from wenit_late_claim_results as waiting
    cross join wenit_late_claim_results as claimed
   where waiting.claim_status = 'wait'
     and claimed.claim_status = 'claimed';

  perform pg_catalog.pg_sleep(
    greatest(0, extract(epoch from (v_wait_until - clock_timestamp())) + 0.01)
  );
  select * into strict v_second_claim
    from public.claim_wenit_poll_start(
      'kindy-late-claim',
      v_waiting_id,
      (select deadline_at from wenit_late_claim_window)
    );
  if v_second_claim.claim_status <> 'claimed'
    or v_second_claim.claim_replay
    or v_second_claim.start_after - v_first_claim_at < interval '1350 milliseconds'
  then
    raise exception 'ASSERTION FAILED: waiting contender must claim a later actual-start slot';
  end if;

  select * into strict v_replay
    from public.claim_wenit_poll_start(
      'kindy-late-claim',
      v_waiting_id,
      (select deadline_at from wenit_late_claim_window)
    );
  if v_replay.claim_status <> 'claimed'
    or not v_replay.claim_replay
    or v_replay.start_after <> v_second_claim.start_after
  then
    raise exception 'ASSERTION FAILED: same claim UUID must replay its exact claim';
  end if;
end;
$$;

select dblink_disconnect('wenitclaim01');
select dblink_disconnect('wenitclaim02');

select dblink_disconnect('wenit01');
select dblink_disconnect('wenit02');
select dblink_disconnect('wenit03');
select dblink_disconnect('wenit04');
select dblink_disconnect('wenit05');
select dblink_disconnect('wenit06');
select dblink_disconnect('wenit07');
select dblink_disconnect('wenit08');

with fixed_time as (
  select clock_timestamp() - interval '20 minutes' as updated_at
)
insert into public.wenit_poll_schedule_scopes (
  credential_scope, next_reservation_at, next_claim_at, updated_at, expires_at
)
select scope, updated_at, updated_at, updated_at, updated_at + interval '15 minutes'
from fixed_time
cross join unnest(array[
  'kindy-expired-1', 'kindy-expired-2', 'kindy-expired-3'
]) as scope;

with fixed_time as (
  select clock_timestamp() - interval '20 minutes' as reserved_at
)
insert into public.wenit_poll_schedule_reservations (
  credential_scope, reservation_id, start_after, reserved_at, expires_at
)
select
  'kindy-expired-1',
  '018f60f7-f9c2-7d61-8e61-8fbffef932d1',
  reserved_at,
  reserved_at,
  reserved_at + interval '15 minutes'
from fixed_time;

do $$
declare
  v_cleanup record;
begin
  select * into strict v_cleanup
    from public.cleanup_wenit_poll_scheduler(1);
  if v_cleanup.reservations_deleted > 1 or v_cleanup.scopes_deleted > 1 then
    raise exception 'ASSERTION FAILED: cleanup must remain bounded per table';
  end if;
end;
$$;

select '0034_wenit_poll_scheduler_pg17_ok' as result;
