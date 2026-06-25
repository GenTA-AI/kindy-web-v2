-- eduvid database schema

-- Children
create table if not exists children (
  id uuid default gen_random_uuid() primary key,
  parent_id text not null,
  name text not null,
  age integer not null check (age >= 3 and age <= 8),
  styles text[] not null default '{}',
  topics text[] not null default '{}',
  created_at timestamptz default now()
);

-- Videos
create table if not exists videos (
  id uuid default gen_random_uuid() primary key,
  child_id uuid references children(id) on delete cascade,
  title text not null,
  description text default '',
  video_url text,
  thumbnail_url text,
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  duration_sec integer,
  prompt_used text,
  adjectives_used text[] default '{}',
  style_tags text[] default '{}',
  topic text default '',
  episode_number integer not null default 1,
  created_at timestamptz default now()
);

-- View events (시청 행동 데이터)
create table if not exists view_events (
  id uuid default gen_random_uuid() primary key,
  video_id uuid references videos(id) on delete cascade,
  child_id uuid references children(id) on delete cascade,
  event_type text not null check (event_type in ('play', 'pause', 'seek_forward', 'seek_backward', 'segment_replay', 'drop_off', 'complete')),
  timestamp_sec real not null default 0,
  segment_start real,
  segment_end real,
  created_at timestamptz default now()
);

-- Emoji reactions
create table if not exists emoji_reactions (
  id uuid default gen_random_uuid() primary key,
  video_id uuid references videos(id) on delete cascade,
  child_id uuid references children(id) on delete cascade,
  reaction text not null check (reaction in ('happy', 'neutral', 'sad')),
  created_at timestamptz default now()
);

-- Quiz results
create table if not exists quiz_results (
  id uuid default gen_random_uuid() primary key,
  video_id uuid references videos(id) on delete cascade,
  child_id uuid references children(id) on delete cascade,
  question text not null,
  options text[] not null,
  correct_answer integer not null,
  selected_answer integer not null,
  is_correct boolean not null,
  created_at timestamptz default now()
);

-- Word profiles (GACS-3)
create table if not exists word_profiles (
  id uuid default gen_random_uuid() primary key,
  child_id uuid references children(id) on delete cascade unique,
  preferred_adjectives text[] default '{}',
  avoid_adjectives text[] default '{}',
  weights jsonb default '{}',
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists idx_videos_child on videos(child_id);
create index if not exists idx_events_video on view_events(video_id);
create index if not exists idx_events_child on view_events(child_id);
create index if not exists idx_reactions_video on emoji_reactions(video_id);
create index if not exists idx_quiz_video on quiz_results(video_id);
