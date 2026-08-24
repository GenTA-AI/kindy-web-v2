import assert from 'node:assert/strict';
import test from 'node:test';

import { NextRequest } from 'next/server';

import { POST } from '@/app/api/chat/rooms/[roomId]/sessions/route';

const ROOM_ID = '018f3000-0000-7000-8000-000000000001';
const ROUTE_CONTEXT = { params: Promise.resolve({ roomId: ROOM_ID }) };
const PRIVATE_MARKER = 'child-private-session-body-must-not-leak';

function unreadBodyRequest(headers: HeadersInit) {
  return new NextRequest(`https://kindy.kr/api/chat/rooms/${ROOM_ID}/sessions`, {
    method: 'POST',
    headers,
    body: new Blob([PRIVATE_MARKER]),
  });
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
  assert.equal(request.bodyUsed, false);
  assert.equal(responseText.includes(PRIVATE_MARKER), false);
  assert.equal(JSON.parse(responseText).error.code, expectedCode);
}

test('session POST applies JSON and same-origin boundary before body or auth', async (t) => {
  await t.test('missing JSON Content-Type', async () => {
    await assertEarlyRejection(
      { origin: 'https://kindy.kr' },
      415,
      'unsupported_media_type',
    );
  });

  await t.test('missing cookie Origin', async () => {
    await assertEarlyRejection(
      { 'content-type': 'application/json' },
      403,
      'request_forbidden',
    );
  });

  await t.test('cross-origin cookie request', async () => {
    await assertEarlyRejection(
      {
        'content-type': 'application/json',
        origin: 'https://attacker.example',
      },
      403,
      'request_forbidden',
    );
  });
});

test('same-origin cookie and Origin-less Bearer session requests reach runtime gate', async (t) => {
  const previousRuntimeFlag = process.env.STORY_CHAT_RUNTIME_ENABLED;
  process.env.STORY_CHAT_RUNTIME_ENABLED = '0';

  try {
    for (const [name, headers] of [
      [
        'same-origin cookie',
        { 'content-type': 'application/json', origin: 'https://kindy.kr' },
      ],
      [
        'Origin-less Bearer',
        {
          authorization: 'Bearer verified-by-supabase-later',
          'content-type': 'application/json',
        },
      ],
    ] as const) {
      await t.test(name, async () => {
        const request = new NextRequest(
          `https://kindy.kr/api/chat/rooms/${ROOM_ID}/sessions`,
          { method: 'POST', headers, body: '{}' },
        );
        const response = await POST(request, ROUTE_CONTEXT);

        assert.equal(response.status, 404);
        assert.equal((await response.json()).error.code, 'runtime_disabled');
      });
    }
  } finally {
    if (previousRuntimeFlag === undefined) {
      delete process.env.STORY_CHAT_RUNTIME_ENABLED;
    } else {
      process.env.STORY_CHAT_RUNTIME_ENABLED = previousRuntimeFlag;
    }
  }
});

test('hard-disabled runtime rejects before reading malformed session JSON', async () => {
  const previousEnvironment = {
    localPreview: process.env.KINDY_LOCAL_PREVIEW,
    launchMode: process.env.KINDY_LAUNCH_MODE,
    runtime: process.env.STORY_CHAT_RUNTIME_ENABLED,
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
  console.error = (...values: unknown[]) => capturedLogs.push(values);
  console.log = (...values: unknown[]) => capturedLogs.push(values);
  console.warn = (...values: unknown[]) => capturedLogs.push(values);

  try {
    const request = new NextRequest(
      `https://kindy.kr/api/chat/rooms/${ROOM_ID}/sessions`,
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
    assert.equal(responseText.includes(PRIVATE_MARKER), false);
    assert.equal(JSON.stringify(capturedLogs).includes(PRIVATE_MARKER), false);
  } finally {
    console.error = originalConsole.error;
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;

    if (previousEnvironment.localPreview === undefined) {
      delete process.env.KINDY_LOCAL_PREVIEW;
    } else {
      process.env.KINDY_LOCAL_PREVIEW = previousEnvironment.localPreview;
    }
    if (previousEnvironment.launchMode === undefined) {
      delete process.env.KINDY_LAUNCH_MODE;
    } else {
      process.env.KINDY_LAUNCH_MODE = previousEnvironment.launchMode;
    }
    if (previousEnvironment.runtime === undefined) {
      delete process.env.STORY_CHAT_RUNTIME_ENABLED;
    } else {
      process.env.STORY_CHAT_RUNTIME_ENABLED = previousEnvironment.runtime;
    }
  }
});
