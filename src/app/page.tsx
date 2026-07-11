import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

const START_HREF = '/auth/login?next=/onboarding';

export const metadata: Metadata = {
  title: 'Kindy — 그림과 클래식이 익숙한 아이로',
  description:
    '런던에서 수학한 미디어아티스트가 한 편 한 편 직접 만드는 어린이 인문·예술 수업. 매주 화·금, 카톡으로 도착합니다.',
};

// 가격 앵커 비교는 랜딩 내부 표에서만 쓴다(트랙2 마케팅 플랜 §0-1 — 광고 크리에이티브에서는 금지).
const ANCHORS = [
  { name: '미술·피아노 학원', price: '월 12~20만원', limit: '이동 필요, 그리기 기술 중심' },
  { name: '어린이 명작 전집', price: '세트당 29~41만원', limit: '일시불 부담, 아이 혼자 안 읽음' },
  { name: '예술의전당 어린이 아카데미', price: '90분 1회 62,000원', limit: '서울 집중, 예약 경쟁' },
  { name: 'Kindy', price: '월 34,900원 · 파운딩 24,900원', limit: '매주 새 작품, 카톡으로 도착' },
];

const SESSION_STEPS = [
  { step: '하나', title: '명화 이야기 영상', body: '3분. 아이의 이름을 불러주며 시작합니다.' },
  { step: '둘', title: '퀴즈와 게임', body: '방금 본 작품 속으로 다시 들어가 봅니다.' },
  { step: '셋', title: '"나라면?" 창작', body: '아이가 자기 버전을 만들어 봅니다.' },
  { step: '넷', title: '부모 리포트', body: '아이가 오래 머문 장면과, 물어볼 질문 세 가지.' },
];

