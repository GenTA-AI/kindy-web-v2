// npx tsx --env-file=.env.local scripts/generate-library-batch.ts
// 옵션 env:
//   ONLY_INDEX=3  // 매트릭스에서 특정 인덱스만 (디버그용, 0-based)
//   SKIP_WHISPER=1  // 자막 생성 건너뛰기
//   DRY_RUN=1  // 실 API 안 호출, 매트릭스만 출력

import 'dotenv/config';

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  createWriteStream,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { LIBRARY_MATRIX, type LibraryBriefSpec } from './library-matrix';
import { ClaudeDirector } from '../src/lib/video-providers/claude-director';
import { NanoBananaProvider } from '../src/lib/video-providers/nano-banana';
import { Seedance2Provider, type SeedanceTier } from '../src/lib/video-providers/seedance2';
import { transcribeToVtt } from '../src/lib/whisper';
import { getSupabase } from '../src/lib/supabase';
import { getSignedUrl, uploadBytes } from '../src/lib/supabase-storage';
import {
  getCharacterAppearance,
  getSceneDialogue,
  resolveSceneLocation,
  type SceneDef,
  type VideoBrief,
  type VideoScript,
} from '../src/lib/video-providers/director.types';

const CLIP_MAX_SEC = 15;
const CLIP_MIN_SEC = 4;
const REPORT_DIR = join(process.cwd(), 'tmp', 'library');
const REPORT_PATH = join(REPORT_DIR, 'report.json');
const SEEDANCE_TIER = (process.env.SEEDANCE_TIER ?? 'standard') as SeedanceTier;

const DRY_RUN = process.env.DRY_RUN === '1';
const SKIP_WHISPER = process.env.SKIP_WHISPER === '1';

type BriefStatus = 'success' | 'failed' | 'skipped' | 'dry_run';

interface CostBreakdown {
  director: number;
  refs: number;
  keyframes: number;
  video_s01: number;
  video_s02: number;
  concat: number;
  upload: number;
  whisper: number;
  total: number;
}

interface BriefReport {
  index: number;
  title: string;
  topic: LibraryBriefSpec['topic'];
  age_band: LibraryBriefSpec['age_band'];
  style_tags: string[];
  status: BriefStatus;
  slug: string;
  workDir: string;
  elapsedMs: number;
  costUsd: CostBreakdown;
  video_url?: string;
  thumbnail_url?: string;
  subtitles_url?: string | null;
  library_video_id?: string;
  skipReason?: string;
  error?: string;
}

interface BatchReport {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  skipWhisper: boolean;
  onlyIndex: number | null;
  selectedCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  totalCostUsd: number;
  results: BriefReport[];
}

function emptyCost(): CostBreakdown {
  return {
    director: 0,
    refs: 0,
    keyframes: 0,
    video_s01: 0,
    video_s02: 0,
    concat: 0,
    upload: 0,
    whisper: 0,
    total: 0,
  };
}

function addCost(cost: CostBreakdown, key: keyof Omit<CostBreakdown, 'total'>, amount: number): void {
  cost[key] += amount;
  cost.total = cost.director + cost.refs + cost.keyframes + cost.video_s01 +
    cost.video_s02 + cost.concat + cost.upload + cost.whisper;
}

function now(): string {
  return new Date().toISOString();
}

function logStep(index: number, title: string, step: string, message: string, costUsd?: number): void {
  const cost = costUsd === undefined ? '' : ` cost=$${costUsd.toFixed(4)}`;
  console.log(`[${now()}] [${index}] ${title} :: ${step} — ${message}${cost}`);
}

function slugForSpec(index: number, spec: LibraryBriefSpec): string {
  const style = spec.style_tags[0] ?? 'style';
  return `${String(index).padStart(2, '0')}-${style}-${spec.topic}-age${spec.age_band}`;
}

