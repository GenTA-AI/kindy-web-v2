import Link from 'next/link';
import MoriCharacter from '@/components/MoriCharacter';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6">
      <section className="max-w-md rounded-3xl border border-line bg-white p-6 text-center shadow-sm">
        <MoriCharacter
          className="mx-auto h-28 w-28 overflow-hidden rounded-full border border-line bg-white"
          imageClassName="scale-125"
          label="모리"
          withGlow={false}
        />
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-sage">모리의 이야기 숲</p>
        <h1 className="mt-2 text-2xl font-black text-ink">이 길에는 이야기가 없어요</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-ink2">
          찾으시는 페이지가 사라졌거나 아직 열리지 않았어요. 모리와 함께 처음 화면에서 다시 시작해 볼까요?
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-saged px-6 text-sm font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
        >
          처음으로
        </Link>
      </section>
    </main>
  );
}
