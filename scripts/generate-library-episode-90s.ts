// npx tsx --env-file=.env.local scripts/generate-library-episode-90s.ts
// 옵션:
//   LIMIT_COUNT=3            // 첫 3편만 처리
//   ONLY_INDEX=N             // 특정 인덱스만
//   SKIP_LIPSYNC=1           // 디버그: voiceover 만
//   ANIMATION_MODE=limited   // 저비용: 정지컷+입뻐끔+슬로우 카메라
//   DRY_RUN=1                // 매트릭스만 출력

import 'dotenv/config';

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  EPISODE_UNIT_SEC,
  LIBRARY_MATRIX_90S,
  type LibraryEpisodeSpec,
} from './library-matrix-90s';
import { runEpisodePipeline, type EpisodeAnimationMode, type EpisodeOutput } from '../src/lib/episode-pipeline';
import { getSupabase } from '../src/lib/supabase';
import { getSignedUrl } from '../src/lib/supabase-storage';
import type { EpisodeScene, VideoBrief } from '../src/lib/video-providers/director.types';
import type { SeedanceTier } from '../src/lib/video-providers/seedance2';

const REPORT_DIR = join(process.cwd(), 'tmp', 'library-90s');
const REPORT_PATH = join(REPORT_DIR, 'report.json');
const DRY_RUN = process.env.DRY_RUN === '1';
const SKIP_LIPSYNC = process.env.SKIP_LIPSYNC === '1';
const SEEDANCE_TIER = (process.env.SEEDANCE_TIER ?? 'standard') as SeedanceTier;
const ANIMATION_MODE = resolveAnimationMode(process.env.EPISODE_ANIMATION_MODE ?? process.env.ANIMATION_MODE);
const EPISODE_LIPSYNC = resolveEpisodeLipsyncMode(SKIP_LIPSYNC, process.env.EPISODE_LIPSYNC);

type EpisodeStatus = 'success' | 'failed' | 'skipped' | 'dry_run';

interface CostBreakdown {
  director: number;
  refs: number;
  keyframes: number;
  videoSilent: number;
  tts: number;
  veed: number;
  lipsync: number;
  concat: number;
  upload: number;
  total: number;
}

interface EpisodeReport {
  index: number;
  title: string;
  topic: LibraryEpisodeSpec['topic'];
  age_band: LibraryEpisodeSpec['age_band'];
  style_tags: string[];
  status: EpisodeStatus;
  slug: string;
  workDir: string;
  elapsedMs: number;
  costUsd: CostBreakdown;
  video_url?: string;
  thumbnail_url?: string;
  subtitles_url?: string;
  library_video_id?: string;
  skipReason?: string;
  error?: string;
}

interface BatchReport {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  skipLipsync: boolean;
  animationMode: EpisodeAnimationMode;
  onlyIndex: number | null;
  limitCount: number | null;
  selectedCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  totalCostUsd: number;
  results: EpisodeReport[];
}

function now(): string {
  return new Date().toISOString();
}

function logStep(index: number, title: string, step: string, message: string, costUsd?: number): void {
  const cost = costUsd === undefined ? '' : ` cost=$${costUsd.toFixed(4)}`;
  console.log(`[${now()}] [${index}] ${title} :: ${step} — ${message}${cost}`);
}

function slugForSpec(index: number, spec: LibraryEpisodeSpec): string {
  const style = spec.style_tags[0] ?? 'style';
  return `${String(index).padStart(2, '0')}-${style}-${spec.topic}-age${spec.age_band}-90s`;
}

function resolveAnimationMode(raw: string | undefined): EpisodeAnimationMode {
  if (!raw) return 'premium';
  if (raw === 'premium' || raw === 'limited') return raw;
  throw new Error(`ANIMATION_MODE must be "premium" or "limited" (got ${raw})`);
}

function resolveEpisodeLipsyncMode(skipLipsync: boolean, raw: string | undefined): 'veed' | 'sync' | 'off' {
  if (skipLipsync) return 'off';
  if (!raw) return 'veed';
  if (raw === 'veed' || raw === 'sync' || raw === 'off') return raw;
  throw new Error(`EPISODE_LIPSYNC must be "veed", "sync", or "off" (got ${raw})`);
}

