import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fal } from '@fal-ai/client';

type AssetSpec = {
  id: string;
  fileName: string;
  imageSize: 'square_hd' | 'landscape_16_9' | 'portrait_4_3';
  prompt: string;
  negativePrompt?: string;
};

const ENDPOINT = process.env.FAL_IMAGE_ENDPOINT || 'fal-ai/flux/schnell';
const OUT_DIR = join(process.cwd(), 'public', 'ip', 'generated');

const STYLE =
  'Premium original Korean children app mascot art, collectible designer toy feeling, soft vinyl and plush material, warm cream and sage palette, polished commercial character design, gentle kawaii appeal, rounded simple shapes, clean lighting, no text, no logo, not copying any existing character, not Labubu, not Sanrio, not Pop Mart IP.';

const ASSETS: AssetSpec[] = [
  {
    id: 'mori-hero',
    fileName: 'mori-hero.png',
    imageSize: 'portrait_4_3',
    prompt: `${STYLE} Full body original character named Mori: a tiny book-spirit friend for 5 to 7 year old children, cream fuzzy body, sage green folded book-page ears, small sage scarf, clever kind eyes, tiny glowing heart on belly, standing calmly, subtle smile, clean warm studio background.`,
  },
  {
    id: 'mori-village-hero',
    fileName: 'mori-village-hero.png',
    imageSize: 'landscape_16_9',
    prompt: `${STYLE} A magical animal village story forest background for a children's web learning service, cozy tree houses, soft lanterns, tiny glowing seed path, gentle morning light, minimal uncluttered composition, enough negative space for headline text on the left. Background only, no character, no mascot, no animal face.`,
    negativePrompt: 'character, mascot, animal face, person, text, logo, watermark',
  },
  {
    id: 'starlight-seed',
    fileName: 'starlight-seed.png',
    imageSize: 'square_hd',
    prompt: `${STYLE} A single cute glowing starlight seed object, small green sprout with warm golden glow, centered on a clean cream background, tactile toy-like object, simple and instantly recognizable for young children.`,
  },
  {
    id: 'hidden-forest',
    fileName: 'hidden-forest.png',
    imageSize: 'landscape_16_9',
    prompt: `${STYLE} A simple hidden-object forest patch for young children, soft grass, leaves, tiny path, warm light, uncluttered, no characters, no text, designed as a calm game background.`,
  },
  {
    id: 'squirrel-friend',
    fileName: 'squirrel-friend.png',
    imageSize: 'square_hd',
    prompt: `${STYLE} Original cute squirrel friend for the animal village, shy and gentle, sage and warm brown color accents, soft toy-like 3D illustration, centered on clean cream background.`,
  },
  {
    id: 'gift-box',
    fileName: 'gift-box.png',
    imageSize: 'square_hd',
    prompt: `${STYLE} A cute blank gift box object for a kids decorating game, cream box with sage ribbon, soft toy-like 3D render, centered on clean background, object only, no face, no eyes, no character, no text.`,
    negativePrompt: 'face, eyes, mouth, character, animal, person, text, logo, watermark',
  },
  {
    id: 'balloon',
    fileName: 'balloon.png',
    imageSize: 'square_hd',
    prompt: `${STYLE} A simple red balloon toy object with a thin string, rounded soft 3D style, centered on clean cream background, object only, no face, no eyes, no character, no text.`,
    negativePrompt: 'face, eyes, mouth, character, animal, person, text, logo, watermark',
  },
  {
    id: 'teddy',
    fileName: 'teddy.png',
    imageSize: 'square_hd',
    prompt: `${STYLE} A tiny teddy bear toy object, warm beige plush, centered on clean cream background, simple plush object for a child choice card, no text.`,
    negativePrompt: 'extra character, person, text, logo, watermark',
  },
  {
    id: 'festival-bell',
    fileName: 'festival-bell.png',
    imageSize: 'square_hd',
    prompt: `${STYLE} A small festival bell object, sage green ribbon, warm golden metal, soft 3D collectible object, centered on clean cream background, object only, no face, no eyes, no character, no text.`,
    negativePrompt: 'face, eyes, mouth, character, animal, person, text, logo, watermark',
  },
];

function apiKey(): string {
  const key = process.env.FAL_KEY?.trim();
  if (!key) {
    throw new Error('FAL_KEY is required. Run with FAL_KEY set in the environment.');
  }
  return key;
}

function imageUrl(result: unknown): string {
  const data = (result as { data?: unknown }).data ?? result;
  const record = data as {
    image?: { url?: string };
    images?: Array<{ url?: string }>;
  };
  const url = record.images?.[0]?.url ?? record.image?.url;
  if (!url) {
    throw new Error(`fal response did not include an image URL: ${JSON.stringify(result).slice(0, 500)}`);
  }
  return url;
}

async function downloadToFile(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed ${res.status}: ${url}`);
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(outPath));
}

async function generateAsset(asset: AssetSpec): Promise<{ id: string; path: string; requestId?: string }> {
  const result = await fal.subscribe(ENDPOINT, {
    input: {
      prompt: asset.prompt,
      image_size: asset.imageSize,
      num_images: 1,
      output_format: 'png',
      enable_safety_checker: true,
      ...(asset.negativePrompt ? { negative_prompt: asset.negativePrompt } : {}),
    },
    logs: true,
    onQueueUpdate(update) {
      if (update.status !== 'IN_PROGRESS') return;
      for (const log of update.logs ?? []) {
        const message = (log as { message?: string }).message;
        if (message) console.log(`[fal:${asset.id}] ${message}`);
      }
    },
  });
  const url = imageUrl(result);
  const outPath = join(OUT_DIR, asset.fileName);
  await downloadToFile(url, outPath);
  return {
    id: asset.id,
    path: outPath,
    requestId: (result as { requestId?: string }).requestId,
  };
}

async function main() {
  fal.config({ credentials: apiKey() });
  mkdirSync(OUT_DIR, { recursive: true });

  const selected = new Set(process.argv.slice(2));
  const specs = selected.size > 0 ? ASSETS.filter((asset) => selected.has(asset.id)) : ASSETS;
  if (specs.length === 0) throw new Error(`No matching asset ids. Available: ${ASSETS.map((asset) => asset.id).join(', ')}`);

  const manifest: Array<{ id: string; path: string; requestId?: string }> = [];
  for (const asset of specs) {
    console.log(`Generating ${asset.id} via ${ENDPOINT}...`);
    manifest.push(await generateAsset(asset));
  }
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify({ endpoint: ENDPOINT, assets: manifest }, null, 2));
  console.log(`Saved ${manifest.length} asset(s) to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
