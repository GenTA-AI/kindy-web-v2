\set ON_ERROR_STOP on

create extension if not exists dblink;

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

create function pg_temp.run_concurrent_read_consumes(
  p_connection_prefix text,
  p_request_count integer,
  p_first_child_id uuid,
  p_second_child_id uuid,
  p_first_child_count integer,
  p_action text
) returns table (
  allowed_count integer,
  denied_count integer
)
language plpgsql
as $$
declare
  v_connection_name text;
  v_connection_string text := pg_catalog.format(
    'dbname=%L host=%L port=%L',
    current_database(),
    current_setting('unix_socket_directories'),
    current_setting('port')
  );
  v_child_id uuid;
  v_result record;
  v_allowed integer := 0;
  v_denied integer := 0;
begin
  if p_request_count < 1
    or p_request_count > 92
    or p_first_child_count < 0
    or p_first_child_count > p_request_count
  then
    raise exception 'invalid concurrent harness shape';
  end if;

  -- Open every connection and dispatch every query before collecting any
  -- result. The advisory-lock implementation must serialize these overlapping
  -- transactions without admitting more than either fixed-window ceiling.
  for v_index in 1..p_request_count loop
    v_connection_name := p_connection_prefix || v_index::text;
    v_child_id := case
      when v_index <= p_first_child_count then p_first_child_id
      else p_second_child_id
    end;
    perform public.dblink_connect(v_connection_name, v_connection_string);
    perform public.dblink_exec(v_connection_name, 'set role service_role');
    perform public.dblink_send_query(
      v_connection_name,
      pg_catalog.format(
        'select * from public.consume_world_chat_read_rate_limit(%L,%L,%L)',
        'parent.read.pg17',
        v_child_id,
        p_action
      )
    );
  end loop;

  for v_index in 1..p_request_count loop
    v_connection_name := p_connection_prefix || v_index::text;
    select result.* into strict v_result
      from public.dblink_get_result(v_connection_name)
        as result(allowed boolean, retry_after_seconds integer);
    if v_result.allowed then
      v_allowed := v_allowed + 1;
      if v_result.retry_after_seconds <> 0 then
        raise exception 'allowed concurrent result has retry delay';
      end if;
    else
      v_denied := v_denied + 1;
      if v_result.retry_after_seconds not between 1 and 60 then
        raise exception 'denied concurrent result has invalid retry delay';
      end if;
    end if;
    perform public.dblink_disconnect(v_connection_name);
  end loop;

  return query select v_allowed, v_denied;
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
    'public.consume_world_chat_read_rate_limit(text,uuid,text)',
    'execute'
  )
    and not has_function_privilege(
      'anon',
      'public.consume_world_chat_read_rate_limit(text,uuid,text)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.consume_world_chat_read_rate_limit(text,uuid,text)',
      'execute'
    ),
  'only service_role may execute the read consume RPC'
);

select pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.cleanup_world_chat_read_rate_limits(integer)',
    'execute'
  )
    and not has_function_privilege(
      'anon',
      'public.cleanup_world_chat_read_rate_limits(integer)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.cleanup_world_chat_read_rate_limits(integer)',
      'execute'
    ),
  'only service_role may execute bounded read cleanup'
);

select pg_temp.assert_true(
  (
    select prosecdef and proconfig @> array['search_path=""']
      from pg_catalog.pg_proc
     where oid = 'public.consume_world_chat_read_rate_limit(text,uuid,text)'::regprocedure
  ),
  'read consume RPC must be SECURITY DEFINER with empty search_path'
);

select pg_temp.assert_true(
  not has_table_privilege(
    'anon', 'public.world_chat_read_parent_rate_limits', 'select'
  )
    and not has_table_privilege(
      'authenticated', 'public.world_chat_read_parent_rate_limits', 'select'
    )
    and not has_table_privilege(
      'service_role', 'public.world_chat_read_parent_rate_limits', 'select'
    )
    and not has_table_privilege(
      'anon', 'public.world_chat_read_child_rate_limits', 'select'
    )
    and not has_table_privilege(
      'authenticated', 'public.world_chat_read_child_rate_limits', 'select'
    )
    and not has_table_privilege(
      'service_role', 'public.world_chat_read_child_rate_limits', 'select'
    ),
  'read counter tables must be RPC-only, including for service_role'
);

select pg_temp.assert_true(
  (
    select relrowsecurity
      from pg_catalog.pg_class
     where oid = 'public.world_chat_read_parent_rate_limits'::regclass
  )
    and (
      select relrowsecurity
        from pg_catalog.pg_class
       where oid = 'public.world_chat_read_child_rate_limits'::regclass
    ),
  'both read limiter tables must have RLS enabled'
);

