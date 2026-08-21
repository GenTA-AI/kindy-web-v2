import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHILD_INPUT_MAX_CHARACTERS,
  precheckChildInput,
} from './child-input-precheck';

test('normalizes NFKC, strips invisible format characters, and trims allowed text', () => {
  assert.deepEqual(precheckChildInput('  \uff28\uff45\uff4c\uff4c\uff4f\u200b \u202e\uce5c\uad6c\uff01  '), {
    kind: 'allow_sanitized',
    sanitizedText: 'Hello \uce5c\uad6c!',
  });
});

test('enforces a Unicode-safe 1..240 character boundary', () => {
  assert.deepEqual(precheckChildInput('  \u200b\u2060  '), {
    kind: 'invalid',
    reasonCode: 'empty',
  });
  assert.equal(
    precheckChildInput('\ud83c\udf31'.repeat(CHILD_INPUT_MAX_CHARACTERS)).kind,
    'allow_sanitized',
  );
  assert.deepEqual(
    precheckChildInput('\ud83c\udf31'.repeat(CHILD_INPUT_MAX_CHARACTERS + 1)),
    { kind: 'invalid', reasonCode: 'too_long' },
  );
  assert.deepEqual(precheckChildInput(42), {
    kind: 'invalid',
    reasonCode: 'not_string',
  });
  assert.deepEqual(precheckChildInput('\ud800'), {
    kind: 'invalid',
    reasonCode: 'malformed_unicode',
  });
  assert.deepEqual(precheckChildInput('hello\u0000world'), {
    kind: 'invalid',
    reasonCode: 'unsupported_control',
  });
});

test('detects email and URL obfuscation after Unicode normalization', () => {
  const result = precheckChildInput(
    '\ub0b4 \uba54\uc77c\uc740 \uff4b\uff49\uff44\u200b\uff20\u202egmail\uff0ecom\uc774\uace0 https://example.com/me \uc57c',
  );

  assert.deepEqual(result, {
    kind: 'privacy_redirect',
    reasonCode: 'high_confidence_pii',
    redactions: {
      total: 2,
      capped: false,
      categories: [
        { category: 'email', count: 1 },
        { category: 'url', count: 1 },
      ],
    },
  });
  assert.doesNotMatch(JSON.stringify(result), /kid|gmail|example|\.com/iu);

  assert.equal(
    precheckChildInput('\uc774\uba54\uc77c\uc740 kid (at) gmail (dot) com').kind,
    'privacy_redirect',
  );
});

test('detects Korean and international phone numbers despite separators and zero-width', () => {
  for (const input of [
    '\uc804\ud654\ud574 010\u200b-1234-5678',
    '\uc5f0\ub77d\ucc98\ub294 \uff10\uff11\uff10 \uff11\uff12\uff13\uff14 \uff15\uff16\uff17\uff18',
    '\uc804\ud654\ub294 +82 (0)10 1234 5678',
    'call me at +1 (415) 555-2671',
    '\uc9d1 \uc804\ud654\ub294 02-1234-5678',
  ]) {
    const result = precheckChildInput(input);
    assert.equal(result.kind, 'privacy_redirect', input);
    assert.doesNotMatch(JSON.stringify(result), /1234|5678|415|2671/iu);
  }
});

test('detects only high-confidence exact address and SNS contact shapes', () => {
  const address = precheckChildInput(
    '\uc6b0\ub9ac \uc9d1\uc740 \uc11c\uc6b8\ud2b9\ubcc4\uc2dc \uac15\ub0a8\uad6c \ud14c\ud5e4\ub780\ub85c 123 101\ub3d9 1001\ud638\uc57c',
  );
  assert.equal(address.kind, 'privacy_redirect');
  if (address.kind === 'privacy_redirect') {
    assert.deepEqual(address.redactions.categories, [
      { category: 'exact_location', count: 1 },
    ]);
  }

  const sns = precheckChildInput('\ub514\uc2a4\ucf54\ub4dc ID: kindy_child99');
  assert.equal(sns.kind, 'privacy_redirect');
  if (sns.kind === 'privacy_redirect') {
    assert.deepEqual(sns.redactions.categories, [
      { category: 'sns_contact', count: 1 },
    ]);
  }

  for (const input of [
    '\uc6b0\ub9ac \uc9d1\uc740 \ucda9\ubd81 \uccad\uc8fc\uc2dc \uc0c1\ub2f9\uad6c \uc0ac\uc9c1\ub300\ub85c 123',
    '\ub098\ub294 \uc0c8\ubd04\ucd08\ub4f1\ud559\uad50 \ub2e4\ub140',
    'discord kid_friend_123',
    'instagram: kid.friend',
    'visit child-place.xyz',
  ]) {
    assert.equal(precheckChildInput(input).kind, 'privacy_redirect', input);
  }
});

