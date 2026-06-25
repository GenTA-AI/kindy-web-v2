/**
 * 스모크 6: Video Extension 으로 30s 체이닝.
 *
 * 입력:
 *   - tmp/smoke/native15s/final_standard_15s.mp4 (1st 15s)
 *   - tmp/smoke/script.json (씬 s03~s05 내용을 2nd 15s 로 압축)
 *   - tmp/smoke/nano/miri_ref.png
 *
 * 과정:
 *   1) 1st 15s 영상을 video_urls 로 재주입 (@Video1)
 *   2) miri_ref + (옵션) 1st 영상 마지막 프레임을 image_urls 로 주입
 *   3) Seedance 2.0 reference-to-video 로 2nd 15s 생성
 *   4) ffmpeg concat → 30s 최종
 *
 * 실행:
 *   npm run smoke:extend15s
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync, createWriteStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { Seedance2Provider, type SeedanceTier } from '../src/lib/video-providers/seedance2';
import {
  getSceneDialogue,
  resolveSceneLocation,
  type VideoScript,
} from '../src/lib/video-providers/director.types';

const TIER = (process.env.SEEDANCE_TIER ?? 'standard') as SeedanceTier;
const TARGET_DURATION_SEC = 15; // 2번째 chunk 길이

async function downloadToFile(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed ${res.status} ${url}`);
  const fileStream = createWriteStream(outPath);
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), fileStream);
}

function extractLastFrame(videoPath: string, outPath: string): void {
  const r = spawnSync('ffmpeg', [
    '-y', '-v', 'error',
    '-sseof', '-0.1',
    '-i', videoPath,
    '-vframes', '1', '-q:v', '2',
    outPath,
  ], { encoding: 'utf-8' });
  if (r.status !== 0) throw new Error(`ffmpeg last-frame extract failed: ${r.stderr}`);
}

function ffConcat(inputs: string[], outPath: string): void {
  // re-encode 후 concat demuxer 로 안정적 합성
  const normalized: string[] = [];
  for (const clip of inputs) {
    const norm = clip.replace(/\.mp4$/, '.norm.mp4');
    const r = spawnSync('ffmpeg', [
      '-y', '-v', 'error',
      '-i', clip,
      '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '24',
      '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2',
      norm,
    ], { encoding: 'utf-8' });
    if (r.status !== 0) throw new Error(`normalize ${clip} failed: ${r.stderr}`);
    normalized.push(norm);
  }
  const listPath = outPath.replace(/\.mp4$/, '.list.txt');
  writeFileSync(listPath, normalized.map((n) => `file '${n}'`).join('\n'), 'utf-8');
  const r = spawnSync('ffmpeg', [
    '-y', '-v', 'error',
    '-f', 'concat', '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    outPath,
  ], { encoding: 'utf-8' });
  if (r.status !== 0) throw new Error(`concat failed: ${r.stderr}`);
}

/** 2번째 chunk 프롬프트 — 3~5씬 (cloud → rain → pond) 을 15s 로 압축 */
function buildExtensionPrompt(script: VideoScript, main: { displayName: string }): string {
  const styleDirective = Array.isArray(script.styleDirectives)
    ? script.styleDirectives.join(', ')
    : script.styleDirectives;

  // script.scenes[2..4] 를 연속 beat 로
  const tailScenes = script.scenes.slice(2);
  let elapsed = 0;
  const beats: string[] = [];
  const dialogues: string[] = [];
  for (const sc of tailScenes) {
    const loc = resolveSceneLocation(script, sc.location);
    const dial = getSceneDialogue(sc);
    const segEnd = elapsed + sc.durationSec;
    beats.push(
      `${elapsed}–${segEnd}s [${loc || sc.id}]: ${sc.action ?? ''} Camera: ${sc.camera ?? ''}. ${sc.effects ? `Effects: ${sc.effects}.` : ''} ${dial ? `Miri speaks naturally in Korean: "${dial.text}"` : ''}`
    );
    if (dial) dialogues.push(dial.text);
    elapsed = segEnd;
  }
  const fullDialogue = dialogues.join(' ');
  const checklist = (script.consistencyChecklist ?? [])
    .map((c) => typeof c === 'string' ? `- ${c}` : `- ${String(c)}`)
    .join('\n');

  return `[Top-level cinematic statement]
${script.topLevelPrompt}

Style: ${styleDirective}
Tone: ${script.toneAndMood}

[Continuation of previous 15-second clip — ${TARGET_DURATION_SEC}s single take, NO cut]

@Video1 is the previous 15-second clip that just ended. This new clip begins IMMEDIATELY where @Video1 ended, preserving the same character design, color palette, art style, and voice of ${main.displayName}. Treat this as the second half of one continuous film — no reset, no re-introduction, no new title.

@Image1 is the definitive character design bible for ${main.displayName} (8-year-old Korean girl, K-pop idol style, high ponytail with sky-blue water-drop hairpin, sky-blue/white hooded dress with cloud embroidery, yellow rain boots, water-drop pendant, clearly defined pink lips with visible teeth when talking). Miri MUST look identical to this bible and to her appearance in @Video1.

@Image2 is the exact last frame of @Video1 (t=0 of this new clip). Begin from this frame.

Voice continuity: Miri's voice MUST sound identical to her voice in @Video1 — same bright, lively 7-8 year old Korean girl's voice, same cadence, same timbre. Lip-sync precisely to her Korean speech.

Narrative beats (compressed into ${TARGET_DURATION_SEC}s continuous motion, no cuts — this continues the water cycle journey from cloud → rain → pond):
${beats.join('\n')}

Full Korean dialogue spoken in sequence during this clip:
"${fullDialogue}"

Camera philosophy: single-take dreamy continuous movement. No hard cuts, transitions via camera movement and environment morphing.

Consistency rules (must hold across every frame AND match @Video1):
${checklist}

Cinematic 2D cel animation with soft watercolor backgrounds, pastel palette, Pinkfong-level kid-friendly warmth, single-take. Character's face and mouth remain clearly visible during speech. No text, no subtitles, no watermarks. 16:9 aspect ratio.`;
}

