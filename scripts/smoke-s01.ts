/**
 * 스모크 3: s01 전체 end-to-end.
 *   - Gemini TTS (s01 대사, 두리 voice=Puck)
 *   - Seedance 2.0 reference-to-video (두리 ref + s01 키프레임 + TTS → 영상)
 *   - ffmpeg 로 영상에 TTS 오디오 합성 (generate_audio=false 이므로 영상에 오디오 없음)
 *
 * 실행:
 *   npm run smoke:s01
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { GeminiTtsProvider } from '../src/lib/video-providers/gemini-tts';
import { Seedance2Provider, type SeedanceTier } from '../src/lib/video-providers/seedance2';
import {
  getSceneDialogue,
  getCharacterVoiceNote,
  resolveSceneLocation,
  type VideoScript,
  type SceneDef,
  type CharacterDef,
} from '../src/lib/video-providers/director.types';

const SEEDANCE_TIER = (process.env.SEEDANCE_TIER ?? 'standard') as SeedanceTier;

/** 씬 전용 Seedance 프롬프트 생성 — @Image1 + @Image2 + @Audio1 태그 사용 */
function buildSeedancePrompt(
  script: VideoScript,
  scene: SceneDef,
  speaker: CharacterDef,
  dialogueText: string
): string {
  const styleDirective = Array.isArray(script.styleDirectives)
    ? script.styleDirectives.join(', ')
    : script.styleDirectives;
  const sfxLine = Array.isArray(scene.sfx) ? scene.sfx.join(', ') : (scene.sfx ?? '');
  const locationDesc = resolveSceneLocation(script, scene.location);
  const voiceNote = getCharacterVoiceNote(speaker) ?? '';
  const checklist = (script.consistencyChecklist ?? []).map((c) => {
    return typeof c === 'string' ? `- ${c}` : `- ${String(c)}`;
  }).join('\n');

  return `[Top-level cinematic statement]
${script.topLevelPrompt}
Style: ${styleDirective}
Tone: ${script.toneAndMood}

[Scene ${scene.id} — ${scene.durationSec} seconds${locationDesc ? `, location: ${locationDesc}` : ''}]

@Image1 is the definitive character design bible for ${speaker.displayName}${speaker.archetype ? ` (${speaker.archetype})` : ''} — the character in the video MUST look IDENTICAL to @Image1 at all times: same face, hair, outfit, proportions, colors.

@Image2 is the starting keyframe (t=0) of this scene. The video begins exactly from this frame and unfolds over ${scene.durationSec} seconds.

@Audio1 is the Korean dialogue track. ${speaker.displayName} speaks the following line, and her mouth should open and close naturally in rhythm with the speech so lip-sync post-processing has clear anchor:
"${dialogueText}"
Voice feel: ${voiceNote}

Action (unfolds over ${scene.durationSec}s):
${scene.action}

Camera:
${scene.camera}

Emotion: ${scene.emotion}

${scene.effects ? `Visual effects: ${scene.effects}` : ''}
${sfxLine ? `Sound design (ambient, not speech): ${sfxLine}` : ''}

Consistency rules (must hold across every frame):
${checklist}

Cinematic, single-take feel, smooth motion, no abrupt cuts, no text, no subtitles, no watermarks. 16:9 aspect ratio. Character's face and mouth must remain clearly visible during the spoken portion.`;
}

