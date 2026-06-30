'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import C6ToolMark from '@/components/C6ToolMark';
import MoriCharacter from '@/components/MoriCharacter';
import { C6_TOOLS, type C6ToolKey } from '@/lib/game/c6-profile';

type DiagnosisOption = {
  id: string;
  label: string;
  helper: string;
  toolKey: C6ToolKey;
};

type DiagnosisQuestion = {
  id: string;
  stepLabel: string;
  title: string;
  body: string;
  options: DiagnosisOption[];
};

type ToolResult = {
  key: C6ToolKey;
  label: string;
  count: number;
  nextBody: string;
  homePrompt: string;
};

const VIDEO_SRC = '/demo-videos/mori-starlight-seed.mp4';
const SUBTITLES_SRC = '/demo-videos/mori-starlight-seed.vtt';
const POSTER_SRC = '/ip/generated/mori-village-hero.png';
const START_HREF = '/start?from=ai-diagnosis';

const QUESTIONS: DiagnosisQuestion[] = [
  {
    id: 'first-clue',
    stepLabel: '장면 단서',
    title: '반짝빛을 찾으려면 어디를 먼저 볼까요?',
    body: '아이의 첫 선택은 장면을 얼마나 자세히 살피는지 보여주는 작은 단서가 됩니다.',
    options: [
      {
        id: 'leaf-shadow',
        label: '잎 그림자 아래',
        helper: '작은 차이를 먼저 살펴봐요.',
        toolKey: 'observe',
      },
      {
        id: 'bell-sound',
        label: '방울 소리가 난 길',
        helper: '들린 단서를 다른 장면과 이어봐요.',
        toolKey: 'imagine',
      },
      {
        id: 'same-lights',
        label: '빛이 반복된 자리',
        helper: '반복되는 모양과 순서를 찾아봐요.',
        toolKey: 'pattern',
      },
    ],
  },
  {
    id: 'next-door',
    stepLabel: '생각 단서',
    title: '모리가 다음 문을 열려면 어떤 방법이 좋을까요?',
    body: '정답보다 아이가 어떤 방법으로 생각을 시작하는지 확인합니다.',
    options: [
      {
        id: 'sort-doors',
        label: '문 모양을 나눠보기',
        helper: '기준을 바꾸며 분류해요.',
        toolKey: 'transform',
      },
      {
        id: 'match-friends',
        label: '친구와 닮은 점 찾기',
        helper: '서로 다른 것을 연결해요.',
        toolKey: 'imagine',
      },
      {
        id: 'repeat-sound',
        label: '소리 순서 따라가기',
        helper: '앞뒤 규칙을 이어봐요.',
        toolKey: 'pattern',
      },
    ],
  },
  {
    id: 'gift-making',
    stepLabel: '표현 단서',
    title: '찾은 단서로 무엇을 만들어볼까요?',
    body: '마지막 선택은 색, 자리, 조합을 다루는 표현 신호를 보여줍니다.',
    options: [
      {
        id: 'two-colors',
        label: '두 가지 색으로 꾸미기',
        helper: '색과 균형을 골라요.',
        toolKey: 'design',
      },
      {
        id: 'new-gift',
        label: '단서를 모아 선물 만들기',
        helper: '여러 재료를 하나로 합쳐요.',
        toolKey: 'compose',
      },
      {
        id: 'tiny-detail',
        label: '작은 무늬 다시 보기',
        helper: '완성 전에 놓친 곳을 살펴요.',
        toolKey: 'observe',
      },
    ],
  },
];

const TOOL_ORDER: C6ToolKey[] = ['observe', 'imagine', 'pattern', 'transform', 'design', 'compose'];

const TOOL_META = new Map(C6_TOOLS.map((tool) => [tool.key, tool]));

function resultFor(toolKey: C6ToolKey, count: number): ToolResult {
  const meta = TOOL_META.get(toolKey)!;
  return {
    key: toolKey,
    label: meta.parentLabel,
    count,
    nextBody: meta.nextBody,
    homePrompt: meta.homePrompt,
  };
}

