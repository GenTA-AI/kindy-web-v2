-- 사전 제작된 라이브러리 영상 카탈로그.
-- 운영자가 Inngest 로 영상 생성 후 이 테이블에 메타 등록 -> published=true 로 노출.

create table if not exists public.library_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  topic text not null,                -- 'science' | 'english' | 'hangul' | etc
  age_band int not null,              -- 5 | 6 | 7 (target age)
  style_tags text[] not null default '{}',  -- ['princess', 'kpop', 'space', ...]
  duration_sec int not null check (duration_sec > 0),
  video_url text not null,            -- GCS / signed URL
  thumbnail_url text,                 -- jpg/png preview
  character_name text not null default '미리',
  view_count int not null default 0,
  published boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_library_videos_seed_dedup on public.library_videos (title, topic, age_band);
create index if not exists idx_library_videos_published on public.library_videos (published, created_at desc) where published = true;
create index if not exists idx_library_videos_topic_age on public.library_videos (topic, age_band) where published = true;

alter table public.library_videos enable row level security;

-- 인증된 부모는 published=true 행만 read.
drop policy if exists library_videos_select_published on public.library_videos;
create policy library_videos_select_published
  on public.library_videos for select
  to authenticated
  using (published = true);

-- 익명 접근 안 함 (라이브러리는 가입 후 접근). service_role 은 자동 bypass.
-- insert/update/delete 정책 없음 -> service_role 만 가능.

comment on table public.library_videos is '사전 제작된 라이브러리 영상 카탈로그. 운영자만 service_role 로 insert. 인증 부모만 published=true 행 read.';
