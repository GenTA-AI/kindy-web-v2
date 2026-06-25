-- ═══════════════════════════════════════════════════════════════
-- 0014_syllabus.sql — 커리큘럼 척추(syllabus spine).
-- library_videos + attention-quiz 위에 단원/차시 + 아이별 진도를 얹는다.
-- subject-agnostic: 과목은 syllabuses.subject 문자열로 표현 (테이블에 과목 하드코딩 금지).
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. syllabuses — 한 과목/연령대의 커리큘럼 한 벌 (카탈로그성, cross-tenant)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.syllabuses (
  id uuid primary key default gen_random_uuid(),
  subject text not null,                 -- 'korean_reading' | 'math' | ... (과목 무관 키)
  age_band int not null,                 -- 5 | 6 | 7 (대표 연령)
  level_code text not null,              -- 'K1' | 'K2' 등 운영자용 레벨 코드
  title text not null,
  description text,
  sort_order int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_syllabuses_published
  on public.syllabuses (published, subject, age_band, sort_order)
  where published = true;

-- ───────────────────────────────────────────────────────────────
-- 2. syllabus_units — 단원 (카탈로그성)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.syllabus_units (
  id uuid primary key default gen_random_uuid(),
  syllabus_id uuid not null references public.syllabuses(id) on delete cascade,
  title text not null,
  description text,
  objective text,                        -- 단원 학습목표 (부모용 한 줄 설명)
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_syllabus_units_syllabus
  on public.syllabus_units (syllabus_id, sort_order);

-- ───────────────────────────────────────────────────────────────
-- 3. syllabus_lessons — 차시/회차 (= 아이가 하루에 하는 atomic 단위, 카탈로그성)
--    library_video_id = null → 콘텐츠 준비중
-- ───────────────────────────────────────────────────────────────
create table if not exists public.syllabus_lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.syllabus_units(id) on delete cascade,
  title text not null,
  objective text,
  sort_order int not null default 0,
  estimated_min int not null default 5,
  library_video_id uuid references public.library_videos(id),  -- nullable: null=준비중
  created_at timestamptz not null default now()
);

create index if not exists idx_syllabus_lessons_unit
  on public.syllabus_lessons (unit_id, sort_order);

-- ───────────────────────────────────────────────────────────────
-- 4. syllabus_enrollments — 아이별 수강 등록 (child-scoped 사용자 데이터)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.syllabus_enrollments (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  syllabus_id uuid not null references public.syllabuses(id) on delete cascade,
  cadence jsonb not null default '{"lessons_per_week": 5}'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed')),
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (child_id, syllabus_id)
);

create index if not exists idx_syllabus_enrollments_child
  on public.syllabus_enrollments (child_id, status);

-- ───────────────────────────────────────────────────────────────
-- 5. lesson_progress — 아이별 차시 진도 (child-scoped 사용자 데이터)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  lesson_id uuid not null references public.syllabus_lessons(id) on delete cascade,
  status text not null default 'available'
    check (status in ('locked', 'available', 'in_progress', 'completed')),
  video_watched boolean not null default false,
  quiz_score int,                        -- 정답 개수 (null=퀴즈 미응시). 만점은 클라이언트가 안다.
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (child_id, lesson_id)
);

create index if not exists idx_lesson_progress_child
  on public.lesson_progress (child_id, status);

-- ═══════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════

-- 카탈로그성 3종: 인증 부모는 published=true 인 syllabus + 그 하위만 read.
alter table public.syllabuses        enable row level security;
alter table public.syllabus_units    enable row level security;
alter table public.syllabus_lessons  enable row level security;

drop policy if exists syllabuses_select_published on public.syllabuses;
create policy syllabuses_select_published
  on public.syllabuses for select
  to authenticated
  using (published = true);

drop policy if exists syllabus_units_select_published on public.syllabus_units;
create policy syllabus_units_select_published
  on public.syllabus_units for select
  to authenticated
  using (
    exists (
      select 1 from public.syllabuses
      where syllabuses.id = syllabus_units.syllabus_id
        and syllabuses.published = true
    )
  );

