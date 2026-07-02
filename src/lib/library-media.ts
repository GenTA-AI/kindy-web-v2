/**
 * 라이브러리 미디어 URL 재서명 (docs/07 P0-3).
 *
 * library_videos 의 *_url 컬럼은 insert 시점의 signed URL(30일 만료) 또는 번들 자산
 * 경로(/demo-videos/...)다. *_path 가 있는 행은 서빙 시점마다 여기서 새로 서명해
 * "생성 30일 뒤 전 구독자 동시 재생 불가"를 막는다. *_path 가 없거나 재서명이
 * 실패하면 저장된 URL을 그대로 쓴다(번들 자산은 만료 개념이 없고, 서명 URL은
 * 아직 유효할 수 있다).
 */

import { getSignedUrls } from '@/lib/supabase-storage';

/** 요청당 재서명이므로 짧게 잡는다 — 세션 하나를 넉넉히 덮는 6시간. */
const SERVE_SIGNED_URL_EXPIRY_SEC = 60 * 60 * 6;

interface LibraryMediaRow {
  video_url: string;
  thumbnail_url: string | null;
  subtitles_url?: string | null;
  video_path?: string | null;
  thumbnail_path?: string | null;
  subtitles_path?: string | null;
}

export async function withFreshLibraryMediaUrls<T extends LibraryMediaRow>(rows: T[]): Promise<T[]> {
  const paths = new Set<string>();
  for (const row of rows) {
    if (row.video_path) paths.add(row.video_path);
    if (row.thumbnail_path) paths.add(row.thumbnail_path);
    if (row.subtitles_path) paths.add(row.subtitles_path);
  }
  if (paths.size === 0) return rows;

  let signed: Map<string, string>;
  try {
    signed = await getSignedUrls([...paths], SERVE_SIGNED_URL_EXPIRY_SEC);
  } catch (error) {
    console.error('[library-media:resign]', error);
    return rows;
  }

  return rows.map((row) => ({
    ...row,
    video_url: (row.video_path && signed.get(row.video_path)) || row.video_url,
    thumbnail_url: (row.thumbnail_path && signed.get(row.thumbnail_path)) || row.thumbnail_url,
    subtitles_url: ((row.subtitles_path && signed.get(row.subtitles_path)) || row.subtitles_url) ?? null,
  }));
}