function styleReferenceFrom(styleTags: string[]): string {
  const labels: Record<string, string> = {
    princess: 'soft fairy-tale princess world, small tiara, gentle sparkles, storybook castle garden warmth',
    kpop: 'K-kids pop stage energy, rhythmic camera moves, cheerful concert lighting, headset mic performance',
    space: 'friendly space explorer adventure, soft stars, rounded rocket props, wonder-filled cosmic classroom',
  };
  const style = styleTags.map((tag) => labels[tag] ?? tag).join(', ');
  const base = 'cinematic 2D cel animation with soft watercolor backgrounds, Pinkfong/Pororo-level kid-friendly warmth, pastel palette, single-take feel';
  return style ? `${base}. Scene mood: ${style}` : base;
}

function toVideoBrief(spec: LibraryBriefSpec): VideoBrief {
  return {
    topic: spec.topic_subject,
    audience: `${spec.age_band}세 유치원`,
    targetDurationSec: spec.target_duration_sec,
    learningGoals: spec.learning_goals,
    styleReference: styleReferenceFrom(spec.style_tags),
    tone: '밝고 따뜻하며 호기심을 자극하는',
    roughSynopsis: spec.rough_synopsis,
    protagonistHint: spec.protagonist_hint,
  };
}

function buildStyleDirective(script: VideoScript): string {
  return Array.isArray(script.styleDirectives)
    ? script.styleDirectives.join(', ')
    : script.styleDirectives;
}

function mainCharacter(script: VideoScript) {
  const main = script.characters[0];
  if (!main) throw new Error('VideoScript has no characters[0]');
  return main;
}

function buildCharacterRefPrompt(script: VideoScript): string {
  const main = mainCharacter(script);
  const appearance = getCharacterAppearance(main);
  const styleDirective = buildStyleDirective(script);
  const mouthSpec = (main as unknown as { mouthSpec?: string }).mouthSpec;

  return `Create a character reference model sheet on a clean pure white background for children's animation production.

CHARACTER: ${main.displayName}${main.archetype ? ` (${main.archetype})` : ''}
${appearance}

Personality: ${main.personality}
${mouthSpec ? `\nMouth rendering spec: ${mouthSpec}` : ''}

SHEET: 4 body views (front, 3/4, side, back) + 4 mouth-focused expressions (neutral smile, talking with teeth, surprised O, wide smile).

STYLE: ${styleDirective}

Upper and lower lips MUST be clearly drawn in every view. Mouth >= 5% of face area. This sheet is the definitive design bible.`;
}

function buildKeyframePrompt(script: VideoScript, scene: SceneDef): string {
  const main = mainCharacter(script);
  const styleDirective = buildStyleDirective(script);
  const locationDesc = resolveSceneLocation(script, scene.location);

  return `Create a single 16:9 first-frame keyframe for this scene of a children's educational animation.

TOP-LEVEL:
${script.topLevelPrompt}

SCENE ${scene.id}${locationDesc ? ` — ${locationDesc}` : ''}:
Action: ${scene.action}
Camera: ${scene.camera}
Emotion: ${scene.emotion}
Character visible: ${main.displayName}
${scene.effects ? `Effects: ${scene.effects}` : ''}

The attached reference is the EXACT character design bible. Match IDENTICALLY.

Starting point (t=0) of a ${scene.durationSec}s shot — compose to unfold naturally.

STYLE: ${styleDirective}

No text, no UI, no watermarks.`;
}

function countScenesForChunk(script: VideoScript, maxDurationSec: number): number {
  let count = 0;
  let duration = 0;
  for (const scene of script.scenes) {
    if (duration + scene.durationSec > maxDurationSec) break;
    duration += scene.durationSec;
    count += 1;
  }
  return Math.max(1, count);
}

