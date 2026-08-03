import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLaunchSurfaceClosed } from '@/lib/launch-surface';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  if (isLaunchSurfaceClosed('/demo', process.env)) {
    notFound();
  }

  return (
    <>
      {children}
      <style>{`body > footer { display: none !important; }`}</style>
    </>
  );
}