drop policy if exists syllabus_lessons_select_published on public.syllabus_lessons;
create policy syllabus_lessons_select_published
  on public.syllabus_lessons for select
  to authenticated
  using (
    exists (
      select 1
      from public.syllabus_units
      join public.syllabuses on syllabuses.id = syllabus_units.syllabus_id
      where syllabus_units.id = syllabus_lessons.unit_id
        and syllabuses.published = true
    )
  );

-- 카탈로그성 3종: insert/update/delete 정책 없음 → service_role 만 쓰기 가능.

-- enrollments: child_id -> children.parent_id 소유권 (0006 child-scoped 패턴).
alter table public.syllabus_enrollments enable row level security;

drop policy if exists syllabus_enrollments_select_own on public.syllabus_enrollments;
drop policy if exists syllabus_enrollments_insert_own on public.syllabus_enrollments;
drop policy if exists syllabus_enrollments_update_own on public.syllabus_enrollments;
drop policy if exists syllabus_enrollments_delete_own on public.syllabus_enrollments;

create policy syllabus_enrollments_select_own
  on public.syllabus_enrollments for select
  using (
    exists (
      select 1 from public.children
      where children.id = syllabus_enrollments.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy syllabus_enrollments_insert_own
  on public.syllabus_enrollments for insert
  with check (
    exists (
      select 1 from public.children
      where children.id = syllabus_enrollments.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy syllabus_enrollments_update_own
  on public.syllabus_enrollments for update
  using (
    exists (
      select 1 from public.children
      where children.id = syllabus_enrollments.child_id
        and children.parent_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from public.children
      where children.id = syllabus_enrollments.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy syllabus_enrollments_delete_own
  on public.syllabus_enrollments for delete
  using (
    exists (
      select 1 from public.children
      where children.id = syllabus_enrollments.child_id
        and children.parent_id = auth.uid()::text
    )
  );

-- lesson_progress: child_id -> children.parent_id 소유권.
alter table public.lesson_progress enable row level security;

drop policy if exists lesson_progress_select_own on public.lesson_progress;
drop policy if exists lesson_progress_insert_own on public.lesson_progress;
drop policy if exists lesson_progress_update_own on public.lesson_progress;
drop policy if exists lesson_progress_delete_own on public.lesson_progress;

create policy lesson_progress_select_own
  on public.lesson_progress for select
  using (
    exists (
      select 1 from public.children
      where children.id = lesson_progress.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy lesson_progress_insert_own
  on public.lesson_progress for insert
  with check (
    exists (
      select 1 from public.children
      where children.id = lesson_progress.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy lesson_progress_update_own
  on public.lesson_progress for update
  using (
    exists (
      select 1 from public.children
      where children.id = lesson_progress.child_id
        and children.parent_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from public.children
      where children.id = lesson_progress.child_id
        and children.parent_id = auth.uid()::text
    )
  );

create policy lesson_progress_delete_own
  on public.lesson_progress for delete
  using (
    exists (
      select 1 from public.children
      where children.id = lesson_progress.child_id
        and children.parent_id = auth.uid()::text
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- comments
-- ═══════════════════════════════════════════════════════════════
comment on table public.syllabuses is '커리큘럼 한 벌 (과목/연령). subject-agnostic. 카탈로그성, 인증 부모는 published=true 만 read.';
comment on table public.syllabus_units is '단원. syllabus_id FK. 카탈로그성.';
comment on table public.syllabus_lessons is '차시/회차 (하루 단위). library_video_id nullable=콘텐츠 준비중. 카탈로그성.';
comment on table public.syllabus_enrollments is '아이별 수강 등록. child_id 기준 소유권. cadence jsonb 에 lessons_per_week.';
comment on table public.lesson_progress is '아이별 차시 진도. status: locked|available|in_progress|completed. unique(child_id,lesson_id).';
