import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRESALE_OPEN_ROUTE_RULES,
  isLaunchSurfaceClosed,
  isPresaleLockdownEnabled,
  isProductionLaunchEnvironment,
  matchesLaunchRoute,
} from './launch-surface';

const production = { NODE_ENV: 'production' } as const;
const development = { NODE_ENV: 'development' } as const;

test('production presale allowlist permits only the intended page families', () => {
  for (const pathname of [
    '/',
    '/first-story',
    '/first-story/',
    '/legal/terms',
    '/legal/privacy',
    '/auth/login',
    '/auth/callback',
    '/subscribe',
    '/subscribe/success',
  ]) {
    assert.equal(isLaunchSurfaceClosed(pathname, production), false, pathname);
  }

  for (const pathname of [
    '/demo',
    '/demo/kiosk',
    '/world',
    '/island',
    '/sample/library',
    '/start',
    '/play',
    '/dashboard',
    '/lesson/seurat-01',
    '/legalese',
    '/authentic',
    '/subscribers',
  ]) {
    assert.equal(isLaunchSurfaceClosed(pathname, production), true, pathname);
  }
});

test('production closes scoped APIs while leaving unrelated operational APIs unchanged', () => {
  for (const pathname of [
    '/api/kiosk/events',
    '/api/videos',
    '/api/videos/bespoke',
    '/api/attention-quiz',
  ]) {
    assert.equal(isLaunchSurfaceClosed(pathname, production), true, pathname);
  }

  for (const pathname of [
    '/api/subscription',
    '/api/payments/webhook/portone',
    '/api/inngest',
    '/api/waitlist',
  ]) {
    assert.equal(isLaunchSurfaceClosed(pathname, production), false, pathname);
  }
});

test('local development and Vercel preview remain open', () => {
  assert.equal(isLaunchSurfaceClosed('/demo/kiosk', development), false);
  assert.equal(
    isLaunchSurfaceClosed('/dashboard', {
      NODE_ENV: 'production',
      VERCEL_ENV: 'preview',
    }),
    false,
  );
  assert.equal(
    isProductionLaunchEnvironment({ NODE_ENV: 'production', VERCEL_ENV: 'development' }),
    false,
  );
});

test('production is always locked and the opt-in switch can exercise lockdown elsewhere', () => {
  assert.equal(isPresaleLockdownEnabled(production), true);
  assert.equal(
    isPresaleLockdownEnabled({
      NODE_ENV: 'production',
      KINDY_PRESALE_LOCKDOWN: '0',
    }),
    true,
  );
  assert.equal(
    isLaunchSurfaceClosed('/demo', {
      NODE_ENV: 'development',
      KINDY_PRESALE_LOCKDOWN: '1',
    }),
    true,
  );
});

test('route matching treats descendants exactly and supports the one-line G2 catch-all', () => {
  const legalRule = PRESALE_OPEN_ROUTE_RULES.find((rule) => rule.path === '/legal');
  assert.ok(legalRule);
  assert.equal(matchesLaunchRoute('/legal/terms', legalRule), true);
  assert.equal(matchesLaunchRoute('/legalese', legalRule), false);

  const g2CatchAll = { path: '/', includeDescendants: true } as const;
  assert.equal(matchesLaunchRoute('/dashboard', g2CatchAll), true);
  assert.equal(matchesLaunchRoute('/api/videos', g2CatchAll), true);
});
