import Image from 'next/image';
import type { StoryChatActor, StoryChatAccent } from '@/types/story-chat';

const ACCENT_CLASS: Record<StoryChatAccent, string> = {
  sage: 'border-sages bg-sagebg text-saged',
  gold: 'border-gold/50 bg-deep text-ink',
  clay: 'border-clay/35 bg-orange-50 text-clay',
  sky: 'border-sky-300 bg-sky-50 text-sky-900',
  ink: 'border-ink bg-ink text-cream',
};

const SIZE_CLASS = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-11 w-11 text-base',
  lg: 'h-14 w-14 text-lg',
} as const;

const IMAGE_SIZE = {
  sm: '36px',
  md: '44px',
  lg: '56px',
} as const;

interface ChatAvatarProps {
  actor: StoryChatActor;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  decorative?: boolean;
}

export default function ChatAvatar({
  actor,
  size = 'md',
  className = '',
  decorative = false,
}: ChatAvatarProps) {
  const label = decorative ? '' : `${actor.name} 프로필`;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden border font-bold ${actor.role === 'system' ? 'rounded-xl' : 'rounded-full'} ${ACCENT_CLASS[actor.accent]} ${SIZE_CLASS[size]} ${className}`}
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
    >
      {actor.avatarUrl ? (
        <Image
          src={actor.avatarUrl}
          alt={label}
          fill
          sizes={IMAGE_SIZE[size]}
          className="object-cover"
        />
      ) : (
        <span aria-hidden="true">{actor.avatarFallback}</span>
      )}
    </span>
  );
}
