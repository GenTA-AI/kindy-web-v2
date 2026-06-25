'use client';

import { useState } from 'react';
import DemoThumb, { type DemoStyle, type DemoTopic } from '@/components/demo/DemoThumb';

interface DemoVideo {
  id: string;
  title: string;
  topic: DemoTopic;
  age_band: 5 | 6 | 7;
  style_tags: string[];
  duration_sec: number;
  episode_unit_sec: 30 | 90;
  thumbnailReal?: string;
  style: DemoStyle;
  seed: number;
  badge?: 'new' | 'hot' | 'continue';
  watched?: boolean;
}

const REAL_THUMB =
  'https://lzzaiqruxxfhhalgvejb.supabase.co/storage/v1/object/sign/videos/library/00-princess-science-age5/thumbnail.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9mM2M5NDdjMy03ZDA3LTQxNjYtODEwMC0zYjc4YzJjZWYzYjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlb3MvbGlicmFyeS8wMC1wcmluY2Vzcy1zY2llbmNlLWFnZTUvdGh1bWJuYWlsLmpwZyIsImlhdCI6MTc3ODY2OTAyNSwiZXhwIjoxNzgxMjYxMDI1fQ.rvDddKfuok0XAlRvr1Gpx4V2vJQ_Ht5I5EIhkze1NOw';

const VIDEOS: DemoVideo[] = [
  // Featured row — princess + science (real Supabase thumbnail)
  { id: 'v01', title: '공주 미리와 물의 여행', topic: 'science', age_band: 5, style_tags: ['공주', '잔잔한', '음악'], duration_sec: 30, episode_unit_sec: 30, thumbnailReal: REAL_THUMB, style: 'princess', seed: 1, badge: 'continue', watched: true },
  { id: 'v02', title: '무지개는 어떻게 생길까?', topic: 'science', age_band: 5, style_tags: ['공주', '판타지'], duration_sec: 90, episode_unit_sec: 90, style: 'princess', seed: 2, badge: 'hot' },

  // Science variety
  { id: 'v03', title: '얼음이 사라졌어!', topic: 'science', age_band: 5, style_tags: ['우주', '신비'], duration_sec: 30, episode_unit_sec: 30, style: 'space', seed: 3, watched: true },
  { id: 'v04', title: '달은 왜 모양이 바뀔까?', topic: 'science', age_band: 6, style_tags: ['우주', '잔잔한'], duration_sec: 90, episode_unit_sec: 90, style: 'space', seed: 4, watched: true },
  { id: 'v05', title: '태양계 친구들을 만나자', topic: 'science', age_band: 6, style_tags: ['우주', '활기찬'], duration_sec: 90, episode_unit_sec: 90, style: 'space', seed: 5 },
  { id: 'v06', title: '왜 미끄럼틀에서 내려갈까?', topic: 'science', age_band: 7, style_tags: ['공룡', '활기찬'], duration_sec: 30, episode_unit_sec: 30, style: 'dino', seed: 6 },
  { id: 'v07', title: '자석의 신기한 힘', topic: 'science', age_band: 7, style_tags: ['공룡', '실험'], duration_sec: 30, episode_unit_sec: 30, style: 'dino', seed: 7, watched: true },

  // English
  { id: 'v08', title: 'Cat, Bat, Hat — 짧은 a 소리', topic: 'english', age_band: 5, style_tags: ['공주', '리듬'], duration_sec: 30, episode_unit_sec: 30, style: 'princess', seed: 8, watched: true },
  { id: 'v09', title: 'Color Words — 색깔 친구들', topic: 'english', age_band: 6, style_tags: ['숲친구', '노래'], duration_sec: 90, episode_unit_sec: 90, style: 'forest', seed: 9, badge: 'new' },
  { id: 'v10', title: 'I like ~ : 좋아하는 것 말하기', topic: 'english', age_band: 7, style_tags: ['공룡', '대화'], duration_sec: 30, episode_unit_sec: 30, style: 'dino', seed: 10 },
  { id: 'v11', title: 'Number Words — 숫자 노래', topic: 'english', age_band: 6, style_tags: ['우주', '리듬'], duration_sec: 30, episode_unit_sec: 30, style: 'space', seed: 11, watched: true },

  // Hangul
  { id: 'v12', title: 'ㄱㄴㄷ 소리 놀이', topic: 'hangul', age_band: 5, style_tags: ['숲친구', '리듬'], duration_sec: 30, episode_unit_sec: 30, style: 'forest', seed: 12, watched: true },
  { id: 'v13', title: '받침 친구를 만나자', topic: 'hangul', age_band: 6, style_tags: ['공주', '잔잔한'], duration_sec: 90, episode_unit_sec: 90, style: 'princess', seed: 13 },
  { id: 'v14', title: '나의 이름 한글로 써보기', topic: 'hangul', age_band: 7, style_tags: ['공룡', '글쓰기'], duration_sec: 30, episode_unit_sec: 30, style: 'dino', seed: 14, badge: 'new' },
];

