import { randomUUID } from 'node:crypto';

import {
  createClient,
  type PostgrestError,
  type SupabaseClient,
} from '@supabase/supabase-js';

/**
 * Human-gated RLS verification after migrations have been applied.
 *
 * This authenticated mutation matrix exists because the 2026-08-03 audit found
 * four defects—free-subscription forgery, unlimited free trials, unlimited
 * credit reissuance, and paywall bypass—that anon/service-role SELECT counts
 * did not detect. Those defects survived through migration 0029. Do not remove
 * the authenticated positive controls, mutation attempts, or before/after
 * service-role snapshots.
 *
 * This script intentionally attempts writes. It must never target production.
 */

const REQUIRED_ENV_NAMES = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RLS_VERIFY_ENVIRONMENT',
  'RLS_VERIFY_ALLOW_WRITES',
] as const;

const WRITE_ACK = 'I_ACKNOWLEDGE_THIS_IS_NOT_PRODUCTION';
const KNOWN_PRODUCTION_HOSTS = new Set(['lzzaiqruxxfhhalgvejb.supabase.co']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const AUTH_POSITIVE_CONTROL_ABORT =
  'Authenticated positive control failed: PostgREST did not return exactly one own child for actor A and actor B and zero cross-tenant children; authenticated attack results would be meaningless, so the run was aborted.';

type Environment = 'local' | 'staging';
type ExpectedBefore = 'present' | 'absent';
type AttackErrorMode = 'permission-or-zero-rows' | 'permission-required';

type Config = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  environment: Environment;
};

type Actor = {
  id: string;
  client: SupabaseClient;
};

type AttackOutcome = {
  error: PostgrestError | null;
};

type FixtureIds = {
  runId: string;
  childA: string;
  childASecondary: string;
  childB: string;
  videoA: string;
  videoB: string;
  purchaseA: string;
  purchaseB: string;
  viewEventA: string;
  viewEventB: string;
  emojiA: string;
  emojiB: string;
  quizA: string;
  quizB: string;
  enrollmentA: string;
  enrollmentB: string;
  progressA: string;
  progressB: string;
  gameSessionA: string;
  gameSessionB: string;
  gameRoundA: string;
  gameRoundB: string;
  libraryVideo: string;
  syllabus: string;
  syllabusUnit: string;
  syllabusLesson: string;
  attackChildOwn: string;
  attackChildCross: string;
  attackVideo: string;
  attackPurchase: string;
  attackViewEvent: string;
  attackEmoji: string;
  attackQuiz: string;
  attackEnrollment: string;
  attackProgress: string;
  attackGameSession: string;
  attackGameRound: string;
  attackWaitlistEmail: string;
};

class Results {
  failures = 0;

  pass(name: string, detail: string): void {
    console.log(`PASS ${name} — ${detail}`);
  }

  skip(name: string, detail: string): void {
    console.log(`SKIP ${name} — ${detail}`);
  }

  fail(name: string, detail: string): void {
    this.failures += 1;
    console.error(`FAIL ${name} — ${detail}`);
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function loadConfig(results: Results): Config {
  for (const name of REQUIRED_ENV_NAMES) {
    requireEnv(name);
    results.pass(`environment ${name}`, 'present');
  }

  const environment = requireEnv('RLS_VERIFY_ENVIRONMENT');
  if (environment !== 'local' && environment !== 'staging') {
    throw new Error('RLS_VERIFY_ENVIRONMENT must be local or staging; production is forbidden');
  }

  if (requireEnv('RLS_VERIFY_ALLOW_WRITES') !== WRITE_ACK) {
    throw new Error('RLS_VERIFY_ALLOW_WRITES does not contain the required non-production acknowledgement');
  }

  let target: URL;
  try {
    target = new URL(requireEnv('NEXT_PUBLIC_SUPABASE_URL'));
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid URL');
  }

  if (target.username || target.password) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must not contain credentials');
  }

  const targetHost = target.hostname.toLowerCase();
  if (KNOWN_PRODUCTION_HOSTS.has(targetHost)) {
    throw new Error('Known production Supabase hosts are forbidden');
  }

  if (environment === 'local') {
    if (!LOCAL_HOSTS.has(targetHost)) {
      throw new Error('local verification is restricted to loopback Supabase URLs');
    }
  } else {
    const expectedHost = requireEnv('RLS_VERIFY_EXPECTED_HOST').toLowerCase();
    results.pass('environment RLS_VERIFY_EXPECTED_HOST', 'present');
    if (KNOWN_PRODUCTION_HOSTS.has(expectedHost)) {
      throw new Error('Known production Supabase hosts cannot be acknowledged as staging');
    }
    if (target.protocol !== 'https:' || targetHost !== expectedHost) {
      throw new Error('staging verification requires HTTPS and an exact RLS_VERIFY_EXPECTED_HOST match');
    }
  }

  results.pass('non-production write safety gate', 'environment, target, and explicit acknowledgement accepted');

  return {
    url: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    environment,
  };
}

function createSupabaseClient(url: string, key: string, storageKey: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey,
    },
  });
}

