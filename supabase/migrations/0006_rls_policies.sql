-- Enable RLS for user-scoped application tables.
-- Existing parent_id columns are text, so auth.uid() is cast to text.

alter table public.children enable row level security;
alter table public.videos enable row level security;
alter table public.credits enable row level security;
alter table public.purchases enable row level security;
alter table public.view_events enable row level security;
alter table public.emoji_reactions enable row level security;
alter table public.quiz_results enable row level security;
alter table public.word_profiles enable row level security;

-- children: parent owns rows by children.parent_id.
drop policy if exists children_select_own on public.children;
drop policy if exists children_insert_own on public.children;
drop policy if exists children_update_own on public.children;
drop policy if exists children_delete_own on public.children;

create policy children_select_own
  on public.children for select
  using (parent_id = auth.uid()::text);

create policy children_insert_own
  on public.children for insert
  with check (parent_id = auth.uid()::text);

create policy children_update_own
  on public.children for update
  using (parent_id = auth.uid()::text)
  with check (parent_id = auth.uid()::text);

create policy children_delete_own
  on public.children for delete
  using (parent_id = auth.uid()::text);

-- videos: parent owns rows through videos.child_id -> children.parent_id.
drop policy if exists videos_select_own on public.videos;
drop policy if exists videos_insert_own on public.videos;
drop policy if exists videos_update_own on public.videos;
drop policy if exists videos_delete_own on public.videos;

