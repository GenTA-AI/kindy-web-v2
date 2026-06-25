-- 첫 아이 등록 시 +3 크레딧 (랜딩 "맞춤 영상 3개 무료 체험" 약속과 일치).
-- 0004 의 grant_initial_credit_trigger() 를 1 → 3 으로 상향.
-- 기존 credits row 는 on conflict do nothing 이라 영향 없음.

create or replace function grant_initial_credit_trigger()
returns trigger
language plpgsql as $$
begin
  -- 동일 parent 가 아이 2명 등록해도 parent 당 1회만 grant.
  -- credits row 가 없을 때만 (parent_id, 3, 3) 삽입. 이미 있으면 do nothing.
  insert into credits (parent_id, balance, lifetime_granted)
  values (NEW.parent_id, 3, 3)
  on conflict (parent_id) do nothing;
  return NEW;
end;
$$;

comment on trigger children_initial_credit on children is
  '첫 아이 등록 시 parent 에게 무료 3 크레딧. 동일 parent 가 추가 아이 등록해도 추가 grant 없음.';
