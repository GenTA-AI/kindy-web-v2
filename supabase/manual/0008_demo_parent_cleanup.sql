-- DESTRUCTIVE — 사용자 승인 후 수동 적용. 적용 전 백업 필수.
-- 주의: 적용 전 백업. 이 파일은 자동 적용 금지, 사용자 승인 후 수동 실행.

-- Delete demo-parent view events.
delete from public.view_events
where child_id in (
  select id from public.children where parent_id = 'demo-parent'
);

-- Delete demo-parent reactions from the current reactions table.
delete from public.emoji_reactions
where child_id in (
  select id from public.children where parent_id = 'demo-parent'
);

-- Delete demo-parent quiz results.
delete from public.quiz_results
where child_id in (
  select id from public.children where parent_id = 'demo-parent'
);

-- Delete demo-parent videos.
delete from public.videos
where child_id in (
  select id from public.children where parent_id = 'demo-parent'
);

-- Delete demo-parent credits.
delete from public.credits
where parent_id = 'demo-parent';

-- Delete demo-parent purchases.
delete from public.purchases
where parent_id = 'demo-parent';

-- Delete demo-parent children.
delete from public.children
where parent_id = 'demo-parent';

-- Delete demo-parent parent row if a parents table exists in this environment.
do $$
begin
  if to_regclass('public.parents') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'parents'
        and column_name = 'id'
    ) then
      execute 'delete from public.parents where id::text = $1' using 'demo-parent';
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'parents'
        and column_name = 'parent_id'
    ) then
      execute 'delete from public.parents where parent_id::text = $1' using 'demo-parent';
    end if;
  end if;
end $$;

-- ROLLBACK: 백업에서 복원 외 방법 없음. 적용 전 dump 필수.
