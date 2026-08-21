import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getProductionEnvironmentViolations,
  isProductionEnvironment,
} from './env-guard';
import type { EnvironmentMap } from './env-guard';

const CONFIGURED_SECRET = 'configured-for-test';

function violationNames(environment: EnvironmentMap): string[] {
  return getProductionEnvironmentViolations(environment).map(
    (violation) => violation.variable,
  );
}

test('배포 환경 변수가 없는 production은 잠그고 development는 연다', () => {
  assert.equal(isProductionEnvironment({ NODE_ENV: 'production' }), true);
  assert.equal(isProductionEnvironment({ NODE_ENV: 'development' }), false);
});

test('명시적인 KINDY_DEPLOY_ENV=preview만 production 이미지를 연다', () => {
  assert.equal(
    isProductionEnvironment({
      NODE_ENV: 'production',
      KINDY_DEPLOY_ENV: 'preview',
      KINDY_LOCAL_PREVIEW: '1',
    }),
    false,
  );
});

test('알 수 없는 값, 오타, 빈 문자열은 production 이미지를 잠근다', () => {
  for (const value of ['', 'preveiw', 'development', 'Preview']) {
    const environment = {
      NODE_ENV: 'production',
      KINDY_DEPLOY_ENV: value,
      KINDY_LOCAL_PREVIEW: '1',
      BILLING_KEY_SECRET: CONFIGURED_SECRET,
    };

    assert.equal(isProductionEnvironment(environment), true, value);
    assert.deepEqual(violationNames(environment), ['KINDY_LOCAL_PREVIEW'], value);
  }
});

test('예전 VERCEL_ENV=preview는 production 잠금을 풀지 못한다', () => {
  assert.equal(
    isProductionEnvironment({
      NODE_ENV: 'production',
      VERCEL_ENV: 'preview',
      KINDY_LOCAL_PREVIEW: '1',
    }),
    true,
  );
});

test('프로덕션에서는 KINDY_LOCAL_PREVIEW=1을 거부한다', () => {
  assert.deepEqual(
    violationNames({
      NODE_ENV: 'production',
      KINDY_LOCAL_PREVIEW: '1',
      BILLING_KEY_SECRET: CONFIGURED_SECRET,
    }),
    ['KINDY_LOCAL_PREVIEW'],
  );
});

test('프로덕션에서는 LESSON_GUEST_MODE=1을 거부한다', () => {
  assert.deepEqual(
    violationNames({
      NODE_ENV: 'production',
      LESSON_GUEST_MODE: '1',
      BILLING_KEY_SECRET: CONFIGURED_SECRET,
    }),
    ['LESSON_GUEST_MODE'],
  );
});

test('프로덕션에서는 BILLING_KEY_SECRET 누락과 빈 값을 모두 거부한다', async (t) => {
  for (const [name, value] of [
    ['누락', undefined],
    ['빈 문자열', ''],
    ['공백', '   '],
  ] as const) {
    await t.test(name, () => {
      assert.deepEqual(
        violationNames({ NODE_ENV: 'production', BILLING_KEY_SECRET: value }),
        ['BILLING_KEY_SECRET'],
      );
    });
  }
});

test('준비 전 Wenit runtime과 브라우저 공개 키를 프로덕션에서 거부한다', () => {
  const publicSecret = 'unit-test-public-wenit-secret';
  const violations = getProductionEnvironmentViolations({
    NODE_ENV: 'production',
    BILLING_KEY_SECRET: CONFIGURED_SECRET,
    WENIT_SAFEGUARD_RUNTIME_ENABLED: '1',
    NEXT_PUBLIC_WENIT_SAFEGUARD_API_KEY: publicSecret,
  });

  assert.deepEqual(
    violations.map((violation) => violation.variable),
    [
      'WENIT_SAFEGUARD_RUNTIME_ENABLED',
      'NEXT_PUBLIC_WENIT_SAFEGUARD_API_KEY',
    ],
  );
  assert.equal(JSON.stringify(violations).includes(publicSecret), false);
});

test('프로덕션의 모든 위반을 한 번에 반환하고 환경변수 값은 노출하지 않는다', () => {
  const secretValue = 'must-never-appear-in-a-violation';
  const violations = getProductionEnvironmentViolations({
    NODE_ENV: 'production',
    KINDY_DEPLOY_ENV: 'production',
    KINDY_LOCAL_PREVIEW: '1',
    LESSON_GUEST_MODE: '1',
    BILLING_KEY_SECRET: '',
    UNRELATED_SECRET: secretValue,
  });

  assert.deepEqual(
    violations.map((violation) => violation.variable),
    ['KINDY_LOCAL_PREVIEW', 'LESSON_GUEST_MODE', 'BILLING_KEY_SECRET'],
  );
  assert.equal(JSON.stringify(violations).includes(secretValue), false);
  for (const violation of violations) {
    assert.match(violation.reason, /.+/);
    assert.match(violation.remediation, /.+/);
  }
});

test('안전한 프로덕션 설정에는 위반이 없다', () => {
  assert.deepEqual(
    getProductionEnvironmentViolations({
      NODE_ENV: 'production',
      KINDY_LOCAL_PREVIEW: '0',
      LESSON_GUEST_MODE: '0',
      BILLING_KEY_SECRET: CONFIGURED_SECRET,
    }),
    [],
  );
  assert.deepEqual(
    getProductionEnvironmentViolations({
      NODE_ENV: 'production',
      KINDY_LOCAL_PREVIEW: 'true',
      LESSON_GUEST_MODE: 'true',
      BILLING_KEY_SECRET: CONFIGURED_SECRET,
    }),
    [],
  );
});

test('로컬 개발과 프리뷰에서는 우회 플래그와 미설정 빌링 시크릿을 허용한다', () => {
  for (const environment of [
    {
      NODE_ENV: 'development',
      KINDY_LOCAL_PREVIEW: '1',
      LESSON_GUEST_MODE: '1',
    },
    {
      NODE_ENV: 'production',
      KINDY_DEPLOY_ENV: 'preview',
      KINDY_LOCAL_PREVIEW: '1',
      LESSON_GUEST_MODE: '1',
    },
  ]) {
    assert.deepEqual(getProductionEnvironmentViolations(environment), []);
  }
});
