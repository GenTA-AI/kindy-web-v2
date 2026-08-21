import assert from 'node:assert/strict';
import test from 'node:test';

import { getWenitRuntimeConfig } from './runtime-config';

const COMPLETE_CONFIGURATION = {
  KINDY_LAUNCH_MODE: 'protected_chat_pilot',
  STORY_CHAT_RUNTIME_ENABLED: '1',
  STORY_CHAT_FREE_TEXT_ENABLED: '1',
  STORY_CONTENT_RELEASE_CHANNEL: 'staging',
  WENIT_SAFEGUARD_RUNTIME_ENABLED: '1',
  WENIT_SAFEGUARD_API_KEY: 'unit-test-server-secret',
  WENIT_SAFEGUARD_CREDENTIAL_SCOPE: 'wenit-primary-v1',
  WENIT_SAFEGUARD_THRESHOLD_VERSIONS: 'threshold-v1,threshold-v2',
  WENIT_SAFEGUARD_PRICING_VERSIONS: 'pricing-v1',
  WENIT_SAFEGUARD_AGE_GROUPS: 'general,infant_child',
  WENIT_SAFEGUARD_CATEGORY_SHAPE: 'array',
  WENIT_SAFEGUARD_PENDING_STATUSES: 'processing',
  WENIT_SAFEGUARD_MATCHED_RULES: 'minor_risk_block_enabled',
} as const;

test('모든 env가 있어도 P0 runtime과 free text hard gate 때문에 비활성이다', () => {
  const config = getWenitRuntimeConfig(COMPLETE_CONFIGURATION);
  assert.equal(config.enabled, false);
  assert.equal(config.credentialConfigured, true);
  assert.equal(config.credentialScope, 'wenit-primary-v1');
  assert.deepEqual(config.contract, {
    thresholdVersions: ['threshold-v1', 'threshold-v2'],
    pricingVersions: ['pricing-v1'],
    ageGroups: ['general', 'infant_child'],
    categoryShape: 'array',
    pendingStatuses: ['processing'],
    matchedRules: ['minor_risk_block_enabled'],
  });
  assert.equal(JSON.stringify(config).includes('unit-test-server-secret'), false);
});

test('credential scope는 동일 key 공유자용 96자 opaque label만 허용한다', () => {
  const maximumLengthScope = `w${'a'.repeat(95)}`;
  assert.equal(
    getWenitRuntimeConfig({
      ...COMPLETE_CONFIGURATION,
      WENIT_SAFEGUARD_CREDENTIAL_SCOPE: maximumLengthScope,
    }).credentialScope,
    maximumLengthScope,
  );

  for (const invalidScope of [`w${'a'.repeat(96)}`, 'raw/key', 'contains space']) {
    assert.equal(
      getWenitRuntimeConfig({
        ...COMPLETE_CONFIGURATION,
        WENIT_SAFEGUARD_CREDENTIAL_SCOPE: invalidScope,
      }).credentialScope,
      null,
    );
  }
});

test('브라우저 공개 키를 탐지하되 어떤 키 값도 config에 반환하지 않는다', () => {
  const publicSecret = 'unit-test-public-secret';
  const config = getWenitRuntimeConfig({
    ...COMPLETE_CONFIGURATION,
    NEXT_PUBLIC_WENIT_SAFEGUARD_API_KEY: publicSecret,
  });
  assert.equal(config.enabled, false);
  assert.equal(config.publicCredentialDetected, true);
  assert.equal(JSON.stringify(config).includes(publicSecret), false);
});

test('빈 값, 중복, 공백 포함 버전 allowlist는 미설정으로 닫는다', () => {
  for (const thresholdVersions of ['', 'same,same', 'valid,bad value']) {
    const config = getWenitRuntimeConfig({
      ...COMPLETE_CONFIGURATION,
      WENIT_SAFEGUARD_THRESHOLD_VERSIONS: thresholdVersions,
    });
    assert.equal(config.enabled, false);
    assert.deepEqual(config.contract.thresholdVersions, []);
  }
});