function buildFirstChunkPrompt(script: VideoScript, scenesToUse: number, durationSec: number): string {
  const styleDirective = buildStyleDirective(script);
  const main = mainCharacter(script);
  const scenes = script.scenes.slice(0, scenesToUse);

  let elapsed = 0;
  const beats: string[] = [];
  const dialogues: string[] = [];
  for (const scene of scenes) {
    const segmentEnd = elapsed + scene.durationSec;
    const location = resolveSceneLocation(script, scene.location);
    const dialogue = getSceneDialogue(scene);
    beats.push(
      `${elapsed}-${segmentEnd}s [${location || scene.id}]: ${scene.action ?? ''} Camera: ${scene.camera ?? ''}. ${scene.effects ? `Effects: ${scene.effects}.` : ''} ${dialogue ? `${main.displayName} speaks naturally in Korean: "${dialogue.text}"` : ''}`
    );
    if (dialogue) dialogues.push(dialogue.text);
    elapsed = segmentEnd;
  }
  const checklist = (script.consistencyChecklist ?? [])
    .map((item) => `- ${typeof item === 'string' ? item : String(item)}`)
    .join('\n');

  return `[Top-level cinematic statement]
${script.topLevelPrompt}

Style: ${styleDirective}
Tone: ${script.toneAndMood}

[Single ${durationSec}-second continuous take — educational children's animation]

@Image1 is the definitive character design bible for ${main.displayName}. Must look IDENTICAL: hair, face, outfit, accessories.

@Image2 is the exact starting frame (t=0). Video begins from this frame and unfolds smoothly over ${durationSec} seconds without any cut.

Language: Korean only. ${main.displayName} speaks in a bright, lively child voice. Lip-sync must be precise.

Narrative beats (${durationSec}s continuous motion, no cuts):
${beats.join('\n')}

Full Korean dialogue in sequence:
"${dialogues.join(' ')}"

Consistency rules:
${checklist}

Cinematic 2D cel animation with soft watercolor backgrounds, pastel palette, Pinkfong-level kid-friendly warmth, single-take. Face and mouth clearly visible during speech. No text, no subtitles, no watermarks. 16:9.`;
}

function buildExtensionPrompt(script: VideoScript, fromSceneIdx: number, durationSec: number): string {
  const styleDirective = buildStyleDirective(script);
  const main = mainCharacter(script);
  const tailScenes = script.scenes.slice(fromSceneIdx);

  let elapsed = 0;
  const beats: string[] = [];
  const dialogues: string[] = [];
  for (const scene of tailScenes) {
    const segmentEnd = elapsed + scene.durationSec;
    const location = resolveSceneLocation(script, scene.location);
    const dialogue = getSceneDialogue(scene);
    beats.push(
      `${elapsed}-${segmentEnd}s [${location || scene.id}]: ${scene.action ?? ''} Camera: ${scene.camera ?? ''}. ${scene.effects ? `Effects: ${scene.effects}.` : ''} ${dialogue ? `${main.displayName} speaks naturally in Korean: "${dialogue.text}"` : ''}`
    );
    if (dialogue) dialogues.push(dialogue.text);
    elapsed = segmentEnd;
  }
  const checklist = (script.consistencyChecklist ?? [])
    .map((item) => `- ${typeof item === 'string' ? item : String(item)}`)
    .join('\n');

  return `[Top-level cinematic statement]
${script.topLevelPrompt}

Style: ${styleDirective}
Tone: ${script.toneAndMood}

[Continuation of previous clip — ${durationSec}s single take, NO cut]

@Video1 is the previous clip that just ended. This new clip begins IMMEDIATELY where @Video1 ended, preserving the same character design, color palette, art style, and voice of ${main.displayName}. Treat this as one continuous film.

@Image1 is the character design bible for ${main.displayName}. ${main.displayName} MUST look identical to @Video1.

@Image2 is the exact last frame of @Video1 (t=0 of this clip).

Voice continuity: ${main.displayName}'s voice MUST sound identical to @Video1 — same timbre, cadence, child voice.

Narrative beats:
${beats.join('\n')}

Full Korean dialogue:
"${dialogues.join(' ')}"

Consistency rules (match @Video1 exactly):
${checklist}

Cinematic 2D cel animation, pastel palette, single-take, no text/subtitles/watermarks. 16:9.`;
}

