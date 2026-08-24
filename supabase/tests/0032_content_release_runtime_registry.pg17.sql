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
  not pg_has_role('service_role', 'kindy_content_release_publisher', 'member'),
  'service_role must not be a publisher member'
);
select pg_temp.assert_true(
  not pg_has_role('service_role', 'kindy_content_release_operator', 'member'),
  'service_role must not be an operator member'
);
select pg_temp.assert_true(
  pg_has_role('kindy_content_release_storage_reader', 'anon', 'member')
    and pg_has_role(
      'authenticator', 'kindy_content_release_storage_reader', 'member'
    ),
  'Supabase Storage custom reader role membership must follow the hosted role pattern'
);
select pg_temp.assert_true(
  to_regprocedure(
    'public.record_verified_content_release(text,text,text,text,text,text,bigint,text,text,bigint,text,text,timestamptz,timestamptz)'
  ) is null,
  'misleading legacy record RPC must not exist'
);
select pg_temp.assert_true(
  to_regprocedure(
    'public.is_world_chat_release_pin_available(text,text,text,text)'
  ) is null,
  'the channel-less availability overload must not exist'
);

select pg_temp.assert_true(
  not has_function_privilege(
    'service_role',
    'public.record_application_verified_content_release_attestation(text,text,text,text,text,text,bigint,text,text,bigint,text,text,timestamptz,timestamptz)',
    'execute'
  ),
  'service_role must not record an attestation'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'service_role', 'public.activate_content_release(text)', 'execute'
  ),
  'service_role must not activate a release'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'service_role', 'public.revoke_content_release(text)', 'execute'
  ),
  'service_role must not revoke a release'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'service_role',
    'public.raise_content_release_minimum_version(text,text,text)',
    'execute'
  ),
  'service_role must not raise a release floor'
);
select pg_temp.assert_true(
  has_function_privilege(
    'kindy_content_release_publisher',
    'public.record_application_verified_content_release_attestation(text,text,text,text,text,text,bigint,text,text,bigint,text,text,timestamptz,timestamptz)',
    'execute'
  ),
  'publisher must be able to record an application-verified attestation'
);
select pg_temp.assert_true(
  has_function_privilege(
    'kindy_content_release_operator',
    'public.activate_content_release(text)',
    'execute'
  ),
  'operator must be able to activate a release'
);
select pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.is_world_chat_release_pin_available(text,text,text,text,text)',
    'execute'
  ),
  'runtime must be able to call the read-only availability hook'
);
select pg_temp.assert_true(
  has_table_privilege('service_role', 'public.content_release_registry', 'select')
    and not has_table_privilege('service_role', 'public.content_release_registry', 'insert')
    and not has_table_privilege('service_role', 'public.content_release_registry', 'update')
    and not has_table_privilege('service_role', 'public.content_release_registry', 'delete'),
  'runtime registry table privilege must be SELECT-only'
);
select pg_temp.assert_true(
  not has_table_privilege(
    'kindy_content_release_publisher',
    'public.content_release_registry',
    'insert,update,delete'
  ),
  'publisher must not mutate registry tables directly'
);

insert into public.content_release_trusted_keys (
  key_id,
  public_key_spki_pem,
  allowed_channels,
  valid_from,
  valid_until
) values (
  'key.pg17',
  '-----BEGIN PUBLIC KEY-----XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX-----END PUBLIC KEY-----',
  array['staging', 'production'],
  now() - interval '1 day',
  now() + interval '1 day'
);

select pg_temp.expect_sqlstate(
  'service_role',
  $$select public.record_application_verified_content_release_attestation(
    'release.denied', 'experience.pg17', '1.0.0', 'staging', repeat('0', 64),
    repeat('1', 64), 100,
    'releases/experience.pg17/1.0.0/content-release.json', repeat('2', 64), 200,
    'releases/experience.pg17/1.0.0/experience-graph.json', 'key.pg17',
    now() - interval '1 minute', now()
  )$$,
  '42501',
  'SET ROLE service_role mutation RPC must be denied'
);

set role kindy_content_release_publisher;
select public.record_application_verified_content_release_attestation(
  'release.staging',
  'experience.pg17',
  '1.0.0',
  'staging',
  repeat('a', 64),
  repeat('b', 64),
  100,
  'releases/experience.pg17/1.0.0/content-release.json',
  repeat('c', 64),
  200,
  'releases/experience.pg17/1.0.0/experience-graph.json',
  'key.pg17',
  now() - interval '1 minute',
  now()
);
select public.record_application_verified_content_release_attestation(
  'release.production',
  'experience.pg17',
  '1.0.1',
  'production',
  repeat('d', 64),
  repeat('e', 64),
  100,
  'releases/experience.pg17/1.0.1/content-release.json',
  repeat('f', 64),
  200,
  'releases/experience.pg17/1.0.1/experience-graph.json',
  'key.pg17',
  now() - interval '1 minute',
  now()
);
reset role;

