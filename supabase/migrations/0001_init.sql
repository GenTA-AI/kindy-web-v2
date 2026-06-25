-- Kindy 초기 스키마.
-- children / videos / view_events / emoji_reactions / quiz_results / word_profiles
-- parent_id 는 현재 MVP 에서 text 리터럴 ('demo-parent'). 추후 Supabase auth.users 연결 예정.

-- ═══════════════════════════════════════════════════════
-- 1. children — 아이 프로필
-- ═══════════════════════════════════════════════════════
create table if not exists children (
  id uuid default gen_random_uuid() primary key,
  parent_id text not null,
  name text not null,
  age int not null check (age between 3 and 12),
  styles text[] not null default '{}',
  topics text[] not null default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_children_parent on children(parent_id);

comment on table children is 'Kindy 아이 프로필. 한 parent 가 여러 아이 보유 가능.';

-- ═══════════════════════════════════════════════════════
-- 2. videos — 생성된 영상 (파이프라인 컬럼은 0002 에서 추가)
-- ═══════════════════════════════════════════════════════
create table if not exists videos (
  id uuid default gen_random_uuid() primary key,
  child_id uuid not null references children(id) on delete cascade,
  title text not null,
  description text default '',
  video_url text,
  thumbnail_url text,
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  duration_sec int,
  prompt_used text,
  adjectives_used text[] not null default '{}',
  style_tags text[] not null default '{}',
  topic text not null default '',
  episode_number int not null default 1,
  created_at timestamptz default now()
);

create index if not exists idx_videos_child_episode on videos(child_id, episode_number desc);
create index if not exists idx_videos_status on videos(status);

comment on table videos is 'Kindy 영상. 파이프라인 단계·비용 컬럼은 0002 에서 확장.';

-- ═══════════════════════════════════════════════════════
-- 3. view_events — 시청 이벤트 (play/pause/seek/drop_off/complete)
-- ═══════════════════════════════════════════════════════
create table if not exists view_events (
  id uuid default gen_random_uuid() primary key,
  video_id uuid not null references videos(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  event_type text not null check (event_type in (
    'play', 'pause', 'seek_forward', 'seek_backward',
    'segment_replay', 'drop_off', 'complete'
  )),
  timestamp_sec numeric not null default 0,
  segment_start numeric,
  segment_end numeric,
  created_at timestamptz default now()
);

create index if not exists idx_view_events_video on view_events(video_id, created_at);
create index if not exists idx_view_events_child on view_events(child_id, created_at desc);

comment on table view_events is 'GACS-3 피드백 루프용 raw 시청 이벤트. word_profile 재계산 input.';

-- ═══════════════════════════════════════════════════════
-- 4. emoji_reactions — 영상 종료 후 감정 리액션
-- ═══════════════════════════════════════════════════════
create table if not exists emoji_reactions (
  id uuid default gen_random_uuid() primary key,
  video_id uuid not null references videos(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  reaction text not null check (reaction in ('happy', 'neutral', 'sad')),
  created_at timestamptz default now()
);

create index if not exists idx_emoji_video on emoji_reactions(video_id);

comment on table emoji_reactions is '영상 끝난 뒤 아이가 누른 이모지. happy=1.0 / neutral=0.5 / sad=0.0 가중치.';

-- ═══════════════════════════════════════════════════════
-- 5. quiz_results — 퀴즈 응답
-- ═══════════════════════════════════════════════════════
create table if not exists quiz_results (
  id uuid default gen_random_uuid() primary key,
  video_id uuid not null references videos(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  question text not null,
  options text[] not null,
  correct_answer int not null,
  selected_answer int not null,
  is_correct boolean not null,
  created_at timestamptz default now()
);

create index if not exists idx_quiz_child on quiz_results(child_id, created_at desc);

comment on table quiz_results is '영상 이후 퀴즈 응답. 정답률로 난이도/주제 가중치 조정.';

-- ═══════════════════════════════════════════════════════
-- 6. word_profiles — 아이별 선호 형용사/가중치 (GACS-3)
-- ═══════════════════════════════════════════════════════
create table if not exists word_profiles (
  child_id uuid primary key references children(id) on delete cascade,
  preferred_adjectives text[] not null default '{}',
  avoid_adjectives text[] not null default '{}',
  weights jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

comment on table word_profiles is 'GACS-3 rule-based 개인화 프로필. view_events + quiz_results 에서 재계산.';
