import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { NanoBananaProvider } from '../src/lib/video-providers/nano-banana';

for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(0);
    throw error;
  });
}

const COST_PER_IMAGE_USD = 0.039;
const OUT_DIR = resolve(process.cwd(), 'tmp', 'avatar-samples');
const APPROVED_FRAMES_DIR = resolve(process.cwd(), 'src', 'content', 'studio', 'approved-frames');

type BaseSpec = {
  id: 1 | 2 | 3;
  name: string;
  body: string;
  hair: string;
};

type PaletteSpec = {
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  name: string;
  outfitHex: string;
  hairHex: string;
};

type CompanionSpec = {
  id: 1 | 2 | 3 | 4 | 5 | 6;
  nameKo: string;
  nameEn: string;
  visual: string;
  referenceFile: string;
};

type SampleCombo = {
  base: BaseSpec['id'];
  palette: PaletteSpec['id'];
  companion: CompanionSpec['id'];
};

const BASES: Record<BaseSpec['id'], BaseSpec> = {
  1: {
    id: 1,
    name: 'round leaf hair',
    body: 'smallest chibi body, wide rounded torso, short arms and stable little feet',
    hair: 'two overlapping rounded leaf-like bangs, soft silhouette, no sharp spikes',
  },
  2: {
    id: 2,
    name: 'cloud bob',
    body: 'medium chibi body, plush head volume, short neck, warm soft toy proportions',
    hair: 'cloud-like rounded bob hair with gentle side volume, not realistic hair strands',
  },
  3: {
    id: 3,
    name: 'sprout ponytail',
    body: 'active chibi balance, slightly taller rounded torso, tiny round hands',
    hair: 'one small rounded sprout ponytail with short side hair, soft and child-safe',
  },
};

const PALETTES: Record<PaletteSpec['id'], PaletteSpec> = {
  1: { id: 1, name: 'Cream Sage', outfitHex: '#F4EAD2', hairHex: '#46763F' },
  2: { id: 2, name: 'Surface Moss', outfitHex: '#FBF7EC', hairHex: '#2E5129' },
  3: { id: 3, name: 'Sage Soft', outfitHex: '#E4EDDF', hairHex: '#93B589' },
  4: { id: 4, name: 'Kindy Cream', outfitHex: '#FBF7EF', hairHex: '#5F735F' },
  5: { id: 5, name: 'Warm Wood', outfitHex: '#E3D8C8', hairHex: '#3F5140' },
  6: { id: 6, name: 'Gentle Heart', outfitHex: '#DDE8DE', hairHex: '#83A58D' },
  7: { id: 7, name: 'Gold Point', outfitHex: '#D19A43', hairHex: '#EEE5D4' },
  8: { id: 8, name: 'Living Ink', outfitHex: '#AFC4AE', hairHex: '#233126' },
};

const COMPANIONS: Record<CompanionSpec['id'], CompanionSpec> = {
  1: {
    id: 1,
    nameKo: '여우',
    nameEn: 'fox',
    visual: 'rounded fox ears, plush tail, tiny sage ribbon accent, friendly non-predator expression',
    referenceFile: '20260703-cast-naong.png',
  },
  2: {
    id: 2,
    nameKo: '고래',
    nameEn: 'whale',
    visual: 'small round baby whale companion, soft sage back, cream belly, floating gently like a toy',
    referenceFile: '20260703-cast-kkumi.png',
  },
  3: {
    id: 3,
    nameKo: '부엉이',
    nameEn: 'owl',
    visual: 'round owl companion with glasses-like eyes, knitted scarf, calm bedtime-story presence',
    referenceFile: '20260703-cast-owl.png',
  },
  4: {
    id: 4,
    nameKo: '토끼',
    nameEn: 'rabbit',
    visual: 'rounded folded long ears, lively rabbit body, tiny gold point charm',
    referenceFile: '20260703-cast-bangul.png',
  },
  5: {
    id: 5,
    nameKo: '거북',
    nameEn: 'turtle',
    visual: 'round shell, slow gentle smile, subtle leaf pattern on shell, no sharp edges',
    referenceFile: '20260703-cast-mori.png',
  },
  6: {
    id: 6,
    nameKo: '다람쥐',
    nameEn: 'squirrel',
    visual: 'small squirrel hugging a fluffy tail, one acorn prop at most, timid brave smile',
    referenceFile: '20260703-cast-doto.png',
  },
};

