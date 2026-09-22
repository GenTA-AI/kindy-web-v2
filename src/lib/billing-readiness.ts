import { isBusinessInfoComplete } from './business-info';

/** Test keys must never create production subscriptions or charge real users. */
export function liveBillingReady(env = process.env): boolean {
  return env.KINDY_TOSS_BILLING_ENABLED === '1'
    && Boolean(env.NEXT_PUBLIC_TOSS_CLIENT_KEY?.startsWith('live_ck_'))
    && Boolean(env.TOSS_SECRET_KEY?.startsWith('live_sk_'))
    && Boolean(env.BILLING_KEY_SECRET?.trim())
    && Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim())
    && isBusinessInfoComplete();
}