select pg_temp.assert_true(
  not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name in (
         'world_chat_read_parent_rate_limits',
         'world_chat_read_child_rate_limits'
       )
       and (
         column_name ilike any (array[
           '%ip%', '%device%', '%fingerprint%', '%user_agent%', '%raw%',
           '%payload%', '%request%', '%body%', '%content%'
         ])
         or data_type in ('json', 'jsonb')
       )
  ),
  'read limiter persistence must contain no request, content, network, device, or JSON data'
);

insert into public.children (id, parent_id, name, age)
values
  ('36000000-0000-4000-8000-000000000001', 'parent.read.pg17', 'A', 8),
  ('36000000-0000-4000-8000-000000000002', 'parent.read.pg17', 'B', 8),
  ('36000000-0000-4000-8000-000000000003', 'parent.read.pg17', 'C', 8),
  ('36000000-0000-4000-8000-000000000004', 'parent.other.pg17', 'D', 8);

insert into public.parent_consents (
  parent_id,
  child_id,
  consent_scope,
  terms_version,
  privacy_version,
  child_consent_version
) values
  (
    'parent.read.pg17', '36000000-0000-4000-8000-000000000001',
    'child_profile_activity', 'pg17', 'pg17', 'pg17'
  ),
  (
    'parent.read.pg17', '36000000-0000-4000-8000-000000000002',
    'child_profile_activity', 'pg17', 'pg17', 'pg17'
  ),
  (
    'parent.read.pg17', '36000000-0000-4000-8000-000000000003',
    'child_profile_activity', 'pg17', 'pg17', 'pg17'
  );

select pg_temp.expect_sqlstate(
  'anon',
  $$select * from public.consume_world_chat_read_rate_limit(
    'parent.read.pg17',
    '36000000-0000-4000-8000-000000000001',
    'rooms_read'
  )$$,
  '42501',
  'anon must not execute the read limiter'
);
select pg_temp.expect_sqlstate(
  'service_role',
  $$select * from public.world_chat_read_parent_rate_limits$$,
  '42501',
  'service_role must not read limiter tables directly'
);
select pg_temp.expect_sqlstate(
  'service_role',
  $$select * from public.consume_world_chat_read_rate_limit(
    'parent.read.pg17',
    '36000000-0000-4000-8000-000000000001',
    'free_form_action'
  )$$,
  '22023',
  'action must be one of the two fixed server constants'
);
select pg_temp.expect_sqlstate(
  'service_role',
  $$select * from public.consume_world_chat_read_rate_limit(
    'parent.other.pg17',
    '36000000-0000-4000-8000-000000000001',
    'rooms_read'
  )$$,
  'P0002',
  'RPC must recheck parent ownership'
);
select pg_temp.expect_sqlstate(
  'service_role',
  $$select * from public.consume_world_chat_read_rate_limit(
    'parent.other.pg17',
    '36000000-0000-4000-8000-000000000004',
    'messages_read'
  )$$,
  '42501',
  'RPC must require active child_profile_activity consent'
);

truncate table
  public.world_chat_read_child_rate_limits,
  public.world_chat_read_parent_rate_limits;

do $$
declare
  v_result record;
begin
  for v_index in 1..12 loop
    select * into strict v_result
      from public.consume_world_chat_read_rate_limit(
        'parent.read.pg17',
        '36000000-0000-4000-8000-000000000001',
        'rooms_read'
      );
    if not v_result.allowed or v_result.retry_after_seconds <> 0 then
      raise exception 'ASSERTION FAILED: rooms_read request % of 12 must pass', v_index;
    end if;
  end loop;

  select * into strict v_result
    from public.consume_world_chat_read_rate_limit(
      'parent.read.pg17',
      '36000000-0000-4000-8000-000000000001',
      'rooms_read'
    );
  if v_result.allowed or v_result.retry_after_seconds not between 1 and 60 then
    raise exception 'ASSERTION FAILED: 13th rooms_read must be denied with bounded retry';
  end if;
end;
$$;

truncate table
  public.world_chat_read_child_rate_limits,
  public.world_chat_read_parent_rate_limits;

do $$
declare
  v_result record;
begin
  for v_index in 1..60 loop
    select * into strict v_result
      from public.consume_world_chat_read_rate_limit(
        'parent.read.pg17',
        '36000000-0000-4000-8000-000000000001',
        'messages_read'
      );
    if not v_result.allowed then
      raise exception 'ASSERTION FAILED: messages_read request % of 60 must pass', v_index;
    end if;
  end loop;

  select * into strict v_result
    from public.consume_world_chat_read_rate_limit(
      'parent.read.pg17',
      '36000000-0000-4000-8000-000000000001',
      'messages_read'
    );
  if v_result.allowed or v_result.retry_after_seconds not between 1 and 60 then
    raise exception 'ASSERTION FAILED: 61st messages_read must be denied';
  end if;
end;
$$;

truncate table
  public.world_chat_read_child_rate_limits,
  public.world_chat_read_parent_rate_limits;

do $$
declare
  v_result record;
