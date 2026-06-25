import { readFileSync, writeFileSync } from 'node:fs';
import { NanoBananaProvider } from '../src/lib/video-providers/nano-banana';

function getKey(): string {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  const m = env.match(/^GOOGLE_API_KEY=(.*)$/m);
  if (!m) throw new Error('GOOGLE_API_KEY not found in .env.local');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

const MOOD_BASE = `Use the attached reference image. SAME EXACT character: a cream and sage-green fuzzy book-spirit designer art toy with big upright folded book-page ears, big bright clever eyes, a small scarf, and a glowing heart on its body. Keep its design, proportions, ears, scarf, body colors and identity IDENTICAL to the reference. Front view, full body, single character, plain soft studio background tinted to match the mood, premium plush-and-vinyl finish, no text except one faint floating letter or sparkle.
Change ONLY the MOOD and the heart-glow / ambient aura color as follows: `;

const VARIANTS: Record<string, string> = {
  m_gentle: MOOD_BASE + `차분/gentle — calm, serene, sleepy-peaceful. Heart glow and soft ambient aura in soft sky-blue and mint. Expression: eyes softly half-closed, a tender peaceful little smile.`,
  m_lively: MOOD_BASE + `신나는/lively — cheerful, excited, playful and energetic. Heart glow and aura in warm sunny yellow and coral. Expression: bright wide happy eyes, a delighted lively smile, ears perked up high.`,
  m_mystery: MOOD_BASE + `모험/mystery — curious, wonder-struck, adventurous. Heart glow and aura in deep violet and indigo with tiny sparkling stars around. Expression: big sparkling wide eyes full of wonder, an intrigued excited smile.`,
  m_warm: MOOD_BASE + `포근/warm — cozy, tender, loving, comforting. Heart glow and aura in soft pink and peach. Expression: warm gentle eyes, a sweet caring snuggly smile.`,
};

const variant = process.env.IP_VARIANT || 'm_gentle';
const prompt = (process.env.IP_PROMPT_FILE ? readFileSync(process.env.IP_PROMPT_FILE, 'utf8') : null) || process.env.IP_PROMPT || VARIANTS[variant] || MOOD_BASE;
const refs = process.argv.slice(2);
const out = process.env.OUT || '/tmp/ip-out.png';
const aspect = (process.env.ASPECT as '1:1' | '16:9') || '1:1';

(async () => {
  const nano = new NanoBananaProvider(getKey());
  const { bytes, mimeType, costUsd } = await nano.generateImageFromFiles(prompt, refs, aspect);
  writeFileSync(out, bytes);
  console.log(`saved ${out} (variant=${variant}, ${mimeType}, $${costUsd}, refs=${refs.length})`);
})().catch((e) => { console.error('ERR', e?.message || e); process.exit(1); });
