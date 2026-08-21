export default function ChatRoomLoading() {
  return (
    <main className="min-h-dvh bg-[#F1EEE7] text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-cream md:border-x md:border-line" role="status" aria-live="polite">
        <div className="h-[76px] border-b border-line" />
        <div className="flex-1 bg-[#F3F0E9] px-4 py-6">
          <div className="h-24 w-[78%] border border-line bg-white motion-safe:animate-pulse" />
          <div className="mt-5 ml-auto h-16 w-[60%] bg-sagebg motion-safe:animate-pulse" />
        </div>
        <p className="border-t border-line bg-cream p-5 text-center text-[16px] text-ink2">이야기방을 여는 중이에요.</p>
      </div>
    </main>
  );
}
