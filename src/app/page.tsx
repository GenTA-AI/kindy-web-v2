'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import InviteCodeForm from '@/components/InviteCodeForm';
import MoriCharacter from '@/components/MoriCharacter';

const START_HREF = '/auth/login?next=/onboarding';
const SAMPLE_REPORT_HREF = '/sample/report';
const DEMO_HREF = '/demo/ai-diagnosis';
const PRICE_LINE = '무료 영상 3편 체험 후, 계속 이어가려면 멤버십 월 25,000원 · 언제든 해지';

function StartCtaBlock({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className={className}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={DEMO_HREF}
          className="inline-flex min-h-14 items-center justify-center rounded-full bg-saged px-7 text-base font-extrabold text-white shadow-[0_14px_28px_-14px_rgba(35,49,38,.55)] transition hover:bg-ink active:scale-[0.98]"
        >
          1분 체험 먼저 보기
        </Link>
        <Link
          href={START_HREF}
          className="inline-flex min-h-14 items-center justify-center rounded-full border border-line bg-white px-7 text-base font-extrabold text-ink transition hover:border-sages hover:bg-mist active:scale-[0.98]"
        >
          무료로 시작하기
        </Link>
      </div>
      <p className="mt-3 text-sm font-bold text-sage">로그인 없이 바로 체험 · 보호자 계정 1분이면 무료로 시작</p>
      <p className="mt-1 text-xs font-semibold leading-relaxed text-ink3">
        {PRICE_LINE}. 아이 화면에는 광고·결제 버튼·자동재생 압박이 보이지 않아요.
      </p>
      <button
        type="button"
        onClick={() => setInviteOpen((open) => !open)}
        className="mt-1 inline-flex min-h-10 items-center text-sm font-bold text-ink3 underline underline-offset-[3px] hover:text-saged"
      >
        초대 코드로 시작하기
      </button>

      {inviteOpen && (
        <InviteCodeForm
          className="mt-4 max-w-sm"
          onSuccess={() => router.push('/auth/login?next=/onboarding')}
          onAuthRequired={() => router.push('/auth/login?next=/onboarding')}
        />
      )}
    </div>
  );
}

const STEPS = [
  ['영상 한 편을 본다', '모리와 동물 마을 친구들의 짧은 이야기'],
  ['질문과 놀이를 한다', '아이가 고른 답과 끝낸 놀이가 기록돼요'],
  ['보호자는 오늘 기록을 본다', '잘 맞은 놀이와 다음에 해볼 놀이가 남아요'],
];

const THINKING_TOOLS = [
  '자세히 보기',
  '머릿속에 그려보기',
  '규칙 찾기',
  '규칙 만들기',
  '닮은 것 잇기',
  '모아서 만들기',
];

const TRUST = [
  '자세히 보기·비슷한 점 찾기·규칙 찾기 놀이 기반',
  '아이 화면엔 광고·결제·자동재생 압박 없음',
  '한 편이 끝나면 보호자 기록으로 멈춤',
  '모든 콘텐츠 사람 검수 후 공개',
  '다음 추천은 활동 기록만 참고',
];

const STORY_OS = [
  ['아이 화면', '모리와 이야기 숲을 탐험해요. 한 화면엔 한 가지 행동만 나오고, 광고와 결제 화면은 보이지 않아요.'],
  ['보호자 기록장', '이번 주 이야기, 아이가 고른 답, 끝낸 놀이, 다음 대화 힌트를 한곳에서 봐요.'],
  ['모리의 역할', '아이가 다시 본 장면, 고른 답, 끝까지 해낸 놀이를 모아 다음 이야기를 더 잘 맞춰줘요.'],
];

const STORY_PATHS = [
  ['모리의 나무집', '오늘 볼 이야기와 놀이를 골라요.'],
  ['동물 마을', '첫 번째 숲 지역. 친구들의 작은 사건을 보고 도와줘요.'],
  ['생각 놀이 길', '자세히 보기, 비슷한 점 찾기, 규칙 찾기 놀이를 하나씩 만나요.'],
  ['오늘 기록 남기기', '놀이와 대답이 끝나면 보호자 기록에 오늘 한 일이 남아요.'],
];

