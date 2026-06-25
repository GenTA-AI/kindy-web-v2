import { SyncLipsyncProvider, type LipsyncTier } from './sync-lipsync';

export interface LipSyncInput {
  videoFilePath: string;
  audioFilePath: string;
  videoDurationSec?: number;
  tier?: LipsyncTier;
}

export interface LipSyncResult {
  resultMp4Bytes: Buffer;
  costUsd: number;
  elapsedMs: number;
}

export async function syncLipSync(input: LipSyncInput): Promise<LipSyncResult> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY missing for syncLipSync');

  const provider = new SyncLipsyncProvider(falKey);
  const result = await provider.generateFromFiles({
    videoFilePath: input.videoFilePath,
    audioFilePath: input.audioFilePath,
    videoDurationSec: input.videoDurationSec ?? 15,
    tier: input.tier ?? (process.env.LIPSYNC_TIER as LipsyncTier | undefined) ?? 'standard',
    syncMode: 'cut_off',
  });

  const response = await fetch(result.videoUrl);
  if (!response.ok) {
    throw new Error(`syncLipSync download failed (${response.status})`);
  }

  return {
    resultMp4Bytes: Buffer.from(await response.arrayBuffer()),
    costUsd: result.costUsd,
    elapsedMs: result.elapsedMs,
  };
}
