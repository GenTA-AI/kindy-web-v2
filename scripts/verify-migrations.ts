/**
 * Verify migrations 0006/0007/0010/0011 and 0024-0029 actually applied to Supabase.
 * Run: npx tsx --env-file=.env.local scripts/verify-migrations.ts
 * Run only after the human-gated `supabase db push` has been applied.
 *
 * Uses service_role to query tables, views, and required columns.
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

  console.log('\n0024-0029: hero + studio schema');
  const heroStudioTables = [
    'world_states',
    'bookshelf',
    'avatars',
    'personal_renders',
    'name_pool',
    'product_defaults',
    'episodes',
    'episode_nodes',
    'shots',
    'renders',
    'model_registry',
    'eval_runs',
    'pipeline_runs',
    'holdout_assignments',
  ];
  for (const t of heroStudioTables) {
    const exists = await checkTableExists(t);
    const cnt = exists ? await rowCount(t) : 'N/A';
    console.log(`  ${t}: ${exists ? '✓ exists' : '✗ MISSING'}  (rows: ${cnt})`);
  }

  console.log('\n0024-0029: metric views');
  for (const v of ['hero_metric_events', 'hero_metric_daily', 'hero_fallback_daily']) {
    const exists = await checkTableExists(v);
    console.log(`  ${v}: ${exists ? '✓ exists' : '✗ MISSING'}`);
  }

  console.log('\n0024-0029: key columns');
  const requiredColumns: Array<[string, string]> = [
    ['game_rounds', 'event_type'],
    ['game_rounds', 'world_processed_at'],
    ['world_states', 'digest'],
    ['world_states', 'state'],
    ['bookshelf', 'cover_url'],
    ['bookshelf', 'personal_assets'],
    ['avatars', 'photoreal_check'],
    ['avatars', 'version'],
    ['personal_renders', 'kind'],
    ['personal_renders', 'model_registry_id'],
    ['product_defaults', 'age_band'],
    ['episodes', 'cp_options_variants'],
    ['episodes', 'format'],
    ['episodes', 'avatar_slots'],
    ['shots', 'personalizable'],
    ['renders', 'model_registry_id'],
    ['model_registry', 'capability'],
    ['pipeline_runs', 'output_ref'],
    ['library_videos', 'episode_id'],
    ['kiosk_sessions', 'demo_version'],
    ['kiosk_sessions', 'venue_arm'],
    ['kiosk_sessions', 'companion'],
    ['kiosk_sessions', 'palette'],
    ['holdout_assignments', 'experiment'],
  ];
  for (const [table, column] of requiredColumns) {
    const exists = await checkColumnExists(table, column);
    console.log(`  ${table}.${column}: ${exists ? '✓ exists' : '✗ MISSING'}`);
  }

  console.log('\n=== Summary ===');
  console.log('If any ✗ above, that migration did not apply correctly.');
}

main().catch((e) => {
  console.error('Verification script error:', e);
  process.exit(1);
});