const FIRST_LOOK = [
  ['모리', '아이 옆에서 영상을 보여주고 질문을 건네는 안내 캐릭터예요.'],
  ['이야기 숲', '영상, 질문, 짧은 놀이가 이어지는 아이 전용 학습 공간이에요.'],
  ['놀이 기록', '정답표가 아니라 아이가 무엇을 봤고 어떤 놀이를 끝냈는지 보여주는 보호자 기록이에요.'],
];

const DIAGNOSIS_SIGNALS = [
  ['영상 뒤 단서 질문', '“해님이 숨으면 무엇이 보였지?”처럼 방금 본 장면과 소리를 떠올려요.', '관찰'],
  ['마음 고르기', '“꾸미는 지금 어떤 마음일까?” 얼굴과 상황 단서를 보고 골라요.', '마음 읽기'],
  ['숨은 친구 찾기', '풀숲에 숨은 도토를 찾아요. 어디를 다시 살펴봤는지도 남아요.', '자세히 보기'],
  ['닮은 선물 찾기', '친구와 어울리는 선물을 이어 보며 비슷한 점을 찾아요.', '닮은 것 잇기'],
  ['무늬 이어가기', '색과 모양의 차례를 보고 다음에 올 무늬를 골라요.', '규칙 찾기'],
  ['나만의 선물 꾸미기', '정답 없이 색, 모양, 스티커로 자기 방법을 만들어요.', '표현'],
];

const ENTRY_FLOW = [
  {
    label: '짧은 체험',
    title: '모리를 먼저 만나봐요',
    childTitle: '3분 모리 체험',
    childLine: '개인정보 없이 영상 하나와 단서 질문 하나를 짧게 해봐요.',
    childAction: '체험 시작',
    parentTitle: '짧게 보고 바로 이해해요',
    parentLine: '아이가 무엇을 자세히 봤는지, 어디에서 다시 살폈는지, 어떤 놀이를 끝까지 했는지 첫 기록을 보여줘요.',
    result: '마지막에는 아이 이름표를 만들고 다음 이야기를 열 수 있어요.',
    href: '/demo/kiosk',
    cta: '짧은 체험 보기',
  },
  {
    label: '오늘의 모험',
    title: '집에서 바로 시작해요',
    childTitle: '오늘의 모리 모험',
    childLine: '아이 이름표를 만들면 영상 1개를 보고, 바로 질문과 놀이를 이어가요.',
    childAction: '문 열래',
    parentTitle: '첫 기록이 바로 쌓여요',
    parentLine: '아이 이름을 만들고, 오늘 이야기와 놀이 기록을 바로 쌓을 수 있어요.',
    result: '보호자 화면에는 오늘 본 이야기, 고른 답, 완료한 놀이가 모여요.',
    href: START_HREF,
    cta: '집에서 시작하기',
  },
  {
    label: '놀이 기록',
    title: '우리 아이 기록이 남아요',
    childTitle: '오늘 놀이 완료',
    childLine: '놀이가 끝나면 모리가 오늘 해낸 활동을 짧게 보여줘요.',
    childAction: '기록 보기',
    parentTitle: '오늘 놀이가 기록돼요',
    parentLine: '이미 잘 들어온 놀이와 한 번 더 해보면 좋은 놀이를 부드럽게 보여줘요.',
    result: '맞고 틀림보다 완료한 활동, 다시 본 순간, 만든 선택을 중심으로 다음 놀이를 추천해요.',
    href: SAMPLE_REPORT_HREF,
    cta: '놀이 기록 보기',
  },
  {
    label: '보호자 화면',
    title: '이번 주 흐름을 확인해요',
    childTitle: '다음 이야기 추천',
    childLine: '이번엔 무늬 언덕에서 비슷한 점을 찾아볼까?',
    childAction: '새 모험 열기',
    parentTitle: '오늘 무엇을 했는지 보여요',
    parentLine: '완료한 영상, 단서 질문, 놀이 기록, 다음 추천이 한 화면에 모입니다.',
    result: '아이에게는 모험으로 보이고, 보호자에게는 대화 힌트와 다음 놀이로 정리돼요.',
    href: SAMPLE_REPORT_HREF,
    cta: '기록 예시 보기',
  },
];

