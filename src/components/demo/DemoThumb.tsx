import type { CSSProperties } from 'react';

export type DemoTopic = 'science' | 'english' | 'hangul';
export type DemoStyle = 'mori' | 'space' | 'forest' | 'dino';

interface Palette {
  from: string;
  to: string;
  accent: string;
  ink: string;
}

const PALETTES: Record<DemoStyle, Record<DemoTopic, Palette>> = {
  // R3: 보라/인디고 폐기. mori = 밝은 크림-세이지 세계, space = 어두운 세이지-밤하늘.
  mori: {
    science: { from: '#EDF2E7', to: '#9DBE96', accent: '#C9871E', ink: '#2E5129' },
    english: { from: '#E4EDDF', to: '#93B589', accent: '#C9871E', ink: '#284821' },
    hangul:  { from: '#F4EAD2', to: '#C2D5B9', accent: '#159C84', ink: '#2E5129' },
  },
  space: {
    science: { from: '#1E351A', to: '#46763F', accent: '#C9871E', ink: '#EDF2E7' },
    english: { from: '#162714', to: '#335A2E', accent: '#93B589', ink: '#DCE7D4' },
    hangul:  { from: '#16291C', to: '#284821', accent: '#C9871E', ink: '#EDF2E7' },
  },
  forest: {
    science: { from: '#dcfce7', to: '#5eead4', accent: '#34d399', ink: '#065f46' },
    english: { from: '#ecfeff', to: '#a7f3d0', accent: '#22d3ee', ink: '#0f766e' },
    hangul:  { from: '#fef9c3', to: '#bef264', accent: '#84cc16', ink: '#365314' },
  },
  dino: {
    science: { from: '#fef3c7', to: '#fb923c', accent: '#facc15', ink: '#7c2d12' },
    english: { from: '#fee2e2', to: '#fb7185', accent: '#fbbf24', ink: '#7f1d1d' },
    hangul:  { from: '#fff7ed', to: '#fdba74', accent: '#f59e0b', ink: '#78350f' },
  },
};

const TOPIC_EMOJI: Record<DemoTopic, string[]> = {
  science: ['🌧️', '🌈', '🌙', '⭐', '🔭', '🧪', '🌊', '❄️', '🌋', '🪐'],
  english: ['🅰️', '🅱️', '📚', '🗣️', '🔤', '🍎', '🐱', '🐶', '🌟', '✨'],
  hangul:  ['ㄱ', 'ㅏ', '한', '글', '나', '비', '가', '다', '사', '랑'],
};

const CHAR_EMOJI: Record<DemoStyle, string> = {
  mori: '모리',
  space: '🚀',
  forest: '🦊',
  dino: '🦖',
};

/**
 * Stylized SVG video thumbnail — gradient + character + topic motif.
 * Looks like a frozen frame from an animated kids' video.
 */
export default function DemoThumb({
  topic,
  style,
  seed = 0,
  className,
  inlineStyle,
}: {
  topic: DemoTopic;
  style: DemoStyle;
  seed?: number;
  className?: string;
  inlineStyle?: CSSProperties;
}) {
  const p = PALETTES[style][topic];
  const motif = TOPIC_EMOJI[topic][seed % TOPIC_EMOJI[topic].length];
  const character = CHAR_EMOJI[style];
  const gradId = `g-${style}-${topic}-${seed}`;

  // Pseudo-random sparkle positions seeded by `seed`
  const rand = (n: number) => {
    const x = Math.sin(seed * 9.7 + n * 3.3) * 10000;
    return x - Math.floor(x);
  };

  return (
    <div className={className} style={inlineStyle}>
      <svg
        viewBox="0 0 320 180"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={p.from} />
            <stop offset="100%" stopColor={p.to} />
          </linearGradient>
          <radialGradient id={`${gradId}-glow`} cx="0.5" cy="0.55" r="0.7">
            <stop offset="0%" stopColor="white" stopOpacity="0.35" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="320" height="180" fill={`url(#${gradId})`} />
        <rect width="320" height="180" fill={`url(#${gradId}-glow)`} />

        {/* Floating decoration motifs */}
        {Array.from({ length: 6 }).map((_, i) => {
          const x = 20 + rand(i) * 280;
          const y = 18 + rand(i + 7) * 110;
          const size = 14 + rand(i + 13) * 16;
          const opacity = 0.22 + rand(i + 21) * 0.4;
          return (
            <text
              key={i}
              x={x}
              y={y}
              fontSize={size}
              opacity={opacity}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {motif}
            </text>
          );
        })}

        {/* Sparkle dots */}
        <circle cx="48" cy="36" r="3" fill={p.accent} opacity="0.7" />
        <circle cx="280" cy="48" r="2" fill="white" opacity="0.8" />
        <circle cx="246" cy="148" r="4" fill={p.accent} opacity="0.55" />

        {/* Soft ground halo */}
        <ellipse cx="160" cy="158" rx="80" ry="14" fill={p.accent} opacity="0.35" />

        {/* Hero character — pushed slightly left */}
        <text
          x="124"
          y="116"
          fontSize="86"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.18))' }}
        >
          {character}
        </text>

        {/* Companion motif on right */}
        <text
          x="232"
          y="100"
          fontSize="52"
          textAnchor="middle"
          dominantBaseline="middle"
          opacity="0.92"
          style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.15))' }}
        >
          {motif}
        </text>
      </svg>
    </div>
  );
}
