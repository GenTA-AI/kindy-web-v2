/**
 * Video generation provider interface.
 *
 * eduvid pipeline (포팅: art&science/ocean-edu-imagen):
 *   scene plan → image (nano-banana) → TTS (Gemini) → lipsync (VEED Fabric) → concat (ffmpeg)
 *
 * 이 인터페이스는 Inngest workflow의 fallback chain 내부에서 호출된다.
 * attempt 1 = 기본 provider, attempt 2 = 대체 provider, attempt 3 = pre-generated pool.
 */

export type Resolution = '480p' | '720p' | '1080p';

export type CharacterVoice =
  | 'Puck'      // 7살 여자아이, 밝고 활기찬
  | 'Leda'      // 8살 남자아이, 걱정/여린 톤
  | 'Aoede'     // 9살 여자아이, 또박또박 관찰자
  | 'Fenrir'    // 8살 남자아이, 힘없고 슬픈 톤
  | 'Kore'      // 10살 여자아이 내레이션, 어린이 뉴스 앵커
  | 'Charon'    // 9살 남자아이, 답답한 톤
  | 'Despina'   // 8살 여자아이, 불안한 톤
  | 'Enceladus' // 10살 남자아이, 차분한 깊은 톤
  | 'auto';     // GACS-3 Word Profile에 맞춰 자동 선택

export interface SceneInput {
  sceneId: string;
  imagePrompt: string;
  imageReferenceUrls?: string[]; // 캐릭터 일관성용 레퍼런스 시트
  dialogue?: string;             // 대사 (null이면 내레이션/전환씬)
  voice?: CharacterVoice;
  voiceStyle?: string;           // 예: "7살 여자아이가 밝고 활기차게..."
  durationSec: number;           // 목표 길이 (기본 10초)
}

export interface VideoPlan {
  videoId: string;
  childId: string;
  adjectives: string[];          // GACS-3 Word Profile 상위 형용사
  topic: string;
  styleTags: string[];
  scenes: SceneInput[];          // 3개 대사씬 (30초 기본)
  resolution: Resolution;
  narrationLanguage: 'ko-KR';    // i18n extension point
}

export interface VideoOutput {
  videoId: string;
  videoUrl: string;              // Supabase Storage signed URL or raw
  videoPath: string;             // 내부 경로 (signed URL 재발급용)
  durationSec: number;
  fileSizeMb: number;
  costUsd: number;               // 실측 비용 (generation ledger용)
  providerUsed: string;          // "veed-fabric" | "seedance" | "pool"
  sceneOutputs: SceneOutput[];
  promptUsed: string;            // 전체 프롬프트 (GACS-3 재학습용)
  adjectivesUsed: string[];      // 실제 사용된 형용사 (Word Profile 피드백)
  attemptCount: number;
  elapsedSec: number;
}

export interface SceneOutput {
  sceneId: string;
  imageUrl?: string;
  ttsAudioUrl?: string;
  videoClipUrl?: string;
  costUsd: number;
}

/**
 * VideoProvider interface — art&science 파이프라인을 추상화.
 *
 * 구현체:
 *   VeedFabricProvider (기본) — 이미지+오디오→립싱크
 *   SeedanceProvider (backup) — 5초 클립, stitching
 *   PoolProvider (fallback) — pre-generated pool에서 스타일 매칭
 */
export interface VideoProvider {
  name: string;

  /** 단일 scene 립싱크 영상 생성 */
  generateScene(input: SceneInput, imageUrl: string, audioUrl: string, resolution: Resolution): Promise<SceneOutput>;

  /** 비용 추정 (UI 표시용) */
  estimateCostUsd(plan: VideoPlan): number;

  /** Health check — Inngest가 provider down 시 다음 attempt로 넘길 때 사용 */
  healthCheck(): Promise<boolean>;
}

/**
 * 이미지 생성 provider (나노바나나프로 구현체 대상).
 * 캐릭터 레퍼런스 시트를 강력히 참조하여 일관성 유지.
 */
export interface ImageProvider {
  name: string;
  generateImage(prompt: string, referenceUrls: string[]): Promise<{ url: string; costUsd: number }>;
}

/**
 * TTS provider (Gemini 2.5 Flash TTS 구현체 대상).
 * voice + style 지시문으로 캐릭터별 음성 고정.
 */
export interface TtsProvider {
  name: string;
  generateTts(dialogue: string, voice: CharacterVoice, style?: string): Promise<{ audioPath: string; durationSec: number; costUsd: number }>;
}
