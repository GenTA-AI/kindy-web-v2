'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  createKioskSession,
  trackKiosk,
  kioskStartUrl,
  type KioskSession,
} from '@/lib/kioskTrack';
import MoriCharacter from '@/components/MoriCharacter';

type Step = 'intro' | 'char' | 'topic' | 'mood' | 'video' | 'result';

// ── 캐릭터(자체 IP 후보) ─────────────────────────────────────────────
const Princess = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full">
    <circle cx="50" cy="56" r="32" fill="#FBCFE8" />
    <circle cx="50" cy="56" r="22" fill="#F9A8D4" />
    <path d="M 32 40 L 50 22 L 68 40 L 60 38 L 50 30 L 40 38 Z" fill="#F472B6" />
    <circle cx="38" cy="34" r="2" fill="#FCD34D" />
    <circle cx="50" cy="26" r="2" fill="#FCD34D" />
    <circle cx="62" cy="34" r="2" fill="#FCD34D" />
    <circle cx="42" cy="56" r="2.5" fill="#1F2937" />
    <circle cx="58" cy="56" r="2.5" fill="#1F2937" />
    <path d="M 44 64 Q 50 68 56 64" stroke="#1F2937" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);
const Astronaut = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full">
    <circle cx="50" cy="55" r="30" fill="#C2D5B9" />
    <circle cx="50" cy="54" r="22" fill="#93B589" />
    <ellipse cx="48" cy="50" rx="10" ry="7" fill="#fff" opacity="0.55" />
    <rect x="38" y="78" width="24" height="8" rx="2" fill="#46763F" />
    <circle cx="44" cy="54" r="2" fill="#1F2937" />
    <circle cx="56" cy="54" r="2" fill="#1F2937" />
    <path d="M 45 62 Q 50 65 55 62" stroke="#1F2937" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    <path d="M 18 24 L 20 28 L 24 30 L 20 32 L 18 36 L 16 32 L 12 30 L 16 28 Z" fill="#FCD34D" />
  </svg>
);
const Dino = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full">
    <ellipse cx="50" cy="60" rx="34" ry="28" fill="#A7F3D0" />
    <ellipse cx="50" cy="62" rx="22" ry="16" fill="#6EE7B7" />
    <path d="M 36 38 L 40 32 L 42 40 Z" fill="#A7F3D0" />
    <path d="M 46 36 L 50 30 L 52 38 Z" fill="#A7F3D0" />
    <path d="M 56 38 L 60 32 L 62 40 Z" fill="#A7F3D0" />
    <circle cx="40" cy="57" r="2" fill="#1F2937" />
    <circle cx="60" cy="57" r="2" fill="#1F2937" />
    <ellipse cx="50" cy="70" rx="8" ry="4" fill="#10B981" />
  </svg>
);
const ForestFriend = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full">
    <circle cx="50" cy="58" r="32" fill="#FED7AA" />
    <ellipse cx="50" cy="60" rx="22" ry="20" fill="#FB923C" />
    <path d="M 28 30 L 32 18 L 38 30 Z" fill="#FB923C" />
    <path d="M 72 30 L 68 18 L 62 30 Z" fill="#FB923C" />
    <circle cx="42" cy="55" r="2.5" fill="#1F2937" />
    <circle cx="58" cy="55" r="2.5" fill="#1F2937" />
    <ellipse cx="50" cy="66" rx="5" ry="3" fill="#1F2937" />
  </svg>
);

type Choice = { id: string; label: string; tagline: string; Illustration?: () => React.ReactElement; emoji?: string; bg: string };

const CHARACTERS: Choice[] = [
  { id: 'mori', label: '모리', tagline: '이야기 숲 안내자', Illustration: ForestFriend, bg: 'bg-sagebg' },
  { id: 'kkumi', label: '꾸미', tagline: '마음 단서 친구', Illustration: Dino, bg: 'bg-emerald-50' },
  { id: 'bangul', label: '방울', tagline: '질문을 던지는 친구', Illustration: Astronaut, bg: 'bg-sky-50' },
  { id: 'nayaong', label: '나옹', tagline: '비슷한 점을 찾는 친구', Illustration: Princess, bg: 'bg-rose-50' },
];
const TOPICS: Choice[] = [
  { id: 'observe', label: '자세히 보기', tagline: '작은 단서 찾기', emoji: '🔎', bg: 'bg-sagebg' },
  { id: 'analogy', label: '닮은 것 잇기', tagline: '비슷한 점 찾기', emoji: '↔', bg: 'bg-mist' },
  { id: 'pattern', label: '규칙 찾기', tagline: '차례 찾기', emoji: '▦', bg: 'bg-amber-50' },
  { id: 'compose', label: '모아서 만들기', tagline: '내 방법 만들기', emoji: '✚', bg: 'bg-emerald-50' },
];
const MOODS: Choice[] = [
  { id: 'quick', label: '바로 풀래', tagline: '단서 질문 먼저', emoji: '?', bg: 'bg-cream' },
  { id: 'slow', label: '천천히 볼래', tagline: '영상 다시', emoji: '◌', bg: 'bg-sagebg' },
  { id: 'make', label: '만들어 볼래', tagline: '놀이 먼저', emoji: '✎', bg: 'bg-mist' },
  { id: 'talk', label: '말해 볼래', tagline: '보호자 대화', emoji: '…', bg: 'bg-amber-50' },
];

