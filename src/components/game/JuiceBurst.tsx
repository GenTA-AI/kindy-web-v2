'use client';

import { useEffect, useState } from 'react';
import { makeConfetti, makeStars, useReducedMotion } from '@/lib/juice';

interface JuiceBurstProps {
  /** 값이 바뀔 때마다 1회 분출(정답/완료 시 증가시키면 됨). 0이면 분출 안 함. */
  fireKey: number;
  /** 'confetti' = 화면 상단에서 떨어짐, 'stars' = 한 점에서 사방으로. */
  variant?: 'confetti' | 'stars';
}

/**
 * 정답/완료 juice 오버레이. 라이브러리 없이 CSS keyframes 로 confetti·별 팡.
 * pointer-events 없음 → 게임 조작 방해 안 함. prefers-reduced-motion 이면 렌더 생략.
 */
export default function JuiceBurst({ fireKey, variant = 'confetti' }: JuiceBurstProps) {
  // 분출 중인 키(0 = 분출 없음). 값이 바뀌면 잠깐 렌더 후 자동 소멸.
  const [activeKey, setActiveKey] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (fireKey <= 0 || reduced) return undefined;
    // setTimeout 콜백 안에서만 상태를 바꿔 동기 setState 를 피한다.
    const showTimer = window.setTimeout(() => setActiveKey(fireKey), 0);
    const hideTimer = window.setTimeout(() => setActiveKey(0), 1300);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [fireKey, reduced]);

  const active = activeKey > 0;
  if (!active || reduced) return null;

  const confetti = variant === 'confetti' ? makeConfetti(20, fireKey) : [];
  const stars = variant === 'stars' ? makeStars(9, fireKey) : [];

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {confetti.map((piece) => (
        <span
          key={piece.id}
          className="juice-confetti-piece"
          style={{
            left: `${piece.left}%`,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}ms`,
            ['--juice-dx' as string]: `${piece.dx}px`,
          }}
        />
      ))}
      {stars.map((piece) => (
        <span
          key={piece.id}
          className="juice-star-piece"
          style={{
            animationDelay: `${piece.delay}ms`,
            ['--juice-dx' as string]: `${piece.dx}px`,
            ['--juice-dy' as string]: `${piece.dy}px`,
          }}
        >
          {piece.glyph}
        </span>
      ))}
    </div>
  );
}
