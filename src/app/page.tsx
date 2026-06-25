'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import InviteCodeForm from '@/components/InviteCodeForm';

/** 책정령 모리 (R3 IP 플레이스홀더 — 실제 히어로 에셋은 public/ip/bookmate-ip-hero.png). */
function Mori({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <path d="M30 44C18 18 40 8 52 30L52 50Z" className="fill-sage" />
      <path d="M90 44C102 18 80 8 68 30L68 50Z" className="fill-sage" />
      <path d="M34 40C26 24 40 18 49 32L49 46Z" className="fill-surface" />
      <path d="M86 40C94 24 80 18 71 32L71 46Z" className="fill-surface" />
      <ellipse cx="60" cy="74" rx="34" ry="32" className="fill-surface stroke-sage" strokeWidth={3.5} />
      <rect x="34" y="92" width="52" height="9" rx="4.5" className="fill-gentle" />
      <circle cx="50" cy="70" r="4.6" className="fill-ink" />
      <circle cx="51.5" cy="68.4" r="1.5" fill="#fff" />
      <circle cx="70" cy="70" r="4.6" className="fill-ink" />
      <circle cx="71.5" cy="68.4" r="1.5" fill="#fff" />
      <path d="M53 80Q60 86 67 80" className="stroke-ink" strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <path d="M60 56l-5-5a3.4 3.4 0 1 1 5-2 3.4 3.4 0 1 1 5 2Z" className="fill-gentle" />
    </svg>
  );
}

function StartCtaBlock({ className = '', align = 'start' }: { className?: string; align?: 'start' | 'center' }) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className={className}>
      <Link
        href="/onboarding"
        className="inline-flex items-center justify-center gap-2 rounded-full bg-sage px-7 py-4 text-base font-bold text-white shadow-[0_10px_24px_-8px_rgba(46,118,63,.55)] transition hover:bg-saged active:scale-[0.97]"
      >
        무료로 시작하기 🐣
      </Link>
      <button
        type="button"
        onClick={() => setInviteOpen((open) => !open)}
        className={`mt-2 inline-flex min-h-11 items-center py-2 text-[13px] font-semibold text-saged underline underline-offset-[3px] hover:text-sage ${align === 'center' ? 'mx-auto' : ''}`}
      >
        초대 코드 있어요
      </button>

      {inviteOpen && (
        <InviteCodeForm
          className="mt-4"
          onSuccess={() => router.push('/auth/login?next=/onboarding')}
          onAuthRequired={() => router.push('/auth/login?next=/onboarding')}
        />
      )}
    </div>
  );
}

const STEPS: [string, string][] = [
  ['이야기 보기', '도서관 추천도서가 AI 애니메이션이 됩니다.'],
  ['생각 질문', '"구름도 외로울까?" — 정답 없는 질문으로 상상해요.'],
  ['표현하기', '말하고, 고르고, 그리며 내 생각을 꺼냅니다.'],
  ['나만의 결과', 'AI로 아이의 아이디어를 작품으로 남겨요.'],
];

const VALUES: [string, string, ReactNode][] = [
  ['01 · 사고력', '정답이 아니라, 질문하는 힘', 'AI 시대의 진짜 경쟁력은 스스로 묻고 상상하는 힘. 매주 정답 없는 질문으로 생각하고 문제를 푸는 힘을 키웁니다.'],
  ['02 · 문해력 · 표현력', '이야기로 읽고, 내 생각으로 말하기', '좋은 책이 이야기가 되고, 아이는 그 안에서 읽고 말하고 표현합니다. 발표력과 문해력이 자연스럽게 자랍니다.'],
  ['03 · 부모 리포트', '우리 아이를 처음으로 들여다봅니다', '어떤 질문에 눈이 반짝이는지, 무엇을 좋아하고 어떻게 표현하는지 — 점수가 아니라 우리 아이의 진짜 모습을 매주 보여드려요.'],
  ['04 · 나만의 이야기', '아이가 직접 완성하는 이야기책', (
    <>좋아하는 세계와 친구로 매주 이야기가 이어지고, 아이가 직접 풀어갑니다. 한 시즌이 끝나면 <b className="font-semibold text-ink">우리 아이만의 이야기책</b>이 남아요.</>
  )],
];

