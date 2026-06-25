/**
 * 스모크 4: s01 립싱크 후처리.
 *   입력:
 *     - tmp/smoke/s01/s01_silent.mp4  (Seedance motion video, 오디오 X)
 *     - tmp/smoke/s01/s01_tts.wav     (Gemini TTS)
 *   출력:
 *     - tmp/smoke/s01/s01_lipsync_{tier}.mp4  (mouth 영역이 TTS 에 맞게 재구성된 영상)
 *
 * 기본 tier = standard ($0.05/s). LIPSYNC_TIER=pro 로 바꾸면 pro ($0.083/s).
 *
 * 실행:
 *   npm run smoke:s01-lipsync
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync, createWriteStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { SyncLipsyncProvider, type LipsyncTier } from '../src/lib/video-providers/sync-lipsync';

const TIER = (process.env.LIPSYNC_TIER ?? 'standard') as LipsyncTier;

function getVideoDuration(path: string): number {
  const r = spawnSync('ffprobe', [
    '-v', 'quiet',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    path,
  ], { encoding: 'utf-8' });
  if (r.status !== 0) throw new Error(`ffprobe failed: ${r.stderr}`);
  return parseFloat(r.stdout.trim());
}

async function downloadToFile(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed ${res.status} ${url}`);
  const fileStream = createWriteStream(outPath);
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), fileStream);
}

async function main() {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY missing');

  const baseDir = join(process.cwd(), 'tmp', 'smoke', 's01');
  const silentPath = join(baseDir, 's01_silent.mp4');
  const ttsPath = join(baseDir, 's01_tts.wav');
  if (!existsSync(silentPath)) throw new Error(`Missing ${silentPath} — run smoke:s01 first`);
  if (!existsSync(ttsPath)) throw new Error(`Missing ${ttsPath} — run smoke:s01 first`);

  const outDir = baseDir;
  mkdirSync(outDir, { recursive: true });

  const videoDuration = getVideoDuration(silentPath);

  console.log('='.repeat(70));
  console.log(`  스모크 4: s01 립싱크 후처리 (Sync Labs v2 ${TIER})`);
  console.log('='.repeat(70));
  console.log(`입력 영상: ${silentPath} (${videoDuration.toFixed(2)}s)`);
  console.log(`입력 오디오: ${ttsPath}`);
  console.log(`Tier: ${TIER}  예상 비용: $${(videoDuration * (TIER === 'pro' ? 5 / 60 : 3 / 60)).toFixed(3)}\n`);

  const t0 = Date.now();
  const provider = new SyncLipsyncProvider(falKey);
  console.log('[1/2] Sync Labs v2 호출 중 (30~120초)...\n');
  const result = await provider.generateFromFiles({
    videoFilePath: silentPath,
    audioFilePath: ttsPath,
    tier: TIER,
    videoDurationSec: videoDuration,
  });
  console.log(`\n      ✓ 완료 (${((Date.now() - t0) / 1000).toFixed(1)}s, $${result.costUsd.toFixed(3)})`);
  console.log(`      request_id: ${result.requestId ?? '(none)'}\n`);

  const outPath = join(outDir, `s01_lipsync_${TIER}.mp4`);
  console.log('[2/2] 결과 다운로드...');
  await downloadToFile(result.videoUrl, outPath);
  const outSize = (readFileSync(outPath).length / (1024 * 1024)).toFixed(2);
  console.log(`      ✓ ${outPath} (${outSize} MB)\n`);

  // 리포트
  const reportPath = join(outDir, `s01_lipsync_${TIER}_report.json`);
  writeFileSync(reportPath, JSON.stringify({
    inputVideo: silentPath,
    inputAudio: ttsPath,
    outputVideo: outPath,
    tier: TIER,
    videoDurationSec: videoDuration,
    costUsd: result.costUsd,
    endpoint: result.endpoint,
    requestId: result.requestId,
    elapsedMs: result.elapsedMs,
  }, null, 2), 'utf-8');

  console.log('─'.repeat(70));
  console.log(`  💰 추가 비용: $${result.costUsd.toFixed(3)} (${TIER})`);
  console.log('─'.repeat(70));
  console.log(`\n영상 확인:`);
  console.log(`  open ${outPath}`);
}

main().catch((e) => {
  console.error('\n❌ 실패:', e);
  process.exit(1);
});