function createFixtureIds(): FixtureIds {
  const runId = randomUUID();
  return {
    runId,
    childA: randomUUID(),
    childASecondary: randomUUID(),
    childB: randomUUID(),
    videoA: randomUUID(),
    videoB: randomUUID(),
    purchaseA: randomUUID(),
    purchaseB: randomUUID(),
    viewEventA: randomUUID(),
    viewEventB: randomUUID(),
    emojiA: randomUUID(),
    emojiB: randomUUID(),
    quizA: randomUUID(),
    quizB: randomUUID(),
    enrollmentA: randomUUID(),
    enrollmentB: randomUUID(),
    progressA: randomUUID(),
    progressB: randomUUID(),
    gameSessionA: randomUUID(),
    gameSessionB: randomUUID(),
    gameRoundA: randomUUID(),
    gameRoundB: randomUUID(),
    libraryVideo: randomUUID(),
    syllabus: randomUUID(),
    syllabusUnit: randomUUID(),
    syllabusLesson: randomUUID(),
    attackChildOwn: randomUUID(),
    attackChildCross: randomUUID(),
    attackVideo: randomUUID(),
    attackPurchase: randomUUID(),
    attackViewEvent: randomUUID(),
    attackEmoji: randomUUID(),
    attackQuiz: randomUUID(),
    attackEnrollment: randomUUID(),
    attackProgress: randomUUID(),
    attackGameSession: randomUUID(),
    attackGameRound: randomUUID(),
    attackWaitlistEmail: `rls-verify-${runId}@invalid.example`,
  };
}

function errorDetail(error: PostgrestError | null): string {
  return error ? `${error.code}: ${error.message}` : 'none';
}

function snapshotDetail(value: unknown): string {
  return value === null ? 'absent' : JSON.stringify(value);
}

async function mustInsert(client: SupabaseClient, table: string, payload: object | object[]): Promise<void> {
  const { error } = await client.from(table).insert(payload);
  if (error) {
    throw new Error(`fixture insert failed for ${table}: ${error.code}: ${error.message}`);
  }
}

async function mustUpdate(
  client: SupabaseClient,
  table: string,
  payload: object,
  column: string,
  value: string,
): Promise<void> {
  const { data, error } = await client.from(table).update(payload).eq(column, value).select(column);
  if (error) {
    throw new Error(`fixture update failed for ${table}: ${error.code}: ${error.message}`);
  }
  if ((data ?? []).length !== 1) {
    throw new Error(`fixture update for ${table} affected ${(data ?? []).length} rows instead of one`);
  }
}

async function mustDelete(client: SupabaseClient, table: string, column: string, values: string[]): Promise<void> {
  const { data, error } = await client.from(table).delete().in(column, values).select(column);
  if (error) {
    throw new Error(`fixture delete failed for ${table}: ${error.code}: ${error.message}`);
  }
  if ((data ?? []).length !== values.length) {
    throw new Error(`fixture delete for ${table} affected ${(data ?? []).length} rows instead of ${values.length}`);
  }
}

async function createActor(
  config: Config,
  serviceRole: SupabaseClient,
  label: 'a' | 'b',
  runId: string,
  createdUserIds: string[],
): Promise<Actor> {
  const email = `rls-verify-${runId}-${label}@invalid.example`;
  const password = `Rls!${randomUUID()}aA9`;
  const { data: created, error: createError } = await serviceRole.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(`test actor ${label.toUpperCase()} creation failed`);
  }
  createdUserIds.push(created.user.id);

  const client = createSupabaseClient(config.url, config.anonKey, `rls-verify-${runId}-${label}`);
  const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !signedIn.session?.access_token || !signedIn.user) {
    throw new Error(`test actor ${label.toUpperCase()} sign-in failed`);
  }
  if (signedIn.user.id !== created.user.id) {
    throw new Error(`test actor ${label.toUpperCase()} session subject mismatch`);
  }

  return { id: created.user.id, client };
}

