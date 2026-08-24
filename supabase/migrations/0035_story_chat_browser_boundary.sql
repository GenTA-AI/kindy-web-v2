-- Make the server-rendered story-chat API the only browser-readable surface.
--
-- 0031 originally allowed authenticated parents to SELECT reference-only chat
-- rows directly through PostgREST. Those rows still contain private runtime
-- identifiers (release pins, authored node references, session/turn IDs) and
-- bypass route-level consent, runtime kill-switch, verified release rendering,
-- and short-lived asset URL projection. Browser roles therefore receive no
-- direct table privilege or SELECT policy; the server runtime reads with its
-- dedicated backend identity and returns a strict rendered DTO.

alter table public.world_chat_rooms enable row level security;
alter table public.world_chat_sessions enable row level security;
alter table public.world_chat_turns enable row level security;
alter table public.world_chat_messages enable row level security;
alter table public.world_chat_events enable row level security;

drop policy if exists world_chat_rooms_select_own on public.world_chat_rooms;
drop policy if exists world_chat_sessions_select_own on public.world_chat_sessions;
drop policy if exists world_chat_turns_select_own on public.world_chat_turns;
drop policy if exists world_chat_messages_select_own on public.world_chat_messages;
drop policy if exists world_chat_events_select_own on public.world_chat_events;

revoke all on table
  public.world_chat_rooms,
  public.world_chat_sessions,
  public.world_chat_turns,
  public.world_chat_messages,
  public.world_chat_events
from public, anon, authenticated;

-- PostgreSQL GRANT is additive. 0031 granted direct DML to service_role, so a
-- later GRANT SELECT does not narrow that privilege by itself. Remove the
-- inherited table privileges first; reviewed SECURITY DEFINER RPCs remain the
-- only mutation boundary.
revoke all on table
  public.world_chat_rooms,
  public.world_chat_sessions,
  public.world_chat_turns,
  public.world_chat_messages,
  public.world_chat_events
from service_role;

grant select on table
  public.world_chat_rooms,
  public.world_chat_sessions,
  public.world_chat_turns,
  public.world_chat_messages,
  public.world_chat_events
to service_role;

comment on table public.world_chat_rooms is
  'Server-only story-chat state. Browser roles cannot SELECT this table; authenticated clients use the consent-gated rendered chat API.';
comment on table public.world_chat_sessions is
  'Server-only story-chat session state. Browser responses expose only the bounded session receipt required to continue a room.';
comment on table public.world_chat_turns is
  'Server-only idempotency and authored transition evidence. Raw turn rows are never a browser API.';
comment on table public.world_chat_messages is
  'Server-only authored references. The browser receives only server-verified ContentRelease render projections.';
comment on table public.world_chat_events is
  'Server-only operational evidence. Direct browser reads are denied.';
