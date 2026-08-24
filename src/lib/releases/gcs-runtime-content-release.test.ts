import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GcsPrivateReleaseAssetSigner,
  GcsPrivateReleaseObjectStore,
  GoogleCloudRunWorkloadAccessTokenProvider,
  isAllowedGcsReleaseAssetSignedUrl,
  type GoogleCloudAccessTokenProvider,
} from './gcs-runtime-content-release';

const BUCKET = 'kindy-493701-content-releases-staging';
const SIGNER = 'kindy-preview-runtime@kindy-493701.iam.gserviceaccount.com';
const STORAGE_KEY = 'releases/story.one/1.0.0/media/cover-image.png';
const ACCESS_TOKEN = 'access-token-value-123456';
const NOW = new Date('2026-08-24T01:02:03.987Z');
const RSA_SIGNATURE = Buffer.alloc(256, 0xab).toString('base64');

const tokenProvider: GoogleCloudAccessTokenProvider = {
  async getAccessToken() {
    return ACCESS_TOKEN;
  },
};

function signingInput() {
  return {
    assetId: 'asset.cover',
    storageKey: STORAGE_KEY,
    sha256: 'a'.repeat(64),
    mimeType: 'image/png',
    expiresInSeconds: 600,
  };
}

test('GCS object reader binds one bucket and encoded object path before bounded streaming', async () => {
  const bytes = Buffer.from('kindy');
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher = (async (resource: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: String(resource), init: init ?? {} });
    return new Response(bytes, {
      status: 200,
      headers: {
        'content-encoding': 'identity',
        'content-length': String(bytes.byteLength),
      },
    });
  }) as typeof fetch;
  const store = new GcsPrivateReleaseObjectStore(BUCKET, {
    accessTokenProvider: tokenProvider,
    fetcher,
  });

  const result = await store.readObject({
    storageKey: STORAGE_KEY,
    expectedSizeBytes: bytes.byteLength,
    maximumBytes: 100,
  });

  assert.deepEqual(result, new Uint8Array(bytes));
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.url,
    `https://storage.googleapis.com/storage/v1/b/${BUCKET}`
      + '/o/releases%2Fstory.one%2F1.0.0%2Fmedia%2Fcover-image.png?alt=media',
  );
  assert.equal(calls[0]?.init.method, 'GET');
  assert.equal(calls[0]?.init.redirect, 'error');
  assert.equal(calls[0]?.init.cache, 'no-store');
  const headers = new Headers(calls[0]?.init.headers);
  assert.equal(headers.get('authorization'), `Bearer ${ACCESS_TOKEN}`);
  assert.equal(headers.get('accept-encoding'), 'identity');
});

test('Cloud Run token provider reads only the exact attached service account metadata path', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher = (async (resource: URL | RequestInfo, init?: RequestInit) => {
    const url = String(resource);
    calls.push({ url, init: init ?? {} });
    if (url.endsWith('/email')) {
      return new Response(SIGNER, {
        status: 200,
        headers: { 'metadata-flavor': 'Google' },
      });
    }
    return new Response(JSON.stringify({
      access_token: ACCESS_TOKEN,
      expires_in: 3_599,
      token_type: 'Bearer',
    }), {
      status: 200,
      headers: { 'metadata-flavor': 'Google' },
    });
  }) as typeof fetch;
  const provider = new GoogleCloudRunWorkloadAccessTokenProvider(SIGNER, fetcher);
  const controller = new AbortController();

  assert.equal(await provider.getAccessToken(controller.signal), ACCESS_TOKEN);
  assert.equal(calls.length, 2);
  assert.equal(
    calls[0]?.url,
    'http://metadata.google.internal/computeMetadata/v1/instance/'
      + 'service-accounts/default/email',
  );
  assert.equal(
    calls[1]?.url,
    'http://metadata.google.internal/computeMetadata/v1/instance/'
      + 'service-accounts/default/token',
  );
  for (const call of calls) {
    assert.equal(call.init.redirect, 'error');
    assert.equal(call.init.cache, 'no-store');
    const headers = new Headers(call.init.headers);
    assert.equal(headers.get('metadata-flavor'), 'Google');
    assert.equal(headers.get('accept-encoding'), 'identity');
    assert.equal(call.init.signal, controller.signal);
  }
});

