import assert from 'node:assert/strict';
import test from 'node:test';

import { getDeploymentHealth, getDeploymentLiveness } from './deployment-health';

const shared = {
  NODE_ENV: 'production',
  KINDY_RELEASE_SHA: 'abc123',
  K_REVISION: 'kindy-test-revision',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'server-only-service-role-key',
  STORY_CONTENT_RELEASE_STORAGE_READER_KEY: 'separate-read-only-storage-jwt',
  STORY_CHAT_RUNTIME_ENABLED: '0',
  STORY_CHAT_FREE_TEXT_ENABLED: '0',
} as const;

test('open preview is ready only with its explicit launch configuration', () => {
  const health = getDeploymentHealth({
    ...shared,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    KINDY_DEPLOY_ENV: 'preview',
    KINDY_LAUNCH_MODE: 'open_preview',
    LESSON_GUEST_MODE: '1',
  });

  assert.equal(health.status, 'ready');
  assert.equal(health.environment, 'preview');
  assert.equal(health.launchMode, 'open_preview');
  assert.deepEqual(health.checks, {
    deployEnvironment: true,
    launchConfiguration: true,
    release: true,
    supabase: true,
    storyChatRuntime: true,
    contentRelease: true,
    freeTextDisabled: true,
    productionSafety: true,
  });
});

test('public preview rejects a need for same-project service-role credentials', () => {
  const health = getDeploymentHealth({
    ...shared,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    KINDY_DEPLOY_ENV: 'preview',
    KINDY_LAUNCH_MODE: 'protected_chat_pilot',
  });

  assert.equal(health.status, 'ready');
  assert.equal(health.checks.supabase, true);
  assert.equal(health.checks.storyChatRuntime, true);

  const leakedServiceRole = getDeploymentHealth({
    ...shared,
    KINDY_DEPLOY_ENV: 'preview',
    KINDY_LAUNCH_MODE: 'open_preview',
  });
  assert.equal(leakedServiceRole.status, 'not_ready');
  assert.equal(leakedServiceRole.checks.supabase, false);
});

test('protected chat pilot remains fail-closed until the immutable object boundary exists', () => {
  for (const deployEnvironment of ['preview', 'production'] as const) {
    const health = getDeploymentHealth({
      ...shared,
      KINDY_DEPLOY_ENV: deployEnvironment,
      KINDY_LAUNCH_MODE: 'protected_chat_pilot',
      STORY_CHAT_RUNTIME_ENABLED: '1',
      STORY_CONTENT_RELEASE_BUCKET: 'content-releases',
      STORY_CONTENT_RELEASE_CHANNEL:
        deployEnvironment === 'preview' ? 'staging' : 'production',
      BILLING_KEY_SECRET:
        deployEnvironment === 'production' ? 'production-billing-key' : undefined,
    });

    assert.equal(health.status, 'not_ready', deployEnvironment);
    assert.equal(health.launchMode, 'protected_chat_pilot');
    assert.equal(health.checks.launchConfiguration, true);
    assert.equal(health.checks.storyChatRuntime, false);
    assert.equal(health.checks.freeTextDisabled, true);
  }
});

test('production presale is ready with chat runtime explicitly disabled', () => {
  const health = getDeploymentHealth({
    ...shared,
    KINDY_DEPLOY_ENV: 'production',
    KINDY_LAUNCH_MODE: 'production_presale',
    BILLING_KEY_SECRET: 'production-billing-key',
  });

  assert.equal(health.status, 'ready');
  assert.equal(health.launchMode, 'production_presale');
});

test('production is not ready when a production guard fails', () => {
  const health = getDeploymentHealth({
    ...shared,
    KINDY_DEPLOY_ENV: 'production',
    KINDY_LAUNCH_MODE: 'production_presale',
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
    launchConfiguration: false,
    release: false,
    supabase: false,
    storyChatRuntime: false,
    contentRelease: false,
    freeTextDisabled: false,
    productionSafety: false,
  });
  assert.equal(health.launchMode, 'unknown');
});

test('readiness rejects invalid deploy and launch mode pairings', () => {
  for (const [deployEnvironment, launchMode] of [
    ['preview', 'production_presale'],
    ['production', 'open_preview'],
    ['preview', 'protected-chat-pilot'],
    ['production', ''],
  ] as const) {
    const health = getDeploymentHealth({
      ...shared,
      KINDY_DEPLOY_ENV: deployEnvironment,
      KINDY_LAUNCH_MODE: launchMode,
      BILLING_KEY_SECRET: 'production-billing-key',
    });

    assert.equal(health.status, 'not_ready', `${deployEnvironment}/${launchMode}`);
    assert.equal(
      health.checks.launchConfiguration,
      false,
      `${deployEnvironment}/${launchMode}`,
    );
  }
});

