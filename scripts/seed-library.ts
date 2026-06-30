// npx tsx --env-file=.env.local scripts/seed-library.ts
// 재실행 안전 (on conflict do nothing 패턴 - 같은 title+topic+age_band 조합은 중복 안 됨).

import { getSupabase } from '../src/lib/supabase';
import type { LibraryVideo } from '../src/types/library';

type LibrarySeed = Omit<LibraryVideo, 'id' | 'view_count' | 'created_at'>;

const stubLibrary: LibrarySeed[] = [
  // 실제 재생 가능한 모리 동물마을 영상(번들 자산). 운영자가 이 스크립트를 돌리면
  // /library 에 진짜 published 영상이 1편 들어간다 — "발행 가능 경로"의 실동작 예시.
  // 아래 'stub-*' GCS URL 항목들은 옛 브랜드(미리) 더미 — 실콘텐츠로 교체 대상.
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
    character_name: '모리',
    published: true,
    featured: true,
  },
  {
    title: '미리와 함께하는 별자리 이야기',
    description: '북두칠성을 따라가며 별의 모양을 배워봐요',
    topic: 'science',
    age_band: 6,
    style_tags: ['space', 'kpop'],
    duration_sec: 120,
    video_url: 'https://storage.googleapis.com/kindy-library/stub-space-stars.mp4',
    thumbnail_url: 'https://storage.googleapis.com/kindy-library/stub-space-stars.jpg',
    character_name: '미리',
    published: true,
    featured: true,
  },
  {
    title: '공주 미리와 ABC 모험',
    description: '왕자와 공주가 알파벳을 찾아나서요',
    topic: 'english',
    age_band: 5,
    style_tags: ['princess'],
    duration_sec: 90,
    video_url: 'https://storage.googleapis.com/kindy-library/stub-princess-abc.mp4',
    thumbnail_url: null,
    character_name: '미리',
    published: true,
    featured: false,
  },
  {
    title: '로켓 타고 떠나는 태양계',
    description: '수성부터 해왕성까지 행성 이름과 특징을 익혀요',
    topic: 'science',
    age_band: 7,
    style_tags: ['space', 'adventure'],
    duration_sec: 150,
    video_url: 'https://storage.googleapis.com/kindy-library/stub-solar-system.mp4',
    thumbnail_url: 'https://storage.googleapis.com/kindy-library/stub-solar-system.jpg',
    character_name: '미리',
    published: true,
    featured: true,
  },
  {
    title: '리듬으로 배우는 색깔 영어',
    description: '노래에 맞춰 red, blue, yellow 를 말해봐요',
    topic: 'english',
    age_band: 6,
    style_tags: ['kpop', 'music'],
    duration_sec: 105,
    video_url: 'https://storage.googleapis.com/kindy-library/stub-color-english.mp4',
    thumbnail_url: 'https://storage.googleapis.com/kindy-library/stub-color-english.jpg',
    character_name: '미리',
    published: true,
    featured: false,
  },
  {
    title: '한글 숲에서 찾은 ㄱㄴㄷ',
    description: '숲속 친구들과 기본 자음을 하나씩 찾아요',
    topic: 'hangul',
    age_band: 5,
    style_tags: ['forest', 'animals'],
    duration_sec: 95,
    video_url: 'https://storage.googleapis.com/kindy-library/stub-hangul-forest.mp4',
    thumbnail_url: 'https://storage.googleapis.com/kindy-library/stub-hangul-forest.jpg',
    character_name: '미리',
    published: true,
    featured: true,
  },
  {
    title: '바닷속 숫자 탐험',
    description: '물고기와 조개를 세며 1부터 10까지 익혀요',
    topic: 'math',
    age_band: 5,
    style_tags: ['ocean', 'adventure'],
    duration_sec: 100,
    video_url: 'https://storage.googleapis.com/kindy-library/stub-ocean-numbers.mp4',
    thumbnail_url: 'https://storage.googleapis.com/kindy-library/stub-ocean-numbers.jpg',
    character_name: '미리',
    published: true,
    featured: false,
  },
  {
    title: '한글 파티 받침 놀이',
    description: '케이크와 풍선 속 받침 글자를 재미있게 읽어요',
    topic: 'hangul',
    age_band: 6,
    style_tags: ['party', 'kpop'],
    duration_sec: 115,
    video_url: 'https://storage.googleapis.com/kindy-library/stub-hangul-party.mp4',
    thumbnail_url: null,
    character_name: '미리',
    published: true,
    featured: false,
  },
  {
    title: '공룡 박사의 화석 수업',
    description: '화석이 어떻게 생기는지 공룡 발자국을 따라 배워요',
    topic: 'science',
    age_band: 5,
    style_tags: ['dinosaur', 'adventure'],
    duration_sec: 130,
    video_url: 'https://storage.googleapis.com/kindy-library/stub-dinosaur-fossil.mp4',
    thumbnail_url: 'https://storage.googleapis.com/kindy-library/stub-dinosaur-fossil.jpg',
    character_name: '미리',
    published: true,
    featured: false,
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
