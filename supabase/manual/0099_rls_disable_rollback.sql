-- EMERGENCY ROLLBACK ONLY — 평상시 적용 금지.
-- RLS 정책 오류로 prod fetch 가 0건이 되는 경우에만 수동 적용.

alter table if exists public.children disable row level security;
alter table if exists public.videos disable row level security;
alter table if exists public.credits disable row level security;
alter table if exists public.purchases disable row level security;
alter table if exists public.view_events disable row level security;
alter table if exists public.emoji_reactions disable row level security;
alter table if exists public.reactions disable row level security;
alter table if exists public.quiz_results disable row level security;
alter table if exists public.word_profiles disable row level security;
alter table if exists public.waitlist disable row level security;
alter table if exists public.invite_codes disable row level security;
alter table if exists public.invite_redemptions disable row level security;