create policy videos_select_own
  on public.videos for select
  using (
    exists (
      select 1
      from public.children
      where children.id = videos.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy videos_insert_own
  on public.videos for insert
  with check (
    exists (
      select 1
      from public.children
      where children.id = videos.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy videos_update_own
  on public.videos for update
  using (
    exists (
      select 1
      from public.children
      where children.id = videos.child_id
        and children.parent_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1
      from public.children
      where children.id = videos.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy videos_delete_own
  on public.videos for delete
  using (
    exists (
      select 1
      from public.children
      where children.id = videos.child_id
        and children.parent_id = auth.uid()::text
    )
  );

-- credits: parent owns rows by credits.parent_id.
drop policy if exists credits_select_own on public.credits;
drop policy if exists credits_insert_own on public.credits;
drop policy if exists credits_update_own on public.credits;
drop policy if exists credits_delete_own on public.credits;

create policy credits_select_own
  on public.credits for select
  using (parent_id = auth.uid()::text);

create policy credits_insert_own
  on public.credits for insert
  with check (parent_id = auth.uid()::text);

create policy credits_update_own
  on public.credits for update
  using (parent_id = auth.uid()::text)
  with check (parent_id = auth.uid()::text);

create policy credits_delete_own
  on public.credits for delete
  using (parent_id = auth.uid()::text);

-- purchases: parent owns rows by purchases.parent_id.
drop policy if exists purchases_select_own on public.purchases;
drop policy if exists purchases_insert_own on public.purchases;
drop policy if exists purchases_update_own on public.purchases;
drop policy if exists purchases_delete_own on public.purchases;

create policy purchases_select_own
  on public.purchases for select
  using (parent_id = auth.uid()::text);

create policy purchases_insert_own
  on public.purchases for insert
  with check (parent_id = auth.uid()::text);

create policy purchases_update_own
  on public.purchases for update
  using (parent_id = auth.uid()::text)
  with check (parent_id = auth.uid()::text);

create policy purchases_delete_own
  on public.purchases for delete
  using (parent_id = auth.uid()::text);

-- view_events: parent owns rows through view_events.child_id -> children.parent_id.
drop policy if exists view_events_select_own on public.view_events;
drop policy if exists view_events_insert_own on public.view_events;
drop policy if exists view_events_update_own on public.view_events;
drop policy if exists view_events_delete_own on public.view_events;

create policy view_events_select_own
  on public.view_events for select
  using (
    exists (
      select 1
      from public.children
      where children.id = view_events.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy view_events_insert_own
  on public.view_events for insert
  with check (
    exists (
      select 1
      from public.children
      where children.id = view_events.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy view_events_update_own
  on public.view_events for update
  using (
    exists (
      select 1
      from public.children
      where children.id = view_events.child_id
        and children.parent_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1
      from public.children
      where children.id = view_events.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy view_events_delete_own
  on public.view_events for delete
  using (
    exists (
      select 1
      from public.children
      where children.id = view_events.child_id
        and children.parent_id = auth.uid()::text
    )
  );

-- emoji_reactions: the current schema's reactions table.
drop policy if exists emoji_reactions_select_own on public.emoji_reactions;
drop policy if exists emoji_reactions_insert_own on public.emoji_reactions;
drop policy if exists emoji_reactions_update_own on public.emoji_reactions;
drop policy if exists emoji_reactions_delete_own on public.emoji_reactions;

create policy emoji_reactions_select_own
  on public.emoji_reactions for select
  using (
    exists (
      select 1
      from public.children
      where children.id = emoji_reactions.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy emoji_reactions_insert_own
  on public.emoji_reactions for insert
  with check (
    exists (
      select 1
      from public.children
      where children.id = emoji_reactions.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy emoji_reactions_update_own
  on public.emoji_reactions for update
  using (
    exists (
      select 1
      from public.children
      where children.id = emoji_reactions.child_id
        and children.parent_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1
      from public.children
      where children.id = emoji_reactions.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy emoji_reactions_delete_own
  on public.emoji_reactions for delete
  using (
    exists (
      select 1
      from public.children
      where children.id = emoji_reactions.child_id
        and children.parent_id = auth.uid()::text
    )
  );

-- quiz_results: parent owns rows through quiz_results.child_id -> children.parent_id.
drop policy if exists quiz_results_select_own on public.quiz_results;
drop policy if exists quiz_results_insert_own on public.quiz_results;
drop policy if exists quiz_results_update_own on public.quiz_results;
drop policy if exists quiz_results_delete_own on public.quiz_results;

create policy quiz_results_select_own
  on public.quiz_results for select
  using (
    exists (
      select 1
      from public.children
      where children.id = quiz_results.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy quiz_results_insert_own
  on public.quiz_results for insert
  with check (
    exists (
      select 1
      from public.children
      where children.id = quiz_results.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy quiz_results_update_own
  on public.quiz_results for update
  using (
    exists (
      select 1
      from public.children
      where children.id = quiz_results.child_id
        and children.parent_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1
      from public.children
      where children.id = quiz_results.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy quiz_results_delete_own
  on public.quiz_results for delete
  using (
    exists (
      select 1
      from public.children
      where children.id = quiz_results.child_id
        and children.parent_id = auth.uid()::text
    )
  );

-- word_profiles: user-scoped through word_profiles.child_id -> children.parent_id.
drop policy if exists word_profiles_select_own on public.word_profiles;
drop policy if exists word_profiles_insert_own on public.word_profiles;
drop policy if exists word_profiles_update_own on public.word_profiles;
drop policy if exists word_profiles_delete_own on public.word_profiles;

create policy word_profiles_select_own
  on public.word_profiles for select
  using (
    exists (
      select 1
      from public.children
      where children.id = word_profiles.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy word_profiles_insert_own
  on public.word_profiles for insert
  with check (
    exists (
      select 1
      from public.children
      where children.id = word_profiles.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy word_profiles_update_own
  on public.word_profiles for update
  using (
    exists (
      select 1
      from public.children
      where children.id = word_profiles.child_id
        and children.parent_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1
      from public.children
      where children.id = word_profiles.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy word_profiles_delete_own
  on public.word_profiles for delete
  using (
    exists (
      select 1
      from public.children
      where children.id = word_profiles.child_id
        and children.parent_id = auth.uid()::text
    )
  );
