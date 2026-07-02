// npx tsx --env-file=.env.local scripts/seed-library.ts
// 재실행 안전 (on conflict do nothing 패턴 - 같은 title+topic+age_band 조합은 중복 안 됨).

import { getSupabase } from '../src/lib/supabase';
import type { LibraryVideo } from '../src/types/library';

type LibrarySeed = Omit<LibraryVideo, 'id' | 'view_count' | 'created_at'>;

const stubLibrary: LibrarySeed[] = [
  // 실제 재생 가능한 모리 동물마을 영상(번들 자산). 운영자가 이 스크립트를 돌리면
  // /library 에 진짜 published 영상이 1편 들어간다 — "발행 가능 경로"의 실동작 예시.
  // (옛 브랜드 '미리' stub-*.mp4 더미 8편은 전부 404라 P1-4로 삭제. 라이브러리 신규 콘텐츠는
  //  generate-library-* 파이프라인 산출물을 publish 하여 채운다.)
  {
    title: '모리와 사라진 반짝빛',
    description: '별빛 축제 아침, 꾸미의 반짝빛이 사라졌어요. 모리와 함께 단서를 찾아볼까요?',
    topic: 'animal-village',
    age_band: 5,
    style_tags: ['mori', 'animal-village'],
    duration_sec: 15,
    video_url: '/demo-videos/mori-starlight-seed.mp4',
    thumbnail_url: '/ip/generated/mori-village-hero.png',
    subtitles_url: '/demo-videos/mori-starlight-seed.vtt',
    c6_focus: 'observe',
    character_name: '모리',
    published: true,
    featured: true,
  },
];

async function main() {
  const supabase = getSupabase();

  for (const row of stubLibrary) {
    const { error } = await supabase
      .from('library_videos')
      .upsert(row, {
        onConflict: 'title,topic,age_band',
        ignoreDuplicates: true,
      });

    if (error) {
      console.error(`Failed to seed: ${row.title}`, error);
      process.exit(1);
    }
  }

  console.log(`Seeded ${stubLibrary.length} library videos`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