test('readiness rejects malformed runtime flags and runtime opt-in outside pilot', () => {
  for (const [runtimeEnabled, freeTextEnabled] of [
    [undefined, '0'],
    ['', '0'],
    ['true', '0'],
    ['1 ', '0'],
    ['0', undefined],
    ['0', '1'],
  ] as const) {
    const health = getDeploymentHealth({
      ...shared,
      KINDY_DEPLOY_ENV: 'preview',
      KINDY_LAUNCH_MODE: 'open_preview',
      STORY_CHAT_RUNTIME_ENABLED: runtimeEnabled,
      STORY_CHAT_FREE_TEXT_ENABLED: freeTextEnabled,
    });

    assert.equal(
      health.status,
      'not_ready',
      `${String(runtimeEnabled)}/${String(freeTextEnabled)}`,
    );
  }

  const runtimeOutsidePilot = getDeploymentHealth({
    ...shared,
    KINDY_DEPLOY_ENV: 'production',
    KINDY_LAUNCH_MODE: 'production_presale',
    STORY_CHAT_RUNTIME_ENABLED: '1',
    BILLING_KEY_SECRET: 'production-billing-key',
  });

  assert.equal(runtimeOutsidePilot.status, 'not_ready');
  assert.equal(runtimeOutsidePilot.checks.storyChatRuntime, false);
});

test('authored runtime requires the exact private release bucket and deploy channel', () => {
  const invalidConfigurations = [
    {
      KINDY_DEPLOY_ENV: 'preview',
      STORY_CONTENT_RELEASE_BUCKET: 'other-releases',
      STORY_CONTENT_RELEASE_CHANNEL: 'staging',
    },
    {
      KINDY_DEPLOY_ENV: 'preview',
      STORY_CONTENT_RELEASE_BUCKET: 'content-releases',
      STORY_CONTENT_RELEASE_CHANNEL: 'production',
    },
    {
      KINDY_DEPLOY_ENV: 'production',
      STORY_CONTENT_RELEASE_BUCKET: 'content-releases',
      STORY_CONTENT_RELEASE_CHANNEL: 'staging',
    },
    {
      KINDY_DEPLOY_ENV: 'production',
      STORY_CONTENT_RELEASE_BUCKET: 'https://storage.invalid/content-releases',
      STORY_CONTENT_RELEASE_CHANNEL: 'production',
    },
  ] as const;

  for (const configuration of invalidConfigurations) {
    const health = getDeploymentHealth({
      ...shared,
      ...configuration,
      KINDY_LAUNCH_MODE: 'protected_chat_pilot',
      STORY_CHAT_RUNTIME_ENABLED: '1',
      BILLING_KEY_SECRET:
        configuration.KINDY_DEPLOY_ENV === 'production'
          ? 'production-billing-key'
          : undefined,
    });

    assert.equal(health.status, 'not_ready');
    assert.equal(health.checks.contentRelease, false);
  }

  const missingReaderIdentity = getDeploymentHealth({
    ...shared,
    KINDY_DEPLOY_ENV: 'preview',
    KINDY_LAUNCH_MODE: 'protected_chat_pilot',
    STORY_CHAT_RUNTIME_ENABLED: '1',
    STORY_CONTENT_RELEASE_CHANNEL: 'staging',
    STORY_CONTENT_RELEASE_STORAGE_READER_KEY: '',
  });
  assert.equal(missingReaderIdentity.status, 'not_ready');
  assert.equal(missingReaderIdentity.checks.contentRelease, false);
});

test('authored runtime cannot be activated even with otherwise valid release settings', () => {
  const health = getDeploymentHealth({
    ...shared,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    KINDY_DEPLOY_ENV: 'preview',
    KINDY_LAUNCH_MODE: 'protected_chat_pilot',
    STORY_CHAT_RUNTIME_ENABLED: '1',
    STORY_CONTENT_RELEASE_CHANNEL: 'staging',
  });

  assert.equal(health.status, 'not_ready');
  assert.equal(health.checks.storyChatRuntime, false);
  assert.equal(health.checks.contentRelease, true);
});

test('disabled authored runtime does not require release objects to be readable', () => {
  const health = getDeploymentHealth({
    ...shared,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    KINDY_DEPLOY_ENV: 'preview',
    KINDY_LAUNCH_MODE: 'open_preview',
    STORY_CONTENT_RELEASE_BUCKET: 'wrong-while-disabled',
    STORY_CONTENT_RELEASE_CHANNEL: 'production',
  });

  assert.equal(health.status, 'ready');
  assert.equal(health.checks.contentRelease, true);
});

test('liveness only proves that the process can answer HTTP', () => {
  assert.deepEqual(getDeploymentLiveness({
    KINDY_RELEASE_SHA: ' release-1 ',
    K_REVISION: ' kindy-00042-test ',
  }), {
    service: 'kindy',
    status: 'ok',
    release: 'release-1',
    revision: 'kindy-00042-test',
  });
});
