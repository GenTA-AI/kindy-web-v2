import assert from 'node:assert/strict';
import test from 'node:test';

import { getDeploymentHealth, getDeploymentLiveness } from './deployment-health';

const shared = {
  NODE_ENV: 'production',
  KINDY_RELEASE_SHA: 'abc123',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'server-only-service-role-key',
} as const;

test('preview is ready with an explicit deploy label and release', () => {
  const health = getDeploymentHealth({
    ...shared,
    KINDY_DEPLOY_ENV: 'preview',
    LESSON_GUEST_MODE: '1',
  });

  assert.equal(health.status, 'ready');
  assert.equal(health.environment, 'preview');
  assert.deepEqual(health.checks, {
    deployEnvironment: true,
    release: true,
    supabase: true,
    productionSafety: true,
  });
});

test('production is not ready when a production guard fails', () => {
  const health = getDeploymentHealth({
    ...shared,
    KINDY_DEPLOY_ENV: 'production',
    BILLING_KEY_SECRET: '',
  });

  assert.equal(health.status, 'not_ready');
  assert.equal(health.checks.productionSafety, false);
});

test('readiness fails closed on missing release, deploy label, or Supabase', () => {
  const health = getDeploymentHealth({ NODE_ENV: 'production' });

  assert.equal(health.status, 'not_ready');
  assert.equal(health.release, 'unknown');
  assert.equal(health.environment, 'unknown');
  assert.deepEqual(health.checks, {
    deployEnvironment: false,
    release: false,
    supabase: false,
    productionSafety: false,
  });
});

test('liveness only proves that the process can answer HTTP', () => {
  assert.deepEqual(getDeploymentLiveness({ KINDY_RELEASE_SHA: ' release-1 ' }), {
    service: 'kindy',
    status: 'ok',
    release: 'release-1',
  });
});
