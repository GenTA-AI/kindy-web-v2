-- view_events 가 라이브러리 영상도 추적하도록 확장.
-- 기존 video_id (개인화 영상) + 신규 library_video_id (라이브러리). 정확히 하나만 non-null.

alter table public.view_events
  add column if not exists library_video_id uuid references public.library_videos(id);

-- 기존 video_id 가 not null 이었다면 nullable 로 변경.
alter table public.view_events alter column video_id drop not null;

-- 정확히 하나만 채워져야 함.
alter table public.view_events drop constraint if exists view_events_target_check;
alter table public.view_events add constraint view_events_target_check
  check (
    (video_id is not null and library_video_id is null)
    or (video_id is null and library_video_id is not null)
  );

create index if not exists idx_view_events_library_video on public.view_events (library_video_id, child_id) where library_video_id is not null;

-- RLS 정책: library_video 시청도 child 의 parent 만 insert 가능.
-- 기존 0006 의 view_events_insert_own 정책은 child_id 기반이라 그대로 작동.
-- 추가로 library_video_id 가 published=true 인 row 만 insert 가능하게 강화.
drop policy if exists view_events_insert_own_library on public.view_events;
create policy view_events_insert_own_library
  on public.view_events
  as restrictive
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.children
      where children.id = view_events.child_id
        and children.parent_id = auth.uid()::text
    )
    and (
      library_video_id is null
      or exists (
        select 1 from public.library_videos
        where library_videos.id = view_events.library_video_id
          and library_videos.published = true
      )
    )
  );

comment on column public.view_events.library_video_id is '라이브러리 영상 시청 시 사용. video_id 와 정확히 하나만 non-null.';
