/**
 * 스모크 2: nano-banana-pro 로 두리 캐릭터 레퍼런스 시트 + s01 키프레임 생성.
 *
 * 입력: tmp/smoke/script.json (smoke-director 결과)
 * 출력: tmp/smoke/nano/doori_ref.png, tmp/smoke/nano/s01_keyframe.png
 *
 * 실행:
 *   npm run smoke:refs
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NanoBananaProvider } from '../src/lib/video-providers/nano-banana';
import {
  getCharacterAppearance,
  resolveSceneLocation,
  type VideoScript,
  type SceneDef,
  type CharacterDef,
} from '../src/lib/video-providers/director.types';

/** 캐릭터 appearance + style directive → 레퍼런스 시트 프롬프트 */
function buildCharacterRefPrompt(c: CharacterDef, styleDirective: string): string {
  const appearance = getCharacterAppearance(c);
  const mouthSpec = (c as unknown as { mouthSpec?: string }).mouthSpec;
  return `Create a character reference model sheet on a clean pure white background for children's animation production.

CHARACTER: ${c.displayName}${c.archetype ? ` (${c.archetype})` : ''}
${appearance}

Personality baseline for expression design: ${c.personality}
${mouthSpec ? `\nMouth rendering spec (critical for lip-sync): ${mouthSpec}` : ''}

SHEET LAYOUT: Show the character in 4 body views (front, 3/4, side, back) and 4 expression variations focused on the face/mouth (neutral smile with visible lips, talking with open mouth showing teeth, surprised O shape, cheerful wide smile). Label views minimally with tiny text if needed.

STYLE: ${styleDirective}

CRITICAL: The upper and lower lips must be clearly drawn and distinguishable in EVERY view and expression. The mouth region must occupy at least 5% of the face area. This sheet will be used as the definitive design bible for every subsequent scene and for AI lip-sync post-processing — consistency and mouth-clarity are paramount.`;
}

/** 씬 키프레임 프롬프트 — topLevelPrompt + 씬 세부 */
function buildSceneKeyframePrompt(
  script: VideoScript,
  scene: SceneDef,
  styleDirective: string
): string {
  const characterNames = scene.characters
    .map((id) => script.characters.find((c) => c.id === id)?.displayName ?? id)
    .join(', ');

  const locationDesc = resolveSceneLocation(script, scene.location);
  return `Create a single 16:9 first-frame (keyframe) for this scene of a children's educational animation.

TOP-LEVEL CONTEXT:
${script.topLevelPrompt}

SCENE ${scene.id}${locationDesc ? ` — ${locationDesc}` : ''}:
Action: ${scene.action}
Camera: ${scene.camera}
Emotion: ${scene.emotion}
Characters visible: ${characterNames}
${scene.effects ? `Effects: ${scene.effects}` : ''}

The attached reference images are the EXACT character design bible. The character must look IDENTICAL to the reference — same proportions, colors, shading, line quality.

This frame is the starting point (t=0) of the shot. Compose it so the camera direction and action described can unfold naturally over the next ${scene.durationSec} seconds.

STYLE: ${styleDirective}

No text, no UI, no watermarks. Pure animation frame.`;
}

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('❌ GOOGLE_API_KEY 가 .env.local 에 없음');
    process.exit(1);
  }

  const scriptPath = join(process.cwd(), 'tmp', 'smoke', 'script.json');
  const script: VideoScript = JSON.parse(readFileSync(scriptPath, 'utf-8'));

  const outDir = join(process.cwd(), 'tmp', 'smoke', 'nano');
  mkdirSync(outDir, { recursive: true });

  const styleDirective = Array.isArray(script.styleDirectives)
    ? script.styleDirectives.join(', ')
    : script.styleDirectives;

  const nano = new NanoBananaProvider(apiKey);

  console.log('='.repeat(70));
  console.log('  스모크 2: nano-banana-pro 레퍼런스 + 키프레임');
  console.log('='.repeat(70));
  console.log(`대본: ${script.title}`);
  console.log(`씬 수: ${script.scenes.length}`);
  console.log(`출력 디렉토리: ${outDir}\n`);

  let totalCost = 0;

  // ─────────────────────────────────────────
  // 1. 캐릭터 레퍼런스 시트 (두리)
  // ─────────────────────────────────────────
  const mainCharacter = script.characters[0];
  const refPath = join(outDir, `${mainCharacter.id}_ref.png`);

  console.log(`[1/2] 캐릭터 레퍼런스 시트 — ${mainCharacter.displayName} (${mainCharacter.id})`);
  console.log(`      appearance: ${getCharacterAppearance(mainCharacter).slice(0, 80)}...`);
  const t0 = Date.now();
  const refPrompt = buildCharacterRefPrompt(mainCharacter, styleDirective);
  const refResult = await nano.generateImageFromFiles(refPrompt, [], '16:9');
  writeFileSync(refPath, refResult.bytes);
  totalCost += refResult.costUsd;
  const refSize = (refResult.bytes.length / 1024).toFixed(0);
  console.log(`      ✓ ${refPath} (${refSize} KB, ${((Date.now() - t0) / 1000).toFixed(1)}초)\n`);

  // ─────────────────────────────────────────
  // 2. s01 키프레임 (캐릭터 레퍼런스 주입)
  // ─────────────────────────────────────────
  const s01 = script.scenes[0];
  const keyframePath = join(outDir, `${s01.id}_keyframe.png`);

  console.log(`[2/2] 씬 ${s01.id} 키프레임 (${s01.durationSec}s)`);
  console.log(`      location: ${resolveSceneLocation(script, s01.location).slice(0, 80) || '-'}`);
  console.log(`      action: ${(s01.action ?? '').slice(0, 80)}...`);
  const t1 = Date.now();
  const scenePrompt = buildSceneKeyframePrompt(script, s01, styleDirective);
  const sceneResult = await nano.generateImageFromFiles(scenePrompt, [refPath], '16:9');
  writeFileSync(keyframePath, sceneResult.bytes);
  totalCost += sceneResult.costUsd;
  const kfSize = (sceneResult.bytes.length / 1024).toFixed(0);
  console.log(`      ✓ ${keyframePath} (${kfSize} KB, ${((Date.now() - t1) / 1000).toFixed(1)}초)\n`);

  console.log('─'.repeat(70));
  console.log(`  💰 비용: $${totalCost.toFixed(3)} (nano-banana-pro ${2} images)`);
  console.log('─'.repeat(70));
  console.log(`\n두리 레퍼런스 시트와 s01 키프레임을 Finder 로 열어서 확인해봐:`);
  console.log(`  open ${outDir}`);
}

main().catch((e) => {
  console.error('\n❌ 실패:', e);
  process.exit(1);
});