begin
  for v_index in 1..60 loop
    perform * from public.consume_world_chat_read_rate_limit(
      'parent.read.pg17',
      '36000000-0000-4000-8000-000000000001',
      'messages_read'
    );
  end loop;
  for v_index in 1..30 loop
    perform * from public.consume_world_chat_read_rate_limit(
      'parent.read.pg17',
      '36000000-0000-4000-8000-000000000002',
      'messages_read'
    );
  end loop;

  select * into strict v_result
    from public.consume_world_chat_read_rate_limit(
      'parent.read.pg17',
      '36000000-0000-4000-8000-000000000003',
      'rooms_read'
    );
  if v_result.allowed or v_result.retry_after_seconds not between 1 and 60 then
    raise exception 'ASSERTION FAILED: 91st parent-global read must be denied';
  end if;
end;
$$;

-- The same ceilings must hold when requests overlap, not only sequentially.
truncate table
  public.world_chat_read_child_rate_limits,
  public.world_chat_read_parent_rate_limits;

select pg_temp.assert_true(
  concurrent.allowed_count = 12 and concurrent.denied_count = 8,
  'twenty overlapping rooms_read calls must admit exactly twelve'
)
from pg_temp.run_concurrent_read_consumes(
  'read_rooms_',
  20,
  '36000000-0000-4000-8000-000000000001',
  '36000000-0000-4000-8000-000000000001',
  20,
  'rooms_read'
) as concurrent;

truncate table
  public.world_chat_read_child_rate_limits,
  public.world_chat_read_parent_rate_limits;

select pg_temp.assert_true(
  concurrent.allowed_count = 60 and concurrent.denied_count = 20,
  'eighty overlapping messages_read calls must admit exactly sixty'
)
from pg_temp.run_concurrent_read_consumes(
  'read_messages_',
  80,
  '36000000-0000-4000-8000-000000000001',
  '36000000-0000-4000-8000-000000000001',
  80,
  'messages_read'
) as concurrent;

truncate table
  public.world_chat_read_child_rate_limits,
  public.world_chat_read_parent_rate_limits;

select pg_temp.assert_true(
  concurrent.allowed_count = 90 and concurrent.denied_count = 2,
  'ninety-two overlapping reads across two children must admit exactly ninety globally'
)
from pg_temp.run_concurrent_read_consumes(
  'read_parent_',
  92,
  '36000000-0000-4000-8000-000000000001',
  '36000000-0000-4000-8000-000000000002',
  46,
  'messages_read'
) as concurrent;

-- Expiring the global window must admit the next request with a fresh bucket.
update public.world_chat_read_parent_rate_limits
   set window_started_at = statement_timestamp() - interval '61 seconds',
       expires_at = statement_timestamp() - interval '1 second',
       updated_at = statement_timestamp() - interval '61 seconds'
 where parent_id = 'parent.read.pg17';

do $$
declare
  v_result record;
begin
  select * into strict v_result
    from public.consume_world_chat_read_rate_limit(
      'parent.read.pg17',
      '36000000-0000-4000-8000-000000000003',
      'rooms_read'
    );
  if not v_result.allowed or v_result.retry_after_seconds <> 0 then
    raise exception 'ASSERTION FAILED: expired parent window must reset';
  end if;
end;
$$;

-- A consent revoked after prior successful reads is denied by the RPC recheck.
update public.parent_consents
   set revoked_at = clock_timestamp()
 where parent_id = 'parent.read.pg17'
   and child_id = '36000000-0000-4000-8000-000000000003'
   and consent_scope = 'child_profile_activity';

select pg_temp.expect_sqlstate(
  'service_role',
  $$select * from public.consume_world_chat_read_rate_limit(
    'parent.read.pg17',
    '36000000-0000-4000-8000-000000000003',
    'rooms_read'
  )$$,
  '42501',
  'revoked consent must fail the consume-time recheck'
);

update public.world_chat_read_child_rate_limits
   set window_started_at = statement_timestamp() - interval '61 seconds',
       expires_at = statement_timestamp() - interval '1 second',
       updated_at = statement_timestamp() - interval '61 seconds';
update public.world_chat_read_parent_rate_limits
   set window_started_at = statement_timestamp() - interval '61 seconds',
       expires_at = statement_timestamp() - interval '1 second',
       updated_at = statement_timestamp() - interval '61 seconds';

do $$
declare
  v_cleanup record;
begin
  select * into strict v_cleanup
    from public.cleanup_world_chat_read_rate_limits(1000);
  if v_cleanup.parent_buckets_deleted < 1
    or v_cleanup.child_buckets_deleted < 1
    or exists (select 1 from public.world_chat_read_parent_rate_limits)
    or exists (select 1 from public.world_chat_read_child_rate_limits)
  then
    raise exception 'ASSERTION FAILED: bounded cleanup must delete all expired test buckets';
  end if;
end;
$$;

select '0036_world_chat_read_rate_limits_pg17_ok' as result;
