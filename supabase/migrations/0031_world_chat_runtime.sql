-- Protected world-chat runtime foundation for the Authored Core pilot.
--
-- This migration deliberately stores immutable ExperienceGraph identifiers,
-- not rendered copy, arbitrary JSON payloads, or raw child free text. The
-- strict free-text path remains disabled until its separate consent, safety,
-- legal, and retention gates are implemented.

-- ═══════════════════════════════════════════════════════
-- 1. Separate consent scope and revocation evidence
-- ═══════════════════════════════════════════════════════
alter table public.parent_consents
  add column if not exists revoked_at timestamptz;

alter table public.parent_consents
  drop constraint if exists parent_consents_scope_check;
alter table public.parent_consents
  add constraint parent_consents_scope_check
  check (consent_scope in (
    'child_profile_activity',
    'recurring_billing',
    'guardian_u14',
    'overseas_transfer',
    'sensitive_gacs',
    'child_free_text_ai',
    'personalized_memory',
    'generated_child_asset'
  ));

alter table public.parent_consents
  drop constraint if exists parent_consents_revoked_at_check;
alter table public.parent_consents
  add constraint parent_consents_revoked_at_check
  check (revoked_at is null or revoked_at >= created_at);

create index if not exists idx_parent_consents_active_scope
  on public.parent_consents (parent_id, child_id, consent_scope, created_at desc)
  where revoked_at is null;

comment on column public.parent_consents.consent_scope is
  '동의 목적별 분리 범위. child_free_text_ai는 아이 자유입력을 외부 AI 안전검사·대화 모델로 처리하기 위한 별도 opt-in이며, child_profile_activity 동의로 대체할 수 없다.';
comment on column public.parent_consents.revoked_at is
  '동의 철회 시각. 증적 행은 삭제하지 않는다. 아이 삭제 후 child_id가 null이 된 과거 증적은 어떤 아이의 활성 동의로도 인정하지 않는다.';

