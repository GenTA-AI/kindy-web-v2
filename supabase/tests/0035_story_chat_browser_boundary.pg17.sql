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

create function pg_temp.expect_select_denied(
  p_role text,
  p_table regclass
) returns void
language plpgsql
as $$
declare
  v_state text;
begin
  execute pg_catalog.format('set local role %I', p_role);
  begin
    execute pg_catalog.format('select * from %s limit 1', p_table);
    raise exception 'EXPECTED SELECT DENIAL for % on %', p_role, p_table;
  exception
    when others then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state <> '42501' then
        raise exception 'EXPECTED 42501, GOT % for % on %', v_state, p_role, p_table;
      end if;
  end;
  execute 'reset role';
exception
  when others then
    execute 'reset role';
    raise;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'world_chat_rooms',
    'world_chat_sessions',
    'world_chat_turns',
    'world_chat_messages',
    'world_chat_events'
  ]
  loop
    perform pg_temp.assert_true(
      not has_table_privilege('anon', 'public.' || v_table, 'select')
        and not has_table_privilege('authenticated', 'public.' || v_table, 'select'),
      v_table || ' must deny direct browser SELECT'
    );
    perform pg_temp.assert_true(
      has_table_privilege('service_role', 'public.' || v_table, 'select'),
      v_table || ' must remain readable by the backend runtime'
    );
    perform pg_temp.assert_true(
      not has_table_privilege('service_role', 'public.' || v_table, 'insert')
        and not has_table_privilege('service_role', 'public.' || v_table, 'update')
        and not has_table_privilege('service_role', 'public.' || v_table, 'delete'),
      v_table || ' runtime role must mutate only through reviewed RPCs'
    );
    perform pg_temp.assert_true(
      not exists (
        select 1
          from pg_catalog.pg_policies
         where schemaname = 'public'
           and tablename = v_table
           and ('authenticated' = any (roles) or 'public' = any (roles))
      ),
      v_table || ' must not retain an authenticated/public SELECT policy'
    );
    perform pg_temp.expect_select_denied(
      'anon',
      pg_catalog.to_regclass('public.' || v_table)
    );
    perform pg_temp.expect_select_denied(
      'authenticated',
      pg_catalog.to_regclass('public.' || v_table)
    );
  end loop;
end;
$$;

select '0035_story_chat_browser_boundary_pg17_ok' as result;
