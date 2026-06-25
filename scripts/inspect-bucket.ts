/**
 * Inspect storage.buckets 'videos' allowed_mime_types.
 * Run: npx tsx --env-file=.env.local scripts/inspect-bucket.ts
 */

import { getSupabase } from '../src/lib/supabase';

async function main() {
  const supabase = getSupabase();
  // storage schema 는 schema('storage') 로 접근
  const { data, error } = await supabase.schema('storage' as never).from('buckets').select('*');
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