test('redaction telemetry is fixed-shape and capped', () => {
  const input = Array.from({ length: 12 }, (_, index) => `a${index}@b.co`).join(' ');
  const result = precheckChildInput(input);
  assert.deepEqual(result, {
    kind: 'privacy_redirect',
    reasonCode: 'high_confidence_pii',
    redactions: {
      total: 9,
      capped: true,
      categories: [{ category: 'email', count: 9 }],
    },
  });
});

test('routes immediate self-harm without echoing child text or embedded PII', () => {
  const raw = '\uc9c0\uae08 \ub108\ubb34 \uc8fd\uace0 \uc2f6\uc5b4. \ub0b4 \ubc88\ud638\ub294 010-1234-5678\uc774\uc57c.';
  const result = precheckChildInput(raw);
  assert.deepEqual(result, {
    kind: 'safety_redirect',
    reasonCode: 'self_harm_imminent',
  });
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /010|1234|5678|\uc8fd\uace0/iu);
  assert.equal(Object.hasOwn(result, 'sanitizedText'), false);

  for (const commonPhrase of [
    '\ub098 \uc8fd\uace0 \uc2f6\uc5b4',
    '\uc800 \uc8fd\uace0 \uc2f6\uc5b4\uc694',
    '\ub098\ub294 \uc9c4\uc9dc \uc8fd\uace0 \uc2f6\uc5b4',
    '\uc81c\uac00 \ucc28\ub77c\ub9ac \uc8fd\uc5b4\ubc84\ub9b4 \uac70\uc57c',
    'I wanna die',
  ]) {
    assert.deepEqual(precheckChildInput(commonPhrase), {
      kind: 'safety_redirect',
      reasonCode: 'self_harm_imminent',
    });
  }
});

test('routes abuse, sexual grooming, and secret offline meeting with fixed codes', () => {
  assert.deepEqual(precheckChildInput('\uc544\ube60\uac00 \uc9c0\uae08 \ub098\ub97c \uacc4\uc18d \ub54c\ub9ac\uace0 \uc788\uc5b4'), {
    kind: 'safety_redirect',
    reasonCode: 'abuse_disclosure',
  });
  assert.deepEqual(precheckChildInput('\uc544\ube60\uac00 \ub098\ub97c \ub54c\ub838\uc5b4'), {
    kind: 'safety_redirect',
    reasonCode: 'abuse_disclosure',
  });
  for (const disclosure of [
    '\uc5c4\ub9c8\ud55c\ud14c \ub9de\uc558\uc5b4',
    '\uc120\uc0dd\ub2d8\uc774 \uc5b4\uc81c \ub098\ub97c \ub54c\ub838\uc5b4',
  ]) {
    assert.deepEqual(precheckChildInput(disclosure), {
      kind: 'safety_redirect',
      reasonCode: 'abuse_disclosure',
    });
  }
  assert.deepEqual(precheckChildInput('\ucc44\ud305 \uc0c1\ub300\uac00 \uc18d\uc637 \uc0ac\uc9c4\uc744 \ucc0d\uc5b4\uc11c \ubcf4\ub0b4\ub798'), {
    kind: 'safety_redirect',
    reasonCode: 'sexual_grooming',
  });
  assert.deepEqual(
    precheckChildInput('\ucc44\ud305\ud55c \uc544\uc800\uc528\uac00 \ubd80\ubaa8\ub2d8\ud55c\ud14c \ub9d0\ud558\uc9c0 \ub9d0\uace0 \uacf5\uc6d0\uc5d0\uc11c \ub9cc\ub098\uc790\uace0 \ud588\uc5b4'),
    {
      kind: 'safety_redirect',
      reasonCode: 'secret_offline_meeting',
    },
  );
});

