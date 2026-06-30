import { notFound } from 'next/navigation';
import { LOCAL_PREVIEW_LIBRARY_VIDEO } from '@/lib/library-preview';
import SampleLibraryVideoClient from './SampleLibraryVideoClient';

type SampleLibraryVideoPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SampleLibraryVideoPage({ params }: SampleLibraryVideoPageProps) {
  const { id } = await params;

  if (id !== LOCAL_PREVIEW_LIBRARY_VIDEO.id) {
    notFound();
  }

  return <SampleLibraryVideoClient video={LOCAL_PREVIEW_LIBRARY_VIDEO} />;
}
