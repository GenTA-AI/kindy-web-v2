'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  createKioskSession,
  trackKiosk,
  kioskStartUrl,
  type KioskSession,
} from '@/lib/kioskTrack';

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
  { id: 'princess', label: '공주', tagline: '반짝이는 친구', Illustration: Princess, bg: 'bg-pink-50' },
  { id: 'space', label: '우주인', tagline: '별을 좋아해', Illustration: Astronaut, bg: 'bg-sagebg' },
  { id: 'dino', label: '공룡', tagline: '크고 멋있어', Illustration: Dino, bg: 'bg-emerald-50' },
  { id: 'forest', label: '숲친구', tagline: '조용하고 따뜻해', Illustration: ForestFriend, bg: 'bg-orange-50' },
];
const TOPICS: Choice[] = [
  { id: 'science', label: '과학', tagline: '신기한 이야기', emoji: '🔬', bg: 'bg-violet-50' },
  { id: 'english', label: '영어', tagline: '소리 놀이', emoji: '🔤', bg: 'bg-violet-50' },
  { id: 'hangul', label: '한글', tagline: 'ㄱㄴㄷ 친구', emoji: 'ㄱ', bg: 'bg-violet-50' },
  { id: 'music', label: '노래', tagline: '함께 부르기', emoji: '🎵', bg: 'bg-violet-50' },
];
// 정서 톤 4종 — 개인화의 핵심(GACS-3 mood). "원하는 스타일로 공부".
const MOODS: Choice[] = [
  { id: 'gentle', label: '부드럽고 잔잔한', tagline: '자기 전에', emoji: '🌙', bg: 'bg-violet-50' },
  { id: 'lively', label: '활기차고 신나는', tagline: '뛰고 싶을 때', emoji: '🎈', bg: 'bg-violet-50' },
  { id: 'mystery', label: '신비하고 멋진', tagline: '두근두근', emoji: '✨', bg: 'bg-violet-50' },
  { id: 'warm', label: '따뜻하고 포근한', tagline: '안아주는 느낌', emoji: '🫧', bg: 'bg-violet-50' },
];

const label = (list: Choice[], id: string | null) => list.find((c) => c.id === id)?.label ?? '';

// TODO: 캐릭터×주제×정서톤 매칭 샘플 세트(4~6개) 확충. 현재는 단일 샘플로 근사 매칭.
function pickDemoVideo(_c: string | null, _t: string | null, _m: string | null) {
  return { src: '/demo-videos/princess-science.mp4', vtt: '/demo-videos/princess-science.vtt', id: 'princess-science' };
}

