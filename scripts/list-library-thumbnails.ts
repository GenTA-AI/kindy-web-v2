/**
 * Walk videos/library/* in storage and list thumbnail.jpg files.
 * Run: npx tsx --env-file=.env.local scripts/list-library-thumbnails.ts
 */

import { getSupabase } from '../src/lib/supabase';

async function main() {
  const supabase = getSupabase();
  const { data: dirs, error } = await supabase.storage
    .from('videos')
    .list('library', { limit: 200, sortBy: { column: 'name', order: 'asc' } });
  if (error) {
    console.error('list error:', error.message);
    process.exit(1);
  }
  const out: Array<{ folder: string; thumbnailSignedUrl?: string; topic?: string; style?: string; age?: string }> = [];
  for (const d of dirs ?? []) {
    if (!d.name) continue;
    const { data: files } = await supabase.storage
      .from('videos')
      .list(`library/${d.name}`, { limit: 200 });
    const thumb = (files ?? []).find((f) => f.name === 'thumbnail.jpg');
    let signedUrl: string | undefined;
    if (thumb) {
      const path = `library/${d.name}/thumbnail.jpg`;
      const { data: signed } = await supabase.storage
        .from('videos')
        .createSignedUrl(path, 60 * 60 * 24 * 30);
      signedUrl = signed?.signedUrl;
    }
    // folder name pattern: 00-princess-science-age5
    const m = d.name.match(/^\d+-([a-z]+)-([a-z]+)-age(\d+)/);
    out.push({
      folder: d.name,
      thumbnailSignedUrl: signedUrl,
      style: m?.[1],
      topic: m?.[2],
      age: m?.[3],
    });
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
