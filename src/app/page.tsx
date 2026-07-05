import Link from 'next/link';
import ReportSlot from '@/components/landing/ReportSlot';

const START_HREF = '/auth/login?next=/onboarding';
const TRUST_CHIPS = ['도서관과 함께', '1탭 해지', '결제 3일 전 알림'];
const HEADLINE = '모두에게 같은 영상이 아니라, 우리 아이에게만 맞춰 자라는 이야기.';

type SearchParams = Record<string, string | string[] | undefined>;

function hasSearchParam(params: SearchParams, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(params, key);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const showLibraryBenefit = hasSearchParam(params, 'ks');

  return (
    <main className="min-h-screen bg-cream text-ink [word-break:keep-all]">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-14 lg:py-12">
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-3 text-xl font-black">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-saged text-white">K</span>
            <span>아이별</span>
          </div>

          {showLibraryBenefit && (
            <div className="mt-10 inline-flex w-fit items-center rounded-full border border-gold bg-white px-4 py-2 text-sm font-black text-clay shadow-sm">
              도서관 한정 월 ₩19,000
            </div>
          )}

          <h1 className="mt-6 max-w-[13ch] text-[42px] font-black leading-[1.08] text-ink sm:text-6xl lg:text-7xl">
            {HEADLINE}
          </h1>
          <p className="mt-6 max-w-xl text-base font-semibold leading-relaxed text-ink2 sm:text-lg">
            첫 이야기를 보고, 아이가 다시 본 장면과 오래 머문 놀이를 보호자 기록으로 받아보세요.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {TRUST_CHIPS.map((chip) => (
              <span
                key={chip}
                className="inline-flex min-h-10 items-center rounded-full border border-line bg-white px-4 text-sm font-black text-saged shadow-sm"
              >
                {chip}
              </span>
            ))}
          </div>

          <Link
            href={START_HREF}
            className="mt-10 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-saged px-8 text-base font-black text-white shadow-[0_18px_34px_-18px_rgba(35,49,38,.7)] transition hover:bg-ink active:scale-[0.98] sm:w-fit"
          >
            우리 아이 이야기 시작하기
          </Link>
        </div>

        <div className="pb-8 lg:pb-0">
          <ReportSlot />
        </div>
      </section>
    </main>
  );
}
