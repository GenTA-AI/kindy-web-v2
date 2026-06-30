import Image from 'next/image';
import { tokenImageSrc } from '@/lib/art-assets';

type GameTokenVisualProps = {
  token: string;
  label: string;
  compact?: boolean;
  className?: string;
};

const TOKEN_MARKS: Record<string, string> = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
  I: 'I',
  angry: '!',
  bell: '♪',
  butterfly: '◇',
  calm: '○',
  clap: '짝',
  do: '도',
  fa: '파',
  flower: '✿',
  happy: '웃음',
  leaf: '잎',
  mi: '미',
  moon: '달',
  proud: '★',
  rain: '비',
  re: '레',
  sad: '슬픔',
  shake: '✦',
  snow: '눈',
  sol: '솔',
  sun: '해',
  tap: '톡',
  worried: '?',
};

export default function GameTokenVisual({
  token,
  label,
  compact = false,
  className = '',
}: GameTokenVisualProps) {
  const cleanToken = token.trim();
  const imageSrc = tokenImageSrc(cleanToken);

  if (isInlineSvg(cleanToken)) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center [&_svg]:h-full [&_svg]:w-full ${
          compact ? 'h-9 w-9' : 'mx-auto h-16 w-16'
        } ${className}`}
        dangerouslySetInnerHTML={{ __html: cleanToken }}
      />
    );
  }

  if (imageSrc) {
    return (
      <span
        aria-hidden="true"
        className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line ${
          compact ? 'h-11 w-11' : 'mx-auto h-20 w-20 lg:h-24 lg:w-24'
        } ${className}`}
      >
        <Image
          fill
          src={imageSrc}
          alt=""
          sizes={compact ? '44px' : '96px'}
          className="object-contain p-1.5"
          draggable={false}
        />
      </span>
    );
  }

  const mark = TOKEN_MARKS[cleanToken] ?? TOKEN_MARKS[cleanToken.replace(/\ufe0f/g, '')] ?? fallbackMark(cleanToken, label);

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl bg-white font-black text-saged shadow-sm ring-1 ring-line ${
        compact ? 'h-11 w-11 text-lg' : 'mx-auto h-20 w-20 text-3xl lg:h-24 lg:w-24'
      } ${className}`}
    >
      {mark}
    </span>
  );
}

function fallbackMark(token: string, label: string): string {
  if (isLikelyEmoji(token)) return label.slice(0, 2);
  return Array.from(token).length <= 2 ? token : label.slice(0, 2);
}

function isInlineSvg(token: string): boolean {
  const trimmed = token.trim();
  return trimmed.startsWith('<svg') && trimmed.endsWith('</svg>');
}

function isLikelyEmoji(value: string): boolean {
  return /[\p{Extended_Pictographic}]/u.test(value);
}