-- ═══════════════════════════════════════════════════════
-- 2. Room and session state
-- ═══════════════════════════════════════════════════════
create table if not exists public.world_chat_rooms (
  id                      uuid primary key default gen_random_uuid(),
  child_id                uuid not null references public.children(id) on delete cascade,
  experience_id           text not null
                            check (char_length(experience_id) <= 96
                              and experience_id ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'),
  release_id              text not null
                            check (char_length(release_id) <= 120
                              and release_id ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'),
  release_version         text not null
                            check (char_length(release_version) <= 50
                              and release_version ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
  release_channel         text not null
                            check (release_channel in ('staging', 'production')),
  release_manifest_sha256 text not null
                            check (release_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  current_node_id         text not null
                            check (char_length(current_node_id) <= 96
                              and current_node_id ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'),
  status                  text not null default 'invited'
                            check (status in (
                              'invited', 'active', 'awaiting_child', 'cinematic_ready',
                              'generating_art', 'paused', 'chapter_complete', 'locked'
                            )),
  revision                bigint not null default 0 check (revision >= 0),
  message_sequence        bigint not null default 0 check (message_sequence >= 0),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (child_id, experience_id, release_channel),
  unique (id, child_id)
);

create index if not exists idx_world_chat_rooms_child_updated
  on public.world_chat_rooms (child_id, updated_at desc);

comment on table public.world_chat_rooms is
  '아이별 세계관 대화방과 현재 ExperienceGraph cursor. experience/release/channel 식별자는 Mori 제작 DB의 story_seeds·episodes FK가 아니라 검증된 immutable ContentRelease pin이다. 기존 child-global world_states(0024)와도 별개다.';
comment on column public.world_chat_rooms.release_channel is
  '서버가 provision할 때 고정하는 staging|production ContentRelease 채널. 클라이언트가 만들거나 바꾸지 않으며 0032 pin trigger가 불변성을 강제한다.';
comment on column public.world_chat_rooms.revision is
  '저작 turn을 커밋할 때만 1 증가하는 optimistic concurrency revision. 클라이언트 expected_revision과 원자적으로 비교한다.';
comment on column public.world_chat_rooms.message_sequence is
  '대화방 타임라인의 마지막 서버 sequence. commit_world_chat_authored_turn이 room row lock 안에서만 증가시킨다.';

create table if not exists public.world_chat_sessions (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.world_chat_rooms(id) on delete cascade,
  client_session_id uuid not null,
  opened_revision bigint not null check (opened_revision >= 0),
  closed_revision bigint check (closed_revision >= opened_revision),
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  unique (room_id, id),
  unique (room_id, client_session_id),
  constraint world_chat_sessions_close_shape_check
    check (
      (ended_at is null and closed_revision is null)
      or (ended_at is not null and closed_revision is not null and ended_at >= started_at)
    )
);

create unique index if not exists idx_world_chat_sessions_one_open
  on public.world_chat_sessions (room_id)
  where ended_at is null;

create index if not exists idx_world_chat_sessions_room_started
  on public.world_chat_sessions (room_id, started_at desc);

comment on table public.world_chat_sessions is
  '대화방 방문 단위. client_session_id는 본문 없는 UUID 멱등키이며, 한 방에는 열린 세션이 최대 1개다. 종료 시 ended_at과 closed_revision을 함께 기록한다.';
comment on column public.world_chat_sessions.client_session_id is
  '클라이언트가 생성한 UUID 멱등키. 아이 입력, 기기 식별자, 임의 payload를 저장하지 않는다.';

-- Fail-closed seam for the signed ContentRelease registry migration. The
-- registry migration replaces this implementation with an exact verified,
-- activated, non-revoked pin lookup. Until then no session can be opened.
create or replace function public.is_world_chat_release_pin_available(
  p_release_id text,
  p_experience_id text,
  p_release_version text,
  p_manifest_sha256 text,
  p_release_channel text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select false
$$;

comment on function public.is_world_chat_release_pin_available(text, text, text, text, text) is
  'Fail-closed ContentRelease registry seam. 0032 replaces this body with an exact active registry+channel lookup; callers must never add an unsigned/demo fallback.';

revoke execute on function public.is_world_chat_release_pin_available(text, text, text, text, text)
from public, anon, authenticated;
grant execute on function public.is_world_chat_release_pin_available(text, text, text, text, text)
to service_role;

-- ═══════════════════════════════════════════════════════
-- 3. Idempotent authored turns and reference-only messages/events
-- ═══════════════════════════════════════════════════════
create table if not exists public.world_chat_turns (
  id                    uuid primary key default gen_random_uuid(),
  room_id               uuid not null references public.world_chat_rooms(id) on delete cascade,
  session_id            uuid not null,
  client_turn_id        uuid not null,
  request_sha256        text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  source_kind           text not null
                          check (source_kind in ('quick_reply', 'choice')),
  authored_input_id     text not null
                          check (char_length(authored_input_id) <= 96
                            and authored_input_id ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'),
  from_node_id          text not null
                          check (char_length(from_node_id) <= 96
                            and from_node_id ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'),
  to_node_id            text not null
                          check (char_length(to_node_id) <= 96
                            and to_node_id ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'),
  expected_revision     bigint not null check (expected_revision >= 0),
  committed_revision    bigint not null check (committed_revision = expected_revision + 1),
  first_message_sequence bigint not null check (first_message_sequence > 0),
  last_message_sequence  bigint not null check (last_message_sequence >= first_message_sequence),
  created_at            timestamptz not null default now(),
  unique (room_id, id),
  unique (room_id, session_id, id),
  unique (room_id, client_turn_id),
  unique (room_id, committed_revision),
  foreign key (room_id, session_id)
    references public.world_chat_sessions (room_id, id) on delete cascade
);

create index if not exists idx_world_chat_turns_session_created
  on public.world_chat_turns (session_id, created_at);

comment on table public.world_chat_turns is
  '승인된 ExperienceGraph 전이 1회. client_turn_id+request_sha256은 재전송 멱등성, expected/committed_revision은 stale write 차단에 사용한다. 자유입력 원문 컬럼은 의도적으로 없다.';
comment on column public.world_chat_turns.request_sha256 is
  'route가 graph 검증 후 만든 canonical authored request의 SHA-256. 원문·프롬프트·모델 출력 hash로 사용하지 않는다.';

create table if not exists public.world_chat_messages (
  id                  uuid primary key default gen_random_uuid(),
  room_id             uuid not null references public.world_chat_rooms(id) on delete cascade,
  session_id          uuid not null,
  turn_id             uuid,
  sequence_no         bigint not null check (sequence_no > 0),
  actor               text not null check (actor in ('child', 'character', 'system')),
  message_kind        text not null check (message_kind in (
                        'character_text', 'child_choice', 'child_prompt', 'quick_reply',
                        'choice', 'cinematic', 'generated_image', 'quiz', 'minigame',
                        'system_transition', 'ending'
                      )),
  authored_content_id text not null
                        check (char_length(authored_content_id) <= 96
                          and authored_content_id ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'),
  authored_context_id text
                        check (authored_context_id is null or (
                          char_length(authored_context_id) <= 96
                          and authored_context_id ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
                        )),
  created_at          timestamptz not null default now(),
  unique (room_id, sequence_no),
  constraint world_chat_messages_actor_kind_check
    check (
      (actor = 'child' and message_kind = 'child_choice')
      or (actor = 'character' and message_kind = 'character_text')
      or (
        actor = 'system'
        and message_kind not in ('child_choice', 'character_text')
      )
    ),
  constraint world_chat_messages_authored_context_check
    check (
      (message_kind = 'child_choice' and authored_context_id is not null)
      or (message_kind <> 'child_choice' and authored_context_id is null)
    ),
  foreign key (room_id, session_id)
    references public.world_chat_sessions (room_id, id) on delete cascade,
  foreign key (room_id, session_id, turn_id)
    references public.world_chat_turns (room_id, session_id, id) on delete cascade
);

create index if not exists idx_world_chat_messages_session_sequence
  on public.world_chat_messages (session_id, sequence_no);

comment on table public.world_chat_messages is
  '렌더 가능한 대화 타임라인. authored content/context ID만 저장하고 문장 body, raw child text, 자유형 payload, media URL은 저장하지 않는다. 표시 내용은 방에 pin된 immutable ContentRelease에서 해석한다.';
comment on column public.world_chat_messages.authored_content_id is
  'ExperienceGraph node/option/asset의 opaque ID. 아이가 선택한 authored option도 ID만 저장하며 그 label을 복제 저장하지 않는다.';
comment on column public.world_chat_messages.authored_context_id is
  'child_choice의 option ID를 해석할 부모 ExperienceGraph node ID. 첫 선택 메시지에만 from_node_id를 저장하고 그 외 메시지는 null이다.';

create table if not exists public.world_chat_events (
  id                  uuid primary key default gen_random_uuid(),
  room_id             uuid not null references public.world_chat_rooms(id) on delete cascade,
  session_id          uuid,
  turn_id             uuid,
  client_event_id     uuid,
  event_type          text not null check (event_type in (
                        'room_invited', 'session_started', 'turn_committed',
                        'choice_committed', 'cinematic_completed', 'image_requested',
                        'image_ready', 'session_completed', 'session_exited'
                      )),
  authored_content_id text
                        check (authored_content_id is null or (
                          char_length(authored_content_id) <= 96
                          and authored_content_id ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
                        )),
  room_revision       bigint not null check (room_revision >= 0),
  occurred_at         timestamptz not null default now(),
  constraint world_chat_events_turn_session_check
    check (turn_id is null or session_id is not null),
  foreign key (room_id, session_id)
    references public.world_chat_sessions (room_id, id) on delete cascade,
  foreign key (room_id, session_id, turn_id)
    references public.world_chat_turns (room_id, session_id, id) on delete cascade
);

create unique index if not exists idx_world_chat_events_client_idempotency
  on public.world_chat_events (room_id, client_event_id)
  where client_event_id is not null;

create index if not exists idx_world_chat_events_room_occurred
  on public.world_chat_events (room_id, occurred_at);

comment on table public.world_chat_events is
  '저작 runtime의 최소 행동 원장. moderation reason/evidence, 자유입력 원문, 임의 JSON payload는 저장하지 않으며 안전 이벤트는 별도 최소수집 설계 전까지 이 테이블에 넣지 않는다.';

-- ═══════════════════════════════════════════════════════
-- 4. Atomic room-session open/resume
-- ═══════════════════════════════════════════════════════
create or replace function public.open_world_chat_session(
  p_parent_id text,
  p_child_id uuid,
  p_room_id uuid,
  p_client_session_id uuid,
  p_expected_release_channel text
)
returns table (
  session_id uuid,
  session_client_id uuid,
  session_opened_revision bigint,
  session_started_at timestamptz,
  session_ended_at timestamptz,
  resumed_existing boolean,
  idempotent_replay boolean,
  room_child_id uuid,
  room_experience_id text,
  room_release_id text,
  room_release_version text,
  room_release_channel text,
  room_release_manifest_sha256 text,
  room_current_node_id text,
  room_status text,
  room_revision bigint,
  room_message_sequence bigint,
  room_created_at timestamptz,
  room_updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_room public.world_chat_rooms%rowtype;
  v_session public.world_chat_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
  v_created boolean := false;
  v_resumed boolean := false;
  v_idempotent boolean := false;
begin
  if p_parent_id is null
    or char_length(p_parent_id) < 1
    or char_length(p_parent_id) > 128
    or p_child_id is null
    or p_room_id is null
    or p_client_session_id is null
    or p_expected_release_channel is null
    or p_expected_release_channel not in ('staging', 'production')
  then
    raise exception using errcode = '22023', message = 'CHAT_INVALID_SESSION_REQUEST';
  end if;

  -- This room lock is the serialization point for all competing open calls.
  -- It also prevents a turn commit from racing the paused/invited transition.
  select rooms.*
    into v_room
    from public.world_chat_rooms as rooms
   where rooms.id = p_room_id
     and rooms.child_id = p_child_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CHAT_ROOM_NOT_FOUND';
  end if;

  -- Defense in depth: the route performs these checks first, then this
  -- service-role-only RPC rechecks and locks the authoritative rows inside the
  -- mutation transaction so ownership transfer or consent revocation cannot
  -- race the session open.
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

  -- The deploy channel is supplied only by trusted server configuration. A
  -- production process must never mutate a room provisioned from staging (or
  -- vice versa), even if the same release identifiers exist in both channels.
  if v_room.release_channel <> p_expected_release_channel then
    raise exception using errcode = '55000', message = 'CHAT_RELEASE_UNAVAILABLE';
  end if;

  -- 0031 intentionally has no unsigned/demo release path. Its hook returns
  -- false until 0032 replaces it with the signed registry lookup.
  if public.is_world_chat_release_pin_available(
    v_room.release_id,
    v_room.experience_id,
    v_room.release_version,
    v_room.release_manifest_sha256,
    v_room.release_channel
  ) is not true then
    raise exception using errcode = '55000', message = 'CHAT_RELEASE_UNAVAILABLE';
  end if;

  -- Only stable authored states are openable. invited is first entry; paused is
  -- an explicit resume and both become active. active/awaiting_child retain
  -- their state. Cinematic, generation, completed, and locked rooms fail shut.
  if v_room.status not in ('invited', 'active', 'awaiting_child', 'paused') then
    raise exception using errcode = '55000', message = 'CHAT_ROOM_NOT_OPENABLE';
  end if;

  select sessions.*
    into v_session
    from public.world_chat_sessions as sessions
   where sessions.room_id = p_room_id
     and sessions.client_session_id = p_client_session_id
   for update;

  if found then
    if v_session.ended_at is not null then
      raise exception using errcode = '23505', message = 'CHAT_CLIENT_SESSION_CONFLICT';
    end if;
    v_resumed := true;
    v_idempotent := true;
  else
    -- A different request UUID may safely adopt the one already-open session.
    -- The response exposes its canonical client_session_id so the client can
    -- retain that key for all later retries; no second session is created.
    select sessions.*
      into v_session
      from public.world_chat_sessions as sessions
     where sessions.room_id = p_room_id
       and sessions.ended_at is null
     for update;

    if found then
      v_resumed := true;
    else
      insert into public.world_chat_sessions (
        room_id,
        client_session_id,
        opened_revision
      ) values (
        p_room_id,
        p_client_session_id,
        v_room.revision
      )
      returning * into v_session;
      v_created := true;
    end if;
  end if;

  if v_room.status in ('invited', 'paused') then
    update public.world_chat_rooms
       set status = 'active',
           updated_at = v_now
     where id = p_room_id
    returning * into v_room;
  elsif v_created then
    update public.world_chat_rooms
       set updated_at = v_now
     where id = p_room_id
    returning * into v_room;
  end if;

  if v_created then
    insert into public.world_chat_events (
      room_id,
      session_id,
      client_event_id,
      event_type,
      room_revision
    ) values (
      p_room_id,
      v_session.id,
      p_client_session_id,
      'session_started',
      v_room.revision
    );
  end if;

  return query
    select
      v_session.id,
      v_session.client_session_id,
      v_session.opened_revision,
      v_session.started_at,
      v_session.ended_at,
      v_resumed,
      v_idempotent,
      v_room.child_id,
      v_room.experience_id,
      v_room.release_id,
      v_room.release_version,
      v_room.release_channel,
      v_room.release_manifest_sha256,
      v_room.current_node_id,
      v_room.status,
      v_room.revision,
      v_room.message_sequence,
      v_room.created_at,
      v_room.updated_at;
end;
$$;

comment on function public.open_world_chat_session(text, uuid, uuid, uuid, text) is
  'Service-role-only session open/resume: parent ownership+active consent recheck/lock, server deploy-channel match, signed release pin gate, room serialization, UUID idempotency, one-open-session invariant, and explicit stable-state transitions. Creates no room and stores no raw text/payload.';

revoke execute on function public.open_world_chat_session(text, uuid, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.open_world_chat_session(text, uuid, uuid, uuid, text)
to service_role;

-- ═══════════════════════════════════════════════════════
-- 5. Atomic authored-turn commit
-- ═══════════════════════════════════════════════════════
create or replace function public.commit_world_chat_authored_turn(
  p_parent_id text,
  p_expected_release_channel text,
  p_expected_release_id text,
  p_expected_release_version text,
  p_expected_release_manifest_sha256 text,
  p_room_id uuid,
  p_session_id uuid,
  p_client_turn_id uuid,
  p_request_sha256 text,
  p_expected_revision bigint,
  p_from_node_id text,
  p_to_node_id text,
  p_target_status text,
  p_source_kind text,
  p_authored_input_id text,
  p_message_actors text[],
  p_message_kinds text[],
  p_message_content_ids text[]
)
returns table (
  turn_id uuid,
  committed_revision bigint,
  last_message_sequence bigint,
  committed_node_id text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_room public.world_chat_rooms%rowtype;
  v_session public.world_chat_sessions%rowtype;
  v_existing public.world_chat_turns%rowtype;
  v_turn_id uuid := gen_random_uuid();
  v_message_count integer;
  v_first_sequence bigint;
  v_last_sequence bigint;
begin
  v_message_count := coalesce(cardinality(p_message_actors), 0);

  if p_parent_id is null
    or char_length(p_parent_id) < 1
    or char_length(p_parent_id) > 128
    or p_expected_release_channel is null
    or p_expected_release_channel not in ('staging', 'production')
    or p_expected_release_id is null
    or char_length(p_expected_release_id) > 120
    or p_expected_release_id !~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    or p_expected_release_version is null
    or char_length(p_expected_release_version) > 50
    or p_expected_release_version !~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
    or p_expected_release_manifest_sha256 is null
    or p_expected_release_manifest_sha256 !~ '^[a-f0-9]{64}$'
    or p_room_id is null
    or p_session_id is null
    or p_client_turn_id is null
    or p_expected_revision is null
    or p_expected_revision < 0
    or p_request_sha256 is null
    or p_request_sha256 !~ '^[a-f0-9]{64}$'
    or p_source_kind is null
    or p_source_kind not in ('quick_reply', 'choice')
    or p_authored_input_id is null
    or p_authored_input_id !~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    or char_length(p_authored_input_id) > 96
    or p_from_node_id is null
    or p_from_node_id !~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    or char_length(p_from_node_id) > 96
    or p_to_node_id is null
    or p_to_node_id !~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    or char_length(p_to_node_id) > 96
    or p_target_status is null
    or p_target_status not in ('awaiting_child', 'chapter_complete')
    or v_message_count < 1
    or v_message_count > 8
    or cardinality(p_message_kinds) is distinct from v_message_count
    or cardinality(p_message_content_ids) is distinct from v_message_count
    or coalesce(p_message_actors[1], '') <> 'child'
    or coalesce(p_message_kinds[1], '') <> 'child_choice'
    or coalesce(p_message_content_ids[1], '') <> p_authored_input_id
    or exists (
      select 1
      from generate_subscripts(p_message_actors, 1) as indexes(index)
      where indexes.index > 1
        and p_message_actors[indexes.index] = 'child'
    )
  then
    raise exception using errcode = '22023', message = 'CHAT_INVALID_TURN_REQUEST';
  end if;

  if exists (
    select 1
    from unnest(p_message_actors, p_message_kinds, p_message_content_ids)
      as message(actor, message_kind, authored_content_id)
    where actor is null
      or message_kind is null
      or authored_content_id is null
      or actor not in ('child', 'character', 'system')
      or message_kind not in (
        'character_text', 'child_choice', 'child_prompt', 'quick_reply',
        'choice', 'cinematic', 'generated_image', 'quiz', 'minigame',
        'system_transition', 'ending'
      )
      or authored_content_id !~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
      or char_length(authored_content_id) > 96
      or not (
        (actor = 'child' and message_kind = 'child_choice')
        or (actor = 'character' and message_kind = 'character_text')
        or (
          actor = 'system'
          and message_kind not in ('child_choice', 'character_text')
        )
      )
  ) then
    raise exception using errcode = '22023', message = 'CHAT_INVALID_TURN_REQUEST';
  end if;

  -- The room lock serializes both first commits and duplicate retries. The
  -- server route performs the first auth/ownership/consent/release checks; this
  -- service-role-only function repeats every mutable authorization decision.
  select rooms.*
    into v_room
    from public.world_chat_rooms as rooms
   where rooms.id = p_room_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CHAT_ROOM_NOT_FOUND';
  end if;

  -- Defense in depth for the service-role RPC. Lock both ownership and active
  -- consent evidence so a concurrent transfer/revocation cannot race a commit.
  perform 1
    from public.children as children
   where children.id = v_room.child_id
     and children.parent_id = p_parent_id
   for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'CHAT_CHILD_ACCESS_DENIED';
  end if;

  perform 1
    from public.parent_consents as consents
   where consents.parent_id = p_parent_id
     and consents.child_id = v_room.child_id
     and consents.consent_scope = 'child_profile_activity'
     and consents.revoked_at is null
   order by consents.created_at desc
   limit 1
   for share;

  if not found then
    raise exception using errcode = '42501', message = 'CHAT_CONSENT_REQUIRED';
  end if;

  -- Compare the exact room pin loaded and graph-verified by the server before
  -- accepting either a new mutation or an immutable replay. This closes the
  -- graph-A-load -> room-B-repin -> graph-A-content commit TOCTOU even if the
  -- provisioning trigger is ever weakened or bypassed.
  if (
    v_room.release_id,
    v_room.release_version,
    v_room.release_manifest_sha256,
    v_room.release_channel
  ) is distinct from (
    p_expected_release_id,
    p_expected_release_version,
    p_expected_release_manifest_sha256,
    p_expected_release_channel
  ) then
    raise exception using errcode = '55000', message = 'CHAT_RELEASE_UNAVAILABLE';
  end if;

  select turns.*
    into v_existing
    from public.world_chat_turns as turns
   where turns.room_id = p_room_id
     and turns.client_turn_id = p_client_turn_id;

  if found then
    if v_existing.request_sha256 <> p_request_sha256
      or v_existing.session_id <> p_session_id
      or v_existing.expected_revision <> p_expected_revision
      or v_existing.from_node_id <> p_from_node_id
      or v_existing.to_node_id <> p_to_node_id
      or v_existing.source_kind <> p_source_kind
      or v_existing.authored_input_id <> p_authored_input_id
    then
      raise exception using errcode = '23505', message = 'CHAT_CLIENT_TURN_CONFLICT';
    end if;

    return query
      select
        v_existing.id,
        v_existing.committed_revision,
        v_existing.last_message_sequence,
        v_existing.to_node_id,
        true;
    return;
  end if;

  -- A previously committed UUID replay is immutable and was returned above.
  -- Every new revision must recheck the room's exact signed release pin inside
  -- this transaction. 0032's implementation also retains release/head/key
  -- SHARE locks, so revocation or a minimum-version floor change cannot race
  -- between this decision and the room mutation below.
  if public.is_world_chat_release_pin_available(
    v_room.release_id,
    v_room.experience_id,
    v_room.release_version,
    v_room.release_manifest_sha256,
    v_room.release_channel
  ) is not true then
    raise exception using errcode = '55000', message = 'CHAT_RELEASE_UNAVAILABLE';
  end if;

  if v_room.status not in ('active', 'awaiting_child') then
    raise exception using errcode = '55000', message = 'CHAT_ROOM_NOT_ACTIVE';
  end if;

  if v_room.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'CHAT_STALE_REVISION';
  end if;

  if v_room.current_node_id <> p_from_node_id then
    raise exception using errcode = '40001', message = 'CHAT_CURRENT_NODE_MISMATCH';
  end if;

  select sessions.*
    into v_session
    from public.world_chat_sessions as sessions
   where sessions.room_id = p_room_id
     and sessions.id = p_session_id
   for update;

  if not found or v_session.ended_at is not null then
    raise exception using errcode = 'P0002', message = 'CHAT_SESSION_NOT_OPEN';
  end if;

  v_first_sequence := v_room.message_sequence + 1;
  v_last_sequence := v_room.message_sequence + v_message_count;

  insert into public.world_chat_turns (
    id,
    room_id,
    session_id,
    client_turn_id,
    request_sha256,
    source_kind,
    authored_input_id,
    from_node_id,
    to_node_id,
    expected_revision,
    committed_revision,
    first_message_sequence,
    last_message_sequence
  ) values (
    v_turn_id,
    p_room_id,
    p_session_id,
    p_client_turn_id,
    p_request_sha256,
    p_source_kind,
    p_authored_input_id,
    p_from_node_id,
    p_to_node_id,
    p_expected_revision,
    p_expected_revision + 1,
    v_first_sequence,
    v_last_sequence
  );

  insert into public.world_chat_messages (
    room_id,
    session_id,
    turn_id,
    sequence_no,
    actor,
    message_kind,
    authored_content_id,
    authored_context_id
  )
  select
    p_room_id,
    p_session_id,
    v_turn_id,
    v_room.message_sequence + message.ordinality,
    message.actor,
    message.message_kind,
    message.authored_content_id,
    case when message.ordinality = 1 then p_from_node_id else null end
  from unnest(p_message_actors, p_message_kinds, p_message_content_ids)
    with ordinality as message(actor, message_kind, authored_content_id, ordinality);

  insert into public.world_chat_events (
    room_id,
    session_id,
    turn_id,
    client_event_id,
    event_type,
    authored_content_id,
    room_revision
  ) values (
    p_room_id,
    p_session_id,
    v_turn_id,
    p_client_turn_id,
    'turn_committed',
    p_authored_input_id,
    p_expected_revision + 1
  );

  update public.world_chat_rooms
     set current_node_id = p_to_node_id,
         status = p_target_status,
         revision = p_expected_revision + 1,
         message_sequence = v_last_sequence,
         updated_at = now()
   where id = p_room_id;

  return query
    select
      v_turn_id,
      p_expected_revision + 1,
      v_last_sequence,
      p_to_node_id,
      false;
end;
$$;

comment on function public.commit_world_chat_authored_turn(
  text, text, text, text, text, uuid, uuid, uuid, text, bigint, text, text, text, text, text, text[], text[], text[]
) is
  'Service-role-only authored turn transaction: parent ownership+active consent recheck/lock, exact server-loaded release pin CAS before immutable replay or mutation, signed release pin recheck/lock for every new revision, room+session lock, revision/current-node/status CAS, and reference-only commit. Route auth/ownership/consent and approved graph validation remain mandatory first defenses.';

revoke execute on function public.commit_world_chat_authored_turn(
  text, text, text, text, text, uuid, uuid, uuid, text, bigint, text, text, text, text, text, text[], text[], text[]
) from public, anon, authenticated;
grant execute on function public.commit_world_chat_authored_turn(
  text, text, text, text, text, uuid, uuid, uuid, text, bigint, text, text, text, text, text, text[], text[], text[]
) to service_role;

-- ═══════════════════════════════════════════════════════
-- 6. Owner-readable / service-role-write RLS
-- ═══════════════════════════════════════════════════════
alter table public.world_chat_rooms enable row level security;
alter table public.world_chat_sessions enable row level security;
alter table public.world_chat_turns enable row level security;
alter table public.world_chat_messages enable row level security;
alter table public.world_chat_events enable row level security;

drop policy if exists world_chat_rooms_select_own on public.world_chat_rooms;
create policy world_chat_rooms_select_own
  on public.world_chat_rooms for select
  to authenticated
  using (
    exists (
      select 1 from public.children
      where children.id = world_chat_rooms.child_id
        and children.parent_id = auth.uid()::text
    )
  );

drop policy if exists world_chat_sessions_select_own on public.world_chat_sessions;
create policy world_chat_sessions_select_own
  on public.world_chat_sessions for select
  to authenticated
  using (
    exists (
      select 1
      from public.world_chat_rooms
      join public.children on children.id = world_chat_rooms.child_id
      where world_chat_rooms.id = world_chat_sessions.room_id
        and children.parent_id = auth.uid()::text
    )
  );

drop policy if exists world_chat_turns_select_own on public.world_chat_turns;
create policy world_chat_turns_select_own
  on public.world_chat_turns for select
  to authenticated
  using (
    exists (
      select 1
      from public.world_chat_rooms
      join public.children on children.id = world_chat_rooms.child_id
      where world_chat_rooms.id = world_chat_turns.room_id
        and children.parent_id = auth.uid()::text
    )
  );

drop policy if exists world_chat_messages_select_own on public.world_chat_messages;
create policy world_chat_messages_select_own
  on public.world_chat_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.world_chat_rooms
      join public.children on children.id = world_chat_rooms.child_id
      where world_chat_rooms.id = world_chat_messages.room_id
        and children.parent_id = auth.uid()::text
    )
  );

drop policy if exists world_chat_events_select_own on public.world_chat_events;
create policy world_chat_events_select_own
  on public.world_chat_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.world_chat_rooms
      join public.children on children.id = world_chat_rooms.child_id
      where world_chat_rooms.id = world_chat_events.room_id
        and children.parent_id = auth.uid()::text
    )
  );

-- RLS has no INSERT/UPDATE/DELETE policy. Make the grant boundary explicit as
-- defense in depth: authenticated parents may read their own rows only; every
-- mutation and the atomic turn RPC are service-role-only server operations.
revoke all on table
  public.world_chat_rooms,
  public.world_chat_sessions,
  public.world_chat_turns,
  public.world_chat_messages,
  public.world_chat_events
from public, anon, authenticated;

grant select on table
  public.world_chat_rooms,
  public.world_chat_sessions,
  public.world_chat_turns,
  public.world_chat_messages,
  public.world_chat_events
to authenticated;

grant select, insert, update, delete on table
  public.world_chat_rooms,
  public.world_chat_sessions,
  public.world_chat_turns,
  public.world_chat_messages,
  public.world_chat_events
to service_role;
