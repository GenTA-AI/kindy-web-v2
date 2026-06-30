'use client';

import Link from 'next/link';
import type { LibraryVideo } from '@/types/library';
import { topicLabel } from '@/lib/topic-label';

interface Props {
  video: LibraryVideo;
  childId: string;
  completedToday?: boolean;
}

const STYLE_TAG_LABELS: Record<string, string> = {
  story_forest: '이야기 숲',
  direct_web: '웹에서 바로',
  direct_mobile: '웹에서 바로',
  water_lab: '물방울 실험터',
  pattern_hill: '무늬 언덕',
  star_workshop: '별빛 작업실',
};

function visibleStyleLabels(tags: string[]): string[] {
  const labels = tags
    .map((tag) => STYLE_TAG_LABELS[tag])
    .filter((label): label is string => Boolean(label));

  return [...new Set(labels)].slice(0, 3);
}

export default function LibraryCard({ video, childId, completedToday = false }: Props) {
  const minutes = Math.floor(video.duration_sec / 60);
  const seconds = video.duration_sec % 60;
  const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const styleLabels = visibleStyleLabels(video.style_tags);

  return (
    <Link
      href={`/library/${video.id}?childId=${encodeURIComponent(childId)}`}
      className="block overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:border-sage hover:shadow-md active:scale-[0.99]"
    >
      <div className="relative aspect-video bg-mist">
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail_url} alt={video.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_35%,#FFFFFF_0%,#F2F5EF_48%,#E6EDE4_100%)] px-3 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl shadow-sm">M</span>
            <span className="mt-2 text-xs font-black text-sage">모리 이야기 카드</span>
          </div>
        )}
        <div className="absolute bottom-2 right-2 rounded bg-ink/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {duration}
        </div>
        {video.episode_unit_sec === 90 && (
          <div className="absolute left-2 top-2 rounded-md bg-saged px-1.5 py-0.5 text-[9px] font-black text-white">
            긴 이야기
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-[10px] font-black uppercase tracking-[.14em] text-sage">
          {topicLabel(video.topic)} · {video.age_band}세
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm font-black leading-snug text-ink">{video.title}</h3>
        {styleLabels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {styleLabels.map((label) => (
              <span key={label} className="rounded-full bg-sagebg px-2 py-0.5 text-[10px] font-bold text-saged">
                {label}
            </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex min-h-9 items-center justify-center rounded-xl bg-mist px-2 text-[11px] font-black text-saged">
          {completedToday ? '보호자와 고르기' : '보고 단서 놀이'}
        </div>
      </div>
    </Link>
  );
}