select pg_temp.assert_true(
  (select count(*) = 2 from public.content_release_registry),
  'publisher calls must persist exactly two verified attestations'
);

select pg_temp.expect_sqlstate(
  'kindy_content_release_publisher',
  $$select public.record_application_verified_content_release_attestation(
    'release.poison', 'experience.pg17', '9007199254740992.0.0', 'staging',
    repeat('3', 64), repeat('4', 64), 100,
    'releases/experience.pg17/9007199254740992.0.0/content-release.json',
    repeat('5', 64), 200,
    'releases/experience.pg17/9007199254740992.0.0/experience-graph.json',
    'key.pg17', now() - interval '1 minute', now()
  )$$,
  '22023',
  'semver components above Number.MAX_SAFE_INTEGER must be rejected'
);
select pg_temp.assert_true(
  not exists (
    select 1 from public.content_release_registry where release_id = 'release.poison'
  ),
  'unsafe semver must not poison the registry'
);

set role kindy_content_release_operator;
select * from public.activate_content_release('release.staging');
select * from public.activate_content_release('release.production');
reset role;

select pg_temp.expect_sqlstate(
  'kindy_content_release_operator',
  $$select public.raise_content_release_minimum_version(
    'experience.pg17', 'staging', '9007199254740992.0.0'
  )$$,
  '22023',
  'unsafe semver floor must be rejected'
);

set role service_role;
select release_id, channel, status from public.content_release_registry order by channel;
select public.is_world_chat_release_pin_available(
  'release.staging', 'experience.pg17', '1.0.0', repeat('a', 64), 'staging'
) as staging_available;
select public.is_world_chat_release_pin_available(
  'release.staging', 'experience.pg17', '1.0.0', repeat('a', 64), 'production'
) as cross_channel_unavailable;
select public.confirm_content_release_runtime_eligibility(
  'release.staging', 'experience.pg17', '1.0.0', repeat('a', 64), 'staging',
  1, 'key.pg17', now()
) as staging_confirmed;
reset role;

select pg_temp.assert_true(
  public.is_world_chat_release_pin_available(
    'release.staging', 'experience.pg17', '1.0.0', repeat('a', 64), 'staging'
  ),
  'exact staging pin must be available'
);
select pg_temp.assert_true(
  not public.is_world_chat_release_pin_available(
    'release.staging', 'experience.pg17', '1.0.0', repeat('a', 64), 'production'
  ),
  'staging pin must not be available through the production channel'
);

insert into public.children (id, parent_id)
values ('10000000-0000-4000-8000-000000000001', 'parent.pg17');
insert into public.parent_consents (parent_id, child_id, consent_scope)
values (
  'parent.pg17',
  '10000000-0000-4000-8000-000000000001',
  'child_profile_activity'
);

insert into public.world_chat_rooms (
  id,
  child_id,
  experience_id,
  release_id,
  release_version,
  release_channel,
  release_manifest_sha256,
  current_node_id
) values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'experience.pg17',
  'release.staging',
  '1.0.0',
  'staging',
  repeat('a', 64),
  'node.start'
), (
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'experience.pg17',
  'release.production',
  '1.0.1',
  'production',
  repeat('d', 64),
  'node.start'
);

select pg_temp.assert_true(
  (
    select count(*) = 2
    from public.world_chat_rooms
    where child_id = '10000000-0000-4000-8000-000000000001'
      and experience_id = 'experience.pg17'
  ),
  'same child and experience must coexist in staging and production rooms'
);

select pg_temp.expect_sqlstate(
  current_user,
  $$update public.world_chat_rooms
    set release_channel = 'production',
        release_id = 'release.production',
        release_version = '1.0.1',
        release_manifest_sha256 = repeat('d', 64)
    where id = '20000000-0000-4000-8000-000000000001'$$,
  '55000',
  'release channel must be immutable even before first open'
);

do $$
declare
  v_first record;
  v_replay record;
  v_resume record;
begin
  select * into v_first
  from public.open_world_chat_session(
    'parent.pg17',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'staging'
  );
  if v_first.resumed_existing or v_first.idempotent_replay
    or v_first.room_status <> 'active'
  then
    raise exception 'first open result is invalid';
  end if;

  select * into v_replay
  from public.open_world_chat_session(
    'parent.pg17',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'staging'
  );
  if not v_replay.resumed_existing or not v_replay.idempotent_replay
    or v_replay.session_id <> v_first.session_id
  then
    raise exception 'same client session replay is invalid';
  end if;

  select * into v_resume
  from public.open_world_chat_session(
    'parent.pg17',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002',
    'staging'
  );
  if not v_resume.resumed_existing or v_resume.idempotent_replay
    or v_resume.session_id <> v_first.session_id
  then
    raise exception 'different client UUID must resume the one open session';
  end if;
