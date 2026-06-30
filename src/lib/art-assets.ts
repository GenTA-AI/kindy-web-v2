export const MORI_IMAGE_SRC = '/ip/mori-reference-no-a.jpg';

export const HERO_VILLAGE_IMAGE_SRC = '/ip/generated/mori-village-hero.png';

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
