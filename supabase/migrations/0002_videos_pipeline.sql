-- videos 테이블을 프로덕션 비디오 생성 오케스트레이터 용으로 확장.
-- 2026-04-19 추가: Claude director → nano-banana → Seedance 2.0 (+ Video Extension) 파이프라인.

-- 0) 기존 status check 확장 ('queued' 추가).
--    기존 값: pending / generating / ready / failed
--    새 값  : queued / generating / ready / failed
alter table videos drop constraint if exists videos_status_check;

-- 전환 안전성: 이미 있는 'pending' 행은 'queued' 로 마이그레이션
update videos set status = 'queued' where status = 'pending';

alter table videos
  add constraint videos_status_check
  check (status in ('queued', 'generating', 'ready', 'failed'));

alter table videos alter column status set default 'queued';

-- 1) 파이프라인 운영용 컬럼
alter table videos
  add column if not exists request_id uuid not null default gen_random_uuid(),
  add column if not exists cost_ledger jsonb not null default '{}'::jsonb,
  add column if not exists provider_used text,
  add column if not exists error_reason text,
  add column if not exists attempt_count int not null default 0,
  add column if not exists elapsed_ms int,
  add column if not exists phase text,
  add column if not exists progress_pct int not null default 0 check (progress_pct between 0 and 100),
  add column if not exists script jsonb,
  add column if not exists seed bigint,
  add column if not exists video_path text,
  add column if not exists last_attempt_at timestamptz;

-- 2) 인덱스
create unique index if not exists idx_videos_request_id on videos(request_id);
create index if not exists idx_videos_status_child on videos(status, child_id);
create index if not exists idx_videos_phase on videos(phase) where phase is not null;

-- 3) Storage 버킷 (Supabase Storage 에서 별도 생성 필요)
--    버킷 이름: videos, public=false, signed URL 30일 기본.
--    MIME: video/mp4, image/png, image/jpeg, audio/wav
