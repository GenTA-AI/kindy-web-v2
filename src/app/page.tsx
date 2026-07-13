import type { Metadata } from 'next';
import Link from 'next/link';
import Reveal from '@/components/landing/Reveal';

const START_HREF = '/auth/login?next=/onboarding';

export const metadata: Metadata = {
  title: 'Kindy — 읽고 느낀 것을 생각으로 만드는 힘',
  description:
    '명화와 클래식, 고전 이야기를 인문·정서·창의·독서로 연결하는 우리 아이 맞춤 통합 인문 수업. 매주 화·금, 카톡으로 도착합니다.',
};

// 한 작품에서 넓혀 가는 네 갈래 — 미술 단독 교육이 아니다 (대표 교정 2026-07-12).
const PILLARS = [
  {
    key: '인문',
    body: '그림과 음악 뒤의 시대와 사람을 만나고, 세상을 이해하는 질문을 나눕니다.',
  },
  { key: '정서', body: '장면 속 마음을 헤아리고, 내가 느낀 감정을 자기 말로 표현합니다.' },
  { key: '창의', body: '정답을 찾기 전에 “나라면?”을 묻고, 아이만의 생각으로 다시 만듭니다.' },
  { key: '독서', body: '이야기의 흐름을 따라가고, 장면의 앞뒤를 자기 말로 다시 들려줍니다.' },
];

// 개인화 흐름 — 부모 대화 → 아이 반응 → 맞춤 커리큘럼 (§2-3 가치 스택 ②③④).
const PERSONAL_STEPS = [
  {
    step: '01',
    title: '부모님과의 대화로 시작',
    body: '아이의 관심사와 성향을 먼저 여쭤보고, 첫 커리큘럼을 함께 짭니다.',
  },
  {
    step: '02',
    title: '아이의 반응을 읽습니다',
    body: '다시 본 장면, 오래 머문 놀이를 매주 리포트로 보내드립니다. 다음 주제는 부모님이 고르거나, 큐레이터가 아이의 반응을 보고 제안합니다.',
  },
  {
    step: '03',
    title: '이름을 불러주는 수업',
    body: '영상이 아이의 이름을 부르며 시작합니다. 모두에게 같은 영상이 아니라, 우리 아이에게 맞춰 자라는 커리큘럼입니다.',
  },
];

// 가격 앵커 비교는 랜딩 내부 표에서만 쓴다(트랙2 마케팅 플랜 §0-1 — 광고 크리에이티브에서는 금지).
const ANCHORS = [
  { name: '미술·피아노 학원', price: '월 12~20만원', limit: '이동 필요, 그리기 기술 중심' },
  { name: '어린이 명작 전집', price: '세트당 29~41만원', limit: '일시불 부담, 아이 혼자 안 읽음' },
  { name: '예술의전당 어린이 아카데미', price: '90분 1회 62,000원', limit: '서울 집중, 예약 경쟁' },
  { name: 'Kindy', price: '월 34,900원 · 얼리버드 24,900원', limit: '매주 새 작품, 카톡으로 도착' },
];

const SESSION_STEPS = [
  { step: '하나', title: '이야기로 만나는 세상', body: '명화·클래식·고전 속 시대와 사람을 만납니다.' },
  { step: '둘', title: '느끼고 말하는 질문', body: '보고 들은 내용을 떠올리고, 자기 마음과 생각을 답합니다.' },
  { step: '셋', title: '“나라면?” 창작', body: '정답 없이 고르고, 그리고, 아이만의 이야기를 만듭니다.' },
  { step: '넷', title: '부모 리포트', body: '아이의 선택과 반응, 집에서 이어갈 대화 질문을 전해드립니다.' },
];

const CURRICULUM = [
  {
    work: '쇠라 〈그랑드 자트 섬의 일요일 오후〉',
    question: '그때 사람들은 일요일을 어떻게 보냈을까',
    field: '인문 · 미술',
  },
  { work: '생상스 〈백조〉', question: '백조의 마음은 어떤 소리일까', field: '정서 · 음악' },
  { work: '아기돼지 삼형제', question: '튼튼한 집을 다르게 만든다면', field: '창의 · 고전' },
  { work: '모차르트 〈마술피리〉', question: '노래로 말하면 이야기가 어떻게 달라질까', field: '독서 · 이야기' },
];

const FAQ = [
  {
    q: 'AI로 만드나요?',
    a: 'AI는 붓입니다. 연출과 대본, 감수는 사람이 합니다. 런던에서 수학한 미디어아티스트가 한 편 한 편 직접 연출합니다.',
  },
  {
    q: '키즈 OTT랑 뭐가 달라요?',
    a: '라이브러리가 아니라 커리큘럼입니다. 매주 아이의 반응을 보고 다음 편을 고릅니다.',
  },
  { q: '해지는 어떻게 하나요?', a: '카톡 한 줄이면 즉시 됩니다. 첫 14일은 100% 환불을 보장합니다.' },
];

