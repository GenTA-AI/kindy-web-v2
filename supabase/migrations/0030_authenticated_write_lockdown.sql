-- 0030_authenticated_write_lockdown.sql
--
-- Revoke authenticated PostgREST mutation paths for economic, progress, and
-- content data. In particular, this prevents clients from forging paid
-- purchases, deleting trial/session or credit state, and selecting paywalled
-- library source rows (signed media URLs and scripts).
--
-- This does not break the application because the browser Supabase client is
-- used only for auth in login, onboarding, and attribution tracking. All data
-- reads and writes go through server code using the service-role client, which
-- bypasses RLS. The browser-client call sites were re-audited before writing
-- this migration and contain no PostgREST from()/rpc() data calls.
--
-- Rollback (human-gated, in a separate SQL session): keep RLS enabled and
-- recreate only the removed policies from their source migrations:
--   0006_rls_policies.sql          children and the original app-table policies
--   0011_view_events_library.sql   view_events_insert_own_library
--   0014_syllabus.sql              catalogue, enrollment, and progress policies
--   0016_game_events.sql           game session and round policies
--   0010_library_videos.sql        library_videos_select_published
--   0007_waitlist_invite.sql       waitlist_insert_own
-- Then restore function access only if direct client RPC is intentionally
-- reintroduced:
--   grant execute on function public.can_purchase(text) to public, anon, authenticated;
--   grant execute on function public.consume_credit(text) to public, anon, authenticated;
-- Do not use the manual RLS-disable rollback for this policy-only change.

-- children: retain children_select_own only. All mutations must pass through
-- /api/children so consent evidence and dependent progress/session integrity
-- cannot be bypassed (direct DELETE would also cascade into child-owned data).
drop policy if exists children_insert_own on public.children;
drop policy if exists children_update_own on public.children;
drop policy if exists children_delete_own on public.children;

-- Existing owner-scoped SELECT policies remain. Removing every DML policy
-- leaves authenticated users denied by default while service_role still
-- bypasses RLS, matching the 0024-0029 owner-select/service-role-write pattern.

drop policy if exists videos_insert_own on public.videos;
drop policy if exists videos_update_own on public.videos;
drop policy if exists videos_delete_own on public.videos;

drop policy if exists credits_insert_own on public.credits;
drop policy if exists credits_update_own on public.credits;
drop policy if exists credits_delete_own on public.credits;

drop policy if exists purchases_insert_own on public.purchases;
drop policy if exists purchases_update_own on public.purchases;
drop policy if exists purchases_delete_own on public.purchases;

drop policy if exists view_events_insert_own on public.view_events;
drop policy if exists view_events_insert_own_library on public.view_events;
drop policy if exists view_events_update_own on public.view_events;
drop policy if exists view_events_delete_own on public.view_events;

drop policy if exists emoji_reactions_insert_own on public.emoji_reactions;
drop policy if exists emoji_reactions_update_own on public.emoji_reactions;
drop policy if exists emoji_reactions_delete_own on public.emoji_reactions;

drop policy if exists quiz_results_insert_own on public.quiz_results;
drop policy if exists quiz_results_update_own on public.quiz_results;
drop policy if exists quiz_results_delete_own on public.quiz_results;

drop policy if exists word_profiles_insert_own on public.word_profiles;
drop policy if exists word_profiles_update_own on public.word_profiles;
drop policy if exists word_profiles_delete_own on public.word_profiles;

drop policy if exists syllabus_enrollments_insert_own on public.syllabus_enrollments;
drop policy if exists syllabus_enrollments_update_own on public.syllabus_enrollments;
drop policy if exists syllabus_enrollments_delete_own on public.syllabus_enrollments;

drop policy if exists lesson_progress_insert_own on public.lesson_progress;
drop policy if exists lesson_progress_update_own on public.lesson_progress;
drop policy if exists lesson_progress_delete_own on public.lesson_progress;

drop policy if exists game_sessions_insert_own on public.game_sessions;
drop policy if exists game_sessions_update_own on public.game_sessions;
drop policy if exists game_sessions_delete_own on public.game_sessions;

drop policy if exists game_rounds_insert_own on public.game_rounds;
drop policy if exists game_rounds_update_own on public.game_rounds;
drop policy if exists game_rounds_delete_own on public.game_rounds;

-- Published catalogue rows are also server-only. There are no browser Supabase
-- reads for this metadata; API routes use service_role. Removing all three
-- syllabus catalogue policies avoids leaving a partial direct catalogue path.
drop policy if exists library_videos_select_published on public.library_videos;
drop policy if exists syllabuses_select_published on public.syllabuses;
drop policy if exists syllabus_units_select_published on public.syllabus_units;
drop policy if exists syllabus_lessons_select_published on public.syllabus_lessons;

-- Waitlist registration is accepted only by /api/waitlist (service_role).
drop policy if exists waitlist_insert_own on public.waitlist;

-- Match 0022's server-side function privilege pattern. PostgreSQL grants
-- function EXECUTE to PUBLIC by default, so revoke both the umbrella role and
-- any explicit client-role grants before granting service_role explicitly.
revoke execute on function public.can_purchase(text) from public, anon, authenticated;
revoke execute on function public.consume_credit(text) from public, anon, authenticated;

grant execute on function public.can_purchase(text) to service_role;
grant execute on function public.consume_credit(text) to service_role;