const TOPIC_LABEL: Record<DemoTopic, string> = {
  science: '과학',
  english: '영어',
  hangul: '한글',
};

export default function DemoLibraryPage() {
  const [topic, setTopic] = useState<DemoTopic | null>(null);
  const [age, setAge] = useState<5 | 6 | 7 | null>(null);

  const filtered = VIDEOS.filter(
    (v) => (!topic || v.topic === topic) && (!age || v.age_band === age),
  );

  return (
    <div className="min-h-screen bg-violet-50">
      <div className="mx-auto max-w-[420px] px-6 pb-12 pt-10">
        <header className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-violet-500">Kindy 라이브러리</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-[1.3] text-gray-900">
            서연이에게 맞는 영상
          </h1>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-gray-600">
            14편 시청 · 87% 평균 완주율 · 다음 영상이 더 잘 맞춰지고 있어요.
          </p>
        </header>

        <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-500">주제</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={topic === null} onClick={() => setTopic(null)}>전체</Chip>
                {(['science', 'english', 'hangul'] as DemoTopic[]).map((t) => (
                  <Chip key={t} active={topic === t} onClick={() => setTopic(t)}>{TOPIC_LABEL[t]}</Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-500">연령</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={age === null} onClick={() => setAge(null)}>전체</Chip>
                {([5, 6, 7] as const).map((a) => (
                  <Chip key={a} active={age === a} onClick={() => setAge(a)}>{a}세</Chip>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Continue watching strip */}
        {(!topic && !age) && (
          <section className="mb-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-bold text-gray-900">이어서 보기</h2>
              <span className="text-[11px] font-semibold text-violet-500">최근 시청</span>
            </div>
            <div className="-mx-6 overflow-x-auto px-6">
              <div className="flex gap-3 pb-1">
                {VIDEOS.filter((v) => v.watched).slice(0, 4).map((v) => (
                  <div key={`recent-${v.id}`} className="flex-shrink-0 w-[180px]">
                    <Card video={v} compact />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Main grid */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-gray-900">
              {topic || age ? '필터 결과' : '추천 영상'}
            </h2>
            <span className="text-[11px] font-semibold text-gray-500">{filtered.length}편</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((v) => (
              <Card key={v.id} video={v} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-full px-3 py-2 text-xs font-semibold transition ${
        active ? 'bg-violet-500 text-white' : 'bg-violet-50 text-violet-600 hover:bg-violet-100'
      }`}
    >
      {children}
    </button>
  );
}

function Card({ video, compact = false }: { video: DemoVideo; compact?: boolean }) {
  const minutes = Math.floor(video.duration_sec / 60);
  const seconds = video.duration_sec % 60;
  const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="block overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-video bg-violet-50">
        {video.thumbnailReal ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailReal} alt={video.title} className="h-full w-full object-cover" />
        ) : (
          <DemoThumb topic={video.topic} style={video.style} seed={video.seed} className="h-full w-full" />
        )}
        <div className="absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          {duration}
        </div>
        {video.episode_unit_sec === 90 && (
          <div className="absolute top-2 left-2 rounded-md bg-violet-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
            EP
          </div>
        )}
        {video.badge === 'new' && (
          <div className="absolute top-2 right-2 rounded-md bg-gentle px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
            NEW
          </div>
        )}
        {video.badge === 'hot' && (
          <div className="absolute top-2 right-2 rounded-md bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
            HOT
          </div>
        )}
        {video.badge === 'continue' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
            <div className="h-full bg-violet-500" style={{ width: '64%' }} />
          </div>
        )}
        {video.watched && !video.badge && (
          <div className="absolute top-2 left-2 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 shadow-sm">
            ✓ 시청
          </div>
        )}
      </div>
      <div className={compact ? 'p-2.5' : 'p-3'}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">
          {TOPIC_LABEL[video.topic]} · {video.age_band}세
        </p>
        <h3 className={`mt-1 line-clamp-2 font-bold leading-snug text-gray-900 ${compact ? 'text-[13px]' : 'text-sm'}`}>
          {video.title}
        </h3>
        {!compact && (
          <div className="mt-2 flex flex-wrap gap-1">
            {video.style_tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