async function downloadToFile(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed ${res.status} ${url}`);
  const fileStream = createWriteStream(outPath);
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), fileStream);
}

function extractLastFrame(videoPath: string, outPath: string): void {
  const result = spawnSync('ffmpeg', [
    '-y', '-v', 'error',
    '-sseof', '-0.1',
    '-i', videoPath,
    '-vframes', '1', '-q:v', '2',
    outPath,
  ], { encoding: 'utf-8' });
  if (result.status !== 0) throw new Error(`ffmpeg last-frame extract failed: ${result.stderr}`);
}

function concatClips(inputs: string[], outPath: string): void {
  const normalized: string[] = [];
  for (const clip of inputs) {
    const normalizedPath = clip.replace(/\.mp4$/, '.norm.mp4');
    const result = spawnSync('ffmpeg', [
      '-y', '-v', 'error',
      '-i', clip,
      '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '24',
      '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2',
      normalizedPath,
    ], { encoding: 'utf-8' });
    if (result.status !== 0) throw new Error(`normalize ${clip} failed: ${result.stderr}`);
    normalized.push(normalizedPath);
  }

  const listPath = outPath.replace(/\.mp4$/, '.list.txt');
  writeFileSync(listPath, normalized.map((path) => `file '${path}'`).join('\n'), 'utf-8');
  const result = spawnSync('ffmpeg', [
    '-y', '-v', 'error',
    '-f', 'concat', '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    outPath,
  ], { encoding: 'utf-8' });
  if (result.status !== 0) throw new Error(`concat failed: ${result.stderr}`);
}

function probeDurationSec(videoPath: string, fallbackSec: number): number {
  const result = spawnSync('ffprobe', [
    '-v', 'quiet',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    videoPath,
  ], { encoding: 'utf-8' });
  const parsed = result.status === 0 ? Number.parseFloat(result.stdout.trim()) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackSec;
}

function writeReport(report: BatchReport): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
}

function estimatedDryRunCost(durationSec: number): CostBreakdown {
  const cost = emptyCost();
  addCost(cost, 'director', 0.5);
  addCost(cost, 'refs', 0.08);
  addCost(cost, 'keyframes', 0.08);
  addCost(cost, 'video_s01', durationSec >= 30 ? 4.7 : 4.7 * (durationSec / 15));
  addCost(cost, 'video_s02', durationSec > 15 ? 4.7 : 0);
  addCost(cost, 'whisper', SKIP_WHISPER ? 0 : (durationSec / 60) * 0.006);
  return cost;
}

async function processBrief(index: number, spec: LibraryBriefSpec): Promise<BriefReport> {
  const startedAt = Date.now();
  const slug = slugForSpec(index, spec);
  const workDir = join(REPORT_DIR, slug);
  const refsDir = join(workDir, 'refs');
  const clipsDir = join(workDir, 'clips');
  const cost = emptyCost();

  mkdirSync(refsDir, { recursive: true });
  mkdirSync(clipsDir, { recursive: true });

  const reportBase = {
    index,
    title: spec.title,
    topic: spec.topic,
    age_band: spec.age_band,
    style_tags: spec.style_tags,
    slug,
    workDir,
    costUsd: cost,
  };

  try {
    const supabase = getSupabase();
    logStep(index, spec.title, 'check', 'library_videos idempotency lookup');
    const { data: existing, error: existingError } = await supabase
      .from('library_videos')
      .select('id, published')
      .eq('title', spec.title)
      .eq('topic', spec.topic)
      .eq('age_band', spec.age_band)
      .maybeSingle();

    if (existingError) throw new Error(`library_videos lookup failed: ${existingError.message}`);
    if (existing) {
      const published = (existing as { published?: boolean }).published;
      logStep(index, spec.title, 'skip', `exists (published=${published})`);
      return {
        ...reportBase,
        status: 'skipped',
        elapsedMs: Date.now() - startedAt,
        library_video_id: (existing as { id?: string }).id,
        skipReason: `exists (published=${published})`,
      };
    }

    const brief = toVideoBrief(spec);

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY missing');
    logStep(index, spec.title, 'director', 'Claude director generating VideoScript');
    const director = new ClaudeDirector({
      apiKey: anthropicKey,
      model: process.env.CLAUDE_MODEL ?? 'claude-opus-4-7',
    });
    const directorResult = await director.direct(brief);
    addCost(cost, 'director', directorResult.costUsd);
    const script = directorResult.script;
    writeFileSync(join(workDir, 'script.json'), JSON.stringify(script, null, 2), 'utf-8');
    logStep(index, spec.title, 'director', `done (${directorResult.model})`, directorResult.costUsd);

    const googleKey = process.env.GOOGLE_API_KEY;
    if (!googleKey) throw new Error('GOOGLE_API_KEY missing');
    const nano = new NanoBananaProvider(googleKey);

    logStep(index, spec.title, 'refs', 'nano-banana character reference');
    const refResult = await nano.generateImageFromFiles(buildCharacterRefPrompt(script), [], '16:9');
    addCost(cost, 'refs', refResult.costUsd);
    const refPath = join(refsDir, 'character_ref.png');
    writeFileSync(refPath, refResult.bytes);
    logStep(index, spec.title, 'refs', 'character_ref.png saved', refResult.costUsd);

    const firstScene = script.scenes[0];
    if (!firstScene) throw new Error('VideoScript has no scenes[0]');
    logStep(index, spec.title, 'keyframe', `nano-banana ${firstScene.id} first frame`);
    const keyframeResult = await nano.generateImageFromFiles(buildKeyframePrompt(script, firstScene), [refPath], '16:9');
    addCost(cost, 'keyframes', keyframeResult.costUsd);
    const keyframePath = join(refsDir, 's01_keyframe.png');
    writeFileSync(keyframePath, keyframeResult.bytes);
    logStep(index, spec.title, 'keyframe', 's01_keyframe.png saved', keyframeResult.costUsd);

    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error('FAL_KEY missing');
    const seedance = new Seedance2Provider(falKey);
    const firstChunkCount = countScenesForChunk(script, CLIP_MAX_SEC);
    const firstDurationSec = Math.min(CLIP_MAX_SEC, Math.max(CLIP_MIN_SEC, spec.target_duration_sec));
    const firstPrompt = buildFirstChunkPrompt(script, firstChunkCount, firstDurationSec);
    writeFileSync(join(workDir, 'seedance_s01_prompt.txt'), firstPrompt, 'utf-8');

    logStep(index, spec.title, 'video_s01', `Seedance 2.0 native ${firstDurationSec}s`);
    const firstVideo = await seedance.generateFromFiles({
      prompt: firstPrompt,
      imageFilePaths: [refPath, keyframePath],
      durationSec: firstDurationSec,
      resolution: '720p',
      aspectRatio: '16:9',
      generateAudio: true,
      tier: SEEDANCE_TIER,
    });
    addCost(cost, 'video_s01', firstVideo.costUsd);
    const firstClipPath = join(clipsDir, 's01.mp4');
    await downloadToFile(firstVideo.videoUrl, firstClipPath);
    logStep(index, spec.title, 'video_s01', `downloaded request_id=${firstVideo.requestId ?? 'none'}`, firstVideo.costUsd);

    const clips = [firstClipPath];
    if (spec.target_duration_sec > CLIP_MAX_SEC) {
      const extensionDurationSec = Math.min(
        CLIP_MAX_SEC,
        Math.max(CLIP_MIN_SEC, spec.target_duration_sec - CLIP_MAX_SEC)
      );
      const fromSceneIdx = firstChunkCount < script.scenes.length
        ? firstChunkCount
        : Math.max(0, script.scenes.length - 1);
      const lastFramePath = join(refsDir, 's01_last_frame.jpg');
      extractLastFrame(firstClipPath, lastFramePath);

      const extensionPrompt = buildExtensionPrompt(script, fromSceneIdx, extensionDurationSec);
      writeFileSync(join(workDir, 'seedance_s02_prompt.txt'), extensionPrompt, 'utf-8');

      logStep(index, spec.title, 'video_s02', `Seedance 2.0 extension ${extensionDurationSec}s`);
      const secondVideo = await seedance.generateFromFiles({
        prompt: extensionPrompt,
        imageFilePaths: [refPath, lastFramePath],
        videoFilePaths: [firstClipPath],
        durationSec: extensionDurationSec,
        resolution: '720p',
        aspectRatio: '16:9',
        generateAudio: true,
        tier: SEEDANCE_TIER,
        seed: firstVideo.seed,
      });
      addCost(cost, 'video_s02', secondVideo.costUsd);
      const secondClipPath = join(clipsDir, 's02.mp4');
      await downloadToFile(secondVideo.videoUrl, secondClipPath);
      clips.push(secondClipPath);
      logStep(index, spec.title, 'video_s02', `downloaded request_id=${secondVideo.requestId ?? 'none'}`, secondVideo.costUsd);
    }

    const finalLocalPath = join(workDir, 'final.mp4');
    logStep(index, spec.title, 'concat', clips.length === 1 ? 'copying single clip' : `ffmpeg concat ${clips.length} clips`);
    if (clips.length === 1) {
      copyFileSync(clips[0], finalLocalPath);
    } else {
      concatClips(clips, finalLocalPath);
    }
    const durationSec = probeDurationSec(finalLocalPath, spec.target_duration_sec);

    const storagePrefix = `library/${slug}`;
    const videoStoragePath = `${storagePrefix}/final.mp4`;
    logStep(index, spec.title, 'upload', videoStoragePath);
    await uploadBytes(videoStoragePath, readFileSync(finalLocalPath), { contentType: 'video/mp4', upsert: true });
    const videoSignedUrl = await getSignedUrl(videoStoragePath);

    const thumbnailLocalPath = join(workDir, 'thumbnail.jpg');
    const thumbnailStoragePath = `${storagePrefix}/thumbnail.jpg`;
    logStep(index, spec.title, 'thumbnail', 'ffmpeg last frame extract');
    extractLastFrame(finalLocalPath, thumbnailLocalPath);
    await uploadBytes(thumbnailStoragePath, readFileSync(thumbnailLocalPath), { contentType: 'image/jpeg', upsert: true });
    const thumbnailSignedUrl = await getSignedUrl(thumbnailStoragePath);

    let subtitlesSignedUrl: string | null = null;
    if (SKIP_WHISPER) {
      logStep(index, spec.title, 'whisper', 'skipped by SKIP_WHISPER=1');
    } else {
      logStep(index, spec.title, 'whisper', 'fal-ai/whisper STT to WebVTT');
      const whisper = await transcribeToVtt(videoSignedUrl, durationSec);
      addCost(cost, 'whisper', whisper.costUsd);
      const subtitlesLocalPath = join(workDir, 'subtitles.vtt');
      const subtitlesStoragePath = `${storagePrefix}/subtitles.vtt`;
      writeFileSync(subtitlesLocalPath, whisper.vtt, 'utf-8');
      await uploadBytes(subtitlesStoragePath, Buffer.from(whisper.vtt), {
        contentType: 'text/vtt',
        upsert: true,
      });
      subtitlesSignedUrl = await getSignedUrl(subtitlesStoragePath);
      logStep(index, spec.title, 'whisper', `uploaded subtitles.vtt language=${whisper.language}`, whisper.costUsd);
    }

    logStep(index, spec.title, 'insert', 'library_videos published=false');
    const { data: inserted, error: insertError } = await supabase
      .from('library_videos')
      .insert({
        title: spec.title,
        description: spec.description,
        topic: spec.topic,
        age_band: spec.age_band,
        style_tags: spec.style_tags,
        duration_sec: Math.round(durationSec),
        video_url: videoSignedUrl,
        thumbnail_url: thumbnailSignedUrl,
        subtitles_url: subtitlesSignedUrl,
        character_name: mainCharacter(script).displayName ?? '미리',
        script,
        published: false,
        featured: false,
      })
      .select('id')
      .single();

    if (insertError) throw new Error(`library_videos insert failed: ${insertError.message}`);
    logStep(index, spec.title, 'done', `inserted id=${inserted?.id ?? 'unknown'} total=$${cost.total.toFixed(4)}`);

    return {
      ...reportBase,
      status: 'success',
      elapsedMs: Date.now() - startedAt,
      video_url: videoSignedUrl,
      thumbnail_url: thumbnailSignedUrl,
      subtitles_url: subtitlesSignedUrl,
      library_video_id: inserted?.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${now()}] [${index}] ${spec.title} :: failed — ${message}`);
    return {
      ...reportBase,
      status: 'failed',
      elapsedMs: Date.now() - startedAt,
      error: message,
    };
  }
}

