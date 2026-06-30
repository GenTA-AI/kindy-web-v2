import Image from 'next/image';
import { MORI_IMAGE_SRC } from '@/lib/art-assets';

interface MoriCharacterProps {
  className?: string;
  imageClassName?: string;
  label?: string;
  loading?: 'eager' | 'lazy';
  withGlow?: boolean;
}

export default function MoriCharacter({
  className = '',
  imageClassName = '',
  label = '책 속 마음을 읽는 정령 모리',
  loading = 'eager',
  withGlow = true,
}: MoriCharacterProps) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {withGlow && (
        <span
          aria-hidden="true"
          className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(221,232,222,.86),rgba(251,247,239,.12)_62%,transparent_72%)] blur-sm"
        />
      )}
      <Image
        fill
        src={MORI_IMAGE_SRC}
        alt={label}
        loading={loading}
        sizes="(max-width: 640px) 160px, 420px"
        className={`relative z-10 h-full w-full rounded-[inherit] object-contain ${imageClassName}`}
        draggable={false}
      />
    </div>
  );
}
