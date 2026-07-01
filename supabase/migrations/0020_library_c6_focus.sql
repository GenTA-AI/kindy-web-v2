-- 0020: 라이브러리 영상에 C6 초점 태그 추가 (선별 기반 초개인화).
--
-- per-child 생성은 비용/노동 문제로 베타. 대신 공유 라이브러리를 아이 약점(C6 도구)에
-- 맞춰 재정렬해 "나에게 맞춰지는" 경험을 한계비용 0으로 준다. 이 컬럼이 그 초점을 담는다.
-- 값: observe | imagine | pattern | transform | design | compose (null=미태깅).
-- 운영자/매트릭스 생성 스크립트가 영상 등록 시 채운다.

alter table public.library_videos
  add column if not exists c6_focus text;

create index if not exists idx_library_videos_c6_focus
  on public.library_videos (c6_focus, age_band)
  where published = true and c6_focus is not null;

comment on column public.library_videos.c6_focus is
  '이 영상이 주로 연습시키는 C6 창의도구. 선별 기반 개인화(약점 우선 배치)에 사용. null=미태깅.';
