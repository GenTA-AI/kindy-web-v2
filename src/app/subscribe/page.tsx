import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import { getSubscriptionState } from '@/lib/subscription';
import SubscribeClient from './SubscribeClient';

export const metadata = {
  title: 'Kindy 멤버십 - 월 구독',
  description: '주 2회 새 에피소드, 초개인화 학습, 부모 리포트까지. 월 25,000원.',
};

/**
 * /subscribe — Kindy 멤버십 구독 페이지 (서버 컴포넌트 가드).
 * 비로그인 → /auth/login?next=/subscribe
 */
export default async function SubscribePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?next=/subscribe');
  }

  const { subscription, entitlement } = await getSubscriptionState(user.id);

  return (
    <SubscribeClient
      parentId={user.id}
      email={user.email ?? null}
      initialSubscription={subscription}
      initialEntitlement={entitlement}
    />
  );
}
