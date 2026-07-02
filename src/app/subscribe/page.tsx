import { redirect } from 'next/navigation';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { getSubscriptionState } from '@/lib/subscription';
import { isSupabaseServiceConfigured } from '@/lib/supabase';
import { createServerClient, isSupabaseServerConfigured } from '@/lib/supabase-server';
import SubscribeClient from './SubscribeClient';

export const metadata = {
  title: 'Kindy 멤버십 - 월 구독',
  description: '계속 늘어나는 모리 이야기와 놀이 기록, 보호자 대화 힌트까지. 월 25,000원.',
};

export const dynamic = 'force-dynamic';

/**
 * /subscribe — Kindy 멤버십 구독 페이지 (서버 컴포넌트 가드).
 * 비로그인 → /auth/login?next=/subscribe
 */
export default async function SubscribePage() {
  let parentId: string;

  try {
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) redirect('/auth/login?next=/subscribe');
    throw error;
  }

  let email: string | null = null;
  if (isSupabaseServerConfigured()) {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  }

  const { subscription, entitlement } = isSupabaseServiceConfigured()
    ? await getSubscriptionState(parentId)
    : {
        subscription: null,
        entitlement: {
          parent_id: parentId,
          is_premium: false,
          premium_until: null,
          source: 'local_preview',
          updated_at: new Date().toISOString(),
        },
      };

  return (
    <SubscribeClient
      parentId={parentId}
      email={email}
      initialSubscription={subscription}
      initialEntitlement={entitlement}
    />
  );
}
