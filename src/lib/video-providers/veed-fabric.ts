/**
 * VEED Fabric 1.0 provider via fal.ai
 *
 * Ported from: art&science/ocean-edu-imagen/generate_ep01_veed.py (generate_veed function)
 *
 * Input: image URL + audio URL → lipsync video
 * Pricing (2026-04-17): $0.08/sec (480p), $0.15/sec (720p)
 * Max clip duration: 30s per request, stitching via ffmpeg for longer
 */

import type { SceneInput, SceneOutput, Resolution, VideoProvider, VideoPlan } from './types';

const FAL_API_URL = 'https://fal.run/veed/fabric-1.0';

const COST_PER_SEC: Record<Resolution, number> = {
  '480p': 0.08,
  '720p': 0.15,
  '1080p': 0.25, // not officially documented, upper bound estimate
};

interface FalVeedRequest {
  image_url: string;
  audio_url: string;
  resolution: '480p' | '720p';
}

interface FalVeedResponse {
  video: { url: string };
  // fal may return additional fields (duration, seed, etc.)
}

export class VeedFabricProvider implements VideoProvider {
  name = 'veed-fabric';

  constructor(private readonly falApiKey: string) {
    if (!falApiKey) throw new Error('FAL_KEY required for VeedFabricProvider');
  }

  async generateScene(
    input: SceneInput,
    imageUrl: string,
    audioUrl: string,
    resolution: Resolution
  ): Promise<SceneOutput> {
    // VEED Fabric 480p/720p only — fall back to 720p if 1080p requested
    const veedResolution: '480p' | '720p' = resolution === '480p' ? '480p' : '720p';

    const body: FalVeedRequest = {
      image_url: imageUrl,
      audio_url: audioUrl,
      resolution: veedResolution,
    };

    const res = await fetch(FAL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${this.falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`VEED Fabric failed (${res.status}): ${text.slice(0, 500)}`);
    }

    const data: FalVeedResponse = await res.json();
    if (!data.video?.url) {
      throw new Error(`VEED Fabric response missing video.url: ${JSON.stringify(data).slice(0, 300)}`);
    }

    const costUsd = input.durationSec * COST_PER_SEC[resolution];

    return {
      sceneId: input.sceneId,
      imageUrl,
      ttsAudioUrl: audioUrl,
      videoClipUrl: data.video.url,
      costUsd,
    };
  }

  estimateCostUsd(plan: VideoPlan): number {
    const pricePerSec = COST_PER_SEC[plan.resolution];
    const dialogueScenes = plan.scenes.filter((s) => s.dialogue);
    return dialogueScenes.reduce((sum, s) => sum + s.durationSec * pricePerSec, 0);
  }

  async healthCheck(): Promise<boolean> {
    // fal.ai doesn't expose a dedicated health endpoint for VEED.
    // Best signal: attempt a HEAD on the base URL. If 200/405/401 → reachable.
    try {
      const res = await fetch(FAL_API_URL, { method: 'HEAD' });
      return res.status < 500;
    } catch {
      return false;
    }
  }
}
