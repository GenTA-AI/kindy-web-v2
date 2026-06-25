-- Closed beta waitlist and invite gate schema for Phase C.

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  created_at timestamptz default now()
);

create table if not exists public.invite_codes (
  code text primary key,
  max_uses int not null default 1,
  used_count int not null default 0,
  expires_at timestamptz,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.invite_redemptions (
  code text references public.invite_codes(code),
  parent_id uuid not null,
  redeemed_at timestamptz default now(),
  primary key (code, parent_id)
);

alter table public.waitlist enable row level security;
alter table public.invite_codes enable row level security;
alter table public.invite_redemptions enable row level security;

-- waitlist: anyone can join; reads are service_role only via RLS bypass.
drop policy if exists waitlist_insert_own on public.waitlist;

create policy waitlist_insert_own
  on public.waitlist for insert
  to anon, authenticated
  with check (true);

-- invite_codes: no explicit policy. service_role bypass is the only intended access path.

-- invite_redemptions: parents can read their own redemptions; writes are service_role only.
drop policy if exists invite_redemptions_select_own on public.invite_redemptions;

create policy invite_redemptions_select_own
  on public.invite_redemptions for select
  to authenticated
  using (parent_id = auth.uid());
