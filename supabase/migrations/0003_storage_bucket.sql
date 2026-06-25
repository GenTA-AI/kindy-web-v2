-- Supabase Storage 버킷 'videos' 생성 (private).
-- 비디오/이미지/오디오 아티팩트 저장소.
--
-- 참고: Storage 버킷은 Supabase 대시보드 Storage > New bucket 으로도 만들 수 있음.
-- 여기서는 DB 레벨 정의로 프로젝트 재생성 시 재현성 확보.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos',
  'videos',
  false,                                       -- signed URL 로만 접근
  524288000,                                   -- 500 MB per file (여유 상한)
  array[
    'video/mp4',
    'image/png',
    'image/jpeg',
    'image/webp',
    'audio/wav',
    'audio/mpeg',
    'application/json'
  ]
)
on conflict (id) do nothing;

-- RLS: service_role 만 쓰기 / 읽기 (signed URL 로만 노출).
-- Next.js API route 와 Inngest function 은 service_role_key 로 접근.
-- Postgres 는 CREATE POLICY 에 IF NOT EXISTS 를 지원하지 않으므로 drop 후 재생성.

drop policy if exists "videos_bucket_insert_service" on storage.objects;
drop policy if exists "videos_bucket_select_service" on storage.objects;
drop policy if exists "videos_bucket_update_service" on storage.objects;
drop policy if exists "videos_bucket_delete_service" on storage.objects;

create policy "videos_bucket_insert_service"
  on storage.objects for insert
  with check (bucket_id = 'videos' and auth.role() = 'service_role');

create policy "videos_bucket_select_service"
  on storage.objects for select
  using (bucket_id = 'videos' and auth.role() = 'service_role');

create policy "videos_bucket_update_service"
  on storage.objects for update
  using (bucket_id = 'videos' and auth.role() = 'service_role');

create policy "videos_bucket_delete_service"
  on storage.objects for delete
  using (bucket_id = 'videos' and auth.role() = 'service_role');
