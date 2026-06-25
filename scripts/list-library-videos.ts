/**
 * List published library_videos for demo seeding.
 * Run: npx tsx --env-file=.env.local scripts/list-library-videos.ts
 */

import { getSupabase } from '../src/lib/supabase';

async function main() {
  const supabase = getSupabase();
  // include unpublished too — we just want any rows that have a usable thumbnail
  const { data, error } = await supabase
    .from('library_videos')
    .select('id, title, topic, age_band, style_tags, duration_sec, episode_unit_sec, character_name, thumbnail_url, view_count, published, featured, created_at')
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) {
    console.error('error:', error.message);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