export default function AiDiagnosisDemo() {
  const [videoTouched, setVideoTouched] = useState(false);
  const [answers, setAnswers] = useState<Record<string, DiagnosisOption>>({});

  const answeredCount = Object.keys(answers).length;
  const completed = answeredCount === QUESTIONS.length;

  const result = useMemo(() => {
    const counts = TOOL_ORDER.reduce<Record<C6ToolKey, number>>((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {
      observe: 0,
      imagine: 0,
      pattern: 0,
      transform: 0,
      design: 0,
      compose: 0,
    });

    Object.values(answers).forEach((answer) => {
      counts[answer.toolKey] += 1;
    });

    const ranked = TOOL_ORDER
      .map((key) => resultFor(key, counts[key]))
      .sort((a, b) => b.count - a.count || TOOL_ORDER.indexOf(a.key) - TOOL_ORDER.indexOf(b.key));

    const strongest = ranked[0] ?? resultFor('observe', 0);
    const nextSeed = [...ranked]
      .sort((a, b) => a.count - b.count || TOOL_ORDER.indexOf(a.key) - TOOL_ORDER.indexOf(b.key))[0]
      ?? resultFor('observe', 0);

    return { counts, ranked, strongest, nextSeed };
  }, [answers]);

  const selectAnswer = (question: DiagnosisQuestion, option: DiagnosisOption) => {
    setAnswers((current) => ({ ...current, [question.id]: option }));
  };

  const reset = () => {
    setAnswers({});
    setVideoTouched(false);
  };

  return (
    <main className="min-h-screen bg-cream text-ink [word-break:keep-all]">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 lg:min-h-screen lg:grid-cols-[.95fr_1.05fr]">
        <section className="flex flex-col justify-between bg-saged px-5 pb-7 pt-8 text-white sm:px-8 lg:min-h-screen lg:px-10 lg:py-10">
          <div>
            <Link href="/demo" className="inline-flex min-h-10 items-center rounded-full bg-white/12 px-4 text-xs font-black text-white/85 transition hover:bg-white/20">
              미리보기 목록
            </Link>

            <div className="mt-8 flex items-center gap-4">
              <MoriCharacter
                className="h-20 w-20 overflow-hidden rounded-[28px] border border-white/25 bg-white"
                imageClassName="scale-125"
                label="모리"
                withGlow={false}
              />
              <div>
                <p className="text-[11px] font-black uppercase tracking-[.16em] text-white/68">모리 영상 미리보기</p>
                <h1 className="mt-1 text-3xl font-black leading-tight tracking-[-.02em]">
                  영상 한 편 보고
                  <br />
                  다음 놀이를 찾아요
                </h1>
              </div>
            </div>

            <p className="mt-6 max-w-md text-base font-semibold leading-relaxed text-white/82">
              아이가 모리 영상을 보고 고른 단서로 오늘 잘 맞은 놀이와 다음에 해볼 놀이를 짧게 보여줘요.
            </p>

            <div className="mt-7 grid grid-cols-3 gap-2 text-center">
              {[
                ['1', '영상'],
                ['2', '질문'],
                ['3', '기록'],
              ].map(([num, label]) => (
                <div key={label} className="rounded-2xl border border-white/18 bg-white/10 px-3 py-3">
                  <p className="text-[10px] font-black text-white/54">{num}</p>
                  <p className="mt-0.5 text-sm font-black text-white">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-white/15 bg-white/10 p-4">
            <p className="text-xs font-black text-white/72">짧게 이렇게 봐요</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-white/82">
              이 화면은 아이를 판단하지 않고, 다음 영상을 고르기 위한 첫 선택만 보여줘요. 정식 서비스에서는 여러 영상과 놀이 기록이 쌓일수록 아이에게 맞는 추천이 더 부드럽게 바뀝니다.
            </p>
          </div>
        </section>

        <section className="px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-[560px]">
            <section className="overflow-hidden rounded-[32px] border border-line bg-white shadow-sm">
              <div className="relative aspect-video bg-ink">
                <video
                  src={VIDEO_SRC}
                  poster={POSTER_SRC}
                  controls
                  playsInline
                  onPlay={() => setVideoTouched(true)}
                  onEnded={() => setVideoTouched(true)}
                  className="h-full w-full bg-ink object-cover"
                >
                  <track kind="subtitles" srcLang="ko" label="한국어" src={SUBTITLES_SRC} default />
                </video>
              </div>
              <div className="p-5">
                <p className="text-[11px] font-black uppercase tracking-[.16em] text-sage">모리와 함께 보는 별빛 단서</p>
                <h2 className="mt-2 text-2xl font-black leading-tight">먼저 영상을 보고 단서를 골라요</h2>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">
                  영상이 끝나면 아래 질문에서 아이가 먼저 떠올린 답을 눌러주세요.
                </p>
              </div>
            </section>

            {!videoTouched && (
              <button
                type="button"
                onClick={() => setVideoTouched(true)}
                className="mt-4 min-h-12 w-full rounded-2xl border border-line bg-white px-5 text-sm font-black text-saged shadow-sm transition hover:bg-mist active:scale-[0.99]"
              >
                영상 봤어요
              </button>
            )}

            <div className="mt-5 space-y-3">
              {QUESTIONS.map((question, index) => {
                const selected = answers[question.id];
                const locked = !videoTouched || index > answeredCount;

                return (
                  <section
                    key={question.id}
                    className={`rounded-[28px] border bg-white p-5 shadow-sm transition ${
                      locked ? 'border-line opacity-55' : 'border-line'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[.16em] text-sage">
                          {index + 1} / {QUESTIONS.length} · {question.stepLabel}
                        </p>
                        <h3 className="mt-2 text-lg font-black leading-snug text-ink">{question.title}</h3>
                      </div>
                      {selected && <C6ToolMark toolKey={selected.toolKey} className="h-10 w-10 rounded-xl" />}
                    </div>
                    <p className="mt-2 text-xs font-semibold leading-relaxed text-ink3">{question.body}</p>

                    <div className="mt-4 grid gap-2">
                      {question.options.map((option) => {
                        const active = selected?.id === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => selectAnswer(question, option)}
                            disabled={locked}
                            className={`min-h-[64px] rounded-2xl px-4 text-left transition active:scale-[0.99] disabled:cursor-not-allowed ${
                              active
                                ? 'bg-saged text-white shadow-md shadow-sagebg'
                                : 'bg-mist text-ink hover:bg-sagebg'
                            }`}
                          >
                            <span className="block text-sm font-black">{option.label}</span>
                            <span className={`mt-1 block text-xs font-semibold ${active ? 'text-white/78' : 'text-ink3'}`}>
                              {option.helper}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            <section className="mt-5 rounded-[32px] border border-line bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-sagebg">
                  <Image src="/ip/generated/starlight-seed.png" alt="반짝빛 단서" fill sizes="64px" className="object-contain p-2" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[.16em] text-sage">
                    {completed ? '오늘 기록' : `진행 중 ${answeredCount}/${QUESTIONS.length}`}
                  </p>
                  <h2 className="mt-1 text-xl font-black leading-snug">
                    {completed ? '오늘 잘 맞은 놀이' : '질문을 끝까지 눌러주세요'}
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">
                    {completed
                      ? '오늘 체험에서 잘 맞은 놀이와 다음에 해볼 놀이를 나눠 보여줍니다.'
                      : '세 가지 선택이 모이면 모리가 다음에 보여줄 이야기 방향을 추천합니다.'}
                  </p>
                </div>
              </div>

              {completed && (
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl bg-sagebg p-4">
                    <div className="flex items-center gap-3">
                      <C6ToolMark toolKey={result.strongest.key} className="h-12 w-12" />
                      <div>
                        <p className="text-xs font-black text-saged">오늘 잘 맞은 놀이</p>
                        <p className="text-base font-black text-ink">{result.strongest.label}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-relaxed text-ink2">
                      영상 속 단서를 고를 때 이 방법을 먼저 사용했어요.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-cream p-4 ring-1 ring-line">
                    <div className="flex items-center gap-3">
                      <C6ToolMark toolKey={result.nextSeed.key} className="h-12 w-12" />
                      <div>
                        <p className="text-xs font-black text-clay">다음에 해볼 놀이</p>
                        <p className="text-base font-black text-ink">{result.nextSeed.label}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-relaxed text-ink2">{result.nextSeed.nextBody}</p>
                  </div>

                  <div className="grid gap-2">
                    {result.ranked.map((tool) => (
                      <div key={tool.key} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2">
                        <C6ToolMark toolKey={tool.key} className="h-9 w-9 rounded-xl" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-black text-ink2">{tool.label}</span>
                            <span className="text-[11px] font-black text-ink3">{tool.count}개 단서</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-mist">
                            <div
                              className="h-2 rounded-full bg-sage"
                              style={{ width: `${Math.min(100, tool.count * 34)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl bg-mist p-4">
                    <p className="text-xs font-black text-saged">집에서 이어볼 한마디</p>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">{result.nextSeed.homePrompt}</p>
                  </div>

                  <div className="grid gap-2">
                    <Link
                      href={START_HREF}
                      className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-saged px-6 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
                    >
                      무료 3편 이어보기
                    </Link>
                    <Link
                      href="/sample/report"
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-white px-6 text-sm font-black text-saged transition hover:bg-mist active:scale-[0.98]"
                    >
                      보호자 기록 예시 보기
                    </Link>
                    <button
                      type="button"
                      onClick={reset}
                      className="min-h-12 rounded-2xl px-6 text-sm font-black text-ink3 transition hover:bg-mist"
                    >
                      다시 해보기
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
