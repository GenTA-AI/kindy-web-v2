-- 90s episode pipeline 메타: 씬 array + episode 단위 길이.
-- - scenes: 씬별 메타 (type, start, end, narration_text, dialogue_text, lipsync_required)
-- - episode_unit_sec: 30 (기존 short) 또는 90 (새 episode)

alter table public.library_videos
  add column if not exists scenes jsonb,
  add column if not exists episode_unit_sec int default 30;

create index if not exists idx_library_videos_episode_unit on public.library_videos (episode_unit_sec) where published = true;

comment on column public.library_videos.scenes is '90s episode pipeline 의 씬 메타 array. type=narration|character_speaking, lipsync_required boolean.';
comment on column public.library_videos.episode_unit_sec is 'episode 단위 초 — 30 (legacy) 또는 90 (research-compliant new pipeline).';
