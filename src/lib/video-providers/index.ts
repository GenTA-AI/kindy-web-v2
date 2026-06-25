/**
 * Video provider barrel export.
 *
 * Usage in Inngest workflow:
 *   import { VeedFabricProvider, GeminiTtsProvider, NanoBananaProvider } from '@/lib/video-providers';
 *   const veed = new VeedFabricProvider(process.env.FAL_KEY!);
 *   const tts = new GeminiTtsProvider(process.env.GOOGLE_API_KEY!);
 *   const img = new NanoBananaProvider(process.env.GOOGLE_API_KEY!);
 *
 * Full pipeline orchestration (TODO: src/lib/video-pipeline.ts):
 *   1. Plan scenes from GACS-3 Word Profile
 *   2. Generate reference-locked images (img)
 *   3. Generate per-character TTS audio (tts)
 *   4. Upload image+audio to Supabase Storage → signed URLs
 *   5. Call VeedFabricProvider.generateScene per dialogue scene
 *   6. ffmpeg concat all clips + fade transitions
 *   7. Upload final video, return VideoOutput
 */

export { VeedFabricProvider } from './veed-fabric';
export { GeminiTtsProvider, GEMINI_TTS_STYLES } from './gemini-tts';
export { NanoBananaProvider } from './nano-banana';
export type {
  VideoProvider,
  ImageProvider,
  TtsProvider,
  SceneInput,
  SceneOutput,
  VideoPlan,
  VideoOutput,
  Resolution,
  CharacterVoice,
} from './types';