export default function Home() {
  return (
    <div className="min-h-screen bg-cream text-ink [word-break:keep-all] [overflow-wrap:anywhere]">
      {/* Nav */}
      <nav className="sticky top-0 z-30 border-b border-line bg-cream/80 backdrop-blur-md backdrop-saturate-150">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-3 px-5 sm:px-8">
          <span className="flex items-center gap-2 text-[20px] font-extrabold tracking-[-.03em]">
            <Mori className="h-9 w-9" /> Kindy
          </span>
          <span className="flex-1" />
          <Link href="/onboarding" className="inline-flex min-h-11 items-center rounded-full bg-sage px-5 py-2.5 text-sm font-bold text-white transition hover:bg-saged">
            무료로 시작
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_85%_-5%,rgba(21,156,132,.14),transparent_70%),radial-gradient(50%_40%_at_0%_100%,rgba(70,118,63,.10),transparent_70%)]" />
        <div className="relative mx-auto grid w-full max-w-[1120px] grid-cols-1 items-center gap-9 px-5 py-12 text-center sm:px-8 md:grid-cols-[1.05fr_0.95fr] md:gap-16 md:py-24 md:text-left">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-sage">AI 시대의 진짜 공부</p>
            <h1 className="mt-3 text-[clamp(34px,6vw,56px)] font-extrabold leading-[1.1] tracking-[-.035em] [text-wrap:balance]">
              정답을 외우는 아이보다
              <br />
              <span className="text-sage">질문을 만드는 아이</span>
            </h1>
            <p className="mx-auto mt-5 max-w-[30ch] text-[clamp(16px,1.6vw,19px)] leading-relaxed text-ink2 md:mx-0">
              AI는 답을 알려줍니다.
              <br />
              하지만 <b className="font-bold text-ink">스스로 묻고 표현하는 힘</b>은
              <br />
              가르쳐주지 않습니다.
            </p>
            <p className="mx-auto mt-3.5 max-w-[30ch] text-[15px] text-ink3 md:mx-0">
              매주 새로운 이야기로 키우는
              <br />
              <b className="font-bold text-ink2">사고력 · 문해력 · 표현력.</b>
            </p>
            <StartCtaBlock className="mt-7 flex flex-col items-center md:items-start" align="center" />
          </div>

          {/* Hero visual */}
          <div className="relative mx-auto mt-2 flex aspect-[5/4.4] w-full max-w-[420px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[40px] border border-line bg-[linear-gradient(160deg,var(--color-sagebg),var(--color-surface))] p-7 shadow-[0_18px_50px_-12px_rgba(46,81,41,.18)] md:mt-0 md:aspect-[5/5.4]">
            <span className="absolute left-[18%] top-[16%] text-gold opacity-50 motion-safe:animate-[twinkle_3.5s_ease-in-out_infinite]">✦</span>
            <span className="absolute right-[16%] top-[24%] text-gold opacity-50 motion-safe:animate-[twinkle_3.5s_ease-in-out_infinite] [animation-delay:1.2s]">✧</span>
            <span className="absolute bottom-[22%] left-[24%] text-gold opacity-50 motion-safe:animate-[twinkle_3.5s_ease-in-out_infinite] [animation-delay:.6s]">✦</span>
            <Mori className="h-[clamp(120px,16vw,168px)] w-[clamp(120px,16vw,168px)] motion-safe:animate-[float_6s_ease-in-out_infinite]" />
            <div className="mt-2 text-lg font-extrabold text-ink">책정령 모리</div>
            <div className="text-[13px] text-ink2">아이의 마음을 읽어, 함께 이야기를 만들어요</div>
            <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-cream/70 px-3.5 py-1.5 text-xs font-bold text-ink2">
              📖 이번 주의 새 이야기
            </span>
          </div>
        </div>
      </header>

      {/* Trust */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-4 px-5 py-10 sm:px-8 md:grid-cols-2 md:py-14">
          <div className="flex items-start gap-4 rounded-3xl border border-line bg-cream px-6 py-5">
            <span className="text-2xl leading-none">🏛️</span>
            <div>
              <div className="font-bold text-ink">전국 <b className="text-saged">공공도서관</b>과 함께하는 프로그램</div>
              <div className="mt-1 text-[13px] text-ink3">문체부 · 교육청 · 지자체 운영 도서관과 협력</div>
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-3xl border border-line bg-cream px-6 py-5">
            <span className="text-2xl leading-none">🎓</span>
            <div>
              <div className="font-bold text-ink"><b className="text-saged">30년 경력 대학 교수</b>가 설계한 커리큘럼</div>
              <div className="mt-1 text-[13px] text-ink3">아이의 생각하는 힘을 키우는 단계별 설계</div>
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto w-full max-w-[1120px] px-5 py-16 sm:px-8 md:py-24">
        <div className="mb-10 text-center md:mb-14">
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-sage">이렇게 배워요</p>
          <h2 className="mt-2.5 text-[clamp(24px,3.6vw,38px)] font-extrabold tracking-[-.03em]">아이는 그냥 놀기만 하면 돼요</h2>
          <p className="mx-auto mt-3 max-w-[48ch] text-base text-ink2">도서관 추천도서가 우리 아이만의 이야기가 되는 네 걸음.</p>
        </div>
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, desc], i) => (
            <div key={title} className="rounded-3xl border border-line bg-surface p-6">
              <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-sage text-sm font-extrabold text-white shadow-[0_6px_16px_-6px_rgba(46,118,63,.5)]">{i + 1}</span>
              <h3 className="text-base font-bold tracking-[-.01em]">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink2">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-[1120px] px-5 py-16 sm:px-8 md:py-24">
          <div className="mb-10 text-center md:mb-14">
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-sage">부모가 사는 가치</p>
            <h2 className="mt-2.5 text-[clamp(24px,3.6vw,38px)] font-extrabold tracking-[-.03em]">학원이 채우지 못한 한 가지</h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {VALUES.map(([ey, title, body]) => (
              <div key={ey} className="rounded-[32px] border border-line bg-cream p-7 shadow-[0_4px_18px_-6px_rgba(46,81,41,.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-12px_rgba(46,81,41,.18)] md:p-8">
                <div className="text-[11px] font-extrabold uppercase tracking-[.12em] text-sage">{ey}</div>
                <h3 className="mt-3 text-[clamp(18px,2.2vw,22px)] font-extrabold tracking-[-.02em]">{title}</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink2">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof */}
      <section className="mx-auto w-full max-w-[1120px] px-5 py-16 sm:px-8 md:py-24">
        <p className="mb-10 text-center text-xs font-extrabold uppercase tracking-[.16em] text-sage">부모님들의 반응</p>
        <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
          <figure className="rounded-3xl border border-line bg-surface px-6 py-6">
            <blockquote className="text-base leading-relaxed text-ink">&quot;학습지는 시키면 도망가는데, 이건 다음 이야기 언제 나오냐고 먼저 물어봐요.&quot;</blockquote>
            <figcaption className="mt-3.5 text-[13px] font-semibold text-ink3">5세 서연이 엄마</figcaption>
          </figure>
          <figure className="rounded-3xl border border-line bg-surface px-6 py-6">
            <blockquote className="text-base leading-relaxed text-ink">&quot;영어·수학은 학원이 있는데, 생각하고 표현하는 건 마땅한 게 없었거든요.&quot;</blockquote>
            <figcaption className="mt-3.5 text-[13px] font-semibold text-ink3">7세 민준이 아빠</figcaption>
          </figure>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-[1120px] px-5 pb-16 sm:px-8">
        <div className="rounded-[44px] bg-[linear-gradient(155deg,var(--color-sage),var(--color-saged))] px-6 py-14 text-center text-white shadow-[0_18px_50px_-12px_rgba(46,81,41,.18)] md:py-20">
          <h2 className="text-[clamp(24px,4vw,38px)] font-extrabold leading-tight tracking-[-.03em]">
            AI 시대, 우리 아이의
            <br />
            <span className="text-[color-mix(in_srgb,#fff_78%,var(--color-gentle))]">생각하는 힘</span>을 키워주세요
          </h2>
          <div className="mt-8 flex justify-center">
            <Link href="/onboarding" className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-base font-bold text-saged transition hover:bg-surface active:scale-[0.97]">
              무료로 시작하기
            </Link>
          </div>
          <p className="mt-4 text-[13px] text-white/80">이번 주 이야기를 무료로 체험 · 카드 등록 없이</p>
        </div>
      </section>

      {/* AI 고지 (AI 기본법) */}
      <footer className="px-5 pb-16 text-center sm:px-8">
        <p className="mx-auto max-w-[44ch] text-[12.5px] text-ink3">
          Kindy의 학습 콘텐츠는 AI 기술을 활용하여 제작되며, 전문가 검수를 거칩니다.
        </p>
      </footer>
    </div>
  );
}
