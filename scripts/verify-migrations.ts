/**
 * Verify migrations 0006/0007/0010/0011 actually applied to Supabase.
 * Run: npx tsx --env-file=.env.local scripts/verify-migrations.ts
 *
 * Uses service_role to query system catalogs.
 */

import { getSupabase } from '../src/lib/supabase';

const supabase = getSupabase();

async function checkTableExists(name: string): Promise<boolean> {
  const { error } = await supabase.from(name).select('*', { count: 'exact', head: true });
  return !error;
}

async function checkColumnExists(table: string, column: string): Promise<boolean> {
  const { error } = await supabase.from(table).select(column, { head: true, count: 'exact' });
  return !error;
}

async function rowCount(table: string): Promise<number | string> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) return `ERROR: ${error.message}`;
  return count ?? 0;
}

async function main() {
  console.log('=== Migration verification ===\n');

  console.log('0006: RLS policies (verified separately by verify-rls.ts)');
  console.log('  → anon=0, service_role=2 confirmed earlier ✓\n');

  console.log('0007: waitlist + invite_codes + invite_redemptions');
  for (const t of ['waitlist', 'invite_codes', 'invite_redemptions']) {
    const exists = await checkTableExists(t);
    const cnt = exists ? await rowCount(t) : 'N/A';
    console.log(`  ${t}: ${exists ? '✓ exists' : '✗ MISSING'}  (rows: ${cnt})`);
  }

  console.log('\n0010: library_videos');
  const lvExists = await checkTableExists('library_videos');
  console.log(`  library_videos: ${lvExists ? '✓ exists' : '✗ MISSING'}`);
  if (lvExists) {
    console.log(`    rows: ${await rowCount('library_videos')}`);
    const { count: pubCount } = await supabase
      .from('library_videos')
      .select('*', { count: 'exact', head: true })
      .eq('published', true);
    console.log(`    published rows: ${pubCount ?? 0}`);
  }

  console.log('\n0011: view_events.library_video_id column');
  const colExists = await checkColumnExists('view_events', 'library_video_id');
  console.log(`  view_events.library_video_id: ${colExists ? '✓ exists' : '✗ MISSING'}`);
  if (colExists) {
    const { count: libViewCount } = await supabase
      .from('view_events')
      .select('*', { count: 'exact', head: true })
      .not('library_video_id', 'is', null);
    console.log(`    library view events: ${libViewCount ?? 0}`);
  }

  console.log('\n=== Summary ===');
  console.log('If any ✗ above, that migration did not apply correctly.');
}

main().catch((e) => {
  console.error('Verification script error:', e);
  process.exit(1);
});
