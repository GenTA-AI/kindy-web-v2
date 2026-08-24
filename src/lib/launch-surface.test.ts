import assert from 'node:assert/strict';
import test from 'node:test';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';

import {
  PROTECTED_CHAT_PILOT_OPEN_API_RULES,
  PRESALE_OPEN_ROUTE_RULES,
  getLaunchMode,
  isLaunchSurfaceClosed,
  isPresaleLockdownEnabled,
  isProductionLaunchEnvironment,
  matchesLaunchRoute,
  resolveOnboardingCompletionPath,
  safeChatPilotNextPath,
} from './launch-surface';
import {
  acceptsBearerAuth,
  config as proxyConfig,
  getBearerToken,
  isAuthProtectedPath,
  loginRedirectUrl,
  proxy,
} from '../proxy';
import { NextRequest } from 'next/server';

const production = { NODE_ENV: 'production' } as const;
const development = { NODE_ENV: 'development' } as const;
const protectedChatPilot = {
  NODE_ENV: 'production',
  KINDY_DEPLOY_ENV: 'production',
  KINDY_LAUNCH_MODE: 'protected_chat_pilot',
} as const;

async function withProcessEnvironment<T>(
  overrides: Record<string, string | undefined>,
  run: () => Promise<T>,
): Promise<T> {
  const original = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    original.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

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

test('protected chat pilot adds only onboarding and chats to the presale page surface', () => {
  for (const pathname of [
    '/',
    '/first-story',
    '/legal/privacy',
    '/auth/login',
    '/subscribe',
    '/onboarding',
    '/chats',
    '/chats/picture-detectives',
  ]) {
    assert.equal(isLaunchSurfaceClosed(pathname, protectedChatPilot), false, pathname);
  }

  for (const pathname of [
    '/demo',
    '/demo/kiosk',
    '/world',
    '/dashboard',
    '/play',
    '/sample/library',
    '/onboarding/complete',
    '/chat',
    '/chatscape',
  ]) {
    assert.equal(isLaunchSurfaceClosed(pathname, protectedChatPilot), true, pathname);
  }
});

test('protected chat pilot exposes only the required API families', () => {
  for (const pathname of [
    '/api/health/live',
    '/api/health/ready',
    '/api/waitlist',
    '/api/subscription',
    '/api/subscription/consent',
    '/api/payments/webhook/portone',
    '/api/inngest',
    '/api/children',
    '/api/children/child-1',
    '/api/chat',
    '/api/chat/turns',
  ]) {
    assert.equal(isLaunchSurfaceClosed(pathname, protectedChatPilot), false, pathname);
  }

  for (const pathname of [
    '/api',
    '/api/dashboard/summary',
    '/api/videos',
    '/api/game/events',
    '/api/attention-quiz',
    '/api/agents/growth',
    '/api/chatbot',
    '/api/childrenish',
  ]) {
    assert.equal(isLaunchSurfaceClosed(pathname, protectedChatPilot), true, pathname);
  }

  assert.ok(
    PROTECTED_CHAT_PILOT_OPEN_API_RULES.some((rule) => rule.path === '/api/chat'),
  );
});

test('launch mode is separate from deploy identity and unknown production modes fail closed', () => {
  assert.equal(getLaunchMode(protectedChatPilot), 'protected_chat_pilot');
  assert.equal(
    getLaunchMode({
      NODE_ENV: 'production',
      KINDY_DEPLOY_ENV: 'preview',
      KINDY_LAUNCH_MODE: 'open_preview',
    }),
    'open_preview',
  );
  assert.equal(
    getLaunchMode({
      NODE_ENV: 'production',
      KINDY_DEPLOY_ENV: 'preview',
      KINDY_LAUNCH_MODE: 'protected_chat_pilot',
    }),
    'protected_chat_pilot',
  );
  assert.equal(
    getLaunchMode({
      NODE_ENV: 'production',
      KINDY_DEPLOY_ENV: 'production',
      KINDY_LAUNCH_MODE: 'open_preview',
    }),
    'production_presale',
  );
  assert.equal(
    getLaunchMode({
      NODE_ENV: 'production',
      KINDY_DEPLOY_ENV: 'preview',
      KINDY_LAUNCH_MODE: 'production_presale',
    }),
    'production_presale',
  );
  assert.equal(
    getLaunchMode({
      NODE_ENV: 'production',
      KINDY_DEPLOY_ENV: 'invalid',
      KINDY_LAUNCH_MODE: 'protected_chat_pilot',
    }),
    'production_presale',
  );
  assert.equal(
    getLaunchMode({
      NODE_ENV: 'production',
      KINDY_DEPLOY_ENV: 'production',
      KINDY_LAUNCH_MODE: 'protected-chat-pilot',
    }),
    'production_presale',
  );
  assert.equal(
    isLaunchSurfaceClosed('/chats', {
      NODE_ENV: 'production',
      KINDY_DEPLOY_ENV: 'production',
      KINDY_LAUNCH_MODE: 'protected-chat-pilot',
    }),
    true,
  );
});

test('chat and onboarding auth coverage is independent of launch mode', () => {
  for (const pathname of [
    '/onboarding',
    '/chats',
    '/chats/picture-detectives',
    '/api/children',
    '/api/children/child-1',
    '/api/chat',
    '/api/chat/turns',
  ]) {
    assert.equal(isAuthProtectedPath(pathname), true, pathname);
  }

  for (const pathname of [
    '/',
    '/auth/login',
    '/auth/callback',
    '/api/health/live',
    '/api/payments/webhook/portone',
    '/api/inngest',
    '/api/chatbot',
    '/chatscape',
  ]) {
    assert.equal(isAuthProtectedPath(pathname), false, pathname);
  }
});

test('Next proxy matcher covers all page and API entry points but not static assets', () => {
  for (const url of [
    '/chats',
    '/chats/room.with-dot',
    '/api/chat/turns',
    '/api/chat/room.json',
    '/api/health/live',
    '/demo/kiosk',
  ]) {
    assert.equal(
      unstable_doesMiddlewareMatch({ config: proxyConfig, nextConfig: {}, url }),
      true,
      url,
    );
  }

  for (const url of [
    '/_next/static/chunks/app.js',
    '/_next/image?url=%2Fposter.jpg',
    '/favicon.ico',
    '/chat/avatar.png',
  ]) {
    assert.equal(
      unstable_doesMiddlewareMatch({ config: proxyConfig, nextConfig: {}, url }),
      false,
      url,
    );
  }
});

test('login redirect preserves the protected path and query as a single safe next value', () => {
  const request = new NextRequest(
    'https://kindy.kr/chats/picture-detectives?from=onboarding&step=1',
  );
  const redirect = loginRedirectUrl(request);

  assert.equal(redirect.origin, 'https://kindy.kr');
  assert.equal(redirect.pathname, '/auth/login');
  assert.equal(
    redirect.searchParams.get('next'),
    '/chats/picture-detectives?from=onboarding&step=1',
  );
});

test('proxy extracts only an explicit Bearer credential for mobile chat auth', () => {
  assert.equal(
    getBearerToken(new NextRequest('https://kindy.kr/api/chat/rooms', {
      headers: { authorization: 'Bearer valid-access-token' },
    })),
    'valid-access-token',
  );
  assert.equal(
    getBearerToken(new NextRequest('https://kindy.kr/api/chat/rooms', {
      headers: { authorization: 'Basic not-a-bearer-token' },
    })),
    null,
  );
  assert.equal(
    getBearerToken(new NextRequest('https://kindy.kr/api/chat/rooms')),
    null,
  );
  assert.equal(acceptsBearerAuth('/api/chat'), true);
  assert.equal(acceptsBearerAuth('/api/chat/rooms/room-1'), true);
  assert.equal(acceptsBearerAuth('/api/children'), false);
  assert.equal(acceptsBearerAuth('/chats/room-1'), false);
});

test('proxy applies pilot 404s before auth and fails closed when auth is unavailable', async () => {
  await withProcessEnvironment(
    {
      NODE_ENV: 'production',
      KINDY_DEPLOY_ENV: 'production',
      KINDY_LAUNCH_MODE: 'protected_chat_pilot',
      KINDY_LOCAL_PREVIEW: '0',
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    },
    async () => {
      const closedPage = await proxy(new NextRequest('https://kindy.kr/demo/kiosk'));
      assert.equal(closedPage.status, 404);
      assert.equal(closedPage.headers.get('x-robots-tag'), 'noindex, nofollow');

      const closedApi = await proxy(
        new NextRequest('https://kindy.kr/api/dashboard/summary'),
      );
      assert.equal(closedApi.status, 404);

      const onboarding = await proxy(
        new NextRequest('https://kindy.kr/onboarding?add=1'),
      );
      assert.equal(onboarding.status, 307);
      const onboardingLocation = onboarding.headers.get('location');
      assert.ok(onboardingLocation);
      const onboardingUrl = new URL(onboardingLocation);
      assert.equal(onboardingUrl.pathname, '/onboarding');
      assert.equal(onboardingUrl.searchParams.get('add'), '1');
      assert.equal(onboardingUrl.searchParams.get('next'), '/chats');

      const chatPage = await proxy(
        new NextRequest('https://kindy.kr/chats/picture-detectives?from=invite'),
      );
      assert.equal(chatPage.status, 307);
      const location = chatPage.headers.get('location');
      assert.ok(location);
      const loginUrl = new URL(location);
      assert.equal(loginUrl.pathname, '/auth/login');
      assert.equal(
        loginUrl.searchParams.get('next'),
        '/chats/picture-detectives?from=invite',
      );

      const chatApi = await proxy(
        new NextRequest('https://kindy.kr/api/chat/turns', { method: 'POST' }),
      );
      assert.equal(chatApi.status, 503);
      assert.deepEqual(await chatApi.json(), { error: 'Auth backend not configured' });

      const health = await proxy(new NextRequest('https://kindy.kr/api/health/live'));
      assert.equal(health.status, 200);
      assert.equal(health.headers.get('x-middleware-next'), '1');

      for (const publicCallback of [
        'https://kindy.kr/auth/callback?code=opaque',
        'https://kindy.kr/api/payments/webhook/portone',
        'https://kindy.kr/api/inngest',
      ]) {
        const response = await proxy(new NextRequest(publicCallback, { method: 'POST' }));
        assert.equal(response.status, 200, publicCallback);
        assert.equal(response.headers.get('x-middleware-next'), '1', publicCallback);
      }
    },
  );
});

test('onboarding completion keeps only same-site chat destinations', () => {
  assert.equal(safeChatPilotNextPath('/chats'), '/chats');
  assert.equal(
    safeChatPilotNextPath('/chats/picture-detectives?from=onboarding#ignored'),
    '/chats/picture-detectives?from=onboarding',
  );

  for (const value of [
    '',
    '/dashboard',
    '//evil.example/chats',
    '/\\evil.example/chats',
    'https://evil.example/chats',
    '/%2F%2Fevil.example',
    '/chatscape',
  ]) {
    assert.equal(safeChatPilotNextPath(value), '/chats', String(value));
  }

  assert.equal(
    resolveOnboardingCompletionPath(null, 'child/one'),
    '/play/first-journey?childId=child%2Fone',
  );
  assert.equal(
    resolveOnboardingCompletionPath('/chats/picture-detectives?from=onboarding', 'child-1'),
    '/chats/picture-detectives?from=onboarding',
  );
  assert.equal(
    resolveOnboardingCompletionPath('//evil.example/chats', 'child-1'),
    '/chats',
  );
});

test('explicit preview emits one non-secret reason log per module instance', (t) => {
  const messages: string[] = [];
  t.mock.method(console, 'warn', (message: string) => {
    messages.push(message);
  });

  const preview = {
    NODE_ENV: 'production',
    KINDY_DEPLOY_ENV: 'preview',
  } as const;

  assert.equal(isProductionLaunchEnvironment(preview), false);
  assert.equal(isProductionLaunchEnvironment(preview), false);
  assert.deepEqual(messages, [
    '[launch-surface] Preview access is enabled because KINDY_DEPLOY_ENV="preview".',
  ]);
});

test('local development and an explicitly labeled Kindy preview remain open', () => {
  assert.equal(isLaunchSurfaceClosed('/demo/kiosk', development), false);
  assert.equal(
    isLaunchSurfaceClosed('/dashboard', {
      NODE_ENV: 'production',
      KINDY_DEPLOY_ENV: 'preview',
    }),
    false,
  );
  assert.equal(
    isProductionLaunchEnvironment({
      NODE_ENV: 'production',
      KINDY_DEPLOY_ENV: 'preview',
    }),
    false,
  );
});

test('production defaults to locked when KINDY_DEPLOY_ENV is missing or invalid', () => {
  for (const value of [undefined, '', 'preveiw', 'development', 'Preview']) {
    assert.equal(
      isProductionLaunchEnvironment({
        NODE_ENV: 'production',
        KINDY_DEPLOY_ENV: value,
      }),
      true,
      `KINDY_DEPLOY_ENV=${JSON.stringify(value)}`,
    );
  }
});

test('legacy VERCEL_ENV can no longer unlock a production image', () => {
  const legacyVercelPreview = {
    NODE_ENV: 'production',
    VERCEL_ENV: 'preview',
  } as const;

  assert.equal(isProductionLaunchEnvironment(legacyVercelPreview), true);
  assert.equal(isLaunchSurfaceClosed('/dashboard', legacyVercelPreview), true);
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
