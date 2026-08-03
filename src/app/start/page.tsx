import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AttributionTracker from './AttributionTracker';
import { normalizeMarketingSource } from '@/lib/attribution';
import { isLaunchSurfaceClosed } from '@/lib/launch-surface';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

const FIRST_LOOK = [
  ['모리', '아이 옆에서 영상을 보여주고 질문을 건네는 안내 친구예요.'],
  ['이야기 숲', '짧은 영상, 단서 질문, 놀이가 한 번에 이어지는 공간이에요.'],
  ['보호자 기록', '오늘 끝낸 놀이와 집에서 이어볼 한마디를 보여줘요.'],
];

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (isLaunchSurfaceClosed('/start', process.env)) {
    notFound();
  }

  const params = await searchParams;
  const token = firstParam(params.ks);
  const source = normalizeMarketingSource(firstParam(params.from));
  const isAiDiagnosis = source === 'ai-diagnosis';

  return (
    <main className="flex-1 bg-cream text-ink">
      <AttributionTracker token={token} source={source} />
      <div className="mx-auto max-w-[375px] px-6 py-12">
        <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-sage">
          {isAiDiagnosis ? '방금 본 영상 다음' : '모리와 더 놀아볼까요?'}
        </p>
        <h1 className="mb-3 text-2xl font-black leading-snug text-ink">
          {isAiDiagnosis ? '다음 영상으로' : '집에서도 모리와'}
          <br />
          {isAiDiagnosis ? '놀이를 이어가요' : '바로 놀아요'}
        </h1>
        <p className="mb-8 text-sm font-semibold leading-relaxed text-ink2">
          {isAiDiagnosis
            ? '방금 본 영상은 모리를 짧게 만나는 첫 장면이에요. 아이 이름표를 만들면 다음 이야기와 짧은 놀이로 오늘 기록을 이어갈 수 있어요.'
            : '아이 이름표를 만들면 웹에서 바로 오늘의 이야기와 단서 놀이를 열 수 있어요. 보호자 화면에는 완료한 놀이와 대화 힌트가 남습니다.'}
        </p>

        <div className="mb-4 rounded-2xl border border-line bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-sage">처음이라면</p>
          <div className="space-y-3">
            {FIRST_LOOK.map(([title, body]) => (
              <div key={title} className="rounded-2xl bg-cream p-3">
                <p className="text-sm font-black text-ink">{title}</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-ink2">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <Link
          href="/auth/login?next=/onboarding"
          className="block w-full rounded-2xl bg-saged px-6 py-4 text-center text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
        >
          모리 시작하기
        </Link>
        <p className="mt-3 text-center text-[11px] font-semibold text-ink3">
          가입은 무료 · 모리 영상 3편과 첫 놀이 기록 무료
        </p>
      </div>
    </main>
  );
}
