import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLaunchSurfaceClosed } from '@/lib/launch-surface';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SampleLayout({ children }: { children: React.ReactNode }) {
  if (isLaunchSurfaceClosed('/sample', process.env)) {
    notFound();
  }

  return children;
}
