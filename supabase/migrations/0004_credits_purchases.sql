-- Kindy 크레딧 + 결제 시스템.
-- - credits: parent 별 크레딧 잔고 (영상 1편 = 1 크레딧)
-- - purchases: 결제 기록 (토스페이먼츠)
-- - 주 3회 구매 제한 (can_purchase)
-- - 신규 children 생성 시 +1 크레딧 자동 grant
-- - 영상 생성 시 consume_credit 로 atomic 차감

-- ═══════════════════════════════════════════════════════
-- 1. credits 테이블 — parent 단위 잔고
-- ═══════════════════════════════════════════════════════
create table if not exists credits (
  parent_id text primary key,
  balance int not null default 0 check (balance >= 0),
  lifetime_granted int not null default 0,
  lifetime_purchased int not null default 0,
  lifetime_consumed int not null default 0,
  updated_at timestamptz default now()
);

comment on table credits is 'Kindy 크레딧 잔고 (영상 1편=1 credit). parent_id 기준 단일 row.';

-- ═══════════════════════════════════════════════════════
-- 2. purchases 테이블 — 결제 기록 (토스페이먼츠)
-- ═══════════════════════════════════════════════════════
create table if not exists purchases (
  id uuid default gen_random_uuid() primary key,
  parent_id text not null,
  bundle_type text not null check (bundle_type in ('single', 'pack6', 'pack15')),
  credits_added int not null check (credits_added > 0),
  amount_krw int not null check (amount_krw > 0),
  payment_provider text not null default 'toss',
  payment_key text,                          -- 토스페이먼츠 paymentKey
  order_id text unique,                      -- 우리 내부 orderId (idempotency)
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'canceled')),
  raw_response jsonb,                        -- 토스 webhook payload 원본 보관
  created_at timestamptz default now(),
  paid_at timestamptz,
  failed_reason text
);

create index if not exists idx_purchases_parent_created on purchases(parent_id, created_at desc);
create index if not exists idx_purchases_status on purchases(status);

-- ═══════════════════════════════════════════════════════
-- 3. 주 3회 구매 제한 체크 함수
-- ═══════════════════════════════════════════════════════
create or replace function can_purchase(p_parent_id text)
returns table (allowed boolean, recent_count int, next_available_at timestamptz)
language sql stable as $$
  with recent as (
    select
      count(*)::int as cnt,
      min(created_at) as oldest
    from purchases
    where parent_id = p_parent_id
      and status in ('paid', 'pending')
      and created_at > now() - interval '7 days'
  )
  select
    (cnt < 3) as allowed,
    cnt as recent_count,
    case when cnt >= 3 then oldest + interval '7 days' else null end as next_available_at
  from recent;
$$;

comment on function can_purchase is '최근 7일간 paid+pending 구매가 3건 미만이면 true. API route 에서 결제 시작 전 반드시 호출.';

-- ═══════════════════════════════════════════════════════
-- 4. 크레딧 atomic 차감 (영상 생성 시)
-- ═══════════════════════════════════════════════════════
create or replace function consume_credit(p_parent_id text)
returns boolean
language sql as $$
  with updated as (
    update credits
      set balance = balance - 1,
          lifetime_consumed = lifetime_consumed + 1,
          updated_at = now()
    where parent_id = p_parent_id and balance > 0
    returning 1
  )
  select exists (select 1 from updated);
$$;

comment on function consume_credit is 'atomic decrement. 잔고 0 이면 false 반환 — orchestrator 는 영상 생성 거부.';

-- ═══════════════════════════════════════════════════════
-- 5. 결제 완료 시 크레딧 증가 (토스 webhook → API → 이 함수 호출)
-- ═══════════════════════════════════════════════════════
drop function if exists grant_credits_on_purchase(uuid);
create function grant_credits_on_purchase(p_purchase_id uuid)
returns int
language sql as $$
  with paid as (
    select parent_id, credits_added
    from purchases
    where id = p_purchase_id and status = 'paid'
  ),
  upsert as (
    insert into credits (parent_id, balance, lifetime_purchased)
    select parent_id, credits_added, credits_added from paid
    on conflict (parent_id) do update
      set balance = credits.balance + excluded.balance,
          lifetime_purchased = credits.lifetime_purchased + excluded.lifetime_purchased,
          updated_at = now()
    returning balance
  )
  select credits_added from paid;
$$;

comment on function grant_credits_on_purchase is
  '결제 webhook 후 호출. paid 가 아닌 purchase 는 0/null 반환 (API 가 체크).';

-- ═══════════════════════════════════════════════════════
-- 6. 신규 children 생성 시 첫 크레딧 +1 자동 grant
-- ═══════════════════════════════════════════════════════
create or replace function grant_initial_credit_trigger()
returns trigger
language plpgsql as $$
begin
  -- 동일 parent 가 아이 2명 등록해도 parent 당 1회만 grant.
  -- credits row 가 없을 때만 (parent_id, 1, 1) 삽입. 이미 있으면 do nothing.
  insert into credits (parent_id, balance, lifetime_granted)
  values (NEW.parent_id, 1, 1)
  on conflict (parent_id) do nothing;
  return NEW;
end;
$$;

drop trigger if exists children_initial_credit on children;
create trigger children_initial_credit
  after insert on children
  for each row execute function grant_initial_credit_trigger();

comment on trigger children_initial_credit on children is
  '첫 아이 등록 시 parent 에게 무료 1 크레딧. 동일 parent 가 추가 아이 등록해도 추가 grant 없음.';
