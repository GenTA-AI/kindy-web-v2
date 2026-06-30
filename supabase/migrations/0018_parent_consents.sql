-- 보호자 동의 기록.
-- 아이 프로필/활동 기록 생성 전에 받은 필수 동의의 서버-side evidence.
-- 개인정보 최소화를 위해 IP/user-agent 는 저장하지 않고, 동의 시각/버전/범위만 보존한다.

create table if not exists public.parent_consents (
  id                    uuid primary key default gen_random_uuid(),
  parent_id             text not null,
  child_id              uuid references public.children(id) on delete set null,
  consent_scope         text not null default 'child_profile_activity',
  terms_version         text not null,
  privacy_version       text not null,
  child_consent_version text not null,
  consent_method        text not null default 'onboarding_checkbox',
  created_at            timestamptz not null default now()
);

create index if not exists idx_parent_consents_parent
  on public.parent_consents (parent_id, created_at desc);

create index if not exists idx_parent_consents_child
  on public.parent_consents (child_id, created_at desc)
  where child_id is not null;

comment on table public.parent_consents is
  '보호자/법정대리인이 아이 프로필 및 활동 기록 수집에 동의한 시각과 약관/개인정보 버전.';

alter table public.parent_consents enable row level security;

drop policy if exists parent_consents_select_own on public.parent_consents;
create policy parent_consents_select_own
  on public.parent_consents for select
  to authenticated
  using (parent_id = auth.uid()::text);

-- insert/update/delete 정책 없음: 쓰기는 service-role API route 전용.