end;
$$;

select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.world_chat_sessions
    where room_id = '20000000-0000-4000-8000-000000000001'
      and ended_at is null
  ),
  'room must have exactly one open session'
);

select pg_temp.expect_sqlstate(
  current_user,
  $$update public.world_chat_rooms
    set release_id = 'release.production',
        release_version = '1.0.1',
        release_manifest_sha256 = repeat('d', 64)
    where id = '20000000-0000-4000-8000-000000000001'$$,
  '55000',
  'an opened room release pin must be immutable'
);

select pg_temp.expect_sqlstate(
  current_user,
  $$select * from public.open_world_chat_session(
    'parent.pg17',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    'production'
  )$$,
  '55000',
  'production process must not open a staging room'
);

do $$
declare
  v_session_id uuid;
  v_commit record;
begin
  select id into v_session_id
  from public.world_chat_sessions
  where room_id = '20000000-0000-4000-8000-000000000001'
    and ended_at is null;

  select * into v_commit
  from public.commit_world_chat_authored_turn(
    'parent.pg17', 'staging', 'release.staging', '1.0.0', repeat('a', 64),
    '20000000-0000-4000-8000-000000000001', v_session_id,
    '40000000-0000-4000-8000-000000000001', repeat('6', 64), 0,
    'node.start', 'node.next', 'awaiting_child', 'choice', 'input.one',
    array['child', 'character'], array['child_choice', 'character_text'],
    array['input.one', 'copy.one']
  );
  if v_commit.committed_revision <> 1 or v_commit.idempotent_replay then
    raise exception 'first authored commit is invalid';
  end if;
end;
$$;

set role kindy_content_release_operator;
select public.revoke_content_release('release.staging');
reset role;

select pg_temp.assert_true(
  not public.is_world_chat_release_pin_available(
    'release.staging', 'experience.pg17', '1.0.0', repeat('a', 64), 'staging'
  ),
  'revoked release must become unavailable'
);

select pg_temp.expect_sqlstate(
  current_user,
  $$select * from public.commit_world_chat_authored_turn(
    'parent.pg17', 'staging', 'release.staging', '1.0.0', repeat('a', 64),
    '20000000-0000-4000-8000-000000000001',
    (select id from public.world_chat_sessions
      where room_id = '20000000-0000-4000-8000-000000000001' and ended_at is null),
    '40000000-0000-4000-8000-000000000002', repeat('7', 64), 1,
    'node.next', 'node.end', 'chapter_complete', 'choice', 'input.two',
    array['child'], array['child_choice'], array['input.two']
  )$$,
  '55000',
  'new commit on a revoked release must fail closed'
);

select pg_temp.assert_true(
  (
    select revision = 1 and current_node_id = 'node.next'
    from public.world_chat_rooms
    where id = '20000000-0000-4000-8000-000000000001'
  ),
  'failed revoked commit must not change room revision or cursor'
);

do $$
declare
  v_session_id uuid;
  v_replay record;
begin
  select id into v_session_id
  from public.world_chat_sessions
  where room_id = '20000000-0000-4000-8000-000000000001'
    and ended_at is null;
  select * into v_replay
  from public.commit_world_chat_authored_turn(
    'parent.pg17', 'staging', 'release.staging', '1.0.0', repeat('a', 64),
    '20000000-0000-4000-8000-000000000001', v_session_id,
    '40000000-0000-4000-8000-000000000001', repeat('6', 64), 0,
    'node.start', 'node.next', 'awaiting_child', 'choice', 'input.one',
    array['child', 'character'], array['child_choice', 'character_text'],
    array['input.one', 'copy.one']
  );
  if not v_replay.idempotent_replay or v_replay.committed_revision <> 1 then
    raise exception 'committed UUID replay must survive later release revocation';
  end if;
end;
$$;

select pg_temp.expect_sqlstate(
  current_user,
  $$select * from public.commit_world_chat_authored_turn(
    'parent.pg17', 'production', 'release.staging', '1.0.0', repeat('a', 64),
    '20000000-0000-4000-8000-000000000001',
    (select id from public.world_chat_sessions
      where room_id = '20000000-0000-4000-8000-000000000001' and ended_at is null),
    '40000000-0000-4000-8000-000000000001', repeat('6', 64), 0,
    'node.start', 'node.next', 'awaiting_child', 'choice', 'input.one',
    array['child', 'character'], array['child_choice', 'character_text'],
    array['input.one', 'copy.one']
  )$$,
  '55000',
  'cross-channel replay must fail the exact expected pin CAS'
);

select '0032_content_release_runtime_registry_pg17_ok' as result;
