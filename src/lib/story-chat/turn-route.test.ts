import assert from 'node:assert/strict';
import test from 'node:test';

import { NextRequest } from 'next/server';

import { POST } from '@/app/api/chat/rooms/[roomId]/turns/route';

const ROOM_ID = '018f3000-0000-7000-8000-000000000001';
const ROUTE_CONTEXT = { params: Promise.resolve({ roomId: ROOM_ID }) };
const PRIVATE_MARKER = 'child-private-body-must-not-leak';

function unreadBodyRequest(headers: HeadersInit) {
  const request = new NextRequest(`https://kindy.kr/api/chat/rooms/${ROOM_ID}/turns`, {
    method: 'POST',
    headers,
    body: new Blob([PRIVATE_MARKER]),
  });

  return request;
}

async function assertEarlyRejection(
  headers: HeadersInit,
  expectedStatus: 403 | 415,
  expectedCode: 'request_forbidden' | 'unsupported_media_type',
) {
  const request = unreadBodyRequest(headers);
  const response = await POST(request, ROUTE_CONTEXT);
  const responseText = await response.text();

  assert.equal(response.status, expectedStatus);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(request.bodyUsed, false, 'the rejected request body must remain unread');
  assert.equal(responseText.includes(PRIVATE_MARKER), false);
  assert.equal(JSON.parse(responseText).error.code, expectedCode);
}

test('turn POST rejects non-JSON media types before reading the body', async (t) => {
  await t.test('missing Content-Type', async () => {
    await assertEarlyRejection(
      { origin: 'https://kindy.kr' },
      415,
      'unsupported_media_type',
    );
  });

  await t.test('wrong Content-Type', async () => {
    await assertEarlyRejection(
      { 'content-type': 'text/plain', origin: 'https://kindy.kr' },
      415,
      'unsupported_media_type',
    );
  });
});

test('cookie-auth turn POST fails closed on Origin before reading the body', async (t) => {
  await t.test('missing Origin', async () => {
    await assertEarlyRejection(
      { 'content-type': 'application/json' },
      403,
      'request_forbidden',
    );
  });

  for (const [name, origin] of [
    ['cross-origin', 'https://attacker.example'],
    ['lookalike origin', 'https://kindy.kr.attacker.example'],
    ['opaque origin', 'null'],
    ['origin with a path', 'https://kindy.kr/not-an-origin'],
  ] as const) {
    await t.test(name, async () => {
      await assertEarlyRejection(
        { 'content-type': 'application/json', origin },
        403,
        'request_forbidden',
      );
    });
  }

  await t.test('malformed Bearer does not bypass Origin', async () => {
    await assertEarlyRejection(
      { 'content-type': 'application/json', authorization: 'Bearer    ' },
      403,
      'request_forbidden',
    );
  });
});

test('same-origin cookie and Origin-less Bearer requests continue to the route', async (t) => {
  const previousRuntimeFlag = process.env.STORY_CHAT_RUNTIME_ENABLED;
  process.env.STORY_CHAT_RUNTIME_ENABLED = '0';

  try {
    await t.test('same-origin cookie request', async () => {
      const request = new NextRequest(
        `https://kindy.kr/api/chat/rooms/${ROOM_ID}/turns`,
        {
          method: 'POST',
          headers: {
            'content-type': 'Application/JSON; charset=UTF-8',
            origin: 'https://kindy.kr',
          },
          body: '{}',
        },
      );
      const response = await POST(request, ROUTE_CONTEXT);

      assert.equal(response.status, 404);
      assert.equal((await response.json()).error.code, 'runtime_disabled');
    });

    await t.test('Origin-less mobile Bearer request', async () => {
      const request = new NextRequest(
        `https://kindy.kr/api/chat/rooms/${ROOM_ID}/turns`,
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer verified-by-supabase-later',
            'content-type': 'application/json',
          },
          body: '{}',
        },
      );
      const response = await POST(request, ROUTE_CONTEXT);

      assert.equal(response.status, 404);
      assert.equal((await response.json()).error.code, 'runtime_disabled');
    });
  } finally {
    if (previousRuntimeFlag === undefined) {
      delete process.env.STORY_CHAT_RUNTIME_ENABLED;
    } else {
      process.env.STORY_CHAT_RUNTIME_ENABLED = previousRuntimeFlag;
    }
  }
});

test('hard-disabled runtime rejects before reading invalid turn JSON', async () => {
  const previousEnvironment = {
    localPreview: process.env.KINDY_LOCAL_PREVIEW,
    launchMode: process.env.KINDY_LAUNCH_MODE,
    runtime: process.env.STORY_CHAT_RUNTIME_ENABLED,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  const capturedLogs: unknown[][] = [];
  const originalConsole = {
    error: console.error,
    log: console.log,
    warn: console.warn,
  };

  process.env.KINDY_LOCAL_PREVIEW = '1';
  process.env.KINDY_LAUNCH_MODE = 'protected_chat_pilot';
  process.env.STORY_CHAT_RUNTIME_ENABLED = '1';
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  console.error = (...values: unknown[]) => capturedLogs.push(values);
  console.log = (...values: unknown[]) => capturedLogs.push(values);
  console.warn = (...values: unknown[]) => capturedLogs.push(values);

  try {
    const request = new NextRequest(
      `https://kindy.kr/api/chat/rooms/${ROOM_ID}/turns`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://kindy.kr',
        },
        body: `{"private":"${PRIVATE_MARKER}"`,
      },
    );
    const response = await POST(request, ROUTE_CONTEXT);
    const responseText = await response.text();

    assert.equal(response.status, 404);
    assert.equal(
      (JSON.parse(responseText) as { error: { code: string } }).error.code,
      'runtime_disabled',
    );
    assert.equal(request.bodyUsed, false);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(responseText.includes(PRIVATE_MARKER), false);
    assert.equal(JSON.stringify(capturedLogs).includes(PRIVATE_MARKER), false);
  } finally {
    console.error = originalConsole.error;
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;

    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore('KINDY_LOCAL_PREVIEW', previousEnvironment.localPreview);
    restore('KINDY_LAUNCH_MODE', previousEnvironment.launchMode);
    restore('STORY_CHAT_RUNTIME_ENABLED', previousEnvironment.runtime);
    restore('NEXT_PUBLIC_SUPABASE_URL', previousEnvironment.supabaseUrl);
    restore('NEXT_PUBLIC_SUPABASE_ANON_KEY', previousEnvironment.supabaseAnonKey);
  }
});
