import type { LibraryVideo } from '@/types/library';

export const MORI_IMAGE_SRC = '/ip/mori-reference-no-a.jpg';

export const HERO_VILLAGE_IMAGE_SRC = '/ip/generated/mori-village-hero.png';

/**
 * 기본 /play(동물 마을) 세션의 첫 영상 폴백.
 * 라이브러리 DB에 published animal-village 영상이 아직 없을 때, 카드 폴백 대신 번들된
 * 실제 모리 영상을 보여준다(랜딩이 약속하는 "영상 한 편"이 기본 세션에서 실재하도록).
 * 현재 자산은 15초 클립 — 75초 정식 영상 제작은 별도(fal.ai). duration_sec 은 자산 실제값.
 */
export const VILLAGE_FIRST_VIDEO_FALLBACK: LibraryVideo = {
  id: 'village-first-mori-starlight-seed',
  title: '모리와 사라진 반짝빛',
  description: '별빛 축제 아침, 꾸미의 반짝빛이 사라졌어요. 모리와 함께 단서를 찾아볼까요?',
  topic: 'animal-village',
  age_band: 5,
  style_tags: ['mori', 'animal-village'],
  duration_sec: 15,
  video_url: '/demo-videos/mori-starlight-seed.mp4',
  thumbnail_url: HERO_VILLAGE_IMAGE_SRC,
  subtitles_url: '/demo-videos/mori-starlight-seed.vtt',
  scenes: null,
  c6_focus: 'observe', // 사라진 반짝빛 단서 찾기 = 자세히 관찰하기
  episode_unit_sec: null,
  character_name: '모리',
  view_count: 0,
  published: true,
  featured: true,
  created_at: '2026-06-30T00:00:00.000Z',
};

export const TOKEN_IMAGE_SRC: Record<string, string> = {
  seed: '/ip/generated/starlight-seed.png',
  '🌱': '/ip/generated/starlight-seed.png',
  doto: '/ip/generated/squirrel-friend.png',
  squirrel: '/ip/generated/squirrel-friend.png',
  '🐿️': '/ip/generated/squirrel-friend.png',
  teddy: '/ip/generated/teddy.png',
  '🧸': '/ip/generated/teddy.png',
  gift_box: '/ip/generated/gift-box.png',
  gift: '/ip/generated/gift-box.png',
  '🎁': '/ip/generated/gift-box.png',
};

export function tokenImageSrc(token: string | null | undefined): string | null {
  if (!token) return null;
  const normalized = token.trim().replace(/\ufe0f/g, '');
  return TOKEN_IMAGE_SRC[token.trim()]
    ?? TOKEN_IMAGE_SRC[normalized]
    ?? (normalized.includes('🌱') ? TOKEN_IMAGE_SRC.seed : null)
    ?? (normalized.includes('🐿') || normalized.includes('🌰') ? TOKEN_IMAGE_SRC.squirrel : null)
    ?? (normalized.includes('🧸') ? TOKEN_IMAGE_SRC.teddy : null)
    ?? (normalized.includes('🎁') ? TOKEN_IMAGE_SRC.gift : null);
}
