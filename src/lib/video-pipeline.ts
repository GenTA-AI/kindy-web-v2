/**
 * 비디오 생성 오케스트레이터.
 *
 * 6단계 파이프라인:
 *   1. director   — Claude Opus → VideoScript JSON (대본)
 *   2. refs       — nano-banana-pro 캐릭터 레퍼런스 시트 (8뷰)
 *   3. keyframes  — 씬별 첫 키프레임 (레퍼런스 주입)
 *   4. video_s01  — Seedance 2.0 reference-to-video 첫 15s (generate_audio=true 네이티브 TTS+립싱크)
 *   5. video_s02  — (30s+ 시) Video Extension 체이닝 — 0.6x 할인
 *   6. concat     — ffmpeg 재인코딩 후 concat demuxer
 *   7. upload     — Supabase Storage 업로드 + signed URL
 *
 * 진행 상태는 videos 테이블 (phase, progress_pct, cost_ledger JSONB) 에 실시간 기록.
 * Inngest function 이 이 `runPipeline` 을 호출; 실패 시 step 단위 재시도.
 */

import { mkdirSync, readFileSync, writeFileSync, createWriteStream } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ClaudeDirector } from './video-providers/claude-director';
import { NanoBananaProvider } from './video-providers/nano-banana';
import { Seedance2Provider, type SeedanceTier } from './video-providers/seedance2';
import {
  getSceneDialogue,
  getCharacterAppearance,
  resolveSceneLocation,
  type VideoBrief,
  type VideoScript,
  type SceneDef,
} from './video-providers/director.types';
import { supabase } from './supabase';
import { uploadBytes, getSignedUrl, pathFor } from './supabase-storage';
import type { VideoPhase, CostLedger } from '@/types';

/** 1씬당 한 클립 = 최대 Seedance 2.0 duration 15s. 총 길이는 clip 수로 결정 */
const CLIP_MAX_SEC = 15;
const CLIP_MIN_SEC = 4;

export interface PipelineInput {
  /** videos 테이블 row id (이미 INSERT 된 상태) */
  videoId: string;
  /** 감독 에이전트 입력 */
  brief: VideoBrief;
  /** 총 목표 길이 초. 15초 기본, 30초면 video_s02 단계 추가 */
  targetDurationSec?: number;
  /** Seedance tier (fast 면 20% 비용 절감) */
  seedanceTier?: SeedanceTier;
}

export interface PipelineResult {
  videoId: string;
  finalVideoPath: string;           // Storage 내부 경로 (signed URL 재발급용)
  signedUrl: string;                // 즉시 재생 가능한 URL
  durationSec: number;
  cost: CostLedger;
  elapsedMs: number;
  script: VideoScript;
  seed?: number;
}

// ──────────────────────────────────────────────────────────
// 상태 업데이트 헬퍼 (videos 테이블)
// ──────────────────────────────────────────────────────────

async function updatePhase(
  videoId: string,
  phase: VideoPhase,
  progressPct: number,
  patch: Record<string, unknown> = {}
) {
  const { error } = await supabase
    .from('videos')
    .update({
      status: phase === 'done' ? 'ready' : 'generating',
      phase,
      progress_pct: progressPct,
      last_attempt_at: new Date().toISOString(),
      ...patch,
    })
    .eq('id', videoId);
  if (error) throw new Error(`update videos phase failed: ${error.message}`);
}

async function mergeCostLedger(videoId: string, partial: Partial<CostLedger>) {
  // atomic 증분이 필요하면 RPC 로 옮길 수 있음. 현 MVP 는 read-modify-write.
  const { data, error } = await supabase
    .from('videos')
    .select('cost_ledger')
    .eq('id', videoId)
    .single();
  if (error) throw new Error(`read cost_ledger failed: ${error.message}`);
  const current = (data?.cost_ledger as CostLedger) ?? {};
  const merged: CostLedger = { ...current, ...partial };
  merged.total = [
    merged.director, merged.refs, merged.keyframes,
    merged.video_s01, merged.video_s02, merged.concat, merged.upload,
  ].reduce<number>((a, b) => a + (b ?? 0), 0);
  const { error: upErr } = await supabase
    .from('videos')
    .update({ cost_ledger: merged })
    .eq('id', videoId);
  if (upErr) throw new Error(`update cost_ledger failed: ${upErr.message}`);
  return merged;
}

