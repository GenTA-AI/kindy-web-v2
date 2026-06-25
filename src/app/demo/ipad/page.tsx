import { getSupabase } from '@/lib/supabase';
import IpadDemoClient from './IpadDemoClient';

export const dynamic = 'force-dynamic';

// Cloud-signed URLs for the real "공주 미리와 물의 여행" video.
// Used when the local DB has no playable row (stub data).
// Re-sign with: select video_url, thumbnail_url from library_videos
//   where topic='science' and age_band=5 and published=true limit 1;
const FALLBACK = {
  title: '공주 미리와 물의 여행',
  characterName: '미리 공주',
  topic: 'science',
  ageBand: 5,
  durationSec: 30,
  videoUrl:
    'https://lzzaiqruxxfhhalgvejb.supabase.co/storage/v1/object/sign/videos/library/00-princess-science-age5/final.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9mM2M5NDdjMy03ZDA3LTQxNjYtODEwMC0zYjc4YzJjZWYzYjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlb3MvbGlicmFyeS8wMC1wcmluY2Vzcy1zY2llbmNlLWFnZTUvZmluYWwubXA0IiwiaWF0IjoxNzc4MDc0MzM4LCJleHAiOjE3ODA2NjYzMzh9.rLYijTW407hxG5psos9ZZK-sFTzMh7ufM5_qmNV1dlU',
  thumbnailUrl:
    'https://lzzaiqruxxfhhalgvejb.supabase.co/storage/v1/object/sign/videos/library/00-princess-science-age5/thumbnail.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9mM2M5NDdjMy03ZDA3LTQxNjYtODEwMC0zYjc4YzJjZWYzYjEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlb3MvbGlicmFyeS8wMC1wcmluY2Vzcy1zY2llbmNlLWFnZTUvdGh1bWJuYWlsLmpwZyIsImlhdCI6MTc3ODA3NDMzOSwiZXhwIjoxNzgwNjY2MzM5fQ.zwoJVrbnXM2tU_t2RV6v29QpN8w-P3sJQq6FAgGEbt8',
};

function isPlayable(url: string | null | undefined): url is string {
  if (!url) return false;
  // Local stub URLs at storage.googleapis.com/kindy-library/stub-* 404
  if (url.includes('storage.googleapis.com/kindy-library/stub-')) return false;
  return true;
}

export default async function DemoIpadPage() {
  const { data } = await getSupabase()
    .from('library_videos')
    .select('title, video_url, thumbnail_url, character_name, topic, age_band, duration_sec')
    .eq('published', true)
    .eq('topic', 'science')
    .eq('age_band', 5)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const usable = data && isPlayable(data.video_url);

  return (
    <IpadDemoClient
      videoUrl={usable ? data.video_url : FALLBACK.videoUrl}
      thumbnailUrl={usable && data.thumbnail_url ? data.thumbnail_url : FALLBACK.thumbnailUrl}
      title={usable ? data.title : FALLBACK.title}
      characterName={(usable && data.character_name) || FALLBACK.characterName}
      topic={usable ? data.topic : FALLBACK.topic}
      ageBand={usable ? data.age_band : FALLBACK.ageBand}
      durationSec={usable && data.duration_sec ? data.duration_sec : FALLBACK.durationSec}
    />
  );
}
