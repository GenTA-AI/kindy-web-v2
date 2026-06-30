'use client';

import { useEffect, useRef, useState } from 'react';
import MoriCharacter from '@/components/MoriCharacter';
import { CHARACTERS } from '@/data/worlds/animal-village';

export type MascotMood = 'idle' | 'cheer' | 'encourage' | 'hint';

interface MascotProps {
  /** 마스코트 기분(대기/정답 환호/오답 격려/힌트). */
  mood: MascotMood;
  /** 말풍선 문구(없으면 기분별 기본 문구). */
  message?: string;
  /** speak 콜백(있으면 메시지가 바뀔 때 음성으로 읽음). */
  onSpeak?: (text: string) => void;
}

const DEFAULT_LINES: Record<MascotMood, string> = {
  idle: '천천히 다시 보면 보여.',
  cheer: '잘 찾았어!',
  encourage: '괜찮아, 다른 단서도 살펴볼까?',
  hint: '모리가 작은 단서를 들었어.',
};

const MOOD_BADGE: Record<MascotMood, string> = {
  idle: '보기',
  cheer: '꽃',
  encourage: '단서',
  hint: '등불',
};

/**
 * 마스코트(모리) — 화면 구석 상시 표시. 상태별 반응 + 말풍선 + juice 애니메이션.
 * 정답엔 박수(cheer), 막힐 땐 힌트, 오답엔 격려.
 */
export default function Mascot({ mood, message, onSpeak }: MascotProps) {
  const toto = CHARACTERS.toto;
  const line = message?.trim() || DEFAULT_LINES[mood];
  const [animClass, setAnimClass] = useState('');
  const lastSpokenRef = useRef<string>('');

  // 기분이 바뀔 때 짧은 juice 애니메이션. (setTimeout 콜백에서만 setState → 동기 setState 회피)
  useEffect(() => {
    const cls = mood === 'cheer' ? 'juice-cheer' : mood === 'encourage' ? 'juice-shake' : mood === 'hint' ? 'juice-bounce' : '';
    const onTimer = window.setTimeout(() => setAnimClass(cls), 0);
    const offTimer = cls ? window.setTimeout(() => setAnimClass(''), 750) : undefined;
    return () => {
      window.clearTimeout(onTimer);
      if (offTimer) window.clearTimeout(offTimer);
    };
  }, [mood, message]);

  // 메시지가 바뀌면 음성으로(중복 방지).
  useEffect(() => {
    if (!onSpeak) return;
    if (line && line !== lastSpokenRef.current) {
      lastSpokenRef.current = line;
      onSpeak(line);
    }
  }, [line, onSpeak]);

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-40 flex max-w-[60%] items-end gap-2 sm:left-6">
      <div className={`relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg shadow-sagebg ${animClass}`}>
        <MoriCharacter className="h-full w-full rounded-full" imageClassName="scale-125" label="모리" withGlow={false} />
        <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-sagebg px-1 text-[9px] font-black text-saged shadow-sm" aria-hidden="true">
          {MOOD_BADGE[mood]}
        </span>
      </div>
      <div className="mb-2 rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm font-bold text-ink shadow-md" role="status" aria-live="polite">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-sage">{toto.name}</span>
        {line}
      </div>
    </div>
  );
}
