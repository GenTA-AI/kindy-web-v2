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

/**
 * signed URL 일괄 발급 — 서빙 경로의 요청당 재서명용(docs/07 P0-3).
 * 반환: path → signedUrl. 개별 실패 path는 map에서 빠진다(호출부가 저장 URL 폴백).
 */
export async function getSignedUrls(
  paths: string[],
  expirySec: number = DEFAULT_SIGNED_URL_EXPIRY_SEC
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const client = getClient();
  const { data, error } = await client.storage.from(BUCKET).createSignedUrls(paths, expirySec);
  if (error || !data) throw new Error(`signedUrls failed (${paths.length} paths): ${error?.message}`);
  const byPath = new Map<string, string>();
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) byPath.set(item.path, item.signedUrl);
  }
  // 개별 실패(삭제·이동된 객체)는 무증상으로 30일 폴백 URL에 얹혀 가므로 반드시 로그를 남긴다.
  const missing = paths.filter((p) => !byPath.has(p));
  if (missing.length > 0) {
    console.error(`[storage:signedUrls] ${missing.length}/${paths.length} path(s) failed to sign:`, missing.slice(0, 10));
  }
  return byPath;
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
