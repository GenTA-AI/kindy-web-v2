import { createClient } from '@supabase/supabase-js';

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

async function main() {
  const anonCount = await countChildren(requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey));
  const serviceRoleCount = await countChildren(requireEnv('SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey));

  console.log(`anon=${anonCount}, service_role=${serviceRoleCount}`);

  if (anonCount !== 0) {
    console.error('Expected anon=0 after RLS is enabled.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