async function createFixtures(
  serviceRole: SupabaseClient,
  actorA: Actor,
  actorB: Actor,
  ids: FixtureIds,
): Promise<void> {
  await mustInsert(serviceRole, 'children', [
    { id: ids.childA, parent_id: actorA.id, name: 'RLS Actor A', age: 8 },
    { id: ids.childASecondary, parent_id: actorA.id, name: 'RLS Actor A Secondary', age: 8 },
    { id: ids.childB, parent_id: actorB.id, name: 'RLS Actor B', age: 8 },
  ]);

  await mustUpdate(
    serviceRole,
    'credits',
    { balance: 7, lifetime_granted: 7, lifetime_purchased: 0, lifetime_consumed: 0 },
    'parent_id',
    actorA.id,
  );
  await mustDelete(serviceRole, 'credits', 'parent_id', [actorB.id]);

  await mustInsert(serviceRole, 'library_videos', {
    id: ids.libraryVideo,
    title: `RLS library ${ids.runId}`,
    description: 'RLS verification fixture',
    topic: 'verification',
    age_band: 8,
    duration_sec: 60,
    video_url: 'private://rls-verification/video.mp4',
    video_path: `rls-verification/${ids.runId}/video.mp4`,
    subtitles_url: 'private://rls-verification/subtitles.vtt',
    subtitles_path: `rls-verification/${ids.runId}/subtitles.vtt`,
    script: { fixture: ids.runId },
    published: true,
  });

  await mustInsert(serviceRole, 'syllabuses', {
    id: ids.syllabus,
    subject: 'rls_verification',
    age_band: 8,
    level_code: 'RLS',
    title: `RLS syllabus ${ids.runId}`,
    published: true,
  });
  await mustInsert(serviceRole, 'syllabus_units', {
    id: ids.syllabusUnit,
    syllabus_id: ids.syllabus,
    title: 'RLS unit',
  });
  await mustInsert(serviceRole, 'syllabus_lessons', {
    id: ids.syllabusLesson,
    unit_id: ids.syllabusUnit,
    title: 'RLS lesson',
    estimated_min: 5,
    library_video_id: ids.libraryVideo,
  });

  await mustInsert(serviceRole, 'videos', [
    { id: ids.videoA, child_id: ids.childA, title: 'RLS video A', status: 'ready', topic: 'verification' },
    { id: ids.videoB, child_id: ids.childB, title: 'RLS video B', status: 'ready', topic: 'verification' },
  ]);
  await mustInsert(serviceRole, 'purchases', [
    {
      id: ids.purchaseA,
      parent_id: actorA.id,
      bundle_type: 'subscription',
      credits_added: 0,
      amount_krw: 1,
      order_id: `rls-${ids.runId}-a`,
      status: 'pending',
    },
    {
      id: ids.purchaseB,
      parent_id: actorB.id,
      bundle_type: 'subscription',
      credits_added: 0,
      amount_krw: 1,
      order_id: `rls-${ids.runId}-b`,
      status: 'pending',
    },
  ]);
  await mustInsert(serviceRole, 'view_events', [
    { id: ids.viewEventA, video_id: ids.videoA, child_id: ids.childA, event_type: 'play', timestamp_sec: 1 },
    { id: ids.viewEventB, video_id: ids.videoB, child_id: ids.childB, event_type: 'play', timestamp_sec: 1 },
  ]);
  await mustInsert(serviceRole, 'emoji_reactions', [
    { id: ids.emojiA, video_id: ids.videoA, child_id: ids.childA, reaction: 'happy' },
    { id: ids.emojiB, video_id: ids.videoB, child_id: ids.childB, reaction: 'happy' },
  ]);
  await mustInsert(serviceRole, 'quiz_results', [
    {
      id: ids.quizA,
      video_id: ids.videoA,
      child_id: ids.childA,
      question: 'RLS A',
      options: ['a', 'b'],
      correct_answer: 0,
      selected_answer: 0,
      is_correct: true,
    },
    {
      id: ids.quizB,
      video_id: ids.videoB,
      child_id: ids.childB,
      question: 'RLS B',
      options: ['a', 'b'],
      correct_answer: 0,
      selected_answer: 0,
      is_correct: true,
    },
  ]);
  await mustInsert(serviceRole, 'word_profiles', [
    { child_id: ids.childA, preferred_adjectives: ['calm'], weights: { calm: 1 } },
    { child_id: ids.childB, preferred_adjectives: ['bright'], weights: { bright: 1 } },
  ]);
  await mustInsert(serviceRole, 'syllabus_enrollments', [
    { id: ids.enrollmentA, child_id: ids.childA, syllabus_id: ids.syllabus, status: 'active' },
    { id: ids.enrollmentB, child_id: ids.childB, syllabus_id: ids.syllabus, status: 'active' },
  ]);
  await mustInsert(serviceRole, 'lesson_progress', [
    { id: ids.progressA, child_id: ids.childA, lesson_id: ids.syllabusLesson, status: 'available' },
    { id: ids.progressB, child_id: ids.childB, lesson_id: ids.syllabusLesson, status: 'available' },
  ]);
  await mustInsert(serviceRole, 'game_sessions', [
    { id: ids.gameSessionA, child_id: ids.childA, context: 'home', rounds_total: 1, rounds_completed: 0 },
    { id: ids.gameSessionB, child_id: ids.childB, context: 'home', rounds_total: 1, rounds_completed: 0 },
  ]);
  await mustInsert(serviceRole, 'game_rounds', [
    {
      id: ids.gameRoundA,
      game_session_id: ids.gameSessionA,
      child_id: ids.childA,
      round_index: 1,
      game_type: 'match',
      difficulty: 1,
    },
    {
      id: ids.gameRoundB,
      game_session_id: ids.gameSessionB,
      child_id: ids.childB,
      round_index: 1,
      game_type: 'match',
      difficulty: 1,
    },
  ]);
}

async function snapshotRow(
  serviceRole: SupabaseClient,
  table: string,
  select: string,
  column: string,
  value: string,
): Promise<unknown | null> {
  const { data, error } = await serviceRole.from(table).select(select).eq(column, value).maybeSingle();
  if (error) {
    throw new Error(`service-role snapshot failed for ${table}: ${error.code}: ${error.message}`);
  }
  return data;
}