test('Cloud Run token provider rejects a response without the metadata attestation header', async () => {
  const provider = new GoogleCloudRunWorkloadAccessTokenProvider(
    SIGNER,
    (async () => new Response(JSON.stringify({
      access_token: ACCESS_TOKEN,
      expires_in: 3_599,
      token_type: 'Bearer',
    }), { status: 200 })) as typeof fetch,
  );

  assert.equal(
    await provider.getAccessToken(new AbortController().signal),
    null,
  );
});

test('Cloud Run token provider rejects identity drift before requesting a token', async () => {
  let fetchCount = 0;
  const provider = new GoogleCloudRunWorkloadAccessTokenProvider(
    SIGNER,
    (async () => {
      fetchCount += 1;
      return new Response(
        'other-runtime@kindy-493701.iam.gserviceaccount.com',
        {
          status: 200,
          headers: { 'metadata-flavor': 'Google' },
        },
      );
    }) as typeof fetch,
  );

  assert.equal(
    await provider.getAccessToken(new AbortController().signal),
    null,
  );
  assert.equal(fetchCount, 1);
});

test('GCS object reader requires an explicit workload identity without a test provider', () => {
  assert.throws(
    () => new GcsPrivateReleaseObjectStore(BUCKET),
    /missing GCS release workload identity/,
  );
});

test('GCS object reader closes on invalid paths and actual byte drift', async () => {
  let fetchCount = 0;
  const fetcher = (async () => {
    fetchCount += 1;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.enqueue(new Uint8Array([4, 5]));
        controller.close();
      },
    });
    return new Response(body, {
      status: 200,
      headers: { 'content-length': '4' },
    });
  }) as typeof fetch;
  const store = new GcsPrivateReleaseObjectStore(BUCKET, {
    accessTokenProvider: tokenProvider,
    fetcher,
  });

  assert.equal(await store.readObject({
    storageKey: 'releases/story.one/1.0.0/media/../secret',
    expectedSizeBytes: 4,
    maximumBytes: 4,
  }), null);
  assert.equal(fetchCount, 0);

  assert.equal(await store.readObject({
    storageKey: 'releases/story.one/1.0.0/graph.json',
    expectedSizeBytes: 4,
    maximumBytes: 4,
  }), null);
  assert.equal(fetchCount, 1);
});

test('GCS object reader applies the wall-clock deadline to ADC as well as the body', async () => {
  const neverResolvingProvider: GoogleCloudAccessTokenProvider = {
    getAccessToken: () => new Promise(() => undefined),
  };
  const store = new GcsPrivateReleaseObjectStore(BUCKET, {
    accessTokenProvider: neverResolvingProvider,
    fetcher: (async () => {
      throw new Error('fetch must not start');
    }) as typeof fetch,
    deadlineMs: 5,
  });

  assert.equal(await store.readObject({
    storageKey: 'releases/story.one/1.0.0/graph.json',
    expectedSizeBytes: 4,
    maximumBytes: 4,
  }), null);
});

