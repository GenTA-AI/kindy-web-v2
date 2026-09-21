import test from 'node:test';
import assert from 'node:assert/strict';
import { liveBillingReady } from '../src/lib/billing-readiness';

test('unconfigured and documentation test credentials can never enable production billing', () => {
  assert.equal(liveBillingReady({} as NodeJS.ProcessEnv), false);
  assert.equal(liveBillingReady({ KINDY_TOSS_BILLING_ENABLED: '1', NEXT_PUBLIC_TOSS_CLIENT_KEY: 'test_ck_docs_example', TOSS_SECRET_KEY: 'test_sk_docs_example', BILLING_KEY_SECRET: 'test', SUPABASE_SERVICE_ROLE_KEY: 'test' } as NodeJS.ProcessEnv), false);
  assert.equal(liveBillingReady({ KINDY_TOSS_BILLING_ENABLED: '0', NEXT_PUBLIC_TOSS_CLIENT_KEY: 'live_ck_example', TOSS_SECRET_KEY: 'live_sk_example' } as NodeJS.ProcessEnv), false);
});