async function markFailed(videoId: string, phase: VideoPhase, err: unknown) {
  const reason = err instanceof Error ? `${phase}: ${err.message}` : `${phase}: ${String(err)}`;
  await supabase
    .from('videos')
    .update({
      status: 'failed',
      error_reason: reason.slice(0, 500),
      last_attempt_at: new Date().toISOString(),
    })
    .eq('id', videoId);
}

// ──────────────────────────────────────────────────────────
// ffmpeg 헬퍼 (로컬 실행 가정 — GCP Cloud Run 이미지에 ffmpeg 포함 필요)
// ──────────────────────────────────────────────────────────

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

function ffmpegConcat(inputs: string[], outPath: string): void {
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

async function downloadToFile(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed ${res.status}`);
  const fileStream = createWriteStream(outPath);
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), fileStream);
}

// ──────────────────────────────────────────────────────────
// Seedance 프롬프트 빌더
// ──────────────────────────────────────────────────────────

function buildStyleDirective(script: VideoScript): string {
  return Array.isArray(script.styleDirectives)
    ? script.styleDirectives.join(', ')
    : script.styleDirectives;
}

/** 첫 N 씬을 15s single-take 로 압축 */
function buildFirstChunkPrompt(script: VideoScript, scenesToUse: number, durationSec: number): string {
  const styleDirective = buildStyleDirective(script);
  const main = script.characters[0];
  const scenes = script.scenes.slice(0, scenesToUse);

  let elapsed = 0;
  const beats: string[] = [];
  const dialogues: string[] = [];
  for (const sc of scenes) {
    const segEnd = elapsed + sc.durationSec;
    const loc = resolveSceneLocation(script, sc.location);
    const dial = getSceneDialogue(sc);
    beats.push(
      `${elapsed}–${segEnd}s [${loc || sc.id}]: ${sc.action ?? ''} Camera: ${sc.camera ?? ''}. ${sc.effects ? `Effects: ${sc.effects}.` : ''} ${dial ? `${main.displayName} speaks naturally in Korean: "${dial.text}"` : ''}`
    );
    if (dial) dialogues.push(dial.text);
    elapsed = segEnd;
  }
  const checklist = (script.consistencyChecklist ?? []).map((c) => `- ${typeof c === 'string' ? c : String(c)}`).join('\n');

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

/** Scene 2+ 확장 프롬프트 — @Video1 + 마지막 프레임 @Image2 주입 */
function buildExtensionPrompt(script: VideoScript, fromSceneIdx: number, durationSec: number): string {
  const styleDirective = buildStyleDirective(script);
  const main = script.characters[0];
  const tail = script.scenes.slice(fromSceneIdx);

  let elapsed = 0;
  const beats: string[] = [];
  const dialogues: string[] = [];
  for (const sc of tail) {
    const segEnd = elapsed + sc.durationSec;
    const loc = resolveSceneLocation(script, sc.location);
    const dial = getSceneDialogue(sc);
    beats.push(
      `${elapsed}–${segEnd}s [${loc || sc.id}]: ${sc.action ?? ''} Camera: ${sc.camera ?? ''}. ${sc.effects ? `Effects: ${sc.effects}.` : ''} ${dial ? `${main.displayName} speaks naturally in Korean: "${dial.text}"` : ''}`
    );
    if (dial) dialogues.push(dial.text);
    elapsed = segEnd;
  }
  const checklist = (script.consistencyChecklist ?? []).map((c) => `- ${typeof c === 'string' ? c : String(c)}`).join('\n');

  return `[Top-level cinematic statement]
${script.topLevelPrompt}

Style: ${styleDirective}
Tone: ${script.toneAndMood}

[Continuation of previous clip — ${durationSec}s single take, NO cut]

@Video1 is the previous clip that just ended. This new clip begins IMMEDIATELY where @Video1 ended, preserving the same character design, color palette, art style, and voice of ${main.displayName}. Treat this as one continuous film.

@Image1 is the character design bible for ${main.displayName}. Miri MUST look identical to @Video1.

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

// ──────────────────────────────────────────────────────────
// 단계 함수들
// ──────────────────────────────────────────────────────────

async function stepDirector(
  videoId: string,
  brief: VideoBrief,
  workDir: string
): Promise<VideoScript> {
  await updatePhase(videoId, 'director', 5);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
  const director = new ClaudeDirector({ apiKey, model: process.env.CLAUDE_MODEL ?? 'claude-opus-4-7' });
  const result = await director.direct(brief);
  writeFileSync(join(workDir, 'script.json'), JSON.stringify(result.script, null, 2));
  // Storage 에 대본 영구 저장 (디버그/재생성용)
  await uploadBytes(pathFor(videoId, 'script.json'), Buffer.from(JSON.stringify(result.script, null, 2)));
  await supabase.from('videos').update({ script: result.script }).eq('id', videoId);
  await mergeCostLedger(videoId, { director: result.costUsd });
  return result.script;
}

async function stepCharacterRef(
  videoId: string,
  script: VideoScript,
  workDir: string
): Promise<string> {
  await updatePhase(videoId, 'refs', 15);
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY missing');
  const nano = new NanoBananaProvider(apiKey);
  const main = script.characters[0];
  const appearance = getCharacterAppearance(main);
  const styleDirective = buildStyleDirective(script);
  const mouthSpec = (main as unknown as { mouthSpec?: string }).mouthSpec;

  const prompt = `Create a character reference model sheet on a clean pure white background for children's animation production.

CHARACTER: ${main.displayName}${main.archetype ? ` (${main.archetype})` : ''}
${appearance}

Personality: ${main.personality}
${mouthSpec ? `\nMouth rendering spec: ${mouthSpec}` : ''}

SHEET: 4 body views (front, 3/4, side, back) + 4 mouth-focused expressions (neutral smile, talking with teeth, surprised O, wide smile).

STYLE: ${styleDirective}

Upper and lower lips MUST be clearly drawn in every view. Mouth ≥ 5% of face area. This sheet is the definitive design bible.`;

  const { bytes, costUsd } = await nano.generateImageFromFiles(prompt, [], '16:9');
  const localPath = join(workDir, 'character_ref.png');
  writeFileSync(localPath, bytes);
  await uploadBytes(pathFor(videoId, 'character_ref.png'), bytes);
  await mergeCostLedger(videoId, { refs: costUsd });
  return localPath;
}

async function stepKeyframe(
  videoId: string,
  script: VideoScript,
  scene: SceneDef,
  refPath: string,
  workDir: string,
  sceneIdx: number
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY!;
  const nano = new NanoBananaProvider(apiKey);
  const main = script.characters[0];
  const styleDirective = buildStyleDirective(script);
  const locationDesc = resolveSceneLocation(script, scene.location);

  const prompt = `Create a single 16:9 first-frame keyframe for this scene of a children's educational animation.

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

  const { bytes, costUsd } = await nano.generateImageFromFiles(prompt, [refPath], '16:9');
  const filename = `s${String(sceneIdx + 1).padStart(2, '0')}_keyframe.png`;
  const localPath = join(workDir, filename);
  writeFileSync(localPath, bytes);
  await uploadBytes(pathFor(videoId, filename), bytes);
  const ledger = await mergeCostLedger(videoId, { keyframes: (await readLedgerFor(videoId, 'keyframes')) + costUsd });
  void ledger;
  return localPath;
}

async function readLedgerFor(videoId: string, key: keyof CostLedger): Promise<number> {
  const { data } = await supabase.from('videos').select('cost_ledger').eq('id', videoId).single();
  const ledger = (data?.cost_ledger as CostLedger) ?? {};
  return ledger[key] ?? 0;
}

async function stepVideoFirst(
  videoId: string,
  script: VideoScript,
  refPath: string,
  keyframePath: string,
  scenesInChunk: number,
  durationSec: number,
  tier: SeedanceTier,
  workDir: string
): Promise<{ path: string; seed?: number }> {
  await updatePhase(videoId, 'video_s01', 35);
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY missing');
  const seedance = new Seedance2Provider(falKey);
  const prompt = buildFirstChunkPrompt(script, scenesInChunk, durationSec);
  const result = await seedance.generateFromFiles({
    prompt,
    imageFilePaths: [refPath, keyframePath],
    durationSec,
    resolution: '720p',
    aspectRatio: '16:9',
    generateAudio: true,
    tier,
  });
  const localPath = join(workDir, 's01.mp4');
  await downloadToFile(result.videoUrl, localPath);
  await uploadBytes(pathFor(videoId, 's01.mp4'), readFileSync(localPath));
  await mergeCostLedger(videoId, { video_s01: result.costUsd });
  if (result.seed !== undefined) {
    await supabase.from('videos').update({ seed: result.seed, provider_used: 'seedance-2.0' }).eq('id', videoId);
  }
  return { path: localPath, seed: result.seed };
}

async function stepVideoExtension(
  videoId: string,
  script: VideoScript,
  refPath: string,
  firstVideoPath: string,
  fromSceneIdx: number,
  durationSec: number,
  tier: SeedanceTier,
  workDir: string,
  seed?: number
): Promise<string> {
  await updatePhase(videoId, 'video_s02', 65);
  const falKey = process.env.FAL_KEY!;

  // 1st 마지막 프레임 추출 → @Image2
  const lastFramePath = join(workDir, 'last_frame.jpg');
  extractLastFrame(firstVideoPath, lastFramePath);

  const seedance = new Seedance2Provider(falKey);
  const prompt = buildExtensionPrompt(script, fromSceneIdx, durationSec);
  const result = await seedance.generateFromFiles({
    prompt,
    imageFilePaths: [refPath, lastFramePath],
    videoFilePaths: [firstVideoPath],
    durationSec,
    resolution: '720p',
    aspectRatio: '16:9',
    generateAudio: true,
    tier,
    seed,
  });
  const localPath = join(workDir, 's02.mp4');
  await downloadToFile(result.videoUrl, localPath);
  await uploadBytes(pathFor(videoId, 's02.mp4'), readFileSync(localPath));
  await mergeCostLedger(videoId, { video_s02: result.costUsd });
  return localPath;
}

async function stepConcatAndUpload(
  videoId: string,
  clips: string[],
  workDir: string
): Promise<{ path: string; signedUrl: string; durationSec: number }> {
  await updatePhase(videoId, 'concat', 85);
  const finalLocal = join(workDir, 'final.mp4');
  if (clips.length === 1) {
    // concat 불필요 — copy
    const bytes = readFileSync(clips[0]);
    writeFileSync(finalLocal, bytes);
  } else {
    ffmpegConcat(clips, finalLocal);
  }

  await updatePhase(videoId, 'upload', 95);
  const bytes = readFileSync(finalLocal);
  const finalPath = pathFor(videoId, 'final.mp4');
  await uploadBytes(finalPath, bytes, { contentType: 'video/mp4' });

  // duration 측정
  const r = spawnSync('ffprobe', [
    '-v', 'quiet',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    finalLocal,
  ], { encoding: 'utf-8' });
  const durationSec = r.status === 0 ? parseFloat(r.stdout.trim()) : 0;

  const signedUrl = await getSignedUrl(finalPath);
  return { path: finalPath, signedUrl, durationSec };
}

// ──────────────────────────────────────────────────────────
// 메인 엔트리
// ──────────────────────────────────────────────────────────

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const startedAt = Date.now();
  const targetDuration = input.targetDurationSec ?? 15;
  const tier = input.seedanceTier ?? (process.env.SEEDANCE_TIER as SeedanceTier | undefined) ?? 'standard';
  const workDir = join(tmpdir(), 'eduvid-pipeline', input.videoId);
  mkdirSync(workDir, { recursive: true });

  // 재시도 카운트 증가
  const { data: current } = await supabase
    .from('videos')
    .select('attempt_count')
    .eq('id', input.videoId)
    .single();
  await supabase
    .from('videos')
    .update({ attempt_count: (current?.attempt_count ?? 0) + 1 })
    .eq('id', input.videoId);

  try {
    // 1. Director
    const script = await stepDirector(input.videoId, input.brief, workDir);

    // 2. Character reference
    const refPath = await stepCharacterRef(input.videoId, script, workDir);

    // 3. Keyframe — first chunk 커버 씬들의 첫 씬 키프레임
    await updatePhase(input.videoId, 'keyframes', 25);
    const firstChunkScenes = script.scenes.reduce<{ count: number; dur: number }>(
      (acc, s) => (acc.dur + s.durationSec <= CLIP_MAX_SEC ? { count: acc.count + 1, dur: acc.dur + s.durationSec } : acc),
      { count: 0, dur: 0 }
    );
    const firstChunkCount = Math.max(1, firstChunkScenes.count);
    const firstChunkDurationSec = Math.min(CLIP_MAX_SEC, Math.max(CLIP_MIN_SEC, targetDuration <= CLIP_MAX_SEC ? targetDuration : CLIP_MAX_SEC));
    const firstKeyframePath = await stepKeyframe(input.videoId, script, script.scenes[0], refPath, workDir, 0);

    // 4. Video s01
    const { path: firstVideoPath, seed } = await stepVideoFirst(
      input.videoId, script, refPath, firstKeyframePath,
      firstChunkCount, firstChunkDurationSec, tier, workDir
    );

    const clips = [firstVideoPath];

    // 5. Video s02 (30s+ 시)
    if (targetDuration > CLIP_MAX_SEC) {
      const extensionDurationSec = Math.min(CLIP_MAX_SEC, Math.max(CLIP_MIN_SEC, targetDuration - CLIP_MAX_SEC));
      const secondVideoPath = await stepVideoExtension(
        input.videoId, script, refPath, firstVideoPath,
        firstChunkCount, extensionDurationSec, tier, workDir, seed
      );
      clips.push(secondVideoPath);
    }

    // 6. Concat + Upload
    const { path: finalPath, signedUrl, durationSec } = await stepConcatAndUpload(
      input.videoId, clips, workDir
    );

    // 7. Done
    const elapsedMs = Date.now() - startedAt;
    await updatePhase(input.videoId, 'done', 100, {
      video_url: signedUrl,
      video_path: finalPath,
      duration_sec: Math.round(durationSec),
      elapsed_ms: elapsedMs,
      status: 'ready',
    });

    const ledger = await readFullLedger(input.videoId);
    return {
      videoId: input.videoId,
      finalVideoPath: finalPath,
      signedUrl,
      durationSec,
      cost: ledger,
      elapsedMs,
      script,
      seed,
    };
  } catch (err) {
    // 현 phase 추적을 위해 최근 phase 를 읽어 기록
    const { data } = await supabase.from('videos').select('phase').eq('id', input.videoId).single();
    const phase = (data?.phase as VideoPhase) ?? 'director';
    await markFailed(input.videoId, phase, err);
    throw err;
  }
}

async function readFullLedger(videoId: string): Promise<CostLedger> {
  const { data } = await supabase.from('videos').select('cost_ledger').eq('id', videoId).single();
  return (data?.cost_ledger as CostLedger) ?? {};
}