// 리퀴드 글라스 재질 — 밝은 면/어두운 면 두 벌. 상단 1px 하이라이트가 유리의 스펙큘러.
const GLASS_LIGHT =
  'rounded-3xl border border-white/60 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_32px_rgba(35,49,38,0.10)] backdrop-blur-2xl backdrop-saturate-150';
const GLASS_DARK =
  'rounded-3xl border border-white/20 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl backdrop-saturate-150';

function LoopVideo({
  src,
  poster,
  className = '',
}: {
  src: string;
  poster: string;
  className?: string;
}) {
  return (
    <video
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      className={className}
    />
  );
}

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
    <main className="bg-cream text-ink [word-break:keep-all]">
      {/* 글라스 스티키 네비 */}
      <header className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-3xl items-center justify-between rounded-full border border-white/50 bg-white/40 px-6 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_rgba(35,49,38,0.10)] backdrop-blur-2xl backdrop-saturate-150">
        <span className="text-sm font-black tracking-[0.3em]">KINDY</span>
        <Link
          href={START_HREF}
          className="rounded-full bg-ink px-4 py-1.5 text-sm font-bold text-cream transition hover:bg-saged"
        >
          첫 이야기 무료
        </Link>
      </header>

      {/* 히어로 — 살아 움직이는 반 고흐 위 글라스 패널 */}
      <section className="relative flex min-h-[100svh] items-end justify-center overflow-hidden sm:items-center">
        <LoopVideo
          src="/landing/starry-alive.mp4"
          poster="/landing/starry-poster.jpg"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-black/15" />
        <Reveal className="relative z-10 mx-4 mb-8 w-full max-w-xl sm:mb-0">
          <div className={`${GLASS_DARK} px-6 py-8 text-center text-white sm:px-12 sm:py-14`}>
            <p className="text-sm font-bold text-white/80">KINDY · 우리 아이 맞춤 통합 인문 수업</p>
            {showLibraryBenefit && (
              <div className="mx-auto mt-4 inline-flex items-center rounded-full border border-gold/70 bg-white/15 px-4 py-1.5 text-sm font-black text-gold backdrop-blur-xl">
                도서관 한정 월 ₩19,000
              </div>
            )}
            <h1 className="mt-4 text-3xl font-black leading-[1.2] tracking-normal sm:text-5xl">
              <span className="block whitespace-nowrap">읽고 느낀 것을,</span>
              <span className="block whitespace-nowrap">생각으로 만드는 힘.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-sm leading-relaxed text-white/85 sm:text-base">
              명화·클래식·고전 이야기에서 질문하고 표현하고 창작합니다. 인문·정서·창의·독서를
              한 흐름으로 연결합니다.
            </p>
            <p className="mx-auto mt-5 max-w-sm border-y border-white/25 py-3 text-sm font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
              인문 · 정서 · 창의 · 독서
            </p>
            <Link
              href={START_HREF}
              className="group relative mt-8 inline-flex min-h-14 items-center justify-center overflow-hidden rounded-full bg-white px-10 text-base font-bold text-ink transition hover:scale-[1.03] active:scale-[0.98]"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              첫 이야기 무료로 보기
            </Link>
            <p className="mt-4 text-xs text-white/70">결제 없이 볼 수 있어요 · 첫 14일 100% 환불 보장</p>
            <p className="mt-6 hidden text-xs text-white/50 sm:block">지금 화면: 반 고흐 〈별이 빛나는 밤〉이 실제 수업처럼 살아 움직이는 모습</p>
          </div>
        </Reveal>
      </section>

      {/* 네 갈래 가치 — 예술은 네 역량을 연결하는 매개다 */}
      <section className="mx-auto w-full max-w-5xl px-5 py-28 sm:px-8 sm:py-36">
        <Reveal>
          <h2 className="text-balance text-3xl font-black leading-snug tracking-tight sm:text-5xl">
            한 편의 이야기로
            <br />
            네 가지 힘을 함께.
          </h2>
          <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-ink2 sm:text-lg">
            Kindy에서 명화와 클래식은 외워야 할 지식이 아닙니다. 아이가 세상을 이해하고,
            마음을 말하고, 자기 생각을 만드는 이야기의 출발점입니다.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {PILLARS.map((pillar, index) => (
            <Reveal key={pillar.key} delay={index * 90}>
              <div className={`${GLASS_LIGHT} h-full px-7 py-8 transition-transform duration-300 hover:-translate-y-1`}>
                <h3 className="text-2xl font-black tracking-tight">
                  <span className="text-gold">{pillar.key}</span>
                </h3>
                <p className="mt-3 text-pretty leading-relaxed text-ink2">{pillar.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 살아 움직이는 수업 — 쇠라 비디오 글라스 프레임 */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-28 sm:px-8 sm:pb-36">
        <Reveal>
          <h2 className="text-balance text-3xl font-black leading-snug tracking-tight sm:text-5xl">
            명화는 목적이 아니라,
            <br />
            이야기의 시작입니다.
          </h2>
          <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-ink2 sm:text-lg">
            살아 움직이는 그림 속으로 들어가 시대와 사람을 만나고, 음악으로 마음을 느끼고,
            질문과 창작으로 아이의 이야기를 꺼냅니다.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <figure className={`${GLASS_LIGHT} mt-12 overflow-hidden p-3 sm:p-4`}>
            <LoopVideo
              src="/landing/seurat-alive.mp4"
              poster="/landing/seurat-poster.jpg"
              className="aspect-video w-full rounded-2xl object-cover"
            />
            <figcaption className="px-2 pb-1 pt-4 text-sm text-ink3">
              쇠라의 한 장면에서 시대 이야기, 감정 질문, 아이의 창작으로 이어지는 수업
            </figcaption>
          </figure>
        </Reveal>
      </section>

      {/* 문제 공감 + 앵커 표 (글라스 카드) */}
      <section className="mx-auto w-full max-w-4xl px-5 pb-28 sm:px-8 sm:pb-36">
        <Reveal>
          <h2 className="text-balance text-3xl font-black leading-snug tracking-tight sm:text-5xl">
            따로 배우던 경험을
            <br />
            한 수업 안에서.
          </h2>
          <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-ink2 sm:text-lg">
            책으로 만나는 인문 이야기, 음악으로 느끼는 감정, 질문으로 넓히는 생각, 손으로 만드는
            창작을 하나의 흐름으로 연결합니다.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <div className={`${GLASS_LIGHT} mt-12 px-6 py-2 sm:px-8`}>
            <table className="w-full border-collapse text-left text-sm sm:text-base">
              <thead>
                <tr className="border-b border-line/70 text-ink3">
                  <th className="py-4 pr-4 font-bold">배우는 곳</th>
                  <th className="py-4 pr-4 font-bold">가격</th>
                  <th className="hidden py-4 font-bold sm:table-cell">한계</th>
                </tr>
              </thead>
              <tbody>
                {ANCHORS.map((row, index) => (
                  <tr
                    key={row.name}
                    className={`${index < ANCHORS.length - 1 ? 'border-b border-line/70' : ''} ${
                      row.name === 'Kindy' ? 'font-black' : 'text-ink2'
                    }`}
                  >
                    <td className="py-4 pr-4">{row.name}</td>
                    <td className="py-4 pr-4">{row.price}</td>
                    <td className="hidden py-4 sm:table-cell">{row.limit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      {/* 수업 구조 — 살아 있는 모네 배경 위 글라스 그리드 */}
      <section className="relative overflow-hidden">
        <LoopVideo
          src="/landing/lilies-alive.mp4"
          poster="/landing/lilies-poster.jpg"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/30 to-black/50" />
        <div className="relative z-10 mx-auto w-full max-w-5xl px-5 py-28 text-white sm:px-8 sm:py-36">
          <Reveal>
            <h2 className="text-balance text-3xl font-black leading-snug tracking-tight sm:text-5xl">
              3분 영상이 아니라,
              <br />
              20분 수업입니다.
            </h2>
            <p className="mt-4 text-sm text-white/70">배경: 모네 〈수련〉 (1906) · 함께 흐르는 클래식 — 생상스 〈백조〉</p>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2">
            {SESSION_STEPS.map((item, index) => (
              <Reveal key={item.title} delay={index * 90}>
                <div className={`${GLASS_DARK} h-full px-7 py-8 transition-transform duration-300 hover:-translate-y-1`}>
                  <p className="text-sm font-bold text-gold">{item.step}</p>
                  <h3 className="mt-2 text-xl font-black">{item.title}</h3>
                  <p className="mt-2 text-pretty leading-relaxed text-white/80">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 커리큘럼 — 가로 스냅 스크롤 글라스 카드 */}
      <section className="mx-auto w-full max-w-5xl px-5 py-28 sm:px-8 sm:py-36">
        <Reveal>
          <h2 className="text-sm font-black tracking-[0.25em] text-ink3">커리큘럼 중에서</h2>
        </Reveal>
        <div className="-mx-5 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8 [scrollbar-width:thin]">
          {CURRICULUM.map((row, index) => (
            <Reveal key={row.work} delay={index * 80} className="snap-start">
              <div className={`${GLASS_LIGHT} flex h-full w-72 shrink-0 flex-col justify-between px-7 py-8 sm:w-80`}>
                <div>
                  <p className="text-xs font-black tracking-[0.2em] text-gold">{row.field}</p>
                  <h3 className="mt-3 text-lg font-black leading-snug">{row.work}</h3>
                </div>
                <p className="mt-6 text-ink2">{row.question}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={200}>
          <p className="mt-8 max-w-2xl text-pretty leading-relaxed text-ink2">
            받은 수업은 회차별로 아이의 계정에 남아 언제든 다시 볼 수 있습니다. 여섯 달이면
            마흔여덟 편 — 아이만의 전집 한 질이 쌓입니다.
          </p>
        </Reveal>
      </section>

      {/* 개인화 — 부모와의 대화로 짜는 우리 아이 커리큘럼 */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-28 sm:px-8 sm:pb-36">
        <Reveal>
          <h2 className="text-balance text-3xl font-black leading-snug tracking-tight sm:text-5xl">
            우리 아이에게만
            <br />
            맞춘 커리큘럼.
          </h2>
          <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-ink2 sm:text-lg">
            정해진 전집을 순서대로 트는 게 아닙니다. 부모님과 대화하고, 아이의 반응을 읽으며,
            매주 커리큘럼이 아이를 따라갑니다.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {PERSONAL_STEPS.map((item, index) => (
            <Reveal key={item.step} delay={index * 100}>
              <div className={`${GLASS_LIGHT} h-full px-7 py-8`}>
                <p className="text-sm font-black tracking-[0.2em] text-gold">{item.step}</p>
                <h3 className="mt-3 text-xl font-black">{item.title}</h3>
                <p className="mt-3 text-pretty leading-relaxed text-ink2">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 만드는 사람 */}
      <section className="mx-auto w-full max-w-4xl px-5 pb-28 text-center sm:px-8 sm:pb-36">
        <Reveal>
          <h2 className="text-sm font-black tracking-[0.25em] text-ink3">만드는 사람</h2>
          <p className="mt-10 text-balance text-2xl font-black leading-snug tracking-tight sm:text-4xl">
            30년 인문학·예술 교수의
            <br />
            커리큘럼을 그대로 옮겼습니다.
          </p>
          <p className="mx-auto mt-8 max-w-xl text-pretty leading-relaxed text-ink2">
            런던에서 수학한 미디어아티스트가 한 편 한 편 직접 연출합니다. AI는 붓입니다 —
            연출과 대본, 감수는 사람이 합니다.
          </p>
        </Reveal>
      </section>

      {/* 가격 — 글라스 카드 */}
      <section className="mx-auto w-full max-w-4xl px-5 pb-28 sm:px-8 sm:pb-36">
        <Reveal>
          <div className={`${GLASS_LIGHT} mx-auto max-w-lg px-8 py-14 text-center`}>
            <p className="text-sm font-black tracking-[0.25em] text-gold">얼리버드 특가 · 기간 한정</p>
            <p className="mt-6 text-5xl font-black tracking-tight">월 24,900원</p>
            <p className="mt-2 font-bold text-ink2">평생 고정</p>
            <p className="mt-6 text-sm leading-relaxed text-ink3">
              정가 월 34,900원 · 하루로 치면 1,163원
            </p>
            <Link
              href={START_HREF}
              className="group relative mt-10 inline-flex min-h-14 w-full items-center justify-center overflow-hidden rounded-full bg-ink px-8 text-base font-bold text-cream transition hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              첫 이야기 무료로 보기
            </Link>
            <p className="mt-4 text-sm text-ink3">첫 14일 100% 환불 보장 · 해지는 카톡 한 줄로</p>
          </div>
        </Reveal>
      </section>

      {/* FAQ — 글라스 아코디언 */}
      <section className="mx-auto w-full max-w-2xl px-5 pb-32 sm:px-8">
        <Reveal>
          <h2 className="text-sm font-black tracking-[0.25em] text-ink3">자주 묻는 질문</h2>
        </Reveal>
        <div className="mt-6 flex flex-col gap-3">
          {FAQ.map((item, index) => (
            <Reveal key={item.q} delay={index * 60}>
              <details className={`${GLASS_LIGHT} group px-6 py-5`}>
                <summary className="flex cursor-pointer list-none items-center justify-between font-black [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden
                    className="text-ink3 transition-transform duration-300 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-pretty leading-relaxed text-ink2">{item.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>
    </main>
  );
}