/** fal CDN URL → 로컬 파일 다운로드 */
async function downloadToFile(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed ${res.status} ${url}`);
  const fileStream = createWriteStream(outPath);
  // ReadableStream → Node stream
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), fileStream);
}

async function main() {
  const googleKey = process.env.GOOGLE_API_KEY;
  const falKey = process.env.FAL_KEY;
  if (!googleKey) throw new Error('GOOGLE_API_KEY missing');
  if (!falKey) throw new Error('FAL_KEY missing');

  // 대본 로드
  const scriptPath = join(process.cwd(), 'tmp', 'smoke', 'script.json');
  const script: VideoScript = JSON.parse(readFileSync(scriptPath, 'utf-8'));

  const scene = script.scenes[0];
  const dialogue = getSceneDialogue(scene);
  if (!dialogue) throw new Error(`scene ${scene.id} has no dialogue`);
  const speakerId = dialogue.speakerId ?? scene.speakerId ?? scene.characters[0] ?? script.characters[0].id;
  const speaker = script.characters.find((c) => c.id === speakerId);
  if (!speaker) throw new Error(`speaker ${speakerId} not found in script.characters`);

  const outDir = join(process.cwd(), 'tmp', 'smoke', 's01');
  mkdirSync(outDir, { recursive: true });

  console.log('='.repeat(70));
  console.log(`  스모크 3: s01 end-to-end (${script.title})`);
  console.log('='.repeat(70));
  console.log(`씬: ${scene.id}  길이: ${scene.durationSec}s  화자: ${speaker.displayName} (${speaker.voice})`);
  console.log(`대사: "${dialogue.text}"`);
  console.log(`Seedance tier: ${SEEDANCE_TIER}\n`);

  let totalCost = 0;
  const timings: Record<string, number> = {};

  // ─────────────────────────────────────────
  // 1. Gemini TTS
  // ─────────────────────────────────────────
  console.log(`[1/3] Gemini TTS 생성 (${speaker.voice}) ...`);
  const ttsStart = Date.now();
  const tts = new GeminiTtsProvider(googleKey);
  const voiceNote = getCharacterVoiceNote(speaker);
  const { wavBytes, durationSec: ttsDuration, costUsd: ttsCost } = await tts.generateTtsToBuffer(
    dialogue.text,
    speaker.voice as Parameters<typeof tts.generateTtsToBuffer>[1],
    voiceNote
  );
  const ttsPath = join(outDir, `${scene.id}_tts.wav`);
  writeFileSync(ttsPath, wavBytes);
  totalCost += ttsCost;
  timings.tts = Date.now() - ttsStart;
  console.log(`      ✓ ${ttsPath}`);
  console.log(`      길이: ${ttsDuration.toFixed(2)}s  파일크기: ${(wavBytes.length / 1024).toFixed(0)}KB  (${(timings.tts / 1000).toFixed(1)}s)\n`);

  // ─────────────────────────────────────────
  // 2. Seedance 2.0 (generate_audio=false → 영상만)
  // ─────────────────────────────────────────
  const refPath = join(process.cwd(), 'tmp', 'smoke', 'nano', `${speaker.id}_ref.png`);
  const keyframePath = join(process.cwd(), 'tmp', 'smoke', 'nano', `${scene.id}_keyframe.png`);

  // TTS 길이보다 약간 여유롭게 맞춤 (Seedance duration은 정수 초 enum)
  const videoDuration = Math.min(15, Math.max(4, Math.ceil(ttsDuration + 0.5)));

  const prompt = buildSeedancePrompt(script, scene, speaker, dialogue.text);
  console.log(`[2/3] Seedance 2.0 reference-to-video (duration=${videoDuration}s, tier=${SEEDANCE_TIER}) ...`);
  console.log(`      이미지: ${speaker.id}_ref.png, ${scene.id}_keyframe.png`);
  console.log(`      오디오: ${scene.id}_tts.wav`);
  console.log(`      생성 중 (30~120초 소요)...\n`);

  const seedStart = Date.now();
  const seedance = new Seedance2Provider(falKey);
  const seedResult = await seedance.generateFromFiles({
    prompt,
    imageFilePaths: [refPath, keyframePath],
    audioFilePaths: [ttsPath],
    durationSec: videoDuration,
    resolution: '720p',
    aspectRatio: '16:9',
    generateAudio: false,
    tier: SEEDANCE_TIER,
  });
  totalCost += seedResult.costUsd;
  timings.seedance = Date.now() - seedStart;

  const silentVideoPath = join(outDir, `${scene.id}_silent.mp4`);
  await downloadToFile(seedResult.videoUrl, silentVideoPath);
  console.log(`\n      ✓ ${silentVideoPath}`);
  console.log(`      비용: $${seedResult.costUsd.toFixed(3)}  (${(timings.seedance / 1000).toFixed(1)}s)\n`);

  // 프롬프트 저장 (재현성)
  writeFileSync(join(outDir, `${scene.id}_seedance_prompt.txt`), prompt, 'utf-8');

  // ─────────────────────────────────────────
  // 3. ffmpeg 로 영상 + TTS 합성
  // ─────────────────────────────────────────
  console.log(`[3/3] ffmpeg 로 영상 + TTS 오디오 합성...`);
  const finalPath = join(outDir, `${scene.id}_final.mp4`);
  const ffStart = Date.now();
  const ff = spawnSync(
    'ffmpeg',
    [
      '-y', '-v', 'error',
      '-i', silentVideoPath,
      '-i', ttsPath,
      '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
      '-map', '0:v:0', '-map', '1:a:0',
      '-shortest',
      finalPath,
    ],
    { encoding: 'utf-8' }
  );
  timings.ffmpeg = Date.now() - ffStart;
  if (ff.status !== 0) {
    console.error(ff.stderr);
    throw new Error(`ffmpeg exit ${ff.status}`);
  }
  const finalSize = (readFileSync(finalPath).length / (1024 * 1024)).toFixed(2);
  console.log(`      ✓ ${finalPath} (${finalSize} MB, ${(timings.ffmpeg / 1000).toFixed(1)}s)\n`);

  // ─────────────────────────────────────────
  // 리포트
  // ─────────────────────────────────────────
  const report = {
    scene: scene.id,
    dialogue: dialogue.text,
    speaker: { id: speaker.id, voice: speaker.voice },
    ttsDurationSec: ttsDuration,
    videoDurationSec: videoDuration,
    costs: {
      tts: ttsCost,
      seedance: seedResult.costUsd,
      total: totalCost,
    },
    timings,
    paths: {
      tts: ttsPath,
      silentVideo: silentVideoPath,
      finalVideo: finalPath,
      prompt: join(outDir, `${scene.id}_seedance_prompt.txt`),
    },
    seedance: {
      endpoint: seedResult.endpoint,
      tier: SEEDANCE_TIER,
      requestId: seedResult.requestId,
    },
  };
  writeFileSync(join(outDir, `${scene.id}_report.json`), JSON.stringify(report, null, 2), 'utf-8');

  console.log('─'.repeat(70));
  console.log(`  💰 총 비용: $${totalCost.toFixed(3)}`);
  console.log(`     • TTS:       $${ttsCost.toFixed(3)} (preview 무료)`);
  console.log(`     • Seedance:  $${seedResult.costUsd.toFixed(3)} (${SEEDANCE_TIER} 720p ${videoDuration}s)`);
  console.log(`  ⏱  총 시간: ${((timings.tts + timings.seedance + timings.ffmpeg) / 1000).toFixed(1)}s`);
  console.log('─'.repeat(70));
  console.log(`\n결과 영상:`);
  console.log(`  open ${finalPath}`);
  console.log(`\nfal.ai 대시보드에서 실제 청구액 확인:`);
  console.log(`  https://fal.ai/dashboard/usage`);
  console.log(`  request_id: ${seedResult.requestId ?? '(none returned)'}`);
}

main().catch((e) => {
  console.error('\n❌ 실패:', e);
  process.exit(1);
});