const SAMPLE_COMBOS: SampleCombo[] = [
  { base: 1, palette: 1, companion: 1 },
  { base: 2, palette: 4, companion: 3 },
  { base: 3, palette: 8, companion: 6 },
];

const NEGATIVE_PROMPT = [
  'photorealistic',
  'realistic human',
  'child photo',
  'camera capture',
  'skin pores',
  'real hair strands',
  'DSLR portrait',
  'uncanny realism',
  '3D glossy plastic',
  'porcelain',
  'scary',
  'horror',
  'dark shadows',
  'villain',
  'predator',
  'sharp teeth',
  'letter above head',
  'floating letters',
  'any text',
  'watermark',
  'logo',
].join(', ');

function comboKey(combo: SampleCombo): string {
  return `b${combo.base}-p${combo.palette}-c${combo.companion}`;
}

function referencePath(companion: CompanionSpec): string {
  return join(APPROVED_FRAMES_DIR, companion.referenceFile);
}

function buildPrompt(combo: SampleCombo): string {
  const base = BASES[combo.base];
  const palette = PALETTES[combo.palette];
  const companion = COMPANIONS[combo.companion];

  return `Create one 16:9 still keyframe for the E13-1 avatar sample combo ${comboKey(combo)}.

STYLE:
KINDYTOY style soft matte designer toy, velvet flocking texture, zero glossy shine, chibi proportions, large round eyes with warm catchlight, toothless gentle smile, warm daylight and lantern glow, miniature storybook forest village diorama.

AVATAR BASE:
Base ${base.id} ${base.name}. Body: ${base.body}. Hair silhouette: ${base.hair}.

PALETTE:
Palette ${palette.id} ${palette.name}. Outfit main color ${palette.outfitHex}. Hair color ${palette.hairHex}. Keep the look within the cream and sage KINDY palette.

COMPANION:
Companion ${companion.id} ${companion.nameEn} (${companion.nameKo}). ${companion.visual}.

COMPOSITION:
The avatar and companion stand together as premium toy friends on a child-room shelf that opens into Mori's story forest. Full-body readable silhouettes, clean production still, no labels.

NEGATIVE:
${NEGATIVE_PROMPT}`;
}

function assertReferencesExist(): void {
  for (const combo of SAMPLE_COMBOS) {
    const companion = COMPANIONS[combo.companion];
    const path = referencePath(companion);
    if (!existsSync(path)) {
      throw new Error(`Missing approved-frame reference for ${comboKey(combo)}: ${path}`);
    }
  }
}

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN?.toLowerCase() === 'true';
  assertReferencesExist();

  console.log(`E13-1 avatar samples ${dryRun ? 'DRY_RUN' : 'GENERATE'} mode`);
  console.log(`output_dir=${OUT_DIR}`);
  console.log(`estimated_cost_usd=${(SAMPLE_COMBOS.length * COST_PER_IMAGE_USD).toFixed(3)}`);

  if (dryRun) {
    for (const combo of SAMPLE_COMBOS) {
      const companion = COMPANIONS[combo.companion];
      const prompt = buildPrompt(combo);
      console.log('\n--- dry prompt ---');
      console.log(`combo=${comboKey(combo)}`);
      console.log(`reference=${referencePath(companion)}`);
      console.log(`prompt=${prompt}`);
    }
    return;
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is required unless DRY_RUN=1. The key value is never printed.');
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const nano = new NanoBananaProvider(apiKey);
  let totalCostUsd = 0;

  for (const combo of SAMPLE_COMBOS) {
    const key = comboKey(combo);
    const companion = COMPANIONS[combo.companion];
    const outPath = join(OUT_DIR, `${key}.png`);
    const result = await nano.generateImageFromFiles(buildPrompt(combo), [referencePath(companion)], '16:9');
    writeFileSync(outPath, result.bytes);
    totalCostUsd += result.costUsd;
    console.log(`generated combo=${key} file=${outPath} cost_usd=${result.costUsd.toFixed(3)}`);
  }

  console.log(`done total_cost_usd=${totalCostUsd.toFixed(3)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