function parseOnlyIndex(): number | null {
  const raw = process.env.ONLY_INDEX;
  if (raw === undefined || raw === '') return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= LIBRARY_MATRIX.length) {
    throw new Error(`ONLY_INDEX must be 0-${LIBRARY_MATRIX.length - 1} (got ${raw})`);
  }
  return parsed;
}

function selectedSpecs(onlyIndex: number | null): Array<{ index: number; spec: LibraryBriefSpec }> {
  if (onlyIndex !== null) return [{ index: onlyIndex, spec: LIBRARY_MATRIX[onlyIndex] }];
  return LIBRARY_MATRIX.map((spec, index) => ({ index, spec }));
}

function buildBatchReport(
  startedAt: string,
  onlyIndex: number | null,
  selectedCount: number,
  results: BriefReport[]
): BatchReport {
  const totalCostUsd = results.reduce((sum, result) => sum + result.costUsd.total, 0);
  return {
    startedAt,
    finishedAt: now(),
    dryRun: DRY_RUN,
    skipWhisper: SKIP_WHISPER,
    onlyIndex,
    selectedCount,
    successCount: results.filter((result) => result.status === 'success').length,
    skippedCount: results.filter((result) => result.status === 'skipped').length,
    failedCount: results.filter((result) => result.status === 'failed').length,
    totalCostUsd,
    results,
  };
}