async function main() {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY missing');

  const scriptPath = join(process.cwd(), 'tmp', 'smoke', 'script.json');
  const script: VideoScript = JSON.parse(readFileSync(scriptPath, 'utf-8'));

  const firstClipPath = join(process.cwd(), 'tmp', 'smoke', 'native15s', 'final_standard_15s.mp4');
  const refPath = join(process.cwd(), 'tmp', 'smoke', 'nano', 'miri_ref.png');
  if (!existsSync(firstClipPath)) throw new Error(`Missing 1st clip: ${firstClipPath}`);
  if (!existsSync(refPath)) throw new Error(`Missing ref: ${refPath}`);

  const outDir = join(process.cwd(), 'tmp', 'smoke', 'extend30s');
  mkdirSync(outDir, { recursive: true });

  // 1) 1st 영상 last frame 추출 → 2nd 영상 @Image2 로 활용
  const lastFramePath = join(outDir, 'first_clip_last_frame.jpg');
  console.log('='.repeat(70));
  console.log(`  스모크 6: Video Extension 으로 30s 체이닝`);
  console.log('='.repeat(70));
  console.log(`1st clip: ${firstClipPath}`);
  console.log(`[prep] 마지막 프레임 추출...`);
  extractLastFrame(firstClipPath, lastFramePath);
  console.log(`      ✓ ${lastFramePath}\n`);

  // 2) Seedance 2nd call with video_urls + image_urls
  const main = script.characters[0];
  const prompt = buildExtensionPrompt(script, main);
  writeFileSync(join(outDir, 'prompt.txt'), prompt, 'utf-8');

  const expectedCost = TARGET_DURATION_SEC * 0.3024 * 0.6;
  console.log(`[1/2] Seedance 2.0 video extension (duration=${TARGET_DURATION_SEC}s, tier=${TIER})...`);
  console.log(`      @Video1: ${firstClipPath.split('/').pop()}`);
  console.log(`      @Image1: miri_ref.png`);
  console.log(`      @Image2: first_clip_last_frame.jpg`);
  console.log(`      오디오: Seedance 내부 TTS 사용 (generate_audio=true)`);
  console.log(`      예상 비용 (0.6x 할인 적용): $${expectedCost.toFixed(3)}`);
  console.log(`      생성 중 (120~240초 소요)...\n`);

  const t0 = Date.now();
  const seedance = new Seedance2Provider(falKey);
  const result = await seedance.generateFromFiles({
    prompt,
    imageFilePaths: [refPath, lastFramePath],
    videoFilePaths: [firstClipPath],
    durationSec: TARGET_DURATION_SEC,
    resolution: '720p',
    aspectRatio: '16:9',
    generateAudio: true,
    tier: TIER,
  });

  const secondClipPath = join(outDir, `second_${TIER}_${TARGET_DURATION_SEC}s.mp4`);
  await downloadToFile(result.videoUrl, secondClipPath);
  const s2size = (readFileSync(secondClipPath).length / (1024 * 1024)).toFixed(2);
  console.log(`\n      ✓ ${secondClipPath} (${s2size} MB)`);
  console.log(`      비용: $${result.costUsd.toFixed(3)}`);
  console.log(`      seed: ${result.seed ?? '(none returned)'}`);
  console.log(`      request_id: ${result.requestId ?? '(none)'}`);
  console.log(`      소요: ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  // 3) ffmpeg concat 1st + 2nd → 30s
  console.log(`[2/2] ffmpeg concat 1st + 2nd → 30s final...`);
  const finalPath = join(outDir, `final_30s_${TIER}.mp4`);
  ffConcat([firstClipPath, secondClipPath], finalPath);
  const finalSize = (readFileSync(finalPath).length / (1024 * 1024)).toFixed(2);
  console.log(`      ✓ ${finalPath} (${finalSize} MB)\n`);

  // 리포트
  writeFileSync(join(outDir, `report_${TIER}.json`), JSON.stringify({
    firstClip: firstClipPath,
    secondClip: secondClipPath,
    finalVideo: finalPath,
    extensionDurationSec: TARGET_DURATION_SEC,
    tier: TIER,
    costUsd: result.costUsd,
    videoUrl: result.videoUrl,
    requestId: result.requestId,
    seed: result.seed,
    elapsedMs: result.elapsedMs,
  }, null, 2), 'utf-8');

  console.log('─'.repeat(70));
  console.log(`  💰 Extension 비용: $${result.costUsd.toFixed(3)}`);
  console.log(`  ⏱  생성 시간: ${(result.elapsedMs / 1000).toFixed(1)}s`);
  console.log('─'.repeat(70));
  console.log(`\n영상 확인:`);
  console.log(`  open ${finalPath}`);
  console.log(`\n검증 포인트:`);
  console.log(`  1. Voice drift — 15초 전후 미리 목소리 동일 느낌?`);
  console.log(`  2. 캐릭터 디자인 동일성 — 의상/헤어/얼굴 변화 있는지?`);
  console.log(`  3. 컬러 그레이드 연속성 — 팔레트/조명 점프 있는지?`);
  console.log(`  4. 씬 전환 자연스러움 — 15초 경계에서 컷 느낌 나는지?`);
}

main().catch((e) => {
  console.error('\n❌ 실패:', e);
  process.exit(1);
});
