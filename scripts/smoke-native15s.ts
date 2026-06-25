/**
 * 스모크 5: Seedance 2.0 네이티브 15초 단일 호출.
 *
 * 이전 파이프라인 (TTS → Seedance silent → Sync Labs) 은 립싱크 품질이
 * 스타일라이즈 애니메이션에서 안 잡혔음. 이번엔 Seedance 가 TTS+립싱크까지
 * 네이티브로 처리 (generate_audio=true), 외부 TTS/Sync Labs 생략.
 *
 * 입력:
 *   - tmp/smoke/script.json (대본의 첫 3씬을 15초로 압축)
 *   - tmp/smoke/nano/miri_ref.png (캐릭터 레퍼런스 시트)
 *   - tmp/smoke/nano/s01_keyframe.png (시작 프레임)
 *
 * 출력:
 *   - tmp/smoke/native15s/final.mp4
 *
 * 비용 (standard 720p 15s): $4.536
 *
 * 실행:
 *   npm run smoke:native15s
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { Seedance2Provider, type SeedanceTier } from '../src/lib/video-providers/seedance2';
import {
  getSceneDialogue,
  resolveSceneLocation,
  type VideoScript,
} from '../src/lib/video-providers/director.types';

const TIER = (process.env.SEEDANCE_TIER ?? 'standard') as SeedanceTier;
const TARGET_DURATION_SEC = parseInt(process.env.TARGET_DURATION ?? '15', 10);

async function downloadToFile(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed ${res.status} ${url}`);
  const fileStream = createWriteStream(outPath);
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), fileStream);
}

/** 첫 N 씬을 하나로 압축해 15초 single-take 프롬프트 생성 */
function buildCompressedPrompt(script: VideoScript, scenesToUse: number): string {
  const styleDirective = Array.isArray(script.styleDirectives)
    ? script.styleDirectives.join(', ')
    : script.styleDirectives;

  const scenes = script.scenes.slice(0, scenesToUse);
  const main = script.characters[0];

  // 각 씬의 핵심 비트 (액션 + 대사 + 카메라) 를 시간순으로 나열
  let elapsed = 0;
  const beatList: string[] = [];
  const dialogueList: string[] = [];
  for (const sc of scenes) {
    const segEnd = elapsed + sc.durationSec;
    const loc = resolveSceneLocation(script, sc.location);
    const dial = getSceneDialogue(sc);
    const camera = sc.camera ?? '';
    const action = sc.action ?? '';
    const effects = sc.effects ?? '';
    beatList.push(
      `${elapsed}–${segEnd}s [${loc || sc.id}]: ${action} Camera: ${camera}. ${effects ? `Effects: ${effects}.` : ''} ${dial ? `Miri speaks naturally in Korean: "${dial.text}"` : ''}`
    );
    if (dial) dialogueList.push(dial.text);
    elapsed = segEnd;
  }

  const checklist = (script.consistencyChecklist ?? [])
    .map((c) => typeof c === 'string' ? `- ${c}` : `- ${String(c)}`)
    .join('\n');

  const fullDialogue = dialogueList.join(' ');

  return `[Top-level cinematic statement]
${script.topLevelPrompt}

Style: ${styleDirective}
Tone: ${script.toneAndMood}

[Single ${TARGET_DURATION_SEC}-second continuous take — educational children's animation]

@Image1 is the definitive character design bible for ${main.displayName} (8-year-old Korean girl, K-pop idol style). The character in the video MUST look IDENTICAL to @Image1: same hair (high ponytail with water-drop hairpin), same face (large sparkling brown eyes, pink blush, clearly defined pink lips with visible teeth when talking), same outfit (sky-blue/white hooded dress with cloud embroidery, white leggings, yellow rain boots, water-drop pendant).

@Image2 is the exact starting frame (t=0). The video begins from this frame and unfolds smoothly over ${TARGET_DURATION_SEC} seconds without any cut.

Language: Korean only. Miri speaks in a bright, lively 7-8 year old girl's voice (cheerful, clear, child-like, like a K-kids TV host). Lip-sync must be precise to her Korean speech.

Narrative beats (compressed into ${TARGET_DURATION_SEC}s continuous motion, no cuts):
${beatList.join('\n')}

Full Korean dialogue spoken in sequence during the video:
"${fullDialogue}"

Camera philosophy: single-take dreamy continuous movement through the environments. Start at the beach, smoothly lift up into the sky, arrive on the cloud. No hard cuts — transitions via camera movement (dolly-up, track-in) and environment morphing.

Consistency rules (must hold across every frame):
${checklist}

Cinematic 2D cel animation with soft watercolor backgrounds, pastel palette, Pinkfong-level kid-friendly warmth, single-take. Character's face and mouth remain clearly visible during speech. No text, no subtitles, no watermarks. 16:9 aspect ratio.`;
}