async function unchangedAfterAttack(options: {
  results: Results;
  serviceRole: SupabaseClient;
  name: string;
  table: string;
  select: string;
  column: string;
  value: string;
  expectedBefore: ExpectedBefore;
  errorMode: AttackErrorMode;
  attack: () => Promise<AttackOutcome>;
}): Promise<void> {
  const before = await snapshotRow(
    options.serviceRole,
    options.table,
    options.select,
    options.column,
    options.value,
  );
  const expectedPresent = options.expectedBefore === 'present';
  if ((before !== null) !== expectedPresent) {
    options.results.fail(
      options.name,
      `fixture guard failed; expected_before=${options.expectedBefore}, before=${snapshotDetail(before)}, after=not-attempted`,
    );
    return;
  }

  let outcome: AttackOutcome;
  try {
    outcome = await options.attack();
  } catch (error) {
    options.results.fail(
      options.name,
      `attack threw unexpectedly; before=${snapshotDetail(before)}, after=not-read, error=${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  const after = await snapshotRow(
    options.serviceRole,
    options.table,
    options.select,
    options.column,
    options.value,
  );
  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  const permissionError = outcome.error?.code === '42501';
  const expectedError =
    options.errorMode === 'permission-required'
      ? permissionError
      : outcome.error === null || permissionError;

  if (!unchanged || !expectedError) {
    options.results.fail(
      options.name,
      `before=${snapshotDetail(before)}, after=${snapshotDetail(after)}, attack_error=${errorDetail(outcome.error)}`,
    );
    return;
  }

  options.results.pass(
    options.name,
    `before=${snapshotDetail(before)}, after=${snapshotDetail(after)}, attack_error=${errorDetail(outcome.error)}`,
  );
}

async function selectMustBeEmpty(options: {
  results: Results;
  client: SupabaseClient;
  name: string;
  table: string;
  select: string;
  column: string;
  value: string;
}): Promise<void> {
  const { data, error } = await options.client
    .from(options.table)
    .select(options.select)
    .eq(options.column, options.value);

  if (error) {
    if (error.code === '42501') {
      options.results.pass(options.name, `permission denied with ${error.code}`);
    } else {
      options.results.fail(options.name, `unexpected query error ${error.code}: ${error.message}`);
    }
    return;
  }

  if ((data ?? []).length === 0) {
    options.results.pass(options.name, 'zero rows returned');
  } else {
    options.results.fail(options.name, `exposed_rows=${JSON.stringify(data)}`);
  }
}

async function runAuthenticatedPositiveControl(
  results: Results,
  actorA: Actor,
  actorB: Actor,
  ids: FixtureIds,
): Promise<void> {
  const [aOwn, bOwn, aCross] = await Promise.all([
    actorA.client.from('children').select('id').eq('id', ids.childA),
    actorB.client.from('children').select('id').eq('id', ids.childB),
    actorA.client.from('children').select('id').eq('id', ids.childB),
  ]);

  const valid =
    !aOwn.error &&
    !bOwn.error &&
    !aCross.error &&
    (aOwn.data ?? []).length === 1 &&
    (bOwn.data ?? []).length === 1 &&
    (aCross.data ?? []).length === 0;

  if (!valid) {
    results.fail(
      'authenticated positive control',
      `${AUTH_POSITIVE_CONTROL_ABORT} actor_a_own=${aOwn.data?.length ?? 0}, actor_b_own=${bOwn.data?.length ?? 0}, actor_a_cross=${aCross.data?.length ?? 0}, errors=${[aOwn.error, bOwn.error, aCross.error].map(errorDetail).join(' | ')}`,
    );
    throw new Error(AUTH_POSITIVE_CONTROL_ABORT);
  }

  results.pass('authenticated positive control actor A', 'own children SELECT returned exactly one fixture row');
  results.pass('authenticated positive control actor B', 'own children SELECT returned exactly one fixture row');
  results.pass('authenticated positive control tenant isolation', 'actor A received zero rows for actor B child');
}

async function countTable(client: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    throw new Error(`${table} count failed: ${error.code}: ${error.message}`);
  }
  return count ?? 0;
}

async function runExistingReadChecks(
  results: Results,
  serviceRole: SupabaseClient,
  anon: SupabaseClient,
  actorA: Actor,
): Promise<void> {
  const serviceRoleChildren = await countTable(serviceRole, 'children');
  const anonChildren = await countTable(anon, 'children');
  if (serviceRoleChildren <= 0) {
    results.fail('legacy children anon SELECT', 'service_role fixture count was not positive; anon check would be inconclusive');
  } else if (anonChildren === 0) {
    results.pass('legacy children anon SELECT', `anon=0, service_role_count=${serviceRoleChildren}`);
  } else {
    results.fail('legacy children anon SELECT', `anon_count=${anonChildren}, service_role_count=${serviceRoleChildren}`);
  }

  const legacyTables = [
    'world_states',
    'bookshelf',
    'avatars',
    'personal_renders',
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

  for (const table of legacyTables) {
    const serviceCount = await countTable(serviceRole, table);
    const anonCount = await countTable(anon, table);
    if (serviceCount === 0 && anonCount === 0) {
      results.skip(`legacy ${table} anon SELECT`, 'inconclusive because the table has no service-role-visible rows');
    } else if (anonCount === 0) {
      results.pass(`legacy ${table} anon SELECT`, `anon=0, service_role_count=${serviceCount}`);
    } else {
      results.fail(`legacy ${table} anon SELECT`, `anon_count=${anonCount}, service_role_count=${serviceCount}`);
    }
  }

  const serviceProductDefaults = await countTable(serviceRole, 'product_defaults');
  const actorProductDefaults = await countTable(actorA.client, 'product_defaults');
  if (serviceProductDefaults === 0) {
    results.skip('legacy product_defaults authenticated SELECT', 'inconclusive because the table has no rows');
  } else if (actorProductDefaults === serviceProductDefaults) {
    results.pass(
      'legacy product_defaults authenticated SELECT',
      `authenticated_count=${actorProductDefaults}, service_role_count=${serviceProductDefaults}`,
    );
  } else {
    results.fail(
      'legacy product_defaults authenticated SELECT',
      `authenticated_count=${actorProductDefaults}, service_role_count=${serviceProductDefaults}`,
    );
  }
}

async function runSelectAndRpcChecks(
  results: Results,
  serviceRole: SupabaseClient,
  actorA: Actor,
  ids: FixtureIds,
): Promise<void> {
  await selectMustBeEmpty({
    results,
    client: actorA.client,
    name: 'cross-tenant children SELECT',
    table: 'children',
    select: 'id,parent_id',
    column: 'id',
    value: ids.childB,
  });

  for (const [table, id] of [
    ['syllabuses', ids.syllabus],
    ['syllabus_units', ids.syllabusUnit],
    ['syllabus_lessons', ids.syllabusLesson],
  ] as const) {
    await selectMustBeEmpty({
      results,
      client: actorA.client,
      name: `${table} authenticated catalogue SELECT`,
      table,
      select: 'id',
      column: 'id',
      value: id,
    });
  }

  await selectMustBeEmpty({
    results,
    client: actorA.client,
    name: 'library_videos authenticated source SELECT',
    table: 'library_videos',
    select: 'id,video_url,video_path,subtitles_url,subtitles_path,script,scenes',
    column: 'id',
    value: ids.libraryVideo,
  });

  const canPurchase = await actorA.client.rpc('can_purchase', { p_parent_id: actorA.id });
  if (canPurchase.error?.code === '42501') {
    results.pass('can_purchase authenticated EXECUTE', 'permission denied with 42501');
  } else {
    results.fail(
      'can_purchase authenticated EXECUTE',
      `expected 42501, received=${errorDetail(canPurchase.error)}, data=${JSON.stringify(canPurchase.data)}`,
    );
  }

  await unchangedAfterAttack({
    results,
    serviceRole,
    name: 'consume_credit authenticated EXECUTE',
    table: 'credits',
    select: 'parent_id,balance,lifetime_consumed',
    column: 'parent_id',
    value: actorA.id,
    expectedBefore: 'present',
    errorMode: 'permission-required',
    attack: async () => {
      const { error } = await actorA.client.rpc('consume_credit', { p_parent_id: actorA.id });
      return { error };
    },
  });
}

async function runMutationMatrix(options: {
  results: Results;
  serviceRole: SupabaseClient;
  anon: SupabaseClient;
  actorA: Actor;
  actorB: Actor;
  ids: FixtureIds;
}): Promise<void> {
  const { results, serviceRole, anon, actorA, actorB, ids } = options;
  const mutate = (attack: () => Promise<AttackOutcome>) => attack;

  await unchangedAfterAttack({
    results, serviceRole, name: 'purchases own INSERT paid forgery', table: 'purchases', select: 'id,parent_id,status,order_id,credits_added', column: 'id', value: ids.attackPurchase, expectedBefore: 'absent', errorMode: 'permission-required',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('purchases').insert({ id: ids.attackPurchase, parent_id: actorA.id, bundle_type: 'subscription', credits_added: 0, amount_krw: 1, status: 'paid', order_id: `rls-${ids.runId}-forged` });
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'purchases own UPDATE status=paid', table: 'purchases', select: 'id,parent_id,status', column: 'id', value: ids.purchaseA, expectedBefore: 'present', errorMode: 'permission-or-zero-rows',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('purchases').update({ status: 'paid' }).eq('id', ids.purchaseA);
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'children own INSERT', table: 'children', select: 'id,parent_id,name,age', column: 'id', value: ids.attackChildOwn, expectedBefore: 'absent', errorMode: 'permission-required',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('children').insert({ id: ids.attackChildOwn, parent_id: actorA.id, name: 'Forged child', age: 8 });
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'children own UPDATE', table: 'children', select: 'id,parent_id,name,age', column: 'id', value: ids.childA, expectedBefore: 'present', errorMode: 'permission-or-zero-rows',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('children').update({ name: 'Forged name' }).eq('id', ids.childA);
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'videos own INSERT', table: 'videos', select: 'id,child_id,title,status', column: 'id', value: ids.attackVideo, expectedBefore: 'absent', errorMode: 'permission-required',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('videos').insert({ id: ids.attackVideo, child_id: ids.childASecondary, title: 'Forged video', status: 'queued', topic: 'verification' });
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'videos own UPDATE', table: 'videos', select: 'id,child_id,title,status', column: 'id', value: ids.videoA, expectedBefore: 'present', errorMode: 'permission-or-zero-rows',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('videos').update({ title: 'Forged title' }).eq('id', ids.videoA);
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'credits own INSERT', table: 'credits', select: 'parent_id,balance,lifetime_granted', column: 'parent_id', value: actorB.id, expectedBefore: 'absent', errorMode: 'permission-required',
    attack: mutate(async () => {
      const { error } = await actorB.client.from('credits').insert({ parent_id: actorB.id, balance: 999, lifetime_granted: 999 });
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'credits own UPDATE balance increase', table: 'credits', select: 'parent_id,balance,lifetime_granted,lifetime_purchased,lifetime_consumed', column: 'parent_id', value: actorA.id, expectedBefore: 'present', errorMode: 'permission-or-zero-rows',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('credits').update({ balance: 1007 }).eq('parent_id', actorA.id);
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'view_events own INSERT', table: 'view_events', select: 'id,video_id,child_id,event_type,timestamp_sec', column: 'id', value: ids.attackViewEvent, expectedBefore: 'absent', errorMode: 'permission-required',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('view_events').insert({ id: ids.attackViewEvent, video_id: ids.videoA, child_id: ids.childA, event_type: 'play', timestamp_sec: 2 });
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'view_events own UPDATE', table: 'view_events', select: 'id,child_id,event_type,timestamp_sec', column: 'id', value: ids.viewEventA, expectedBefore: 'present', errorMode: 'permission-or-zero-rows',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('view_events').update({ timestamp_sec: 99 }).eq('id', ids.viewEventA);
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'emoji_reactions own INSERT', table: 'emoji_reactions', select: 'id,video_id,child_id,reaction', column: 'id', value: ids.attackEmoji, expectedBefore: 'absent', errorMode: 'permission-required',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('emoji_reactions').insert({ id: ids.attackEmoji, video_id: ids.videoA, child_id: ids.childA, reaction: 'neutral' });
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'emoji_reactions own UPDATE', table: 'emoji_reactions', select: 'id,child_id,reaction', column: 'id', value: ids.emojiA, expectedBefore: 'present', errorMode: 'permission-or-zero-rows',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('emoji_reactions').update({ reaction: 'sad' }).eq('id', ids.emojiA);
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'quiz_results own INSERT', table: 'quiz_results', select: 'id,video_id,child_id,selected_answer,is_correct', column: 'id', value: ids.attackQuiz, expectedBefore: 'absent', errorMode: 'permission-required',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('quiz_results').insert({ id: ids.attackQuiz, video_id: ids.videoA, child_id: ids.childA, question: 'Forged quiz', options: ['a', 'b'], correct_answer: 0, selected_answer: 1, is_correct: false });
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'quiz_results own UPDATE', table: 'quiz_results', select: 'id,child_id,selected_answer,is_correct', column: 'id', value: ids.quizA, expectedBefore: 'present', errorMode: 'permission-or-zero-rows',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('quiz_results').update({ selected_answer: 1, is_correct: false }).eq('id', ids.quizA);
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'word_profiles own INSERT', table: 'word_profiles', select: 'child_id,preferred_adjectives,avoid_adjectives,weights', column: 'child_id', value: ids.childASecondary, expectedBefore: 'absent', errorMode: 'permission-required',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('word_profiles').insert({ child_id: ids.childASecondary, preferred_adjectives: ['forged'], weights: { forged: 1 } });
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'word_profiles own UPDATE', table: 'word_profiles', select: 'child_id,preferred_adjectives,avoid_adjectives,weights', column: 'child_id', value: ids.childA, expectedBefore: 'present', errorMode: 'permission-or-zero-rows',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('word_profiles').update({ weights: { forged: 999 } }).eq('child_id', ids.childA);
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'syllabus_enrollments own INSERT', table: 'syllabus_enrollments', select: 'id,child_id,syllabus_id,status', column: 'id', value: ids.attackEnrollment, expectedBefore: 'absent', errorMode: 'permission-required',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('syllabus_enrollments').insert({ id: ids.attackEnrollment, child_id: ids.childASecondary, syllabus_id: ids.syllabus, status: 'active' });
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'syllabus_enrollments own UPDATE', table: 'syllabus_enrollments', select: 'id,child_id,syllabus_id,status', column: 'id', value: ids.enrollmentA, expectedBefore: 'present', errorMode: 'permission-or-zero-rows',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('syllabus_enrollments').update({ status: 'paused' }).eq('id', ids.enrollmentA);
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'lesson_progress own INSERT', table: 'lesson_progress', select: 'id,child_id,lesson_id,status,video_watched', column: 'id', value: ids.attackProgress, expectedBefore: 'absent', errorMode: 'permission-required',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('lesson_progress').insert({ id: ids.attackProgress, child_id: ids.childASecondary, lesson_id: ids.syllabusLesson, status: 'available', video_watched: false });
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'lesson_progress own UPDATE', table: 'lesson_progress', select: 'id,child_id,lesson_id,status,video_watched', column: 'id', value: ids.progressA, expectedBefore: 'present', errorMode: 'permission-or-zero-rows',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('lesson_progress').update({ status: 'completed', video_watched: true }).eq('id', ids.progressA);
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'game_sessions own INSERT', table: 'game_sessions', select: 'id,child_id,context,rounds_total,rounds_completed', column: 'id', value: ids.attackGameSession, expectedBefore: 'absent', errorMode: 'permission-required',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('game_sessions').insert({ id: ids.attackGameSession, child_id: ids.childASecondary, context: 'home', rounds_total: 1, rounds_completed: 0 });
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'game_sessions own UPDATE', table: 'game_sessions', select: 'id,child_id,context,rounds_total,rounds_completed', column: 'id', value: ids.gameSessionA, expectedBefore: 'present', errorMode: 'permission-or-zero-rows',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('game_sessions').update({ rounds_completed: 1 }).eq('id', ids.gameSessionA);
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'game_rounds own INSERT', table: 'game_rounds', select: 'id,game_session_id,child_id,round_index,game_type,difficulty', column: 'id', value: ids.attackGameRound, expectedBefore: 'absent', errorMode: 'permission-required',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('game_rounds').insert({ id: ids.attackGameRound, game_session_id: ids.gameSessionA, child_id: ids.childA, round_index: 2, game_type: 'match', difficulty: 1 });
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'game_rounds own UPDATE', table: 'game_rounds', select: 'id,child_id,round_index,game_type,difficulty', column: 'id', value: ids.gameRoundA, expectedBefore: 'present', errorMode: 'permission-or-zero-rows',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('game_rounds').update({ difficulty: 2 }).eq('id', ids.gameRoundA);
      return { error };
    }),
  });

  await unchangedAfterAttack({
    results, serviceRole, name: 'cross-tenant children INSERT with actor B parent_id', table: 'children', select: 'id,parent_id,name,age', column: 'id', value: ids.attackChildCross, expectedBefore: 'absent', errorMode: 'permission-required',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('children').insert({ id: ids.attackChildCross, parent_id: actorB.id, name: 'Cross tenant child', age: 8 });
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'cross-tenant purchases UPDATE with actor B parent_id', table: 'purchases', select: 'id,parent_id,status', column: 'id', value: ids.purchaseB, expectedBefore: 'present', errorMode: 'permission-or-zero-rows',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('purchases').update({ status: 'paid' }).eq('id', ids.purchaseB).eq('parent_id', actorB.id);
      return { error };
    }),
  });
  await unchangedAfterAttack({
    results, serviceRole, name: 'cross-tenant game_sessions DELETE with actor B child_id', table: 'game_sessions', select: 'id,child_id,rounds_total,rounds_completed', column: 'id', value: ids.gameSessionB, expectedBefore: 'present', errorMode: 'permission-or-zero-rows',
    attack: mutate(async () => {
      const { error } = await actorA.client.from('game_sessions').delete().eq('id', ids.gameSessionB).eq('child_id', ids.childB);
      return { error };
    }),
  });

  await unchangedAfterAttack({
    results, serviceRole, name: 'waitlist anon INSERT', table: 'waitlist', select: 'id,email,source', column: 'email', value: ids.attackWaitlistEmail, expectedBefore: 'absent', errorMode: 'permission-required',
    attack: mutate(async () => {
      const { error } = await anon.from('waitlist').insert({ email: ids.attackWaitlistEmail, source: 'rls-verification' });
      return { error };
    }),
  });

  const deleteChecks: Array<{
    name: string;
    table: string;
    select: string;
    column: string;
    value: string;
    client: SupabaseClient;
  }> = [
    { name: 'view_events own DELETE', table: 'view_events', select: 'id,child_id,event_type,timestamp_sec', column: 'id', value: ids.viewEventA, client: actorA.client },
    { name: 'emoji_reactions own DELETE', table: 'emoji_reactions', select: 'id,child_id,reaction', column: 'id', value: ids.emojiA, client: actorA.client },
    { name: 'quiz_results own DELETE', table: 'quiz_results', select: 'id,child_id,selected_answer,is_correct', column: 'id', value: ids.quizA, client: actorA.client },
    { name: 'word_profiles own DELETE', table: 'word_profiles', select: 'child_id,preferred_adjectives,weights', column: 'child_id', value: ids.childA, client: actorA.client },
    { name: 'syllabus_enrollments own DELETE', table: 'syllabus_enrollments', select: 'id,child_id,status', column: 'id', value: ids.enrollmentA, client: actorA.client },
    { name: 'lesson_progress own DELETE', table: 'lesson_progress', select: 'id,child_id,status', column: 'id', value: ids.progressA, client: actorA.client },
    { name: 'game_rounds own DELETE', table: 'game_rounds', select: 'id,child_id,difficulty', column: 'id', value: ids.gameRoundA, client: actorA.client },
    { name: 'game_sessions own DELETE', table: 'game_sessions', select: 'id,child_id,rounds_completed', column: 'id', value: ids.gameSessionA, client: actorA.client },
    { name: 'videos own DELETE', table: 'videos', select: 'id,child_id,title,status', column: 'id', value: ids.videoA, client: actorA.client },
    { name: 'purchases own DELETE', table: 'purchases', select: 'id,parent_id,status', column: 'id', value: ids.purchaseA, client: actorA.client },
    { name: 'credits own DELETE', table: 'credits', select: 'parent_id,balance,lifetime_granted', column: 'parent_id', value: actorA.id, client: actorA.client },
    { name: 'children own DELETE', table: 'children', select: 'id,parent_id,name,age', column: 'id', value: ids.childASecondary, client: actorA.client },
  ];

  for (const check of deleteChecks) {
    await unchangedAfterAttack({
      results,
      serviceRole,
      name: check.name,
      table: check.table,
      select: check.select,
      column: check.column,
      value: check.value,
      expectedBefore: 'present',
      errorMode: 'permission-or-zero-rows',
      attack: async () => {
        const { error } = await check.client.from(check.table).delete().eq(check.column, check.value);
        return { error };
      },
    });
  }
}

async function cleanupFixtures(
  results: Results,
  serviceRole: SupabaseClient,
  ids: FixtureIds,
  actorIds: string[],
): Promise<void> {
  const cleanupErrors: string[] = [];
  const remove = async (table: string, column: string, values: string[]) => {
    const { error } = await serviceRole.from(table).delete().in(column, values);
    if (error) cleanupErrors.push(`${table}:${error.code}`);
  };

  await remove('view_events', 'id', [ids.viewEventA, ids.viewEventB, ids.attackViewEvent]);
  await remove('emoji_reactions', 'id', [ids.emojiA, ids.emojiB, ids.attackEmoji]);
  await remove('quiz_results', 'id', [ids.quizA, ids.quizB, ids.attackQuiz]);
  await remove('game_rounds', 'id', [ids.gameRoundA, ids.gameRoundB, ids.attackGameRound]);
  await remove('game_sessions', 'id', [ids.gameSessionA, ids.gameSessionB, ids.attackGameSession]);
  await remove('lesson_progress', 'id', [ids.progressA, ids.progressB, ids.attackProgress]);
  await remove('syllabus_enrollments', 'id', [ids.enrollmentA, ids.enrollmentB, ids.attackEnrollment]);
  await remove('word_profiles', 'child_id', [ids.childA, ids.childASecondary, ids.childB]);
  await remove('purchases', 'id', [ids.purchaseA, ids.purchaseB, ids.attackPurchase]);
  await remove('videos', 'id', [ids.videoA, ids.videoB, ids.attackVideo]);
  await remove('children', 'id', [ids.childA, ids.childASecondary, ids.childB, ids.attackChildOwn, ids.attackChildCross]);
  await remove('credits', 'parent_id', actorIds);
  await remove('syllabus_lessons', 'id', [ids.syllabusLesson]);
  await remove('syllabus_units', 'id', [ids.syllabusUnit]);
  await remove('syllabuses', 'id', [ids.syllabus]);
  await remove('library_videos', 'id', [ids.libraryVideo]);
  await remove('waitlist', 'email', [ids.attackWaitlistEmail]);

  for (const userId of actorIds) {
    const { error } = await serviceRole.auth.admin.deleteUser(userId);
    if (error) cleanupErrors.push(`auth.users:${userId}`);
  }

  if (cleanupErrors.length === 0) {
    results.pass('cleanup', 'fixture rows and both one-time Auth users removed');
  } else {
    results.fail(
      'cleanup',
      `remaining targets may include run_id=${ids.runId}, actor_ids=${JSON.stringify(actorIds)}, child_ids=${JSON.stringify([ids.childA, ids.childASecondary, ids.childB, ids.attackChildOwn, ids.attackChildCross])}, row_ids=${JSON.stringify(ids)}, errors=${cleanupErrors.join(',')}`,
    );
  }
}

async function main(): Promise<void> {
  const results = new Results();
  const ids = createFixtureIds();
  const createdUserIds: string[] = [];
  let serviceRole: SupabaseClient | null = null;

  try {
    const config = loadConfig(results);
    serviceRole = createSupabaseClient(config.url, config.serviceRoleKey, `rls-verify-${ids.runId}-service`);
    const anon = createSupabaseClient(config.url, config.anonKey, `rls-verify-${ids.runId}-anon`);
    const actorA = await createActor(config, serviceRole, 'a', ids.runId, createdUserIds);
    const actorB = await createActor(config, serviceRole, 'b', ids.runId, createdUserIds);
    results.pass('one-time authenticated actors', 'two users created and signed in; secret values were not logged');

    await createFixtures(serviceRole, actorA, actorB, ids);
    results.pass('service-role fixtures', 'constraint-valid rows created for both tenants');

    await runAuthenticatedPositiveControl(results, actorA, actorB, ids);
    await runExistingReadChecks(results, serviceRole, anon, actorA);
    await runSelectAndRpcChecks(results, serviceRole, actorA, ids);
    await runMutationMatrix({ results, serviceRole, anon, actorA, actorB, ids });
  } finally {
    if (serviceRole) {
      await cleanupFixtures(results, serviceRole, ids, createdUserIds);
    }
  }

  if (results.failures > 0) {
    throw new Error(`RLS verification failed with ${results.failures} FAIL result(s)`);
  }
  console.log('PASS RLS verification summary — no failures');
}

main().catch((error) => {
  console.error(`FAIL RLS verification aborted — ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