function styleReferenceFrom(styleTags: string[]): string {
  const labels: Record<string, string> = {
    princess: 'soft fairy-tale princess world, small tiara, gentle sparkles, storybook castle garden warmth',
    kpop: 'K-kids pop stage energy, rhythmic camera moves, cheerful concert lighting, headset mic performance',
    space: 'friendly space explorer adventure, soft stars, rounded rocket props, wonder-filled cosmic classroom',
  };
  const style = styleTags.map((tag) => labels[tag] ?? tag).join(', ');
  const base = 'cinematic 2D cel animation with soft watercolor backgrounds, Pinkfong/Pororo-level kid-friendly warmth, pastel palette, 90-second episode with stable character continuity';
  return style ? `${base}. Scene mood: ${style}` : base;
}

function toVideoBrief(spec: LibraryEpisodeSpec): VideoBrief {
  return {
    topic: spec.topic_subject,
    audience: `${spec.age_band}세 유치원`,
    targetDurationSec: EPISODE_UNIT_SEC,
    learningGoals: spec.learning_goals,
    styleReference: styleReferenceFrom(spec.style_tags),
    tone: '밝고 따뜻하며 호기심을 자극하는',
    roughSynopsis: spec.rough_synopsis,
    protagonistHint: spec.protagonist_hint,
    referenceImagePaths: spec.reference_image_paths?.map((path) => resolve(process.cwd(), path)),
  };
}

function costFromOutput(output: EpisodeOutput): CostBreakdown {
  const cost = output.perStageCostUsd;
  return {
    ...cost,
    total: output.totalCostUsd,
  };
}

function estimatedDryRunCost(): CostBreakdown {
  if (ANIMATION_MODE === 'limited') {
    const director = 0.8;
    const refs = 0.039;
    const keyframes = 6 * 0.039;
    const videoSilent = 0;
    const tts = 0.03;
    // DRY_RUN reference estimate from 2026 studio ledger: VEED ≈ $0.05/dialogue scene.
    const veed = EPISODE_LIPSYNC === 'veed' ? 3 * 0.05 : 0;
    const lipsync = 0;
    const concat = 0;
    const upload = 0;
    const total = director + refs + keyframes + videoSilent + tts + veed + lipsync + concat + upload;
    return { director, refs, keyframes, videoSilent, tts, veed, lipsync, concat, upload, total };
  }

  const seedanceRate = SEEDANCE_TIER === 'fast' ? 0.2419 : 0.3024;
  const director = 0.8;
  const refs = 0.039;
  const keyframes = 6 * 0.039;
  const videoSilent = (EPISODE_LIPSYNC === 'veed' ? 60 : EPISODE_UNIT_SEC) * seedanceRate;
  const tts = 0.03;
  // DRY_RUN reference estimate from 2026 studio ledger: VEED ≈ $0.05/dialogue scene.
  const veed = EPISODE_LIPSYNC === 'veed' ? 3 * 0.05 : 0;
  const lipsync = EPISODE_LIPSYNC === 'sync' ? 30 * 0.05 : 0;
  const concat = 0;
  const upload = 0;
  const total = director + refs + keyframes + videoSilent + tts + veed + lipsync + concat + upload;
  return { director, refs, keyframes, videoSilent, tts, veed, lipsync, concat, upload, total };
}

function buildSceneRows(scenes: EpisodeScene[]): Array<Record<string, unknown>> {
  let elapsed = 0;
  return scenes.map((scene) => {
    const start = elapsed;
    const end = elapsed + scene.durationSec;
    elapsed = end;
    return {
      index: scene.index,
      type: scene.type,
      start_sec: start,
      end_sec: end,
      duration_sec: scene.durationSec,
      narration_text: scene.narrationText ?? null,
      dialogue_text: scene.dialogueText ?? null,
      wait_beat_sec: scene.waitBeatSec ?? null,
      lipsync_required: scene.type === 'character_speaking',
      location: scene.location ?? null,
      emotion: scene.emotion,
      visual_action: scene.visualAction,
      camera_directive: scene.cameraDirective,
    };
  });
}

function writeReport(report: BatchReport): void {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
}

