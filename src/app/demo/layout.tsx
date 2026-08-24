import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { isLaunchSurfaceClosed } from '@/lib/launch-surface';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DemoLayout({ children }: { children: React.ReactNode }) {
  // The launch mode is injected into the Cloud Run revision at runtime. Wait
  // for a request so the build environment cannot bake a preview-only route
  // into a permanent 404 (or accidentally expose it in production).
  await connection();

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