const CURRICULUM = [
  { work: '모차르트 〈마술피리〉', question: '오페라는 왜 노래로 말할까' },
  { work: '모네 〈건초더미〉', question: '같은 건초더미를 서른 번 그린 이유' },
  { work: '쇠라 〈그랑드 자트 섬의 일요일 오후〉', question: '점 백만 개로 그린 일요일' },
  { work: '생상스 〈백조〉', question: '첼로는 어떻게 헤엄칠까' },
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
  { q: '몇 살부터 볼 수 있나요?', a: '7~10세에 맞춰 설계했습니다.' },
  { q: '해지는 어떻게 하나요?', a: '카톡 한 줄이면 즉시 됩니다. 첫 14일은 100% 환불을 보장합니다.' },
];

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
      {/* 히어로 */}
      <section className="mx-auto flex min-h-[92vh] w-full max-w-4xl flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
        <span className="text-sm font-black tracking-[0.35em] text-ink3">KINDY</span>
        <p className="mt-8 text-sm font-bold text-ink2">어린이 인문·예술 수업 · 7~10세</p>

        {showLibraryBenefit && (
          <div className="mt-6 inline-flex items-center rounded-full border border-gold bg-white px-4 py-2 text-sm font-black text-clay">
            도서관 한정 월 ₩19,000
          </div>
        )}

        <h1 className="mt-5 text-5xl font-black leading-[1.12] tracking-tight sm:text-7xl">
          그림과 클래식이
          <br />
          익숙한 아이로.
        </h1>
        <p className="mt-8 max-w-xl text-base font-medium leading-relaxed text-ink2 sm:text-lg">
          런던에서 수학한 미디어아티스트가 한 편 한 편 직접 만드는 명화·클래식 이야기 수업.
          매주 화·금 오후 4시, 카톡으로 도착합니다.
        </p>
        <Link
          href={START_HREF}
          className="mt-12 inline-flex min-h-14 items-center justify-center rounded-full bg-ink px-10 text-base font-bold text-cream transition hover:bg-saged active:scale-[0.98]"
        >
          첫 이야기 무료로 보기
        </Link>
        <p className="mt-4 text-sm text-ink3">결제 없이 볼 수 있어요 · 첫 14일 100% 환불 보장</p>
      </section>

      {/* 작품 밴드 — 실제 수업 장면 */}
      <section className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <figure>
          <Image
            src="/landing/seurat-fishing.jpg"
            alt="쇠라 〈그랑드 자트 섬의 일요일 오후〉 부분 — 물가에서 낚시하는 여인"
            width={1920}
            height={1080}
            className="w-full rounded-2xl"
            sizes="(min-width: 1152px) 1088px, 100vw"
          />
          <figcaption className="mt-4 text-center text-sm text-ink3">
            조르주 쇠라, 〈그랑드 자트 섬의 일요일 오후〉 (1886) — 시즌 1에서 아이가 실제로 만나는 장면
          </figcaption>
        </figure>
      </section>

      {/* 문제 공감 + 앵커 표 */}
      <section className="mx-auto w-full max-w-4xl px-5 py-28 sm:px-8 sm:py-36">
        <h2 className="text-3xl font-black leading-snug tracking-tight sm:text-5xl">
          작품을 보는 눈은
          <br />
          누가 가르치죠?
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink2 sm:text-lg">
          미술학원은 그리기를 가르칩니다. 명화를 읽고, 클래식을 듣고, 자기 생각을 말하는 힘은
          따로 배워야 합니다.
        </p>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm sm:text-base">
            <thead>
              <tr className="border-b border-line text-ink3">
                <th className="py-3 pr-4 font-bold">배우는 곳</th>
                <th className="py-3 pr-4 font-bold">가격</th>
                <th className="py-3 font-bold">한계</th>
              </tr>
            </thead>
            <tbody>
              {ANCHORS.map((row) => (
                <tr
                  key={row.name}
                  className={`border-b border-line ${row.name === 'Kindy' ? 'font-black' : 'text-ink2'}`}
                >
                  <td className="py-4 pr-4">{row.name}</td>
                  <td className="py-4 pr-4">{row.price}</td>
                  <td className="py-4">{row.limit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 수업 구조 */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-4xl px-5 py-28 sm:px-8 sm:py-36">
          <h2 className="text-3xl font-black leading-snug tracking-tight sm:text-5xl">
            3분 영상이 아니라,
            <br />
            20분 수업입니다.
          </h2>
          <div className="mt-14 grid gap-10 sm:grid-cols-2">
            {SESSION_STEPS.map((item) => (
              <div key={item.title}>
                <p className="text-sm font-bold text-gold">{item.step}</p>
                <h3 className="mt-2 text-xl font-black">{item.title}</h3>
                <p className="mt-2 leading-relaxed text-ink2">{item.body}</p>
              </div>
            ))}
          </div>

          <h3 className="mt-24 text-sm font-black tracking-[0.25em] text-ink3">커리큘럼 중에서</h3>
          <ul className="mt-6 divide-y divide-line">
            {CURRICULUM.map((row) => (
              <li key={row.work} className="flex flex-col gap-1 py-5 sm:flex-row sm:items-baseline sm:justify-between">
                <span className="font-black">{row.work}</span>
                <span className="text-ink2">{row.question}</span>
              </li>
            ))}
          </ul>
          <p className="mt-10 leading-relaxed text-ink2">
            받은 수업은 회차별로 아이의 계정에 남아 언제든 다시 볼 수 있습니다. 여섯 달이면
            마흔여덟 편 — 아이만의 전집 한 질이 쌓입니다.
          </p>
        </div>
      </section>

      {/* 만드는 사람 */}
      <section className="mx-auto w-full max-w-4xl px-5 py-28 text-center sm:px-8 sm:py-36">
        <h2 className="text-sm font-black tracking-[0.25em] text-ink3">만드는 사람</h2>
        <p className="mt-10 text-2xl font-black leading-snug tracking-tight sm:text-4xl">
          30년 인문학·예술 교수의
          <br />
          커리큘럼을 그대로 옮겼습니다.
        </p>
        <p className="mx-auto mt-8 max-w-xl leading-relaxed text-ink2">
          런던에서 수학한 미디어아티스트가 한 편 한 편 직접 연출합니다. AI는 붓입니다 —
          연출과 대본, 감수는 사람이 합니다.
        </p>
      </section>

      {/* 가격 */}
      <section className="mx-auto w-full max-w-4xl px-5 pb-28 sm:px-8 sm:pb-36">
        <div className="mx-auto max-w-lg rounded-3xl border border-line bg-surface px-8 py-14 text-center">
          <p className="text-sm font-black tracking-[0.25em] text-gold">파운딩 멤버 · 첫 20가정</p>
          <p className="mt-6 text-5xl font-black tracking-tight">월 24,900원</p>
          <p className="mt-2 font-bold text-ink2">평생 고정</p>
          <p className="mt-6 text-sm leading-relaxed text-ink3">
            정가 월 34,900원 · 하루로 치면 1,163원
          </p>
          <Link
            href={START_HREF}
            className="mt-10 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-ink px-8 text-base font-bold text-cream transition hover:bg-saged active:scale-[0.98]"
          >
            첫 이야기 무료로 보기
          </Link>
          <p className="mt-4 text-sm text-ink3">첫 14일 100% 환불 보장 · 해지는 카톡 한 줄로</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-2xl px-5 pb-32 sm:px-8">
        <h2 className="text-sm font-black tracking-[0.25em] text-ink3">자주 묻는 질문</h2>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-black [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden className="text-ink3 transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-ink2">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