export default function DemoKioskPage() {
  const [step, setStep] = useState<Step>('intro');
  const [character, setCharacter] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [session, setSession] = useState<KioskSession | null>(null);
  const sessionRef = useRef<KioskSession | null>(null);
  sessionRef.current = session;

  const sid = () => sessionRef.current?.sessionId ?? null;
  const video = pickDemoVideo(character, topic, mood);

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
      className="relative mx-auto flex h-screen w-full max-w-[520px] flex-col overflow-hidden bg-gradient-to-b from-violet-50 via-white to-violet-50"
      style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, system-ui, sans-serif" }}
    >
      {/* 헤더 — 도서관 신뢰 */}
      <header className="flex shrink-0 items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500 text-lg">📚</div>
          <div className="leading-tight">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-violet-500">아산시립도서관 꿈샘</p>
            <p className="text-sm font-extrabold text-gray-900">AI 책 놀이</p>
          </div>
        </div>
        {step !== 'intro' && (
          <button onClick={reset} className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-600">
            처음부터
          </button>
        )}
      </header>

      {/* 진행 바 (선택 단계) */}
      {stepNum > 0 && (
        <div className="mt-4 flex shrink-0 items-center gap-2 px-6">
          <p className="text-xs font-bold text-gray-400">{stepNum} / 3</p>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-violet-100">
            <div className="h-full rounded-full bg-violet-500 transition-all duration-500" style={{ width: `${(stepNum / 3) * 100}%` }} />
          </div>
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col px-6 py-5">
        {step === 'intro' && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-8 h-40 w-40">
              <Princess />
            </div>
            <h2 className="text-3xl font-black leading-tight tracking-tight text-gray-900">
              오늘은 어떤 이야기를
              <br />
              만들어 볼까?
            </h2>
            <p className="mt-4 text-base font-medium text-gray-500">
              내 친구랑 내 스타일로, 1분이면 끝나요
            </p>
            <button
              onClick={begin}
              className="mt-10 w-full max-w-xs rounded-2xl bg-violet-500 py-5 text-xl font-bold text-white shadow-lg shadow-violet-200 transition active:scale-[0.98]"
            >
              시작하기 ✨
            </button>
          </div>
        )}

        {step === 'char' && (
          <SelectStep
            kicker="질문 1 · 친구"
            title="어떤 친구랑 갈까?"
            list={CHARACTERS}
            selected={character}
            onSelect={setCharacter}
          />
        )}
        {step === 'topic' && (
          <SelectStep kicker="질문 2 · 배울 것" title="무엇을 배울까?" list={TOPICS} selected={topic} onSelect={setTopic} />
        )}
        {step === 'mood' && (
          <SelectStep kicker="질문 3 · 내 스타일" title="어떤 느낌이 좋아?" list={MOODS} selected={mood} onSelect={setMood} />
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
          <p className="text-xs font-medium text-gray-400">이 놀이는 개인정보를 저장하지 않아요 · 도움이 필요하면 사서 선생님께</p>
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
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-violet-500">{kicker}</p>
        <h2 className="mt-1.5 text-2xl font-black leading-tight tracking-tight text-gray-900">{title}</h2>
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
                on ? 'border-[3px] border-violet-500 shadow-xl shadow-violet-200' : 'border-2 border-gray-100 shadow-sm'
              }`}
            >
              <div className={`flex h-24 w-24 items-center justify-center rounded-2xl ${c.bg} text-5xl`}>
                {c.Illustration ? <c.Illustration /> : <span aria-hidden>{c.emoji}</span>}
              </div>
              <p className={`text-lg font-extrabold leading-tight ${on ? 'text-violet-600' : 'text-gray-900'}`}>{c.label}</p>
              <p className={`text-xs font-medium ${on ? 'text-violet-500' : 'text-gray-400'}`}>{c.tagline}</p>
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
      <button
        onClick={() => {
          const v = videoRef.current;
          trackKiosk(sid(), { eventType: 'video_progress', demoVideoId: videoId, positionSec: v?.currentTime, durationSec: v?.duration, payload: { reason: 'skip' } });
          onDone();
        }}
        className="mt-4 self-center text-sm font-bold text-gray-400"
      >
        건너뛰기 →
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
  const moodLabel = label(MOODS, mood);

  return (
    <div className="flex flex-1 flex-col">
      {/* 상단 — 아이 칭찬 */}
      <div className="shrink-0 rounded-3xl bg-gradient-to-b from-violet-500 to-violet-600 p-5 text-center text-white shadow-lg shadow-violet-200">
        <div className="text-4xl">🎉</div>
        <h2 className="mt-2 text-2xl font-black leading-tight">와! 멋진 이야기를 만들었어</h2>
        <p className="mt-1.5 text-sm font-medium text-violet-100">
          {charLabel}와 함께 {moodLabel} {topicLabel} 이야기
        </p>
      </div>

      {/* 하단 — 부모 전환 카드 + 실제 QR */}
      <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-3xl border-2 border-violet-100 bg-white p-5 text-center shadow-sm">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-violet-500">집에서 계속</p>
        <h3 className="mt-1.5 text-lg font-extrabold leading-snug text-gray-900">
          QR을 찍으면 집에서
          <br />
          우리 아이만의 영상으로 이어져요
        </h3>
        <div className="mt-4 rounded-2xl bg-white p-3 shadow-inner ring-1 ring-gray-100">
          <QRCodeSVG value={kioskStartUrl(qrToken)} size={150} level="M" />
        </div>
        <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-600">
          또는 사서 선생님께 안내 종이 받기
        </p>
      </div>

      <button onClick={onReset} className="mt-4 self-center text-sm font-bold text-gray-400">
        처음부터 다시 →
      </button>
    </div>
  );
}