function EntryFlowDemo() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = ENTRY_FLOW[activeIndex];

  const move = (direction: 1 | -1) => {
    setActiveIndex((current) => (current + direction + ENTRY_FLOW.length) % ENTRY_FLOW.length);
  };

  return (
    <section id="entry-flow" className="border-b border-line bg-white">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:py-20">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-sage">시작부터 기록까지</p>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">모리와 한 편을 놀면, 오늘 기록이 남아요</h2>
          <p className="mt-4 text-base font-semibold leading-relaxed text-ink2">
            아이는 모리와 영상을 보고, 짧은 단서 질문과 놀이를 지나갑니다. 보호자는 아이가 무엇을 잘 보고 어디에서 다시 살펴봤는지 확인합니다.
          </p>

          <div className="mt-6 grid gap-2">
            {ENTRY_FLOW.map((step, index) => {
              const selected = index === activeIndex;
              return (
                <button
                  key={step.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setActiveIndex(index)}
                  className={`flex min-h-14 items-center justify-between gap-4 rounded-2xl border px-4 text-left transition active:scale-[0.99] ${
                    selected
                      ? 'border-sage bg-sagebg text-ink shadow-sm'
                      : 'border-line bg-cream text-ink2 hover:border-sage hover:bg-mist'
                  }`}
                >
                  <span>
                    <span className="block text-xs font-black text-sage">{step.label}</span>
                    <span className="block text-sm font-black">{step.title}</span>
                  </span>
                  <span className="text-xl font-black text-saged">›</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => move(-1)}
              title="이전 단계"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white text-2xl font-black text-sage transition hover:bg-mist"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              title="다음 단계"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white text-2xl font-black text-sage transition hover:bg-mist"
            >
              ›
            </button>
            <Link
              href={active.href}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-saged px-6 text-sm font-black text-white transition hover:bg-ink active:scale-[0.98]"
            >
              {active.cta}
            </Link>
          </div>
        </div>

        <div className="rounded-[34px] border border-line bg-cream p-4 shadow-sm sm:p-5" aria-live="polite">
          <div className="grid gap-4 lg:grid-cols-[.96fr_1.04fr]">
            <div className="rounded-[28px] border border-line bg-white p-5">
              <div className="flex items-center gap-3">
                <MoriCharacter className="h-14 w-14 overflow-hidden rounded-full border border-line bg-cream" imageClassName="scale-125" label="모리" withGlow={false} />
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[.14em] text-sage">아이 화면</p>
                  <h3 className="text-lg font-black">{active.childTitle}</h3>
                </div>
              </div>
              <div className="mt-5 rounded-3xl bg-mist p-5">
                <p className="text-xl font-black leading-snug text-ink">{active.childLine}</p>
                <button
                  type="button"
                  className="mt-6 min-h-12 w-full rounded-2xl bg-saged px-4 text-sm font-black text-white shadow-[0_12px_24px_-16px_rgba(35,49,38,.75)]"
                  onClick={() => move(1)}
                >
                  {active.childAction}
                </button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {['단서', '빛', '꽃'].map((item, index) => (
                  <div key={item} className="rounded-2xl border border-line bg-cream px-2 py-3">
                    <p className="text-[11px] font-black text-ink3">{item}</p>
                    <p className="mt-1 text-lg font-black text-saged">{index <= activeIndex ? index + 1 : 0}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-line bg-white p-5">
              <p className="text-[11px] font-black uppercase tracking-[.14em] text-clay">보호자 화면</p>
              <h3 className="mt-2 text-2xl font-black leading-tight">{active.parentTitle}</h3>
              <p className="mt-3 text-base font-bold leading-relaxed text-ink2">{active.parentLine}</p>
              <div className="mt-5 rounded-3xl bg-sagebg p-5">
                <p className="text-xs font-black uppercase tracking-[.14em] text-sage">모리가 남기는 기록</p>
                <p className="mt-2 text-lg font-black leading-snug text-ink">{active.result}</p>
              </div>
              <div className="mt-5 grid gap-2">
                {['짧게 만나기', '오늘의 이야기', '보호자 기록'].map((line, index) => (
                  <div key={line} className={`rounded-2xl px-4 py-3 text-sm font-black ${index <= activeIndex ? 'bg-saged text-white' : 'bg-mist text-ink2'}`}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DiagnosisPreviewSection() {
  return (
    <section className="border-b border-line bg-mist">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[.86fr_1.14fr] lg:py-20">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-sage">무엇을 묻고 보나요</p>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">아이에게는 놀이, 보호자에게는 관찰 기록</h2>
          <p className="mt-4 text-base font-semibold leading-relaxed text-ink2">
            모리는 검사지를 내밀지 않아요. 영상 뒤의 짧은 단서 질문과 놀이에서 어떤 장면을 골랐는지, 다시 살펴봤는지, 끝까지 만들었는지 모아 “지금 잘 들어온 놀이”와 “다음에 더 해볼 놀이”를 보여줘요.
          </p>
          <div className="mt-6 rounded-[28px] border border-line bg-white p-5">
            <p className="text-sm font-black text-sage">오늘 예시</p>
            <p className="mt-2 text-xl font-black leading-snug text-ink">
              영상 뒤 단서 질문 → 꾸미 마음 찾기 → 숨은 친구 찾기 → 닮은 선물 찾기 → 나만의 선물 꾸미기
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {DIAGNOSIS_SIGNALS.map(([title, body, tag]) => (
            <article key={title} className="grid grid-cols-[1fr_auto] gap-4 rounded-[24px] border border-line bg-white p-5 shadow-sm">
              <div>
                <h3 className="text-lg font-black">{title}</h3>
                <p className="mt-1.5 text-sm font-semibold leading-relaxed text-ink2">{body}</p>
              </div>
              <span className="self-start rounded-full bg-sagebg px-3 py-1 text-xs font-black text-saged">{tag}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-cream text-ink [word-break:keep-all] [overflow-wrap:anywhere]">
      <nav className="sticky top-0 z-30 border-b border-line bg-cream/88 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3 text-xl font-black">
            <MoriCharacter className="h-10 w-10 overflow-hidden rounded-full border border-line bg-white" imageClassName="scale-125" label="모리" withGlow={false} />
            Kindy Mori
          </Link>
          <span className="hidden text-sm font-bold text-ink3 sm:inline">모리의 이야기 숲</span>
          <span className="flex-1" />
          <Link href={START_HREF} className="inline-flex min-h-11 items-center rounded-full bg-saged px-5 text-sm font-extrabold text-white transition hover:bg-ink">
            무료로 시작
          </Link>
        </div>
      </nav>

      <header className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#FBF7EF_0%,#F0F3EE_100%)]" />
        <div className="relative mx-auto grid min-h-[calc(88svh-64px)] w-full max-w-6xl grid-cols-1 items-center gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1.02fr_.98fr] lg:py-14">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[.18em] text-sage">영상 1편 · 짧은 질문 · 보호자 기록</p>
            <h1 className="mt-4 text-[clamp(38px,7vw,72px)] font-black leading-[1.02]">
              아이는 영상으로 놀고,{' '}
              <br />
              부모는 오늘을 이해해요
            </h1>
            <p className="mt-5 max-w-[36rem] text-[17px] font-semibold leading-relaxed text-ink2 sm:text-xl">
              모리의 짧은 이야기를 보고, 바로 이어지는 질문과 놀이를 해요. 끝나면 보호자는 아이가 무엇을 자세히 봤고 어떤 놀이가 잘 맞았는지 확인합니다.
            </p>
            <p className="mt-4 max-w-[34rem] text-base font-bold leading-relaxed text-saged">
              영상으로 배우고, 놀이로 확인하고, 부모는 오늘을 기록으로 봅니다.
            </p>
            <StartCtaBlock className="mt-8" />
            <a href="#entry-flow" className="mt-4 inline-flex min-h-11 items-center text-sm font-black text-saged underline underline-offset-[4px] hover:text-ink">
              아이 기록이 남는 방식 보기
            </a>
          </div>

          <div className="relative mx-auto w-full max-w-[520px]">
            <div className="relative aspect-[.92/1] overflow-hidden rounded-[44px] border border-line bg-white shadow-[0_28px_80px_-40px_rgba(35,49,38,.38)]">
              <MoriCharacter className="h-full w-full" imageClassName="scale-[1.08]" />
              <div className="absolute inset-x-5 bottom-5 rounded-[28px] border border-white/70 bg-cream/90 p-4 shadow-lg backdrop-blur">
                <p className="text-[11px] font-black uppercase tracking-[.16em] text-sage">첫 모험</p>
                <h2 className="mt-1 text-xl font-black">책정령 모리와 동물 마을 친구들</h2>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-ink2">
                  아이 화면엔 광고와 결제 화면 없이, 모리와 이야기가 먼저 보입니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-line bg-cream">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-5 py-10 sm:px-8 md:grid-cols-3">
            {FIRST_LOOK.map(([title, body]) => (
              <article key={title} className="rounded-[28px] border border-line bg-white p-5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[.16em] text-sage">처음이라면</p>
                <h2 className="mt-2 text-xl font-black text-ink">{title}</h2>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <EntryFlowDemo />
        <DiagnosisPreviewSection />

        <section className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 lg:py-20">
          <div className="mb-8 max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[.16em] text-sage">모리의 이야기 숲</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">아이는 놀고, 보호자는 아이를 더 잘 이해해요</h2>
            <p className="mt-4 text-base font-semibold leading-relaxed text-ink2">
              아이는 웹에서 바로 플레이하고, 보호자는 기록장에서 아이가 무엇에 몰입했는지 확인합니다. 다시 본 장면과 고른 놀이가 쌓일수록 다음 이야기도 아이에게 더 잘 맞아집니다.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STORY_OS.map(([title, body]) => (
              <article key={title} className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
                <h3 className="text-xl font-black">{title}</h3>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-ink2">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-line bg-mist">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[.95fr_1.05fr] lg:py-20">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-sage">아이의 플레이 루프</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">모리와 따라가면 자연스럽게 한 편이 끝나요</h2>
              <p className="mt-4 text-base font-semibold leading-relaxed text-ink2">
                나무집에서 시작해 문을 열고, 영상을 보고, 짧은 놀이를 합니다. 보호자에게는 그 여정이 오늘의 관찰 기록으로 남습니다.
              </p>
            </div>
            <div className="grid gap-3">
              {STORY_PATHS.map(([title, body], index) => (
                <article key={title} className="grid grid-cols-[44px_1fr] gap-4 rounded-[24px] border border-line bg-white p-4 shadow-sm">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sagebg text-sm font-black text-saged">{index + 1}</span>
                  <div>
                    <h3 className="text-lg font-black">{title}</h3>
                    <p className="mt-1 text-sm font-semibold leading-relaxed text-ink2">{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[.92fr_1.08fr] lg:py-24">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-sage">왜 모리인가요</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">아이마다 좋아하는 게 다른데, 콘텐츠는 다 똑같죠.</h2>
          </div>
          <div className="rounded-[32px] border border-line bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xl font-black leading-relaxed text-ink">
              모리는 우리 아이가 무엇에 빠지는지 보고, 다음 모험을 그 아이에게 맞춰요.
            </p>
          </div>
        </section>

        <section className="border-y border-line bg-mist">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
            <div className="mb-10">
              <p className="text-xs font-black uppercase tracking-[.16em] text-sage">첫 플레이 3스텝</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">무료 체험 안에서 바로 느껴집니다</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {STEPS.map(([title, body], index) => (
                <article key={title} className="rounded-[28px] border border-line bg-white p-6 shadow-sm">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sagebg text-sm font-black text-saged">{index + 1}</span>
                  <h3 className="mt-5 text-xl font-black">{title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1fr] lg:py-24">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-sage">6가지 생각 놀이</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">아이에게는 놀이 이름으로 보여줘요</h2>
            <p className="mt-4 text-base font-semibold leading-relaxed text-ink2">
              내부적으로는 아이의 사고 과정을 나누어 보지만, 화면에서는 자세히 보기, 규칙 찾기처럼 바로 이해되는 놀이 이름으로 안내합니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {THINKING_TOOLS.map((tool) => (
              <div key={tool} className="flex min-h-24 items-center justify-center rounded-3xl border border-line bg-white px-4 text-center text-base font-black shadow-sm">
                {tool}
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-line bg-mist">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
            <div className="rounded-[34px] border border-line bg-white p-6 shadow-sm sm:p-8">
              <p className="text-xs font-black uppercase tracking-[.16em] text-sage">기록 미리보기</p>
              <h2 className="mt-3 text-3xl font-black">서연이의 첫 놀이 기록</h2>
              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl bg-sagebg p-4">
                  <p className="text-sm font-black text-saged">이미 빛나는 점</p>
                  <p className="mt-1 text-lg font-black text-ink">규칙 찾기 ★ · 그려보기 ★</p>
                </div>
                <div className="rounded-2xl bg-cream p-4 ring-1 ring-line">
                  <p className="text-sm font-black text-clay">곧 자랄 점</p>
                  <p className="mt-1 text-base font-bold leading-relaxed text-ink2">
                    여기에 &apos;닮은 것 잇기&apos;가 더해지면 문제를 푸는 방법이 한 단계 단단해져요.
                  </p>
                </div>
              </div>
              <p className="mt-5 text-base font-black leading-relaxed text-ink">
                매주 서연이에게 조금 더 잘 맞는 모험이 그 길을 만들어요.
              </p>
            </div>

            <div className="flex flex-col justify-center">
              <p className="text-xs font-black uppercase tracking-[.16em] text-clay">신뢰</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">오늘 한 일이 바로 보여요.</h2>
              <div className="mt-6 grid gap-3">
                {TRUST.map((item) => (
                  <div key={item} className="rounded-2xl border border-line bg-white p-4 text-base font-black text-ink shadow-sm">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
          <div className="rounded-[36px] bg-saged px-6 py-12 text-center text-white sm:px-10">
            <p className="text-xs font-black uppercase tracking-[.16em] text-white/70">무료 체험</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">
              무료로 모험 3편과 첫 기록을 받아보고, 마음에 들면 계속 이어가요.
            </h2>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href={START_HREF} className="inline-flex min-h-14 items-center justify-center rounded-full bg-white px-8 text-base font-black text-saged transition hover:bg-cream active:scale-[0.98]">
                무료로 시작하기
              </Link>
              <span className="text-sm font-bold text-white/72">설치 없이 웹에서 시작</span>
            </div>
            <p className="mt-5 text-sm font-semibold text-white/80">
              무료 영상 3편 체험 후, 계속 이어가려면 멤버십 월 25,000원 · 언제든 해지
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8">
          <div className="rounded-[36px] border border-line bg-white px-6 py-12 text-center shadow-sm sm:px-10">
            <p className="text-sm font-black text-sage">아이에게는 모리의 첫 모험, 보호자에게는 첫 놀이 기록</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">우리 아이의 첫 모험, 지금 무료로.</h2>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href={START_HREF} className="inline-flex min-h-14 items-center justify-center rounded-full bg-saged px-8 text-base font-black text-white transition hover:bg-ink active:scale-[0.98]">
                무료로 시작
              </Link>
              <Link href={SAMPLE_REPORT_HREF} className="inline-flex min-h-14 items-center justify-center rounded-full border border-line bg-cream px-8 text-base font-black text-saged transition hover:bg-mist active:scale-[0.98]">
                기록 예시 보기
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
