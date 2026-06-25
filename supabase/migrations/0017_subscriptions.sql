-- 0017_subscriptions.sql
-- Kindy 멤버십 월 구독 (월 25,000원) — TossPayments v2 빌링(정기결제).
-- - billing_keys: 토스 빌링키 보관 (카드 등록 결과)
-- - subscriptions: 구독 상태 + 결제 주기
-- - entitlements: iPad 앱이 읽는 단일 진실 — is_premium / premium_until
-- - sync_entitlement(parent_id): subscriptions 로부터 entitlements 재계산 (security definer)
-- 쓰기는 전부 service-role(API route, RLS 우회) 전용. 부모는 본인 행 SELECT 만 가능.

create extension if not exists pgcrypto;

-- ═══════════════════════════════════════════════════════
-- 1. billing_keys — 토스 빌링키 (카드 등록)
-- ═══════════════════════════════════════════════════════
create table if not exists public.billing_keys (
  id           uuid primary key default gen_random_uuid(),
  parent_id    text not null,
  provider     text not null default 'toss',
  -- ⚠️ billing_key 평문 저장 금지(실서비스).
  -- TODO(보안): 실서비스 전환 전 pgsodium / Supabase Vault 또는 앱 레벨 AES-GCM 암호화 적용.
  -- 테스트 모드(test_sk_*)에서만 평문 허용. 유출 시 임의 결제 가능한 민감 정보임.
  billing_key  text not null,
  card_summary text,                       -- 예: '신한 **** 1234' (표시용, 민감정보 아님)
  created_at   timestamptz not null default now()
);

create index if not exists idx_billing_keys_parent on public.billing_keys (parent_id, created_at desc);

comment on table public.billing_keys is
  '토스 빌링키. billing_key 컬럼은 실서비스에서 평문 저장 금지 — 암호화 TODO 참조.';

-- ═══════════════════════════════════════════════════════
-- 2. subscriptions — 구독 상태
-- ═══════════════════════════════════════════════════════
create table if not exists public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  parent_id            text not null,
  status               text not null default 'active'
                         check (status in ('active', 'past_due', 'canceled', 'expired')),
  plan                 text not null default 'kindy_monthly',
  price_krw            int not null default 25000,
  billing_key_id       uuid references public.billing_keys(id),
  current_period_start timestamptz,
  current_period_end   timestamptz,
  canceled_at          timestamptz,        -- 해지 신청 시각. 기간 만료까지는 혜택 유지.
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_subscriptions_parent on public.subscriptions (parent_id, created_at desc);
create index if not exists idx_subscriptions_status_period
  on public.subscriptions (status, current_period_end);

comment on table public.subscriptions is
  'Kindy 멤버십 구독. canceled 는 기간말 해지(현재 기간 끝까지 premium 유지).';

-- ═══════════════════════════════════════════════════════
-- 3. entitlements — iPad 앱이 읽는 권한 테이블 (parent 당 1행)
-- ═══════════════════════════════════════════════════════
create table if not exists public.entitlements (
  parent_id     text primary key,
  is_premium    boolean not null default false,
  premium_until timestamptz,
  source        text,                      -- 'subscription' 등 (권한 출처)
  updated_at    timestamptz not null default now()
);

comment on table public.entitlements is
  'iPad 앱이 읽는 권한 단일 진실. sync_entitlement() 가 subscriptions 로부터 재계산.';

-- ═══════════════════════════════════════════════════════
-- 4. sync_entitlement — subscriptions → entitlements 재계산
-- ═══════════════════════════════════════════════════════
create or replace function public.sync_entitlement(p_parent_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_until timestamptz;
begin
  -- premium 판정: expired 가 아닌 구독 중 현재 기간이 아직 안 끝난 것.
  -- canceled(기간말 해지)도 current_period_end 까지는 premium 유지.
  select max(current_period_end)
    into v_until
    from public.subscriptions
   where parent_id = p_parent_id
     and status in ('active', 'past_due', 'canceled')
     and current_period_end > now();

  insert into public.entitlements (parent_id, is_premium, premium_until, source, updated_at)
  values (p_parent_id, v_until is not null, v_until, 'subscription', now())
  on conflict (parent_id) do update
    set is_premium    = excluded.is_premium,
        premium_until = excluded.premium_until,
        source        = excluded.source,
        updated_at    = now();
end;
$$;

comment on function public.sync_entitlement is
  '구독 상태 변경(결제/해지/webhook) 후 반드시 호출. service-role API 에서 rpc 로 사용.';

-- ═══════════════════════════════════════════════════════
-- 5. RLS — 부모는 본인 행 SELECT 만, 쓰기는 service-role 전용
--    (insert/update/delete 정책 없음 = deny by default)
-- ═══════════════════════════════════════════════════════
alter table public.billing_keys enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;

drop policy if exists billing_keys_select_own on public.billing_keys;
create policy billing_keys_select_own
  on public.billing_keys for select
  to authenticated
  using (parent_id = auth.uid()::text);

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
  on public.subscriptions for select
  to authenticated
  using (parent_id = auth.uid()::text);

drop policy if exists entitlements_select_own on public.entitlements;
create policy entitlements_select_own
  on public.entitlements for select
  to authenticated
  using (parent_id = auth.uid()::text);

-- ═══════════════════════════════════════════════════════
-- 6. purchases 확장 — 구독 결제 기록도 purchases 에 적재
--    (bundle_type 'subscription' 허용, credits_added 0 허용)
-- ═══════════════════════════════════════════════════════
alter table public.purchases drop constraint if exists purchases_bundle_type_check;
alter table public.purchases
  add constraint purchases_bundle_type_check
  check (bundle_type in ('single', 'pack6', 'pack15', 'subscription'));

alter table public.purchases drop constraint if exists purchases_credits_added_check;
alter table public.purchases
  add constraint purchases_credits_added_check
  check (credits_added >= 0);

-- 주 3회 구매 제한(can_purchase)은 크레딧 번들 전용 — 구독 결제는 제외.
create or replace function can_purchase(p_parent_id text)
returns table (allowed boolean, recent_count int, next_available_at timestamptz)
language sql stable as $$
  with recent as (
    select
      count(*)::int as cnt,
      min(created_at) as oldest
    from purchases
    where parent_id = p_parent_id
      and bundle_type <> 'subscription'
      and status in ('paid', 'pending')
      and created_at > now() - interval '7 days'
  )
  select
    (cnt < 3) as allowed,
    cnt as recent_count,
    case when cnt >= 3 then oldest + interval '7 days' else null end as next_available_at
  from recent;
$$;

comment on function can_purchase is
  '최근 7일간 paid+pending 크레딧 번들 구매가 3건 미만이면 true. 구독(subscription) 결제는 제한에서 제외.';