async function processEpisode(index: number, spec: LibraryEpisodeSpec): Promise<EpisodeReport> {
  const startedAt = Date.now();
  const slug = slugForSpec(index, spec);
  const workDir = join(REPORT_DIR, slug);
  const storagePrefix = `library/90s/${slug}`;
  mkdirSync(workDir, { recursive: true });

  const reportBase = {
    index,
    title: spec.title,
    topic: spec.topic,
    age_band: spec.age_band,
    style_tags: spec.style_tags,
    slug,
    workDir,
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
      .eq('episode_unit_sec', 90)
      .maybeSingle();

    if (existingError) throw new Error(`library_videos lookup failed: ${existingError.message}`);
    if (existing) {
      const published = (existing as { published?: boolean }).published;
      logStep(index, spec.title, 'skip', `exists episode_unit_sec=90 (published=${published})`);
      return {
        ...reportBase,
        status: 'skipped',
        elapsedMs: Date.now() - startedAt,
        costUsd: estimatedDryRunCost(),
        library_video_id: (existing as { id?: string }).id,
        skipReason: `exists episode_unit_sec=90 (published=${published})`,
      };
    }

    logStep(index, spec.title, 'pipeline', `runEpisodePipeline mode=${ANIMATION_MODE} tier=${SEEDANCE_TIER} skip_lipsync=${SKIP_LIPSYNC}`);
    const output = await runEpisodePipeline({
      brief: toVideoBrief(spec),
      workDir,
      storagePrefix,
      seedanceTier: SEEDANCE_TIER,
      skipLipsync: SKIP_LIPSYNC,
      animationMode: ANIMATION_MODE,
    });

    const videoSignedUrl = await getSignedUrl(output.finalVideoStoragePath);
    const thumbnailSignedUrl = await getSignedUrl(output.thumbnailStoragePath);
    const subtitlesSignedUrl = await getSignedUrl(output.subtitlesStoragePath);

    logStep(index, spec.title, 'insert', 'library_videos published=false episode_unit_sec=90');
    const { data: inserted, error: insertError } = await supabase
      .from('library_videos')
      .insert({
        title: spec.title,
        description: spec.description,
        topic: spec.topic,
        age_band: spec.age_band,
        style_tags: spec.style_tags,
        duration_sec: Math.round(output.totalDurationSec),
        video_url: videoSignedUrl,
        thumbnail_url: thumbnailSignedUrl,
        subtitles_url: subtitlesSignedUrl,
        // P0-3: 서빙 시 요청당 재서명용 storage 경로. 없으면 30일 뒤 재생 불가.
        video_path: output.finalVideoStoragePath,
        thumbnail_path: output.thumbnailStoragePath,
        subtitles_path: output.subtitlesStoragePath,
        character_name: output.script.characters[0]?.displayName ?? '모리',
        script: output.script,
        scenes: buildSceneRows(output.scenes),
        // P1-5: 선별 기반 초개인화 태그. 매트릭스가 채운다(0020). null=미태깅.
        c6_focus: spec.c6_focus ?? null,
        episode_unit_sec: 90,
        published: false,
        featured: false,
      })
      .select('id')
      .single();

    if (insertError) throw new Error(`library_videos insert failed: ${insertError.message}`);

    const cost = costFromOutput(output);
    logStep(index, spec.title, 'done', `inserted id=${inserted?.id ?? 'unknown'}`, cost.total);
    return {
      ...reportBase,
      status: 'success',
      elapsedMs: Date.now() - startedAt,
      costUsd: cost,
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
      costUsd: estimatedDryRunCost(),
      error: message,
    };
  }
}

function parseOnlyIndex(): number | null {
  const raw = process.env.ONLY_INDEX;
  if (raw === undefined || raw === '') return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= LIBRARY_MATRIX_90S.length) {
    throw new Error(`ONLY_INDEX must be 0-${LIBRARY_MATRIX_90S.length - 1} (got ${raw})`);
  }
  return parsed;
}

function parseLimitCount(): number | null {
  const raw = process.env.LIMIT_COUNT;
  if (raw === undefined || raw === '') return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`LIMIT_COUNT must be a non-negative integer (got ${raw})`);
  }
  return parsed;
}

