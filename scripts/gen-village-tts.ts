// 동물 마을 음성 사전 생성 — 각 voice line → Gemini TTS 아동 음성 → public/audio/village/<id>.{mp3|wav}
//
// 실행:
//   npx tsx --env-file=.env.local scripts/gen-village-tts.ts
//   FORCE=1 로 기존 파일 무시하고 재생성. ONLY=<idprefix> 로 일부만.
//
// 산출:
//   public/audio/village/<id>.mp3 (ffmpeg 있으면) 또는 .wav
//   src/data/worlds/animal-village-voice.json  ({ id: { file, durationSec } })

import 'dotenv/config';

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { collectVoiceLines } from '@/data/worlds/animal-village';
import { GeminiTtsProvider } from '@/lib/video-providers/gemini-tts';
import { resolveVoiceCasting, resolveVoiceStyle } from '@/content/studio/animal-village-bible';
import type { EpisodeVoiceEmotion } from '@/lib/video-providers/director.types';

const OUT_DIR = join(process.cwd(), 'public', 'audio', 'village');
const MANIFEST_PATH = join(process.cwd(), 'src', 'data', 'worlds', 'animal-village-voice.json');

interface ManifestEntry {
  file: string; // public 기준 경로 (예: /audio/village/act.read_face.intro.mp3)
  durationSec: number;
}

type Manifest = Record<string, ManifestEntry>;

function hasFfmpeg(): boolean {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf-8' });
  return r.status === 0;
}

/** WAV → mp3 변환(용량↓). 실패 시 false. */
function convertToMp3(wavPath: string, mp3Path: string): boolean {
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-qscale:a', '4', mp3Path],
    { encoding: 'utf-8' },
  );
  return r.status === 0 && existsSync(mp3Path);
}

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY 또는 GEMINI_API_KEY가 .env.local에 필요합니다.');
  }

  const force = process.env.FORCE === '1';
  const onlyPrefix = process.env.ONLY ?? '';
  mkdirSync(OUT_DIR, { recursive: true });

  const ffmpeg = hasFfmpeg();
  const ext = ffmpeg ? 'mp3' : 'wav';
  console.log(`[gen-village-tts] ffmpeg=${ffmpeg ? 'yes (mp3)' : 'no (wav)'} · 출력=${OUT_DIR}`);

  const provider = new GeminiTtsProvider(apiKey);
  const lines = collectVoiceLines().filter((l) => !onlyPrefix || l.id.startsWith(onlyPrefix));

  // 기존 매니페스트는 보존하며 갱신.
  const manifest: Manifest = existsSync(MANIFEST_PATH)
    ? (JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as Manifest)
    : {};

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const line of lines) {
    const finalRel = `/audio/village/${line.id}.${ext}`;
    const wavPath = join(OUT_DIR, `${line.id}.wav`);
    const finalPath = join(OUT_DIR, `${line.id}.${ext}`);

    if (!force && existsSync(finalPath) && manifest[line.id]) {
      skipped += 1;
      continue;
    }

    try {
      const emotion = voiceEmotionForLineId(line.id);
      const casting = resolveVoiceCasting(line.characterId);
      const style = resolveVoiceStyle(line.characterId, emotion);
      const { wavBytes, durationSec } = await provider.generateTtsToBuffer(line.text, casting.voice, style);
      writeFileSync(wavPath, wavBytes);

      let outFile = finalRel;
      if (ffmpeg) {
        const mp3Path = join(OUT_DIR, `${line.id}.mp3`);
        if (convertToMp3(wavPath, mp3Path)) {
          // wav 삭제(용량↓) — mp3 만 보관.
          spawnSync('rm', ['-f', wavPath]);
        } else {
          outFile = `/audio/village/${line.id}.wav`;
        }
      }

      manifest[line.id] = { file: outFile, durationSec: Number(durationSec.toFixed(2)) };
      generated += 1;
      console.log(`  ✓ ${line.id} [${casting.voice}/${emotion}] ${durationSec.toFixed(1)}s — ${line.text.slice(0, 24)}…`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${line.id} 실패:`, err instanceof Error ? err.message : err);
    }

    // 레이트 리밋 완화.
    await new Promise((r) => setTimeout(r, 300));
  }

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[gen-village-tts] 완료 · 생성 ${generated} · 스킵 ${skipped} · 실패 ${failed} · 매니페스트 라인 ${Object.keys(manifest).length}`,
  );
  if (failed > 0) process.exitCode = 1;
}

function voiceEmotionForLineId(id: string): EpisodeVoiceEmotion {
  if (id.startsWith('act.') && id.endsWith('.praise')) return 'excited';
  if (id.startsWith('act.') && id.endsWith('.intro')) return 'bright';
  if (id.startsWith('sess.')) return 'storytelling';
  return 'bright';
}

main().catch((err) => {
  console.error('[gen-village-tts] 치명적 오류:', err);
  process.exit(1);
});