test('format-control injection cannot bypass hard-risk rules', () => {
  assert.deepEqual(precheckChildInput('\uc9c0\u200b\uae08 \uc8fd\u202e\uace0 \uc2f6\uc5b4'), {
    kind: 'safety_redirect',
    reasonCode: 'self_harm_imminent',
  });
});

test('explicit self-identifying name and school cues are blocked without echo', () => {
  for (const raw of [
    '\ub0b4 \uc774\ub984\uc740 \ubbfc\uc9c0\uace0 \uc0c8\ubd04\ucd08\ub4f1\ud559\uad50 3\ud559\ub144\uc774\uc57c',
    '\ub098\ub294 \uc11c\uc6b8 \uac15\ub0a8\uad6c\uc5d0 \uc0b4\uace0 \uc788\uc5b4',
  ]) {
    const result = precheckChildInput(raw);
    assert.equal(result.kind, 'privacy_redirect');
    assert.equal(JSON.stringify(result).includes('\ubbfc\uc9c0'), false);
    assert.equal(JSON.stringify(result).includes('\uc0c8\ubd04'), false);
    assert.equal(JSON.stringify(result).includes('\uac15\ub0a8'), false);
  }
});

test('does not overclaim third-person names, school stories, or contextual humanities text', () => {
  for (const input of [
    '\ubbfc\uc9c0\ub294 \uc11c\uc6b8\uc5d0 \uc788\ub294 \uc0c8\ubd04\ucd08\ub4f1\ud559\uad50 \uc774\uc57c\uae30\ub97c \uc88b\uc544\ud574',
    '\uc18c\ud06c\ub77c\ud14c\uc2a4\ub294 \uc65c \uc8fd\uc74c\uc744 \ub450\ub824\uc6cc\ud558\uc9c0 \uc54a\uc558\uc744\uae4c?',
    '\uc8fc\uc778\uacf5\uc774 \uc8fd\uace0 \uc2f6\uc5b4 \ud558\ub294 \uc7a5\uba74\uc740 \ubb34\uc2a8 \ub73b\uc774\uc57c?',
    '\uc18c\uc124 \uc18d \uc8fc\uc778\uacf5\uc740 \uc9c0\uae08 \uc8fd\uace0 \uc2f6\uc5b4 \ud574. \uc65c \uadf8\ub7f4\uae4c?',
    '\ub098\ub294 \uc8fc\uc778\uacf5\uc774 \uc8fd\uace0 \uc2f6\uc5b4 \ud558\ub294 \uc774\uc720\uac00 \uad81\uae08\ud574',
    '\uc774\uc57c\uae30\uc5d0\uc11c \uc8fc\uc778\uacf5\uc774 \uacc4\uc18d \ub9de\uace0 \uc788\uc5b4',
    '\uc5c4\ub9c8\ub791 \uacf5\uc6d0\uc5d0\uc11c \ub9cc\ub098\uae30\ub85c \ud588\uc5b4',
    '\ubd80\ubaa8\ub2d8\uaed8 \ube44\ubc00\ub85c \uc624\ub798 \ubcf4\uad00\ud55c \uc0c1\uc790 \uc774\uc57c\uae30\uc57c',
    '\uc778\uc2a4\ud0c0\uadf8\ub7a8\uc774 \ubb50\uc57c?',
    'discord server',
    'instagram history',
    'tiktok dance',
    'line drawing',
    'telegram story',
    '\uc624\ub298\uc740 2026-08-21\uc774\uace0 \uc6d0\uc8fc\uc728\uc740 3.14159265\uc57c',
  ]) {
    assert.equal(precheckChildInput(input).kind, 'allow_sanitized', input);
  }
});

test('invalid and privacy paths never return original or normalized text fields', () => {
  const rawEmail = 'secret_child@example.com';
  const privacy = precheckChildInput(rawEmail);
  assert.equal(privacy.kind, 'privacy_redirect');
  assert.equal(Object.hasOwn(privacy, 'sanitizedText'), false);
  assert.doesNotMatch(JSON.stringify(privacy), /secret_child|example/iu);

  const oversized = 'private'.repeat(400);
  const invalid = precheckChildInput(oversized);
  assert.deepEqual(invalid, { kind: 'invalid', reasonCode: 'too_long' });
  assert.doesNotMatch(JSON.stringify(invalid), /private/iu);
});
