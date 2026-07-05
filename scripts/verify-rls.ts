import { createClient } from '@supabase/supabase-js';

/**
 * Verify RLS behavior after migrations have been applied.
 * Run: npx tsx --env-file=.env.local scripts/verify-rls.ts
 * Run only after the human-gated `supabase db push` has been applied.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function countChildren(key: string): Promise<number> {
  const client = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count, error } = await client
    .from('children')
    .select('id', { count: 'exact', head: true });

  if (error) {
    throw new Error(`children select failed: ${error.message}`);
  }

  return count ?? 0;
}

async function countTableAsAnon(table: string): Promise<number> {
  const client = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`${table} anon select failed: ${error.message}`);
  }

  return count ?? 0;
}

async function assertServiceRoleCanRead(table: string): Promise<void> {
  const client = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`${table} service_role select failed: ${error.message}`);
  }
}

async function main() {
  const anonCount = await countChildren(requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey));
  const serviceRoleCount = await countChildren(requireEnv('SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey));

  console.log(`anon=${anonCount}, service_role=${serviceRoleCount}`);

  if (anonCount !== 0) {
    console.error('Expected anon=0 after RLS is enabled.');
    process.exit(1);
  }

  const ownerSelectTables = ['world_states', 'bookshelf', 'avatars', 'personal_renders'];
  const serviceRoleOnlyTables = [
    'name_pool',
    'episodes',
    'episode_nodes',
    'shots',
    'renders',
    'model_registry',
    'eval_runs',
    'pipeline_runs',
    'holdout_assignments',
  ];
  const authenticatedOpenTables = ['product_defaults'];

  console.log('\n0024-0029 RLS expectations:');
  console.log(`  owner-select policies: ${ownerSelectTables.join(', ')}`);
  console.log(`  authenticated select-open policies: ${authenticatedOpenTables.join(', ')}`);
  console.log(`  policy-count=0 service-role-only tables: ${serviceRoleOnlyTables.join(', ')}`);

  for (const table of [...ownerSelectTables, ...serviceRoleOnlyTables]) {
    await assertServiceRoleCanRead(table);
    const anonRows = await countTableAsAnon(table);
    console.log(`  ${table}: anon=${anonRows}, service_role=readable`);
    if (anonRows !== 0) {
      console.error(`Expected ${table} anon=0 under RLS.`);
      process.exit(1);
    }
  }

  for (const table of authenticatedOpenTables) {
    await assertServiceRoleCanRead(table);
    console.log(`  ${table}: authenticated select policy expected; service_role=readable`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
