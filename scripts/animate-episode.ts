// npx tsx --env-file=.env.local scripts/animate-episode.ts
// DRY_RUN=1 npx tsx scripts/animate-episode.ts

import 'dotenv/config';

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  EPISODE_UNIT_SEC,
  LIBRARY_MATRIX_ANIMAL_VILLAGE,
  type LibraryEpisodeSpec,
} from './library-matrix-90s';
import { runEpisodePipeline, type EpisodeAnimationMode, type EpisodeOutput } from '../src/lib/episode-pipeline';
import { runEpisodeQc, type QcReport } from '../src/lib/studio/qa-agent';
import type { EpisodeScene, VideoBrief } from '../src/lib/video-providers/director.types';
import type { SeedanceTier } from '../src/lib/video-providers/seedance2';

type EpisodeLipsyncMode = 'veed' | 'sync' | 'off';
type StageStatus = 'success' | 'warn' | 'fail' | 'failed' | 'skipped' | 'dry_run';

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

interface StageRecord {
  name: string;
  status: StageStatus;
  elapsedMs: number;
  costUsd: number;
  artifacts: string[];
  error?: string;
}

interface StageResult<T> {
  value: T;
  status?: StageStatus;
  costUsd?: number;
  artifacts?: string[];
}

interface RunnerConfig {
  index: number;
  dryRun: boolean;
  animationMode: EpisodeAnimationMode;
  episodeLipsync: EpisodeLipsyncMode;
  skipQc: boolean;
  insertDb: boolean;
  seedanceTier: SeedanceTier;
}

interface InsertResult {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  subtitlesUrl: string;
}

interface StudioRunReport {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  config: RunnerConfig;
  spec: {
    index: number;
    title: string;
    topic: string;
    age_band: number;
    style_tags: string[];
    topic_subject: string;
    c6_focus: string;
  };
  slug: string;
  workDir: string;
  storagePrefix: string;
  stages: StageRecord[];
  estimatedCostUsd?: CostBreakdown;
  output?: {
    finalVideoLocalPath: string;
    finalVideoStoragePath: string;
    thumbnailLocalPath: string;
    thumbnailStoragePath: string;
    subtitlesVttLocalPath: string;
    subtitlesStoragePath: string;
    totalDurationSec: number;
    totalCostUsd: number;
  };
  qc?: QcReport;
  insert?: InsertResult;
  error?: string;
}

function now(): string {
  return new Date().toISOString();
}

function slugForSpec(index: number, spec: LibraryEpisodeSpec): string {
  const style = spec.style_tags[0] ?? 'style';
  return `${String(index).padStart(2, '0')}-${style}-${spec.topic}-age${spec.age_band}-90s`;
}

function resolveConfig(): RunnerConfig {
  return {
    index: parseOnlyIndex(),
    dryRun: process.env.DRY_RUN === '1',
    animationMode: resolveAnimationMode(process.env.EPISODE_ANIMATION_MODE),
    episodeLipsync: resolveEpisodeLipsyncMode(process.env.EPISODE_LIPSYNC),
    skipQc: process.env.SKIP_QC === '1',
    insertDb: process.env.INSERT_DB === '1',
    seedanceTier: (process.env.SEEDANCE_TIER ?? 'standard') as SeedanceTier,
  };
}

function parseOnlyIndex(): number {
  const raw = process.env.ONLY_INDEX;
  if (raw === undefined || raw === '') return 0;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= LIBRARY_MATRIX_ANIMAL_VILLAGE.length) {
    throw new Error(`ONLY_INDEX must be 0-${LIBRARY_MATRIX_ANIMAL_VILLAGE.length - 1} (got ${raw})`);
  }
  return parsed;
}

function resolveAnimationMode(raw: string | undefined): EpisodeAnimationMode {
  if (!raw) return 'limited';
  if (raw === 'premium' || raw === 'limited') return raw;
  throw new Error(`EPISODE_ANIMATION_MODE must be "premium" or "limited" (got ${raw})`);
}

