import type { Metadata } from 'next';
import Link from 'next/link';
import { getSignedUrl } from '@/lib/supabase-storage';
import { GLASS_LIGHT } from '@/components/ui/glass';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Kindy — 첫 이야기 무료로 보기',
  description:
    '쇠라 〈그랑드 자트 섬의 일요일 오후〉 도슨트 수업을 결제 없이 바로 봅니다. 카톡 채널을 추가하면 매주 새 수업이 도착합니다.',
};

const EPISODE_PATH = 'first-story/seurat-episode-720p.mp4';
const SIGNED_URL_EXPIRY_SEC = 60 * 60 * 6;

// 카톡 채널 개설 전에는 온보딩으로 폴백 — 채널이 생기면 env만 채우면 된다.
const KAKAO_CHANNEL_URL = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL;
const FALLBACK_CTA_HREF = '/auth/login?next=/onboarding';


async function loadEpisodeUrl(): Promise<string | null> {
  try {
    return await getSignedUrl(EPISODE_PATH, SIGNED_URL_EXPIRY_SEC);
  } catch {
    // Supabase 미설정 로컬 프리뷰 등 — 페이지는 열리되 영상 자리에 안내를 보여준다.
    return null;
  }
}

export default async function FirstStoryPage() {
  const videoUrl = await loadEpisodeUrl();
  const ctaHref = KAKAO_CHANNEL_URL ?? FALLBACK_CTA_HREF;
  const ctaExternal = Boolean(KAKAO_CHANNEL_URL);

  return (
    <main className="bg-cream text-ink [word-break:keep-all]">
      <section className="mx-auto w-full max-w-4xl px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
        <p className="text-center text-sm font-black tracking-[0.35em] text-ink3">KINDY</p>
        <p className="mt-6 text-center text-sm font-bold text-ink2">첫 이야기 · 결제 없이 바로</p>
        <h1 className="mt-3 text-balance text-center text-3xl font-black leading-snug tracking-tight sm:text-5xl">
          쇠라의 일요일 오후,
          <br />
          점 백만 개의 비밀.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-pretty text-center text-base leading-relaxed text-ink2">
          그림이 살아 움직이는 2분 30초 도슨트 수업입니다. 아이와 함께 소리를 켜고 보세요 —
          숨은 원숭이도 찾아보세요.
        </p>

        <figure className={`${GLASS_LIGHT} mt-10 overflow-hidden p-3 sm:p-4`}>
          {videoUrl ? (
            <video
              src={videoUrl}
              poster="/landing/seurat-poster.jpg"
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full rounded-2xl bg-black"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-mist text-sm font-bold text-ink2">
              영상을 준비하고 있어요. 잠시 후 다시 열어 주세요.
            </div>
          )}
          <figcaption className="flex flex-col gap-1 px-2 pb-1 pt-4 text-sm text-ink3 sm:flex-row sm:justify-between">
            <span>조르주 쇠라, 〈그랑드 자트 섬의 일요일 오후〉 (1886) · 음악 생상스 〈백조〉</span>
            <span>AI로 만들고 사람이 살펴봐요</span>
          </figcaption>
        </figure>

        <div className={`${GLASS_LIGHT} mx-auto mt-12 max-w-lg px-8 py-10 text-center`}>
          <p className="text-sm font-black tracking-[0.25em] text-gold">다음 이야기 받아보기</p>
          <p className="mt-4 text-pretty text-xl font-black leading-snug">
            매주 새 수업이
            <br />
            카톡으로 도착합니다.
          </p>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-ink2">
            아이가 수업을 마치면 부모님께 알려드리고, 아이의 반응을 보며 다음 작품을 고릅니다.
          </p>
          {ctaExternal ? (
            <a
              href={ctaHref}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-ink px-8 text-base font-bold text-cream transition hover:scale-[1.02] active:scale-[0.98]"
            >
              카톡 채널 추가하고 받아보기
            </a>
          ) : (
            <Link
              href={ctaHref}
              className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-ink px-8 text-base font-bold text-cream transition hover:scale-[1.02] active:scale-[0.98]"
            >
              시작하고 받아보기
            </Link>
          )}
          <p className="mt-4 text-sm text-ink3">
            얼리버드 특가 월 24,900원 · 기간 한정 · 첫 14일 100% 환불 보장
          </p>
        </div>

        <p className="mt-10 text-center text-sm text-ink3">
          <Link href="/" className="underline underline-offset-4">
            Kindy가 어떤 수업인지 더 보기
          </Link>
        </p>
      </section>
    </main>
  );
}
