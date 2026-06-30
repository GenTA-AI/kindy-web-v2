// 누끼(배경 제거) via fal. usage: npx tsx scripts/cutout.ts <in.png> <out.png>
import { readFileSync, writeFileSync } from 'node:fs';
import { fal } from '@fal-ai/client';

function getKey(): string {
  if (process.env.FAL_KEY?.trim()) return process.env.FAL_KEY.trim();
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  const m = env.match(/^FAL_KEY=(.*)$/m);
  if (!m) throw new Error('FAL_KEY not found in .env.local');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) { console.error('usage: cutout.ts <in> <out>'); process.exit(1); }

fal.config({ credentials: getKey() });
const dataUri = `data:image/png;base64,${readFileSync(input).toString('base64')}`;
const MODEL = process.env.FAL_BG_MODEL || 'fal-ai/birefnet/v2';

type FalBackgroundResult = {
  data?: {
    image?: { url?: string };
    images?: Array<{ url?: string }>;
  };
  image?: { url?: string };
};

(async () => {
  const r = await fal.subscribe(MODEL, { input: { image_url: dataUri } }) as FalBackgroundResult;
  const url = r?.data?.image?.url || r?.image?.url || r?.data?.images?.[0]?.url;
  if (!url) { console.error('no image url. result=', JSON.stringify(r).slice(0, 500)); process.exit(1); }
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(output, buf);
  console.log(`saved ${output} (${buf.length} bytes) via ${MODEL}`);
})().catch((e) => { console.error('ERR', e?.message || e); process.exit(1); });
