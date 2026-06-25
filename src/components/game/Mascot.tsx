'use client';

import { useEffect, useRef, useState } from 'react';
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
  idle: '천천히 해도 괜찮아!',
  cheer: '우와, 해냈어! 짝짝짝 👏',
  encourage: '거의 다 왔어, 한 번 더!',
  hint: '이쪽을 한번 볼까?',
};

const MOOD_EMOJI: Record<MascotMood, string> = {
  idle: '🐰',
  cheer: '🐰',
  encourage: '🐰',
  hint: '🐰',
};

const MOOD_BADGE: Record<MascotMood, string> = {
  idle: '🙂',
  cheer: '🎉',
  encourage: '💪',
  hint: '💡',
};

/**
 * 마스코트(토토) — 화면 구석 상시 표시. 상태별 반응 + 말풍선 + juice 애니메이션.
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
      <div className={`relative flex h-16 w-16 items-center justify-center rounded-full bg-white text-4xl shadow-lg shadow-violet-200 ${animClass}`}>
        <span aria-hidden="true">{MOOD_EMOJI[mood]}</span>
        <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-sm shadow-sm" aria-hidden="true">
          {MOOD_BADGE[mood]}
        </span>
      </div>
      <div className="mb-2 rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm font-bold text-gray-800 shadow-md" role="status" aria-live="polite">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-violet-400">{toto.name}</span>
        {line}
      </div>
    </div>
  );
}
