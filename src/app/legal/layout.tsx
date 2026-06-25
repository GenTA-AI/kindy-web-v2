import Link from 'next/link';

export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className="min-h-screen bg-gradient-to-b from-violet-50 to-white"
      style={{
        fontFamily:
          'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}
    >
      <div className="mx-auto min-h-screen max-w-[375px] px-6 py-8">
        <header className="mb-8 border-b border-violet-100 pb-5">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-sm font-bold text-violet-600 hover:text-violet-700"
          >
            &larr; 홈으로
          </Link>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-violet-500">
            Kindy Legal
          </p>
        </header>
        {children}
      </div>
    </div>
  );
}
