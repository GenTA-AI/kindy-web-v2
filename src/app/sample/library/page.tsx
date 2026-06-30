import Link from 'next/link';
import MoriCharacter from '@/components/MoriCharacter';
import { LOCAL_PREVIEW_LIBRARY_VIDEO } from '@/lib/library-preview';
import { topicLabel } from '@/lib/topic-label';

const START_HREF = '/auth/login?next=/onboarding';

function formatDuration(secondsTotal: number): string {
  const minutes = Math.floor(secondsTotal / 60);
  const seconds = secondsTotal % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function SampleLibraryPage() {
  const video = LOCAL_PREVIEW_LIBRARY_VIDEO;

  return (
    <main className="min-h-screen bg-cream text-ink [word-break:keep-all]">
      <div className="mx-auto w-full max-w-[430px] px-5 pb-16 pt-8">
        <header className="rounded-[34px] bg-saged p-6 text-white shadow-[0_24px_70px_-44px_rgba(35,49,38,.65)]">
          <div className="flex items-center gap-3">
            <MoriCharacter className="h-14 w-14 overflow-hidden rounded-full border border-white/30 bg-white" imageClassName="scale-125" label="모리" withGlow={false} />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.16em] text-white/70">이야기 숲 미리보기</p>
              <h1 className="mt-1 text-2xl font-black leading-tight">모리의 첫 이야기</h1>
            </div>
          </div>
          <p className="mt-5 text-sm font-semibold leading-relaxed text-white/82">
            영상 하나를 보고, 짧은 단서 질문으로 어떤 기록이 남는지 먼저 확인해요.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {['영상', '단서', '기록'].map((item) => (
              <div key={item} className="rounded-2xl border border-white/20 bg-white/10 px-3 py-3 text-sm font-black text-white">
                {item}
              </div>
            ))}
          </div>
        </header>

        <section className="mt-5 overflow-hidden rounded-[30px] border border-line bg-white shadow-sm">
          <Link href={`/sample/library/${video.id}`} className="block transition hover:bg-mist active:scale-[0.99]">
            <div className="relative aspect-video bg-mist">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={video.thumbnail_url ?? '/ip/mori-reference-no-a.jpg'} alt={video.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              <span className="absolute bottom-3 right-3 rounded-full bg-ink/82 px-3 py-1 text-xs font-black text-white">
                {formatDuration(video.duration_sec)}
              </span>
            </div>
            <div className="p-5">
              <p className="text-[11px] font-black uppercase tracking-[.16em] text-sage">
                {topicLabel(video.topic)} · {video.age_band}세
              </p>
              <h2 className="mt-2 text-2xl font-black leading-tight">{video.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">{video.description}</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <span className="rounded-2xl bg-sagebg px-3 py-3 text-center text-sm font-black text-saged">
                  보고 단서 놀이
                </span>
                <span className="rounded-2xl bg-cream px-3 py-3 text-center text-sm font-black text-clay ring-1 ring-line">
                  기록 예시 연결
                </span>
              </div>
            </div>
          </Link>
        </section>

        <section className="mt-5 rounded-[28px] border border-line bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[.16em] text-sage">아이 화면 원칙</p>
          <div className="mt-4 grid gap-2">
            {[
              '광고와 결제 버튼 없이 이야기가 먼저 보여요.',
              '정답 압박보다 다시 살펴볼 단서를 알려줘요.',
              '한 편이 끝나면 보호자가 볼 기록으로 멈춰요.',
            ].map((line) => (
              <p key={line} className="rounded-2xl bg-mist px-4 py-3 text-sm font-bold leading-relaxed text-ink2">
                {line}
              </p>
            ))}
          </div>
        </section>

        <div className="mt-5 grid gap-2">
          <Link
            href={`/sample/library/${video.id}`}
            className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-saged px-6 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
          >
            첫 이야기 보기
          </Link>
          <Link
            href={START_HREF}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-white px-6 text-sm font-black text-saged transition hover:bg-mist active:scale-[0.98]"
          >
            무료로 시작하기
          </Link>
        </div>
      </div>
    </main>
  );
}
