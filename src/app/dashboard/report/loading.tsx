export default function Loading() {
  return (
    <main className="min-h-screen bg-cream px-5 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-3xl motion-safe:animate-pulse">
        <div className="h-3 w-28 rounded-full bg-sagebg" />
        <div className="mt-3 h-8 w-64 rounded-2xl bg-deep" />
        <p role="status" className="mt-4 text-sm font-bold text-ink3">
          기록장을 펴는 중...
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-24 rounded-[24px] border border-line bg-white" />
          ))}
        </div>

        <div className="mt-6 space-y-3">
          <div className="h-32 rounded-[28px] border border-line bg-white" />
          <div className="h-40 rounded-[28px] border border-line bg-white" />
        </div>
      </div>
    </main>
  );
}