const label = (list: Choice[], id: string | null) => list.find((c) => c.id === id)?.label ?? '';

// TODO: 캐릭터×주제×정서톤 매칭 샘플 세트(4~6개) 확충. 현재는 단일 샘플로 근사 매칭.
function pickDemoVideo() {
  return { src: '/demo-videos/mori-starlight-seed.mp4', vtt: '/demo-videos/mori-starlight-seed.vtt', id: 'mori-starlight-seed' };
}

export default function DemoKioskPage() {
  const [step, setStep] = useState<Step>('intro');
  const [character, setCharacter] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [session, setSession] = useState<KioskSession | null>(null);
  const sessionRef = useRef<KioskSession | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const sid = () => sessionRef.current?.sessionId ?? null;
  const video = pickDemoVideo();

  // 데모 진입 → 세션 생성(+demo_started)
  const begin = useCallback(async () => {
    setStep('char');
    if (!sessionRef.current) {
      const s = await createKioskSession();
      if (s) setSession(s);
    }
  }, []);

  // 선택 후 0.7초 자동 전환 + step_select 적재
  useEffect(() => {
    if (step === 'char' && character) {
      trackKiosk(sid(), { eventType: 'step_select', payload: { character } });
      const t = setTimeout(() => setStep('topic'), 700);
      return () => clearTimeout(t);
    }
    if (step === 'topic' && topic) {
      trackKiosk(sid(), { eventType: 'step_select', payload: { topic } });
      const t = setTimeout(() => setStep('mood'), 700);
      return () => clearTimeout(t);
    }
    if (step === 'mood' && mood) {
      trackKiosk(sid(), { eventType: 'step_select', payload: { mood } });
      const t = setTimeout(() => setStep('video'), 700);
      return () => clearTimeout(t);
    }
  }, [step, character, topic, mood]);

  const reset = () => {
    setCharacter(null);
    setTopic(null);
    setMood(null);
    setSession(null);
    setStep('intro');
  };

  const stepNum = step === 'char' ? 1 : step === 'topic' ? 2 : step === 'mood' ? 3 : 0;

  return (
    <div
      className="relative mx-auto flex h-screen w-full max-w-[520px] flex-col overflow-hidden bg-cream"
      style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, system-ui, sans-serif" }}
    >
      <header className="flex shrink-0 items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2.5">
          <MoriCharacter className="h-10 w-10 overflow-hidden rounded-full border border-line bg-white" imageClassName="scale-125" label="모리" withGlow={false} />
          <div className="leading-tight">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-sage">도서관에서 만나는 모리</p>
            <p className="text-sm font-extrabold text-ink">3분 모리 체험</p>
          </div>
        </div>
        {step !== 'intro' && (
          <button onClick={reset} className="rounded-full bg-mist px-3 py-1.5 text-xs font-bold text-saged">
            처음부터
          </button>
        )}
      </header>

      {/* 진행 바 (선택 단계) */}
      {stepNum > 0 && (
        <div className="mt-4 flex shrink-0 items-center gap-2 px-6">
          <p className="text-xs font-bold text-gray-400">{stepNum} / 3</p>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sagebg">
            <div className="h-full rounded-full bg-sage transition-all duration-500" style={{ width: `${(stepNum / 3) * 100}%` }} />
          </div>
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col px-6 py-5">
        {step === 'intro' && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <MoriCharacter className="mb-8 h-44 w-44 overflow-hidden rounded-[40px] border border-line bg-white shadow-sm" imageClassName="scale-110" label="모리" />
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sage">3분 체험 + 첫 기록</p>
            <h2 className="mt-2 text-3xl font-black leading-tight tracking-tight text-ink">
              모리와 짧게 놀고
              <br />
              오늘 기록을 봐요
            </h2>
            <p className="mt-4 text-base font-bold leading-relaxed text-ink2">
              개인정보 없이 영상 하나, 질문 하나, 놀이 하나를 지나며 아이가 무엇을 잘 보고 어디에서 다시 살피는지 볼 수 있어요.
            </p>
            <button
              onClick={begin}
              className="mt-10 w-full max-w-xs rounded-2xl bg-saged py-5 text-xl font-bold text-white shadow-lg shadow-sagebg transition active:scale-[0.98]"
            >
              모리 만나기
            </button>
          </div>
        )}

        {step === 'char' && (
          <SelectStep
            kicker="질문 1 · 친구"
            title="누가 안내해 줄까?"
            list={CHARACTERS}
            selected={character}
            onSelect={setCharacter}
          />
        )}
        {step === 'topic' && (
          <SelectStep kicker="질문 2 · 놀이" title="오늘 어떤 놀이를 해볼까?" list={TOPICS} selected={topic} onSelect={setTopic} />
        )}
        {step === 'mood' && (
          <SelectStep kicker="질문 3 · 추천 방식" title="다음엔 어떤 방식이 좋을까?" list={MOODS} selected={mood} onSelect={setMood} />
        )}

        {step === 'video' && (
          <VideoStep
            src={video.src}
            vtt={video.vtt}
            videoId={video.id}
            title={`${label(CHARACTERS, character)}와 함께하는 ${label(TOPICS, topic)} 이야기`}
            sid={sid}
            onDone={() => setStep('result')}
          />
        )}

        {step === 'result' && (
          <ResultStep
            character={character}
            topic={topic}
            mood={mood}
            qrToken={session?.qrToken ?? null}
            sid={sid}
            onReset={reset}
          />
        )}
      </main>

      {step !== 'intro' && step !== 'result' && (
        <footer className="shrink-0 px-6 pb-5 text-center">
          <p className="text-xs font-medium text-ink3">개인정보 없이 진행돼요 · QR을 찍으면 집에서도 바로 열 수 있어요</p>
        </footer>
      )}
    </div>
  );
}

function SelectStep({
  kicker,
  title,
  list,
  selected,
  onSelect,
}: {
  kicker: string;
  title: string;
  list: Choice[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-5 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-sage">{kicker}</p>
        <h2 className="mt-1.5 text-2xl font-black leading-tight tracking-tight text-ink">{title}</h2>
        <p className="mt-1.5 text-sm font-medium text-gray-400">하나만 골라 봐 · 정답은 없어요</p>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-3 content-center">
        {list.map((c) => {
          const on = selected === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`flex flex-col items-center justify-center gap-2 rounded-3xl bg-white p-4 transition active:scale-[0.97] ${
                on ? 'border-[3px] border-sage shadow-xl shadow-sagebg' : 'border-2 border-line shadow-sm'
              }`}
            >
              <div className={`flex h-24 w-24 items-center justify-center rounded-2xl ${c.bg} text-5xl`}>
                {c.Illustration ? <c.Illustration /> : <span aria-hidden>{c.emoji}</span>}
              </div>
              <p className={`text-lg font-extrabold leading-tight ${on ? 'text-saged' : 'text-ink'}`}>{c.label}</p>
              <p className={`text-xs font-medium ${on ? 'text-sage' : 'text-ink3'}`}>{c.tagline}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VideoStep({
  src,
  vtt,
  videoId,
  title,
  sid,
  onDone,
}: {
  src: string;
  vtt: string;
  videoId: string;
  title: string;
  sid: () => string | null;
  onDone: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedRef = useRef(false);
  const lastProgressRef = useRef(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // 도서관: muted + 자막 항상 ON.
    v.muted = true;
    const showCaptions = () => {
      const tracks = v.textTracks;
      if (tracks && tracks.length) tracks[0].mode = 'showing';
    };
    v.addEventListener('loadedmetadata', showCaptions);
    showCaptions();
    return () => v.removeEventListener('loadedmetadata', showCaptions);
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative flex-1 overflow-hidden rounded-3xl bg-gray-900 shadow-xl">
        <video
          ref={videoRef}
          src={src}
          muted
          autoPlay
          playsInline
          preload="auto"
          className="h-full w-full object-cover"
          onPlay={() => {
            if (!startedRef.current) {
              startedRef.current = true;
              trackKiosk(sid(), { eventType: 'video_started', demoVideoId: videoId, durationSec: videoRef.current?.duration });
            }
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.currentTime - lastProgressRef.current >= 5) {
              lastProgressRef.current = v.currentTime;
              trackKiosk(sid(), { eventType: 'video_progress', demoVideoId: videoId, positionSec: v.currentTime, durationSec: v.duration });
            }
          }}
          onEnded={() => {
            const v = videoRef.current;
            trackKiosk(sid(), { eventType: 'video_completed', demoVideoId: videoId, positionSec: v?.duration, durationSec: v?.duration });
            onDone();
          }}
        >
          <track kind="subtitles" src={vtt} srcLang="ko" label="한국어" default />
        </video>
        {/* 제목 오버레이 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">소리 없이 · 자막으로</p>
          <h3 className="mt-1 text-lg font-extrabold leading-tight text-white">{title}</h3>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-black text-sage">영상</p>
          <p className="mt-1 text-sm font-black text-ink">보기</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-black text-sage">단서</p>
          <p className="mt-1 text-sm font-black text-ink">질문</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-black text-sage">놀이</p>
          <p className="mt-1 text-sm font-black text-ink">해보기</p>
        </div>
      </div>
      <button
        onClick={() => {
          const v = videoRef.current;
          trackKiosk(sid(), { eventType: 'video_progress', demoVideoId: videoId, positionSec: v?.currentTime, durationSec: v?.duration, payload: { reason: 'skip' } });
          onDone();
        }}
        className="mt-4 self-center text-sm font-bold text-ink3"
      >
        오늘 기록 보기 →
      </button>
    </div>
  );
}

function ResultStep({
  character,
  topic,
  mood,
  qrToken,
  sid,
  onReset,
}: {
  character: string | null;
  topic: string | null;
  mood: string | null;
  qrToken: string | null;
  sid: () => string | null;
  onReset: () => void;
}) {
  useEffect(() => {
    trackKiosk(sid(), { eventType: 'qr_shown' });
  }, [sid]);

  const charLabel = label(CHARACTERS, character);
  const topicLabel = label(TOPICS, topic);
  const homeModeLabel = label(MOODS, mood);

  return (
    <div className="flex flex-1 flex-col">
      <div className="shrink-0 rounded-3xl bg-saged p-5 text-center text-white shadow-lg shadow-sagebg">
        <div className="text-4xl">✓</div>
        <h2 className="mt-2 text-2xl font-black leading-tight">오늘의 모리 기록이 나왔어요</h2>
        <p className="mt-1.5 text-sm font-medium text-white/82">
          {charLabel}와 함께 {topicLabel}을 살펴봤어요
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-sage">오늘 기록 요약</p>
          <h3 className="mt-1.5 text-lg font-extrabold leading-snug text-ink">
            오늘 잘한 건 자세히 보기,
            <br />
            다음에 해볼 놀이는 {topicLabel || '닮은 것 잇기'}예요.
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-sagebg p-3">
              <p className="text-[10px] font-black text-sage">잘 보인 부분</p>
              <p className="mt-1 text-sm font-black text-ink">자세히 보기</p>
            </div>
            <div className="rounded-2xl bg-cream p-3 ring-1 ring-line">
              <p className="text-[10px] font-black text-clay">다음에 해볼 놀이</p>
              <p className="mt-1 text-sm font-black text-ink">{topicLabel || '닮은 것 잇기'}</p>
            </div>
          </div>
          <p className="mt-3 rounded-2xl bg-mist px-3 py-2 text-xs font-bold leading-relaxed text-ink2">
            추천 놀이 방식: {homeModeLabel || '영상 보고 단서 질문과 놀이로 다시 해보기'}
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-white p-5 text-center shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-sage">집에서 이어 보기</p>
          <h3 className="mt-1.5 text-lg font-extrabold leading-snug text-ink">
            QR을 찍으면 설치 없이
            <br />
            모리 이야기를 바로 열어요
          </h3>
          <div className="mt-4 rounded-2xl bg-white p-3 shadow-inner ring-1 ring-line">
            <QRCodeSVG value={kioskStartUrl(qrToken)} size={144} level="M" />
          </div>
          <p className="mt-3 rounded-xl bg-sagebg px-3 py-2 text-xs font-bold text-saged">
            집에서도 같은 웹에서 모리 이야기를 바로 열 수 있어요
          </p>
        </div>
      </div>

      <button onClick={onReset} className="mt-4 self-center text-sm font-bold text-ink3">
        처음부터 다시 →
      </button>
    </div>
  );
}