async function main(): Promise<void> {
  const startedAt = now();
  const onlyIndex = parseOnlyIndex();
  const selected = selectedSpecs(onlyIndex);
  mkdirSync(REPORT_DIR, { recursive: true });

  if (DRY_RUN) {
    const results: BriefReport[] = selected.map(({ index, spec }) => {
      const cost = estimatedDryRunCost(spec.target_duration_sec);
      console.log(
        `[DRY_RUN] [${index}] ${spec.title} | ${spec.topic}/${spec.age_band}세 | ${spec.style_tags.join(',')} | ${spec.topic_subject} | est=$${cost.total.toFixed(2)}`
      );
      return {
        index,
        title: spec.title,
        topic: spec.topic,
        age_band: spec.age_band,
        style_tags: spec.style_tags,
        status: 'dry_run',
        slug: slugForSpec(index, spec),
        workDir: join(REPORT_DIR, slugForSpec(index, spec)),
        elapsedMs: 0,
        costUsd: cost,
      };
    });
    const total = results.reduce((sum, result) => sum + result.costUsd.total, 0);
    console.log(`[DRY_RUN] entries=${results.length} estimated_total=$${total.toFixed(2)} skip_whisper=${SKIP_WHISPER}`);
    writeReport(buildBatchReport(startedAt, onlyIndex, selected.length, results));
    console.log(`[DRY_RUN] report=${REPORT_PATH}`);
    return;
  }

  console.log(`[${now()}] library batch start selected=${selected.length} skip_whisper=${SKIP_WHISPER} tier=${SEEDANCE_TIER}`);
  const results: BriefReport[] = [];
  for (const { index, spec } of selected) {
    const result = await processBrief(index, spec);
    results.push(result);
    writeReport(buildBatchReport(startedAt, onlyIndex, selected.length, results));
  }

  const report = buildBatchReport(startedAt, onlyIndex, selected.length, results);
  writeReport(report);

  console.log(`[${now()}] library batch finished success=${report.successCount} skipped=${report.skippedCount} failed=${report.failedCount} cost=$${report.totalCostUsd.toFixed(4)}`);
  console.log(`report=${REPORT_PATH}`);

  const failures = results.filter((result) => result.status === 'failed');
  if (failures.length > 0) {
    console.error('failed briefs:');
    for (const failure of failures) {
      console.error(`  [${failure.index}] ${failure.title}: ${failure.error}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
