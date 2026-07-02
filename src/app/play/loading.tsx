import MoriCharacter from '@/components/MoriCharacter';

export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
      <MoriCharacter
        className="h-32 w-32 overflow-hidden rounded-full border border-line bg-white shadow-sm motion-safe:animate-[float_3s_ease-in-out_infinite]"
        imageClassName="scale-125"
        label="모리"
      />
      <p role="status" className="mt-6 text-xl font-black text-ink">
        모리가 이야기를 여는 중...
      </p>
      <div className="mt-4 flex gap-2" aria-hidden="true">
        <span className="h-3 w-3 rounded-full bg-sages motion-safe:animate-pulse" />
        <span className="h-3 w-3 rounded-full bg-sages motion-safe:animate-pulse [animation-delay:.2s]" />
        <span className="h-3 w-3 rounded-full bg-sages motion-safe:animate-pulse [animation-delay:.4s]" />
      </div>
    </main>
  );
}
