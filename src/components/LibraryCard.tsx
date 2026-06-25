'use client';

import Link from 'next/link';
import type { LibraryVideo } from '@/types/library';

interface Props {
  video: LibraryVideo;
  childId: string;
}

export default function LibraryCard({ video, childId }: Props) {
  const minutes = Math.floor(video.duration_sec / 60);
  const seconds = video.duration_sec % 60;
  const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <Link
      href={`/library/${video.id}?childId=${encodeURIComponent(childId)}`}
      className="block overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm transition hover:shadow-md active:scale-[0.99]"
    >
      <div className="relative aspect-video bg-violet-50">
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail_url} alt={video.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-violet-300">
            미리보기 준비 중
          </div>
        )}
        <div className="absolute bottom-2 right-2 rounded bg-violet-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {duration}
        </div>
        {video.episode_unit_sec === 90 && (
          <div className="absolute top-2 left-2 rounded-md bg-violet-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">
            EP
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">
          {video.topic} · {video.age_band}세
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-gray-900">{video.title}</h3>
        <div className="mt-2 flex flex-wrap gap-1">
          {video.style_tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
