import ParentSelReportPage from '@/app/dashboard/report/page';

export const dynamic = 'force-dynamic';

export default function PublicSampleReportPage() {
  return (
    <ParentSelReportPage
      searchParams={Promise.resolve({
        childId: 'local-preview-child',
        sample: '1',
      })}
    />
  );
}
