import Link from 'next/link';

export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className="min-h-screen bg-cream"
      style={{
        fontFamily:
          'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}
    >
      <div className="mx-auto min-h-screen max-w-[375px] px-6 py-8">
        <header className="mb-8 border-b border-line pb-5">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-sm font-bold text-saged hover:text-ink"
          >
            &larr; 홈으로
          </Link>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-sage">
            Kindy Legal
          </p>
        </header>
        {children}
      </div>
    </div>
  );
}