async function main() {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY missing');

  const scriptPath = join(process.cwd(), 'tmp', 'smoke', 'script.json');
  const script: VideoScript = JSON.parse(readFileSync(scriptPath, 'utf-8'));

  // 15초면 보통 첫 2~3씬 (s01+s02 = 12s 대본 상) 을 담기 좋음
  const scenesFit = script.scenes.reduce<{ count: number; dur: number }>(
    (acc, s) => (acc.dur + s.durationSec <= TARGET_DURATION_SEC ? { count: acc.count + 1, dur: acc.dur + s.durationSec } : acc),
    { count: 0, dur: 0 }
  );
  const scenesToUse = Math.max(1, scenesFit.count);

  const refPath = join(process.cwd(), 'tmp', 'smoke', 'nano', 'miri_ref.png');
  const keyframePath = join(process.cwd(), 'tmp', 'smoke', 'nano', 's01_keyframe.png');

  const outDir = join(process.cwd(), 'tmp', 'smoke', 'native15s');
  mkdirSync(outDir, { recursive: true });

  console.log('='.repeat(70));
  console.log(`  스모크 5: Seedance 2.0 네이티브 ${TARGET_DURATION_SEC}초 single-take`);
  console.log('='.repeat(70));
  console.log(`대본: ${script.title}`);
  console.log(`담는 씬: 첫 ${scenesToUse}개 (원래 길이 합 ${scenesFit.dur}s → ${TARGET_DURATION_SEC}s 로 압축)`);
  console.log(`tier: ${TIER}  예상 비용: $${(TARGET_DURATION_SEC * (TIER === 'fast' ? 0.2419 : 0.3024)).toFixed(3)}\n`);

  const prompt = buildCompressedPrompt(script, scenesToUse);
  writeFileSync(join(outDir, 'prompt.txt'), prompt, 'utf-8');

  console.log(`[1/1] Seedance 2.0 reference-to-video (generate_audio=true, duration=${TARGET_DURATION_SEC}s)...`);
  console.log(`      이미지: miri_ref.png, s01_keyframe.png`);
  console.log(`      오디오: (없음 — Seedance 내부 TTS 사용)`);
  console.log(`      생성 중 (60~180초 소요)...\n`);

  const t0 = Date.now();
  const seedance = new Seedance2Provider(falKey);
  const result = await seedance.generateFromFiles({
    prompt,
    imageFilePaths: [refPath, keyframePath],
    // audio 없음 — Seedance 가 한국어 네이티브 TTS + 립싱크 생성
    durationSec: TARGET_DURATION_SEC,
    resolution: '720p',
    aspectRatio: '16:9',
    generateAudio: true,
    tier: TIER,
  });

  const outPath = join(outDir, `final_${TIER}_${TARGET_DURATION_SEC}s.mp4`);
  await downloadToFile(result.videoUrl, outPath);
  const size = (readFileSync(outPath).length / (1024 * 1024)).toFixed(2);
  console.log(`\n      ✓ ${outPath} (${size} MB)`);
  console.log(`      비용: $${result.costUsd.toFixed(3)}`);
  console.log(`      소요: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`      request_id: ${result.requestId ?? '(none)'}\n`);

  writeFileSync(
    join(outDir, `report_${TIER}_${TARGET_DURATION_SEC}s.json`),
    JSON.stringify({
      scenesUsed: scenesToUse,
      targetDurationSec: TARGET_DURATION_SEC,
      tier: TIER,
      costUsd: result.costUsd,
      videoUrl: result.videoUrl,
      requestId: result.requestId,
      elapsedMs: result.elapsedMs,
    }, null, 2),
    'utf-8'
  );

  console.log('─'.repeat(70));
  console.log(`  💰 비용: $${result.costUsd.toFixed(3)} (post-processing 없음)`);
  console.log('─'.repeat(70));
  console.log(`\n영상 확인:`);
  console.log(`  open ${outPath}`);
  console.log(`\n프롬프트 저장:`);
  console.log(`  ${join(outDir, 'prompt.txt')}`);
}

main().catch((e) => {
  console.error('\n❌ 실패:', e);
  process.exit(1);
});
