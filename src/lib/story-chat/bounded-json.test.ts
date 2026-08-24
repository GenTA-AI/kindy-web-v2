import assert from 'node:assert/strict';
import test from 'node:test';

import { readBoundedJson } from './bounded-json';

test('bounded JSON accepts a small valid request', async () => {
  const request = new Request('https://kindy.kr/api/chat/turn', {
    method: 'POST',
    body: JSON.stringify({ kind: 'choice' }),
  });
  assert.deepEqual(await readBoundedJson(request, 64), {
    ok: true,
    value: { kind: 'choice' },
  });
});

test('bounded JSON rejects oversized content-length without reading a body', async () => {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new TextEncoder().encode('{}'));
      controller.close();
    },
  });
  const request = new Request('https://kindy.kr/api/chat/turn', {
    method: 'POST',
    headers: { 'content-length': '4097' },
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });

  assert.deepEqual(await readBoundedJson(request, 4096), {
    ok: false,
    reason: 'too_large',
  });
});

test('bounded JSON stops an oversized chunked body with no content-length', async () => {
  const request = new Request('https://kindy.kr/api/chat/turn', {
    method: 'POST',
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(40));
        controller.enqueue(new Uint8Array(40));
        controller.close();
      },
    }),
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });

  assert.deepEqual(await readBoundedJson(request, 64), {
    ok: false,
    reason: 'too_large',
  });
});

test('bounded JSON rejects malformed JSON and invalid UTF-8', async (t) => {
  await t.test('malformed JSON', async () => {
    const request = new Request('https://kindy.kr/api/chat/turn', {
      method: 'POST',
      body: '{',
    });
    assert.deepEqual(await readBoundedJson(request, 64), {
      ok: false,
      reason: 'invalid',
    });
  });

  await t.test('invalid UTF-8', async () => {
    const request = new Request('https://kindy.kr/api/chat/turn', {
      method: 'POST',
      body: new Uint8Array([0xff]),
    });
    assert.deepEqual(await readBoundedJson(request, 64), {
      ok: false,
      reason: 'invalid',
    });
  });
});
