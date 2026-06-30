import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { getCurrentParentId, isAuthError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) {
      redirect('/auth/login?next=/dashboard');
    }
    throw error;
  }

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </>
  );
}
