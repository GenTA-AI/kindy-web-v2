/**
 * List ALL existing thumbnails across personal `videos` table + library_videos.
 * Run: npx tsx --env-file=.env.local scripts/list-thumbnails.ts
 */

import { getSupabase } from '../src/lib/supabase';

async function refreshSigned(url: string | null | undefined, supabase: ReturnType<typeof getSupabase>) {
  if (!url) return null;
  // extract storage path from a /object/sign/<bucket>/<path> URL
  const m = url.match(/\/object\/(?:sign|public)\/([^/]+)\/([^?]+)/);
  if (!m) return url;
  const bucket = m[1];
  const path = decodeURIComponent(m[2]);
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 30);
  return data?.signedUrl ?? url;
}

async function main() {
  const supabase = getSupabase();

  const { data: vids } = await supabase
    .from('videos')
    .select('id, title, status, thumbnail_url, child_id, created_at')
    .eq('status', 'ready')
    .not('thumbnail_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(80);

  const out: Array<{ source: string; title: string; thumbnail: string | null; createdAt: string }> = [];
  for (const v of vids ?? []) {
    out.push({
      source: 'videos',
      title: v.title,
      thumbnail: await refreshSigned(v.thumbnail_url, supabase),
      createdAt: v.created_at,
    });
  }

  console.log(JSON.stringify(out, null, 2));
  console.log(`\n# total: ${out.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
