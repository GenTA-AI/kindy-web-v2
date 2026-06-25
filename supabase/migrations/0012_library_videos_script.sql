-- library_videos 에 대본 + 자막 URL 컬럼 추가.
-- - script: VideoScript JSON (퀴즈 생성용 — attention-quiz API 가 읽음)
-- - subtitles_url: WebVTT 또는 SRT 파일의 Supabase Storage signed URL

alter table public.library_videos
  add column if not exists script jsonb,
  add column if not exists subtitles_url text;

comment on column public.library_videos.script is 'Claude director가 생성한 VideoScript JSON. attention-quiz가 이것을 입력으로 사용.';
comment on column public.library_videos.subtitles_url is 'WebVTT 자막 파일 signed URL. 없으면 자막 토글 비활성.';
