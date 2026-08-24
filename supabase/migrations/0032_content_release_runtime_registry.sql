-- Signed ContentRelease registry and private runtime graph loading boundary.
--
-- No rendered copy, arbitrary payload, raw child input, public URL, or signed
-- URL is stored here. Immutable private storage keys are resolved server-side.

-- Runtime, publishing, and release operations use disjoint Postgres roles.
-- These roles cannot log in directly and are not granted to service_role.
-- A separately provisioned publisher/operator login must SET ROLE explicitly.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'kindy_content_release_publisher'
  ) then
    create role kindy_content_release_publisher
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'kindy_content_release_operator'
  ) then
    create role kindy_content_release_operator
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'kindy_content_release_storage_reader'
  ) then
    create role kindy_content_release_storage_reader
      nologin inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end;
$$;

alter role kindy_content_release_publisher
  nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
alter role kindy_content_release_operator
  nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
alter role kindy_content_release_storage_reader
  nologin inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

-- Supabase Storage may SET ROLE only for a separately signed JWT whose role
-- claim names this read-only role. Runtime service_role is deliberately not a
-- member of either publisher or operator.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_roles where rolname = 'anon'
  ) then
    grant anon to kindy_content_release_storage_reader;
  end if;
  if exists (
    select 1 from pg_catalog.pg_roles where rolname = 'authenticator'
  ) then
    grant kindy_content_release_storage_reader to authenticator;
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════
-- 1. Administrative Ed25519 trust allowlist
-- ═══════════════════════════════════════════════════════
create table if not exists public.content_release_trusted_keys (
  key_id                 text primary key
                           check (char_length(key_id) <= 120
                             and key_id ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'),
  algorithm              text not null default 'ed25519'
                           check (algorithm = 'ed25519'),
  issuer                 text not null default 'mori-studio'
                           check (issuer = 'mori-studio'),
  audience               text not null default 'kindy-web'
                           check (audience = 'kindy-web'),
  public_key_spki_pem     text not null
                           check (char_length(public_key_spki_pem) between 80 and 2048
                             and public_key_spki_pem like '-----BEGIN PUBLIC KEY-----%'),
  allowed_channels       text[] not null
                           check (allowed_channels in (
                             array['staging']::text[],
                             array['production']::text[],
                             array['staging', 'production']::text[]
                           )),
  valid_from             timestamptz not null,
  valid_until            timestamptz not null,
  revoked_at             timestamptz,
  created_at             timestamptz not null default now(),
  constraint content_release_trusted_keys_time_check
    check (
      valid_until > valid_from
      and (revoked_at is null or revoked_at >= valid_from)
    )
);

comment on table public.content_release_trusted_keys is
  'Kindy 운영자가 별도 migration/관리 절차로 등록하는 Mori Ed25519 공개키 allowlist. issuer, audience, channel, 유효기간, 철회 시각을 runtime 검증기가 모두 재검사한다.';

-- ═══════════════════════════════════════════════════════
-- 2. Fully verified immutable release attestations
-- ═══════════════════════════════════════════════════════
create table if not exists public.content_release_registry (
  release_id              text primary key
                            check (char_length(release_id) <= 120
                              and release_id ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'),
  experience_id           text not null
                            check (char_length(experience_id) <= 96
                              and experience_id ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'),
  release_version         text not null
                            check (char_length(release_version) <= 50
                              and release_version ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
  version_major           bigint not null
                            check (version_major between 0 and 9007199254740991),
  version_minor           bigint not null
                            check (version_minor between 0 and 9007199254740991),
  version_patch           bigint not null
                            check (version_patch between 0 and 9007199254740991),
  channel                 text not null check (channel in ('staging', 'production')),
  manifest_sha256         text not null check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  manifest_object_sha256  text not null check (manifest_object_sha256 ~ '^[a-f0-9]{64}$'),
  manifest_size_bytes     bigint not null check (manifest_size_bytes between 1 and 2097152),
  manifest_storage_key    text not null unique
                            check (char_length(manifest_storage_key) <= 512
                              and manifest_storage_key ~ '^releases/[a-zA-Z0-9._/-]+$'
                              and manifest_storage_key not like '%..%'
                              and manifest_storage_key not like '%//%'),
  graph_sha256            text not null check (graph_sha256 ~ '^[a-f0-9]{64}$'),
  graph_size_bytes        bigint not null check (graph_size_bytes between 1 and 8388608),
  graph_storage_key       text not null unique
                            check (char_length(graph_storage_key) <= 512
                              and graph_storage_key ~ '^releases/[a-zA-Z0-9._/-]+$'
                              and graph_storage_key not like '%..%'
                              and graph_storage_key not like '%//%'),
  signature_key_id        text not null
                            references public.content_release_trusted_keys(key_id) on delete restrict,
  signed_at               timestamptz not null,
  assets_verified_at      timestamptz not null,
  activation_sequence     bigint
                            check (activation_sequence between 1 and 9007199254740991),
  activated_at            timestamptz,
  status                  text not null default 'verified'
                            check (status in ('verified', 'revoked')),
  revoked_at              timestamptz,
  registered_at           timestamptz not null default now(),
  unique (experience_id, channel, release_version),
  unique (experience_id, channel, release_id),
  unique (experience_id, channel, activation_sequence),
  constraint content_release_registry_version_parts_check
    check (
      release_version = version_major::text || '.' || version_minor::text || '.' || version_patch::text
    ),
  constraint content_release_registry_storage_prefix_check
    check (
      manifest_storage_key =
        'releases/' || experience_id || '/' || release_version || '/content-release.json'
      and graph_storage_key like
        'releases/' || experience_id || '/' || release_version || '/%'
    ),
  constraint content_release_registry_activation_shape_check
    check (
      (activation_sequence is null and activated_at is null)
      or (activation_sequence is not null and activated_at is not null)
    ),
  constraint content_release_registry_revocation_shape_check
    check (
      (status = 'verified' and revoked_at is null)
      or (status = 'revoked' and revoked_at is not null)
    ),
  constraint content_release_registry_verification_time_check
    check (
      assets_verified_at >= signed_at - interval '5 minutes'
      and (activated_at is null or activated_at >= assets_verified_at)
      and (revoked_at is null or revoked_at >= registered_at)
    )
);

create index if not exists idx_content_release_registry_runtime_lookup
  on public.content_release_registry (
    experience_id,
    channel,
    release_version,
    manifest_sha256
  )
  where status = 'verified' and activation_sequence is not null;

comment on table public.content_release_registry is
  'verifyContentRelease가 manifest, graph, 모든 asset byte를 검증한 뒤 기록하는 immutable attestation. runtime은 private storage key로 manifest+graph를 다시 읽고 서명과 graph bytes를 검증한다.';
comment on column public.content_release_registry.manifest_sha256 is
  'ContentRelease manifest payload의 canonical SHA-256이며 world_chat_rooms가 pin한다. manifest object 자체의 byte hash와는 구분한다.';
comment on column public.content_release_registry.manifest_storage_key is
  'private content-releases bucket의 immutable object key. public URL 또는 signed URL을 저장하지 않는다.';
comment on column public.content_release_registry.assets_verified_at is
  '발행 ingest가 모든 artifact/asset의 실제 byte hash와 size를 확인한 시각. DB metadata만 복사한 값이어서는 안 된다.';

-- One monotonic head per experience/channel. Older activated releases remain
-- readable for already-pinned rooms until an operator raises the explicit
-- minimum floor; new room pins must always use head_release_id.
create table if not exists public.content_release_channel_heads (
  experience_id             text not null,
  channel                   text not null check (channel in ('staging', 'production')),
  head_release_id           text not null,
  head_activation_sequence  bigint not null
                              check (head_activation_sequence between 1 and 9007199254740991),
  head_version_major        bigint not null
                              check (head_version_major between 0 and 9007199254740991),
  head_version_minor        bigint not null
                              check (head_version_minor between 0 and 9007199254740991),
  head_version_patch        bigint not null
                              check (head_version_patch between 0 and 9007199254740991),
  minimum_version_major     bigint not null
                              check (minimum_version_major between 0 and 9007199254740991),
  minimum_version_minor     bigint not null
                              check (minimum_version_minor between 0 and 9007199254740991),
  minimum_version_patch     bigint not null
                              check (minimum_version_patch between 0 and 9007199254740991),
  updated_at                timestamptz not null default now(),
  primary key (experience_id, channel),
  foreign key (experience_id, channel, head_release_id)
    references public.content_release_registry (experience_id, channel, release_id)
    on delete restrict,
  constraint content_release_channel_heads_floor_check
    check (
      (head_version_major, head_version_minor, head_version_patch)
        >= (minimum_version_major, minimum_version_minor, minimum_version_patch)
    )
);

comment on table public.content_release_channel_heads is
  'Strictly increasing semver activation head. 신규 room pin의 rollback을 막고, minimum version floor 아래의 기존 pin도 runtime에서 닫는다.';

-- ═══════════════════════════════════════════════════════
-- 3. Publisher-only external attestation and operator-only mutations
-- ═══════════════════════════════════════════════════════
-- Remove the misleading pre-launch name if an operator replayed an earlier
-- draft locally. No externally activated migration currently contains it.
drop function if exists public.record_verified_content_release(
  text, text, text, text, text, text, bigint, text, text, bigint, text, text,
  timestamptz, timestamptz
);

create or replace function public.record_application_verified_content_release_attestation(
  p_release_id text,
  p_experience_id text,
  p_release_version text,
  p_channel text,
  p_manifest_sha256 text,
  p_manifest_object_sha256 text,
  p_manifest_size_bytes bigint,
  p_manifest_storage_key text,
  p_graph_sha256 text,
  p_graph_size_bytes bigint,
  p_graph_storage_key text,
  p_signature_key_id text,
  p_signed_at timestamptz,
  p_assets_verified_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_major bigint;
  v_minor bigint;
  v_patch bigint;
  v_major_numeric numeric;
  v_minor_numeric numeric;
  v_patch_numeric numeric;
  v_existing public.content_release_registry%rowtype;
begin
  if p_release_version is null
    or char_length(p_release_version) > 50
    or p_release_version !~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
  then
    raise exception using errcode = '22023', message = 'CONTENT_RELEASE_INVALID_ATTESTATION';
  end if;

  v_major_numeric := split_part(p_release_version, '.', 1)::numeric;
  v_minor_numeric := split_part(p_release_version, '.', 2)::numeric;
  v_patch_numeric := split_part(p_release_version, '.', 3)::numeric;
  if v_major_numeric > 9007199254740991
    or v_minor_numeric > 9007199254740991
    or v_patch_numeric > 9007199254740991
  then
    raise exception using errcode = '22023', message = 'CONTENT_RELEASE_INVALID_ATTESTATION';
  end if;
  v_major := v_major_numeric::bigint;
  v_minor := v_minor_numeric::bigint;
  v_patch := v_patch_numeric::bigint;

  if not exists (
    select 1
    from public.content_release_trusted_keys as trusted_key
    where trusted_key.key_id = p_signature_key_id
      and trusted_key.algorithm = 'ed25519'
      and trusted_key.issuer = 'mori-studio'
      and trusted_key.audience = 'kindy-web'
      and p_channel = any(trusted_key.allowed_channels)
      and p_signed_at between trusted_key.valid_from and trusted_key.valid_until
      and p_signed_at <= p_assets_verified_at + interval '5 minutes'
      and p_assets_verified_at <= now() + interval '5 minutes'
      and trusted_key.revoked_at is null
  ) then
    raise exception using errcode = '42501', message = 'CONTENT_RELEASE_KEY_NOT_TRUSTED';
  end if;

  select * into v_existing
  from public.content_release_registry
  where release_id = p_release_id
  for update;

  if found then
    if v_existing.experience_id <> p_experience_id
      or v_existing.release_version <> p_release_version
      or v_existing.channel <> p_channel
      or v_existing.manifest_sha256 <> p_manifest_sha256
      or v_existing.manifest_object_sha256 <> p_manifest_object_sha256
      or v_existing.manifest_size_bytes <> p_manifest_size_bytes
      or v_existing.manifest_storage_key <> p_manifest_storage_key
      or v_existing.graph_sha256 <> p_graph_sha256
      or v_existing.graph_size_bytes <> p_graph_size_bytes
      or v_existing.graph_storage_key <> p_graph_storage_key
      or v_existing.signature_key_id <> p_signature_key_id
      or v_existing.signed_at <> p_signed_at
    then
      raise exception using errcode = '23505', message = 'CONTENT_RELEASE_ID_CONFLICT';
    end if;
    return false;
  end if;

  insert into public.content_release_registry (
    release_id,
    experience_id,
    release_version,
    version_major,
    version_minor,
    version_patch,
    channel,
    manifest_sha256,
    manifest_object_sha256,
    manifest_size_bytes,
    manifest_storage_key,
    graph_sha256,
    graph_size_bytes,
    graph_storage_key,
    signature_key_id,
    signed_at,
    assets_verified_at
  ) values (
    p_release_id,
    p_experience_id,
    p_release_version,
    v_major,
    v_minor,
    v_patch,
    p_channel,
    p_manifest_sha256,
    p_manifest_object_sha256,
    p_manifest_size_bytes,
    p_manifest_storage_key,
    p_graph_sha256,
    p_graph_size_bytes,
    p_graph_storage_key,
    p_signature_key_id,
    p_signed_at,
    p_assets_verified_at
  );

  return true;
exception
  when numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'CONTENT_RELEASE_INVALID_ATTESTATION';
end;
$$;

comment on function public.record_application_verified_content_release_attestation(
  text, text, text, text, text, text, bigint, text, text, bigint, text, text,
  timestamptz, timestamptz
) is
  'Publisher-role-only attestation insert. The SQL function performs no hashing, signature verification, object download, or cryptography; Mori must run application verifyContentRelease against actual manifest, graph, and every asset byte before calling it with a separately provisioned publisher identity.';

create or replace function public.activate_content_release(
  p_release_id text
) returns table (
  release_id text,
  activation_sequence bigint,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_release public.content_release_registry%rowtype;
  v_head public.content_release_channel_heads%rowtype;
  v_next_sequence bigint;
  v_head_found boolean;
begin
  select * into v_release
  from public.content_release_registry
  where content_release_registry.release_id = p_release_id
    and status = 'verified'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CONTENT_RELEASE_NOT_VERIFIED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_release.experience_id || ':' || v_release.channel, 0)
  );

  select * into v_head
  from public.content_release_channel_heads
  where experience_id = v_release.experience_id
    and channel = v_release.channel
  for update;
  v_head_found := found;

  -- Registry mutation lock order is release -> channel head -> signing key.
  perform 1
  from public.content_release_trusted_keys as trusted_key
  where trusted_key.key_id = v_release.signature_key_id
    and trusted_key.algorithm = 'ed25519'
    and trusted_key.issuer = 'mori-studio'
    and trusted_key.audience = 'kindy-web'
    and v_release.channel = any(trusted_key.allowed_channels)
    and v_release.signed_at between trusted_key.valid_from and trusted_key.valid_until
    and (trusted_key.revoked_at is null or now() < trusted_key.revoked_at)
  for share;
  if not found then
    raise exception using errcode = '42501', message = 'CONTENT_RELEASE_KEY_NOT_TRUSTED';
  end if;

  if v_head_found and v_head.head_release_id = v_release.release_id then
    return query select v_release.release_id, v_head.head_activation_sequence, true;
    return;
  end if;

  if v_head_found and (
    (v_release.version_major, v_release.version_minor, v_release.version_patch)
      <= (v_head.head_version_major, v_head.head_version_minor, v_head.head_version_patch)
  ) then
    raise exception using errcode = '40001', message = 'CONTENT_RELEASE_ROLLBACK_REJECTED';
  end if;

  v_next_sequence := case
    when v_head_found then v_head.head_activation_sequence + 1
    else 1
  end;

  update public.content_release_registry as registry
  set activation_sequence = v_next_sequence,
      activated_at = now()
  where registry.release_id = v_release.release_id
    and registry.activation_sequence is null;

  if not found then
    raise exception using errcode = '23505', message = 'CONTENT_RELEASE_ACTIVATION_CONFLICT';
  end if;

  insert into public.content_release_channel_heads (
    experience_id,
    channel,
    head_release_id,
    head_activation_sequence,
    head_version_major,
    head_version_minor,
    head_version_patch,
    minimum_version_major,
    minimum_version_minor,
    minimum_version_patch,
    updated_at
  ) values (
    v_release.experience_id,
    v_release.channel,
    v_release.release_id,
    v_next_sequence,
    v_release.version_major,
    v_release.version_minor,
    v_release.version_patch,
    v_release.version_major,
    v_release.version_minor,
    v_release.version_patch,
    now()
  )
  on conflict (experience_id, channel) do update
  set head_release_id = excluded.head_release_id,
      head_activation_sequence = excluded.head_activation_sequence,
      head_version_major = excluded.head_version_major,
      head_version_minor = excluded.head_version_minor,
      head_version_patch = excluded.head_version_patch,
      updated_at = excluded.updated_at;

  return query select v_release.release_id, v_next_sequence, false;
end;
$$;

comment on function public.activate_content_release(text) is
  'Operator-role-only strict semver CAS activation. Equal calls replay idempotently; a lower or equal non-head version is rejected to prevent rollback.';

create or replace function public.revoke_content_release(
  p_release_id text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_release public.content_release_registry%rowtype;
begin
  select release.* into v_release
  from public.content_release_registry as release
  where release.release_id = p_release_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CONTENT_RELEASE_NOT_FOUND';
  end if;
  if v_release.status = 'revoked' then return false; end if;

  update public.content_release_registry as release
  set status = 'revoked',
      revoked_at = now()
  where release.release_id = p_release_id;
  return true;
end;
$$;

comment on function public.revoke_content_release(text) is
  'Operator-role-only fail-closed release revocation. It takes the release row lock used by runtime eligibility checks and never rewinds the channel head.';

create or replace function public.raise_content_release_minimum_version(
  p_experience_id text,
  p_channel text,
  p_minimum_release_version text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_head public.content_release_channel_heads%rowtype;
  v_major_numeric numeric;
  v_minor_numeric numeric;
  v_patch_numeric numeric;
  v_major bigint;
  v_minor bigint;
  v_patch bigint;
begin
  if p_minimum_release_version is null
    or char_length(p_minimum_release_version) > 50
    or p_minimum_release_version
      !~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
  then
    raise exception using errcode = '22023', message = 'CONTENT_RELEASE_INVALID_FLOOR';
  end if;

  v_major_numeric := split_part(p_minimum_release_version, '.', 1)::numeric;
  v_minor_numeric := split_part(p_minimum_release_version, '.', 2)::numeric;
  v_patch_numeric := split_part(p_minimum_release_version, '.', 3)::numeric;
  if v_major_numeric > 9007199254740991
    or v_minor_numeric > 9007199254740991
    or v_patch_numeric > 9007199254740991
  then
    raise exception using errcode = '22023', message = 'CONTENT_RELEASE_INVALID_FLOOR';
  end if;
  v_major := v_major_numeric::bigint;
  v_minor := v_minor_numeric::bigint;
  v_patch := v_patch_numeric::bigint;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_experience_id || ':' || p_channel, 0)
  );
  select head.* into v_head
  from public.content_release_channel_heads as head
  where head.experience_id = p_experience_id
    and head.channel = p_channel
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CONTENT_RELEASE_HEAD_NOT_FOUND';
  end if;

  if (v_major, v_minor, v_patch)
      < (v_head.minimum_version_major, v_head.minimum_version_minor, v_head.minimum_version_patch)
  then
    raise exception using errcode = '40001', message = 'CONTENT_RELEASE_FLOOR_ROLLBACK_REJECTED';
  end if;
  if (v_major, v_minor, v_patch)
      > (v_head.head_version_major, v_head.head_version_minor, v_head.head_version_patch)
  then
    raise exception using errcode = '22023', message = 'CONTENT_RELEASE_FLOOR_ABOVE_HEAD';
  end if;
  if (v_major, v_minor, v_patch)
      = (v_head.minimum_version_major, v_head.minimum_version_minor, v_head.minimum_version_patch)
  then
    return false;
  end if;

  update public.content_release_channel_heads as head
  set minimum_version_major = v_major,
      minimum_version_minor = v_minor,
      minimum_version_patch = v_patch,
      updated_at = now()
  where head.experience_id = p_experience_id
    and head.channel = p_channel;
  return true;
exception
  when numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'CONTENT_RELEASE_INVALID_FLOOR';
end;
$$;

comment on function public.raise_content_release_minimum_version(text, text, text) is
  'Operator-role-only monotonic minimum runtime version raise. The floor cannot be lowered or moved above the current head.';

-- ═══════════════════════════════════════════════════════
-- 4. New room/repin must use the current verified channel head
-- ═══════════════════════════════════════════════════════
create or replace function public.enforce_world_chat_release_pin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_release public.content_release_registry%rowtype;
  v_head public.content_release_channel_heads%rowtype;
  v_key public.content_release_trusted_keys%rowtype;
begin
  -- A room's deploy channel is part of its immutable identity from
  -- provisioning onward. Even an unstarted room must be reprovisioned rather
  -- than moved between staging and production in place.
  if tg_op = 'UPDATE'
    and new.release_channel is distinct from old.release_channel
  then
    raise exception using errcode = '55000', message = 'CHAT_RELEASE_PIN_IMMUTABLE';
  end if;

  if tg_op = 'UPDATE'
    and (
      new.experience_id,
      new.release_id,
      new.release_version,
      new.release_manifest_sha256,
      new.release_channel
    )
      is not distinct from
        (
          old.experience_id,
          old.release_id,
          old.release_version,
          old.release_manifest_sha256,
          old.release_channel
        )
  then
    return new;
  end if;

  if tg_op = 'UPDATE' and (
    old.status <> 'invited'
    or old.revision <> 0
    or old.message_sequence <> 0
    or exists (
      select 1
      from public.world_chat_sessions as session
      where session.room_id = old.id
    )
  ) then
    raise exception using errcode = '55000', message = 'CHAT_RELEASE_PIN_IMMUTABLE';
  end if;

  select release.* into v_release
  from public.content_release_registry as release
  where release.release_id = new.release_id
    and release.experience_id = new.experience_id
    and release.release_version = new.release_version
    and release.manifest_sha256 = new.release_manifest_sha256
    and release.channel = new.release_channel
    and release.status = 'verified'
    and release.revoked_at is null
  for share;
  if not found then
    raise exception using errcode = '42501', message = 'CHAT_RELEASE_PIN_NOT_CURRENT';
  end if;

  select head.* into v_head
  from public.content_release_channel_heads as head
  where head.experience_id = v_release.experience_id
    and head.channel = v_release.channel
    and head.head_release_id = v_release.release_id
    and head.head_activation_sequence = v_release.activation_sequence
  for share;
  if not found then
    raise exception using errcode = '42501', message = 'CHAT_RELEASE_PIN_NOT_CURRENT';
  end if;

  select trusted_key.* into v_key
  from public.content_release_trusted_keys as trusted_key
  where trusted_key.key_id = v_release.signature_key_id
    and trusted_key.algorithm = 'ed25519'
    and trusted_key.issuer = 'mori-studio'
    and trusted_key.audience = 'kindy-web'
    and v_release.channel = any(trusted_key.allowed_channels)
    and v_release.signed_at between trusted_key.valid_from and trusted_key.valid_until
    and (trusted_key.revoked_at is null or now() < trusted_key.revoked_at)
  for share;
  if not found then
    raise exception using errcode = '42501', message = 'CHAT_RELEASE_PIN_NOT_CURRENT';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_world_chat_release_pin on public.world_chat_rooms;
create trigger trg_world_chat_release_pin
  before insert or update of
    experience_id,
    release_id,
    release_version,
    release_manifest_sha256,
    release_channel
  on public.world_chat_rooms
  for each row execute function public.enforce_world_chat_release_pin();

comment on function public.enforce_world_chat_release_pin() is
  'Blocks unsigned, unverified, revoked, rollback, or cross-channel pins. A release pin may change only on a never-opened invited room; after any session/state/revision activity it is immutable.';

-- 0031 defines this hook as deny-by-default so the lifecycle RPC cannot open a
-- room before this registry migration exists. An already-pinned release may be
-- older than the current head, but it must remain activated, non-revoked, and
-- at or above the operator-controlled rollback floor.
drop function if exists public.is_world_chat_release_pin_available(
  text, text, text, text
);
create or replace function public.is_world_chat_release_pin_available(
  p_release_id text,
  p_experience_id text,
  p_release_version text,
  p_manifest_sha256 text,
  p_release_channel text
) returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_release public.content_release_registry%rowtype;
  v_head public.content_release_channel_heads%rowtype;
  v_key public.content_release_trusted_keys%rowtype;
begin
  -- Lock order is release -> channel head -> signing key. open_world_chat_session
  -- already holds the room lock; activation/revocation code must never acquire
  -- a room lock after taking any of these registry locks.
  select release.* into v_release
  from public.content_release_registry as release
  where release.release_id = p_release_id
    and release.experience_id = p_experience_id
    and release.release_version = p_release_version
    and release.manifest_sha256 = p_manifest_sha256
    and release.channel = p_release_channel
    and release.status = 'verified'
    and release.revoked_at is null
    and release.activation_sequence is not null
  for share;
  if not found then return false; end if;

  select head.* into v_head
  from public.content_release_channel_heads as head
  where head.experience_id = v_release.experience_id
    and head.channel = v_release.channel
  for share;
  if not found
    or v_release.activation_sequence > v_head.head_activation_sequence
    or (v_release.version_major, v_release.version_minor, v_release.version_patch)
      < (v_head.minimum_version_major, v_head.minimum_version_minor, v_head.minimum_version_patch)
    or (v_release.version_major, v_release.version_minor, v_release.version_patch)
      > (v_head.head_version_major, v_head.head_version_minor, v_head.head_version_patch)
  then
    return false;
  end if;

  select trusted_key.* into v_key
  from public.content_release_trusted_keys as trusted_key
  where trusted_key.key_id = v_release.signature_key_id
    and trusted_key.algorithm = 'ed25519'
    and trusted_key.issuer = 'mori-studio'
    and trusted_key.audience = 'kindy-web'
    and v_release.channel = any(trusted_key.allowed_channels)
    and v_release.signed_at between trusted_key.valid_from and trusted_key.valid_until
    and (trusted_key.revoked_at is null or now() < trusted_key.revoked_at)
  for share;
  return found;
end;
$$;

comment on function public.is_world_chat_release_pin_available(text, text, text, text, text) is
  'Lifecycle fail-closed hook: exact activated, verified, non-revoked pin within the channel anti-rollback window.';

create or replace function public.confirm_content_release_runtime_eligibility(
  p_release_id text,
  p_experience_id text,
  p_release_version text,
  p_manifest_sha256 text,
  p_channel text,
  p_activation_sequence bigint,
  p_signature_key_id text,
  p_checked_at timestamptz
) returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_release public.content_release_registry%rowtype;
begin
  if p_checked_at is null
    or p_checked_at < now() - interval '5 minutes'
    or p_checked_at > now() + interval '5 minutes'
  then
    return false;
  end if;

  if public.is_world_chat_release_pin_available(
    p_release_id,
    p_experience_id,
    p_release_version,
    p_manifest_sha256,
    p_channel
  ) is not true then
    return false;
  end if;

  -- The availability hook retains FOR SHARE locks until this RPC transaction
  -- completes, so this exact-field check cannot race release/key revocation.
  select release.* into v_release
  from public.content_release_registry as release
  where release.release_id = p_release_id
    and release.channel = p_channel
    and release.activation_sequence = p_activation_sequence
    and release.signature_key_id = p_signature_key_id;
  if not found then return false; end if;

  return exists (
    select 1
    from public.content_release_trusted_keys as trusted_key
    where trusted_key.key_id = p_signature_key_id
      and (trusted_key.revoked_at is null or p_checked_at < trusted_key.revoked_at)
  );
end;
$$;

comment on function public.confirm_content_release_runtime_eligibility(
  text, text, text, text, text, bigint, text, timestamptz
) is
  'Final post-I/O recheck for release/head/key revocation races. The loader calls this after signature and graph byte verification, immediately before returning the graph.';

-- ═══════════════════════════════════════════════════════
-- 5. Private object bucket and read-only runtime grants
-- ═══════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('content-releases', 'content-releases', false)
on conflict (id) do update set public = false;

drop policy if exists content_releases_service_insert on storage.objects;
drop policy if exists content_releases_service_select on storage.objects;
drop policy if exists content_releases_service_update on storage.objects;
drop policy if exists content_releases_runtime_reader_select on storage.objects;
create policy content_releases_runtime_reader_select on storage.objects
  for select to kindy_content_release_storage_reader
  using (bucket_id = 'content-releases');

-- No INSERT/UPDATE/DELETE policy exists for the storage reader. The anon
-- membership follows Supabase Storage's custom-role execution pattern and the
-- separately signed JWT is defense in depth only. The same Cloud Run process
-- still carries a BYPASSRLS service_role for legacy DB paths, so this cannot be
-- described as an immutable storage boundary and authored runtime stays hard
-- disabled until GCS isolation or a fully RPC-only DB identity is provisioned.
-- A hosted createSignedUrl smoke remains an external gate.

alter table public.content_release_trusted_keys enable row level security;
alter table public.content_release_registry enable row level security;
alter table public.content_release_channel_heads enable row level security;

revoke all on table
  public.content_release_trusted_keys,
  public.content_release_registry,
  public.content_release_channel_heads
from public, anon, authenticated, service_role,
  authenticator,
  kindy_content_release_publisher,
  kindy_content_release_operator,
  kindy_content_release_storage_reader;

grant select on table
  public.content_release_trusted_keys,
  public.content_release_registry,
  public.content_release_channel_heads
to service_role;

grant usage on schema public
to kindy_content_release_publisher,
  kindy_content_release_operator,
  kindy_content_release_storage_reader;

revoke all on table storage.objects
from kindy_content_release_storage_reader;
grant usage on schema storage to kindy_content_release_storage_reader;
grant select on table storage.objects to kindy_content_release_storage_reader;

revoke execute on function public.record_application_verified_content_release_attestation(
  text, text, text, text, text, text, bigint, text, text, bigint, text, text,
  timestamptz, timestamptz
) from public, anon, authenticated, service_role,
  authenticator,
  kindy_content_release_operator,
  kindy_content_release_storage_reader;
grant execute on function public.record_application_verified_content_release_attestation(
  text, text, text, text, text, text, bigint, text, text, bigint, text, text,
  timestamptz, timestamptz
) to kindy_content_release_publisher;

revoke execute on function public.activate_content_release(text)
from public, anon, authenticated, service_role,
  authenticator,
  kindy_content_release_publisher,
  kindy_content_release_storage_reader;
grant execute on function public.activate_content_release(text)
to kindy_content_release_operator;

revoke execute on function public.revoke_content_release(text)
from public, anon, authenticated, service_role,
  authenticator,
  kindy_content_release_publisher,
  kindy_content_release_storage_reader;
grant execute on function public.revoke_content_release(text)
to kindy_content_release_operator;

revoke execute on function public.raise_content_release_minimum_version(text, text, text)
from public, anon, authenticated, service_role,
  authenticator,
  kindy_content_release_publisher,
  kindy_content_release_storage_reader;
grant execute on function public.raise_content_release_minimum_version(text, text, text)
to kindy_content_release_operator;

revoke execute on function public.enforce_world_chat_release_pin()
from public, anon, authenticated, service_role,
  authenticator,
  kindy_content_release_publisher,
  kindy_content_release_operator,
  kindy_content_release_storage_reader;

revoke execute on function public.is_world_chat_release_pin_available(
  text, text, text, text, text
) from public, anon, authenticated, authenticator,
  kindy_content_release_publisher,
  kindy_content_release_operator,
  kindy_content_release_storage_reader;
grant execute on function public.is_world_chat_release_pin_available(
  text, text, text, text, text
) to service_role;

revoke execute on function public.confirm_content_release_runtime_eligibility(
  text, text, text, text, text, bigint, text, timestamptz
) from public, anon, authenticated, authenticator,
  kindy_content_release_publisher,
  kindy_content_release_operator,
  kindy_content_release_storage_reader;
grant execute on function public.confirm_content_release_runtime_eligibility(
  text, text, text, text, text, bigint, text, timestamptz
) to service_role;
