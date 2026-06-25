/**
 * Supabase Storage — 비디오/이미지/오디오 업로드 + signed URL 발급.
 *
 * 버킷 구조:
 *   videos/
 *     {videoId}/
 *       script.json
 *       character_ref.png
 *       s01_keyframe.png
 *       s02_keyframe.png         (30s 이상)
 *       s01.mp4                  (1st Seedance chunk)
 *       s02.mp4                  (2nd Seedance chunk, 옵션)
 *       final.mp4                (concat 결과)
 *
 * 권한: public=false, signed URL 30일 기본.
 */

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'videos';
const DEFAULT_SIGNED_URL_EXPIRY_SEC = 60 * 60 * 24 * 30; // 30 days

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL missing');
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY (or anon key) missing');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function contentTypeFor(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

/** 로컬 파일/Buffer → Storage 업로드 */
export async function uploadBytes(
  path: string,
  bytes: Buffer | ArrayBuffer | Uint8Array,
  opts: { contentType?: string; upsert?: boolean } = {}
): Promise<{ path: string }> {
  const client = getClient();
  const contentType = opts.contentType ?? contentTypeFor(path);
  const body = bytes instanceof Buffer ? bytes : Buffer.from(bytes as ArrayBuffer);
  const { error } = await client.storage.from(BUCKET).upload(path, body, {
    contentType,
    upsert: opts.upsert ?? true,
  });
  if (error) throw new Error(`Storage upload failed (${path}): ${error.message}`);
  return { path };
}

/** signed URL 발급 — UI/player 에서 임시 접근용 */
export async function getSignedUrl(
  path: string,
  expirySec: number = DEFAULT_SIGNED_URL_EXPIRY_SEC
): Promise<string> {
  const client = getClient();
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, expirySec);
  if (error || !data?.signedUrl) throw new Error(`signedUrl failed (${path}): ${error?.message}`);
  return data.signedUrl;
}

/** videoId 별 폴더 경로 헬퍼 */
export function pathFor(videoId: string, filename: string): string {
  return `${videoId}/${filename}`;
}

/** 제거 — 실패한 생성 cleanup 용 */
export async function removePrefix(videoId: string): Promise<void> {
  const client = getClient();
  const { data, error: listErr } = await client.storage.from(BUCKET).list(videoId);
  if (listErr) throw new Error(`list failed: ${listErr.message}`);
  if (!data?.length) return;
  const paths = data.map((f) => `${videoId}/${f.name}`);
  const { error } = await client.storage.from(BUCKET).remove(paths);
  if (error) throw new Error(`remove failed: ${error.message}`);
}