test('GCS asset signer uses IAM signBlob and returns one exact short-lived V4 URL', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher = (async (resource: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: String(resource), init: init ?? {} });
    return new Response(JSON.stringify({
      keyId: 'system-managed-key',
      signedBlob: RSA_SIGNATURE,
    }), { status: 200 });
  }) as typeof fetch;
  const signer = new GcsPrivateReleaseAssetSigner({
    bucket: BUCKET,
    signerServiceAccount: SIGNER,
    accessTokenProvider: tokenProvider,
    fetcher,
    now: () => NOW,
  });

  const result = await signer.sign(signingInput());
  const parsed = new URL(result.url);

  assert.equal(result.expiresAt, '2026-08-24T01:12:03.000Z');
  assert.equal(parsed.origin, 'https://storage.googleapis.com');
  assert.equal(
    parsed.pathname,
    `/${BUCKET}/releases/story.one/1.0.0/media/cover-image.png`,
  );
  assert.equal(parsed.searchParams.get('X-Goog-Expires'), '600');
  assert.equal(parsed.searchParams.get('X-Goog-Signature'), 'ab'.repeat(256));
  assert.equal(isAllowedGcsReleaseAssetSignedUrl(result.url, {
    bucket: BUCKET,
    storageKey: STORAGE_KEY,
    signerServiceAccount: SIGNER,
    issuedAt: new Date('2026-08-24T01:02:03.000Z'),
    expiresInSeconds: 600,
  }), true);

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.url,
    'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'
      + 'kindy-preview-runtime%40kindy-493701.iam.gserviceaccount.com:signBlob',
  );
  assert.equal(calls[0]?.init.method, 'POST');
  assert.equal(calls[0]?.init.redirect, 'error');
  assert.equal(calls[0]?.init.cache, 'no-store');
  const headers = new Headers(calls[0]?.init.headers);
  assert.equal(headers.get('authorization'), `Bearer ${ACCESS_TOKEN}`);
  assert.equal(headers.get('accept-encoding'), 'identity');
  const requestBody = JSON.parse(String(calls[0]?.init.body)) as { payload: string };
  const stringToSign = Buffer.from(requestBody.payload, 'base64').toString('utf8');
  assert.equal(stringToSign, [
    'GOOG4-RSA-SHA256',
    '20260824T010203Z',
    '20260824/auto/storage/goog4_request',
    'cd95056b6a53e6f0207dd34d74b7cff5b1724d7a44007a88ea6b98b71760591c',
  ].join('\n'));
});

test('GCS signed URL validator rejects origin, object, query, and identity widening', async () => {
  const signer = new GcsPrivateReleaseAssetSigner({
    bucket: BUCKET,
    signerServiceAccount: SIGNER,
    accessTokenProvider: tokenProvider,
    fetcher: (async () => new Response(JSON.stringify({
      signedBlob: RSA_SIGNATURE,
    }), { status: 200 })) as typeof fetch,
    now: () => NOW,
  });
  const valid = (await signer.sign(signingInput())).url;
  const validationInput = {
    bucket: BUCKET,
    storageKey: STORAGE_KEY,
    signerServiceAccount: SIGNER,
    issuedAt: new Date('2026-08-24T01:02:03.000Z'),
    expiresInSeconds: 600,
  };
  const invalidUrls = [
    valid.replace('storage.googleapis.com', 'storage.attacker.example'),
    valid.replace('cover-image.png', 'other.png'),
    `${valid}&response-content-disposition=attachment`,
    valid.replace('X-Goog-Expires=600', 'X-Goog-Expires=900'),
    valid.replace(encodeURIComponent(SIGNER), encodeURIComponent(
      'attacker@kindy-493701.iam.gserviceaccount.com',
    )),
  ];

  for (const url of invalidUrls) {
    assert.equal(isAllowedGcsReleaseAssetSignedUrl(url, validationInput), false);
  }
});

test('GCS asset signer closes before IAM on invalid input and malformed signatures', async () => {
  let fetchCount = 0;
  const signer = new GcsPrivateReleaseAssetSigner({
    bucket: BUCKET,
    signerServiceAccount: SIGNER,
    accessTokenProvider: tokenProvider,
    fetcher: (async () => {
      fetchCount += 1;
      return new Response(JSON.stringify({ signedBlob: 'not-base64' }), {
        status: 200,
      });
    }) as typeof fetch,
    now: () => NOW,
  });

  await assert.rejects(signer.sign({
    ...signingInput(),
    storageKey: 'releases/story.one/1.0.0/media/../secret.png',
  }), /release asset signing unavailable/);
  assert.equal(fetchCount, 0);

  await assert.rejects(signer.sign(signingInput()), /release asset signing unavailable/);
  assert.equal(fetchCount, 1);
});