function selectedSpecs(
  onlyIndex: number | null,
  limitCount: number | null
): Array<{ index: number; spec: LibraryEpisodeSpec }> {
  if (onlyIndex !== null) return [{ index: onlyIndex, spec: LIBRARY_MATRIX_90S[onlyIndex] }];
  const all = LIBRARY_MATRIX_90S.map((spec, index) => ({ index, spec }));
  return limitCount === null ? all : all.slice(0, limitCount);
}

function buildBatchReport(
  startedAt: string,
  onlyIndex: number | null,
  limitCount: number | null,
  selectedCount: number,
  results: EpisodeReport[]
): BatchReport {
  const totalCostUsd = results.reduce((sum, result) => sum + result.costUsd.total, 0);
  return {
    startedAt,
    finishedAt: now(),
    dryRun: DRY_RUN,
    skipLipsync: SKIP_LIPSYNC,
    animationMode: ANIMATION_MODE,
    onlyIndex,
    limitCount,
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
  const limitCount = parseLimitCount();
  const selected = selectedSpecs(onlyIndex, limitCount);
  mkdirSync(REPORT_DIR, { recursive: true });

  if (DRY_RUN) {
    const results: EpisodeReport[] = selected.map(({ index, spec }) => {
      const cost = estimatedDryRunCost();
      console.log(
        `[DRY_RUN] [${index}] ${spec.title} | ${spec.topic}/${spec.age_band}세 | ${spec.style_tags.join(',')} | ${spec.topic_subject} | episode_unit_sec=${EPISODE_UNIT_SEC} | mode=${ANIMATION_MODE} | est=$${cost.total.toFixed(2)}`
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
    const report = buildBatchReport(startedAt, onlyIndex, limitCount, selected.length, results);
    writeReport(report);
    console.log(`[DRY_RUN] entries=${results.length} estimated_total=$${report.totalCostUsd.toFixed(2)} mode=${ANIMATION_MODE} skip_lipsync=${SKIP_LIPSYNC}`);
    console.log(`[DRY_RUN] report=${REPORT_PATH}`);
    return;
  }

  console.log(`[${now()}] library 90s batch start selected=${selected.length} limit=${limitCount ?? 'all'} mode=${ANIMATION_MODE} skip_lipsync=${SKIP_LIPSYNC} tier=${SEEDANCE_TIER}`);

  // 정본 레퍼런스 프리플라이트 — 파이프라인 내부 검사(stepCharacterRef)는 director 호출($~0.8)
  // 뒤에 오므로, 여기서 무비용으로 먼저 실패시킨다.
  for (const { index, spec } of selected) {
    const missing = (spec.reference_image_paths ?? [])
      .map((path) => resolve(process.cwd(), path))
      .filter((path) => !existsSync(path));
    if (missing.length > 0) {
      throw new Error(`[${index}] ${spec.title}: 정본 레퍼런스 이미지 없음 — ${missing.join(', ')}`);
    }
  }

  // P0-3 프리플라이트: migration 0021(*_path 컬럼) 미적용 DB에서 유료 생성이 끝난 뒤
  // insert 단계에서야 실패하는 것을 막는다 — 생성 시작 전에 컬럼 존재를 확인.
  {
    const { error: pathColumnError } = await getSupabase()
      .from('library_videos')
      .select('video_path')
      .limit(1);
    if (pathColumnError) {
      throw new Error(
        `library_videos.video_path 확인 실패 — supabase/migrations/0021_library_media_paths.sql 적용 후 재실행: ${pathColumnError.message}`
      );
    }
  }

  const results: EpisodeReport[] = [];
  for (const { index, spec } of selected) {
    const result = await processEpisode(index, spec);
    results.push(result);
    writeReport(buildBatchReport(startedAt, onlyIndex, limitCount, selected.length, results));
  }

  const report = buildBatchReport(startedAt, onlyIndex, limitCount, selected.length, results);
  writeReport(report);

  console.log(`[${now()}] library 90s batch finished success=${report.successCount} skipped=${report.skippedCount} failed=${report.failedCount} cost=$${report.totalCostUsd.toFixed(4)}`);
  console.log(`report=${REPORT_PATH}`);

  const failures = results.filter((result) => result.status === 'failed');
  if (failures.length > 0) {
    console.error('failed episodes:');
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