function resolveEpisodeLipsyncMode(raw: string | undefined): EpisodeLipsyncMode {
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

function estimatedDryRunCost(config: RunnerConfig): CostBreakdown {
  if (config.animationMode === 'limited') {
    const director = 0.8;
    const refs = 0.039;
    const keyframes = 6 * 0.039;
    const videoSilent = 0;
    const tts = 0.03;
    const veed = config.episodeLipsync === 'veed' ? 3 * 0.05 : 0;
    const lipsync = 0;
    const concat = 0;
    const upload = 0;
    const total = director + refs + keyframes + videoSilent + tts + veed + lipsync + concat + upload;
    return { director, refs, keyframes, videoSilent, tts, veed, lipsync, concat, upload, total };
  }

  const seedanceRate = config.seedanceTier === 'fast' ? 0.2419 : 0.3024;
  const director = 0.8;
  const refs = 0.039;
  const keyframes = 6 * 0.039;
  const videoSilent = (config.episodeLipsync === 'veed' ? 60 : EPISODE_UNIT_SEC) * seedanceRate;
  const tts = 0.03;
  const veed = config.episodeLipsync === 'veed' ? 3 * 0.05 : 0;
  const lipsync = config.episodeLipsync === 'sync' ? 30 * 0.05 : 0;
  const concat = 0;
  const upload = 0;
  const total = director + refs + keyframes + videoSilent + tts + veed + lipsync + concat + upload;
  return { director, refs, keyframes, videoSilent, tts, veed, lipsync, concat, upload, total };
}

function keyframePathsFor(workDir: string, sceneCount: number): string[] {
  return Array.from({ length: sceneCount }, (_, index) =>
    join(workDir, 'keyframes', `s${String(index + 1).padStart(2, '0')}_keyframe.png`)
  );
}

function plannedArtifacts(workDir: string, reportPath: string): string[] {
  return [
    join(workDir, 'episode-script.json'),
    join(workDir, 'refs', 'character_ref.png'),
    join(workDir, 'keyframes', 'sNN_keyframe.png'),
    join(workDir, 'final.mp4'),
    join(workDir, 'thumbnail.jpg'),
    join(workDir, 'subtitles.vtt'),
    join(workDir, 'qc-report.json'),
    reportPath,
  ];
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

async function runStage<T>(
  stages: StageRecord[],
  name: string,
  fn: () => Promise<StageResult<T>>
): Promise<T> {
  const startedAt = Date.now();
  console.log(`[${now()}] ${name} start`);
  try {
    const result = await fn();
    const record: StageRecord = {
      name,
      status: result.status ?? 'success',
      elapsedMs: Date.now() - startedAt,
      costUsd: result.costUsd ?? 0,
      artifacts: result.artifacts ?? [],
    };
    stages.push(record);
    console.log(`[${now()}] ${name} ${record.status} elapsed=${record.elapsedMs}ms cost=$${record.costUsd.toFixed(4)}`);
    return result.value;
  } catch (error) {
    const record: StageRecord = {
      name,
      status: 'failed',
      elapsedMs: Date.now() - startedAt,
      costUsd: 0,
      artifacts: [],
      error: error instanceof Error ? error.message : String(error),
    };
    stages.push(record);
    console.error(`[${now()}] ${name} failed elapsed=${record.elapsedMs}ms — ${record.error}`);
    throw error;
  }
}

function printStageTable(stages: StageRecord[]): void {
  console.table(stages.map((stage) => ({
    stage: stage.name,
    status: stage.status,
    elapsedMs: stage.elapsedMs,
    costUsd: Number(stage.costUsd.toFixed(4)),
    artifacts: stage.artifacts.length,
  })));
}

function writeStudioReport(path: string, report: StudioRunReport): void {
  writeFileSync(path, JSON.stringify(report, null, 2), 'utf-8');
}

function buildReport(input: {
  startedAt: string;
  config: RunnerConfig;
  spec: LibraryEpisodeSpec;
  slug: string;
  workDir: string;
  storagePrefix: string;
  stages: StageRecord[];
  estimatedCostUsd?: CostBreakdown;
  output?: EpisodeOutput;
  qc?: QcReport;
  insert?: InsertResult;
  error?: string;
}): StudioRunReport {
  return {
    startedAt: input.startedAt,
    finishedAt: now(),
    dryRun: input.config.dryRun,
    config: input.config,
    spec: {
      index: input.config.index,
      title: input.spec.title,
      topic: input.spec.topic,
      age_band: input.spec.age_band,
      style_tags: input.spec.style_tags,
      topic_subject: input.spec.topic_subject,
      c6_focus: input.spec.c6_focus,
    },
    slug: input.slug,
    workDir: input.workDir,
    storagePrefix: input.storagePrefix,
    stages: input.stages,
    ...(input.estimatedCostUsd ? { estimatedCostUsd: input.estimatedCostUsd } : {}),
    ...(input.output ? {
      output: {
        finalVideoLocalPath: input.output.finalVideoLocalPath,
        finalVideoStoragePath: input.output.finalVideoStoragePath,
        thumbnailLocalPath: input.output.thumbnailLocalPath,
        thumbnailStoragePath: input.output.thumbnailStoragePath,
        subtitlesVttLocalPath: input.output.subtitlesVttLocalPath,
        subtitlesStoragePath: input.output.subtitlesStoragePath,
        totalDurationSec: input.output.totalDurationSec,
        totalCostUsd: input.output.totalCostUsd,
      },
    } : {}),
    ...(input.qc ? { qc: input.qc } : {}),
    ...(input.insert ? { insert: input.insert } : {}),
    ...(input.error ? { error: input.error } : {}),
  };
}

async function insertLibraryVideo(spec: LibraryEpisodeSpec, output: EpisodeOutput): Promise<InsertResult> {
  const [{ getSupabase }, { getSignedUrl }] = await Promise.all([
    import('../src/lib/supabase'),
    import('../src/lib/supabase-storage'),
  ]);

  const [videoUrl, thumbnailUrl, subtitlesUrl] = await Promise.all([
    getSignedUrl(output.finalVideoStoragePath),
    getSignedUrl(output.thumbnailStoragePath),
    getSignedUrl(output.subtitlesStoragePath),
  ]);

  const { data, error } = await getSupabase()
    .from('library_videos')
    .insert({
      title: spec.title,
      description: spec.description,
      topic: spec.topic,
      age_band: spec.age_band,
      style_tags: spec.style_tags,
      duration_sec: Math.round(output.totalDurationSec),
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      subtitles_url: subtitlesUrl,
      video_path: output.finalVideoStoragePath,
      thumbnail_path: output.thumbnailStoragePath,
      subtitles_path: output.subtitlesStoragePath,
      character_name: output.script.characters[0]?.displayName ?? '모리',
      script: output.script,
      scenes: buildSceneRows(output.scenes),
      c6_focus: spec.c6_focus ?? null,
      episode_unit_sec: EPISODE_UNIT_SEC,
      published: false,
      featured: false,
    })
    .select('id')
    .single();

  if (error) throw new Error(`library_videos insert failed: ${error.message}`);
  return {
    id: String(data?.id ?? ''),
    videoUrl,
    thumbnailUrl,
    subtitlesUrl,
  };
}

async function main(): Promise<void> {
  const startedAt = now();
  const config = resolveConfig();
  const spec = LIBRARY_MATRIX_ANIMAL_VILLAGE[config.index];
  const slug = slugForSpec(config.index, spec);
  const workDir = join(process.cwd(), 'tmp', 'studio', slug);
  const storagePrefix = `library/90s/${slug}`;
  const reportPath = join(workDir, 'report.json');
  const stages: StageRecord[] = [];

  mkdirSync(workDir, { recursive: true });

  if (config.dryRun) {
    const estimate = estimatedDryRunCost(config);
    const artifacts = plannedArtifacts(workDir, reportPath);
    stages.push(
      { name: 'planning', status: 'dry_run', elapsedMs: 0, costUsd: 0, artifacts: [] },
      { name: 'writer-director-actor-edit', status: 'dry_run', elapsedMs: 0, costUsd: estimate.total, artifacts },
      { name: 'qc', status: config.skipQc ? 'skipped' : 'dry_run', elapsedMs: 0, costUsd: 0, artifacts: [join(workDir, 'qc-report.json')] },
      { name: 'insert_db', status: config.insertDb ? 'dry_run' : 'skipped', elapsedMs: 0, costUsd: 0, artifacts: [] },
      { name: 'report', status: 'dry_run', elapsedMs: 0, costUsd: 0, artifacts: [reportPath] }
    );
    const report = buildReport({
      startedAt,
      config,
      spec,
      slug,
      workDir,
      storagePrefix,
      stages,
      estimatedCostUsd: estimate,
    });
    writeStudioReport(reportPath, report);
    console.log(`[DRY_RUN] selected=[${config.index}] ${spec.title}`);
    console.log(`[DRY_RUN] mode=${config.animationMode} lipsync=${config.episodeLipsync} skip_qc=${config.skipQc} insert_db=${config.insertDb}`);
    console.log(`[DRY_RUN] estimated_total=$${estimate.total.toFixed(2)}`);
    console.log(`[DRY_RUN] workDir=${workDir}`);
    console.log(`[DRY_RUN] report=${reportPath}`);
    console.log('[DRY_RUN] planned artifacts:');
    for (const artifact of artifacts) console.log(`  - ${artifact}`);
    printStageTable(stages);
    return;
  }

  let brief: VideoBrief | undefined;
  let output: EpisodeOutput | undefined;
  let qc: QcReport | undefined;
  let insert: InsertResult | undefined;

  try {
    brief = await runStage(stages, 'planning', async () => {
      const videoBrief = toVideoBrief(spec);
      const missing = (videoBrief.referenceImagePaths ?? []).filter((path) => !existsSync(path));
      if (missing.length > 0) {
        throw new Error(`reference image missing: ${missing.join(', ')}`);
      }
      return {
        value: videoBrief,
        artifacts: videoBrief.referenceImagePaths ?? [],
      };
    });

    output = await runStage(stages, 'writer-director-actor-edit', async () => {
      const result = await runEpisodePipeline({
        brief: brief as VideoBrief,
        workDir,
        storagePrefix,
        seedanceTier: config.seedanceTier,
        skipLipsync: config.episodeLipsync === 'off',
        animationMode: config.animationMode,
      });
      return {
        value: result,
        costUsd: result.totalCostUsd,
        artifacts: [
          join(workDir, 'episode-script.json'),
          join(workDir, 'refs', 'character_ref.png'),
          ...keyframePathsFor(workDir, result.scenes.length),
          result.finalVideoLocalPath,
          result.thumbnailLocalPath,
          result.subtitlesVttLocalPath,
          `storage:${result.finalVideoStoragePath}`,
          `storage:${result.thumbnailStoragePath}`,
          `storage:${result.subtitlesStoragePath}`,
        ],
      };
    });

    if (config.skipQc) {
      stages.push({ name: 'qc', status: 'skipped', elapsedMs: 0, costUsd: 0, artifacts: [] });
    } else {
      qc = await runStage(stages, 'qc', async () => {
        const report = await runEpisodeQc({
          script: (output as EpisodeOutput).script,
          keyframePaths: keyframePathsFor(workDir, (output as EpisodeOutput).scenes.length),
          workDir,
        });
        return {
          value: report,
          status: report.overall === 'pass' ? 'success' : report.overall,
          costUsd: report.costUsd,
          artifacts: [join(workDir, 'qc-report.json')],
        };
      });
    }

    if (config.insertDb) {
      insert = await runStage(stages, 'insert_db', async () => {
        const result = await insertLibraryVideo(spec, output as EpisodeOutput);
        return {
          value: result,
          artifacts: [`library_videos:${result.id}`],
        };
      });
    } else {
      stages.push({ name: 'insert_db', status: 'skipped', elapsedMs: 0, costUsd: 0, artifacts: [] });
    }

    const reportStartedAt = Date.now();
    stages.push({
      name: 'report',
      status: 'success',
      elapsedMs: Date.now() - reportStartedAt,
      costUsd: 0,
      artifacts: [reportPath],
    });
    writeStudioReport(reportPath, buildReport({
      startedAt,
      config,
      spec,
      slug,
      workDir,
      storagePrefix,
      stages,
      output,
      qc,
      insert,
    }));

    printStageTable(stages);
    console.log(`[${now()}] studio run complete report=${reportPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stages.push({
      name: 'report',
      status: 'failed',
      elapsedMs: 0,
      costUsd: 0,
      artifacts: [reportPath],
      error: message,
    });
    writeStudioReport(reportPath, buildReport({
      startedAt,
      config,
      spec,
      slug,
      workDir,
      storagePrefix,
      stages,
      output,
      qc,
      insert,
      error: message,
    }));
    printStageTable(stages);
    console.error(`[${now()}] studio run failed report=${reportPath}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
