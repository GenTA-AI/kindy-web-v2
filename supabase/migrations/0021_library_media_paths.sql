-- P0-3 (docs/07): 서명 URL 30일 박제 해소.
-- 기존에는 생성 스크립트가 30일짜리 signed URL을 video_url/thumbnail_url/subtitles_url에
-- insert 시점 고정 저장 → 생성 ~30일 뒤 전 구독자 동시 재생 불가.
-- 이제 storage 경로를 별도 컬럼에 저장하고, 서빙 경로(/api/library, /play)가 요청당 재서명한다.
-- *_url 컬럼은 (a) 경로 없는 번들/로컬 자산(/demo-videos/...)의 원본 URL, (b) 재서명 실패 시 폴백으로 유지.

alter table public.library_videos
  add column if not exists video_path text,
  add column if not exists thumbnail_path text,
  add column if not exists subtitles_path text;

comment on column public.library_videos.video_path is
  'videos 버킷 내 storage 경로(예: library/<slug>/final.mp4). 있으면 서빙 시 요청당 재서명. null이면 video_url 원문 사용(번들 자산).';
comment on column public.library_videos.thumbnail_path is
  'videos 버킷 내 썸네일 경로. 있으면 서빙 시 요청당 재서명.';
comment on column public.library_videos.subtitles_path is
  'videos 버킷 내 자막(vtt) 경로. 있으면 서빙 시 요청당 재서명.';

-- 백필: 이미 signed URL로 저장된 행에서 경로를 추출한다.
-- supabase-js signed URL 형식: <base>/storage/v1/object/sign/videos/<path>?token=...
update public.library_videos
set video_path = substring(video_url from '/storage/v1/object/sign/videos/([^?]+)')
where video_path is null
  and video_url like '%/storage/v1/object/sign/videos/%';

update public.library_videos
set thumbnail_path = substring(thumbnail_url from '/storage/v1/object/sign/videos/([^?]+)')
where thumbnail_path is null
  and thumbnail_url like '%/storage/v1/object/sign/videos/%';

update public.library_videos
set subtitles_path = substring(subtitles_url from '/storage/v1/object/sign/videos/([^?]+)')
where subtitles_path is null
  and subtitles_url like '%/storage/v1/object/sign/videos/%';
