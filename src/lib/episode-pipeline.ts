/**
 * 90s episode 파이프라인 오케스트레이터.
 * 사용: 새 batch 스크립트가 episode 1편 생성 시 호출.
 */

import Anthropic from '@anthropic-ai/sdk';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  createWriteStream,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { synthesizeKorean } from './gemini-tts';
import {
  cameraPresetFromDirective,
  parseNormalizedBox,
  renderLimitedAnimationScene,
} from './limited-animation';
import { NanoBananaProvider } from './video-providers/nano-banana';
import { Seedance2Provider, type SeedanceTier } from './video-providers/seedance2';
import { syncLipSync } from './video-providers/fal-lipsync';
import { VeedFabricProvider } from './video-providers/veed-fabric';
import { uploadBytes } from './supabase-storage';
import {
  ANIMAL_VILLAGE_BIBLE,
  EPISODE_VOICE_EMOTIONS,
  resolveVoiceCasting,
  resolveVoiceStyle,
  wrapWithPromptRules,
} from '../content/studio/animal-village-bible';
import { listApprovedFrames } from './studio/approved-frames';
import {
  getCharacterAppearance,
  type EpisodeVoiceEmotion,
  type EpisodeScene,
  type EpisodeScript,
  type VideoBrief,
} from './video-providers/director.types';

export interface EpisodeInput {
  brief: VideoBrief;
  workDir: string;
  storagePrefix: string;
  seedanceTier?: SeedanceTier;
  skipLipsync?: boolean;
  animationMode?: EpisodeAnimationMode;
}

export type EpisodeAnimationMode = 'premium' | 'limited';

export interface EpisodeOutput {
  script: EpisodeScript;
  finalVideoLocalPath: string;
  finalVideoStoragePath: string;
  thumbnailLocalPath: string;
  thumbnailStoragePath: string;
  subtitlesVttLocalPath: string;
  subtitlesStoragePath: string;
  totalDurationSec: number;
  totalCostUsd: number;
  perStageCostUsd: {
    director: number;
    refs: number;
    keyframes: number;
    videoSilent: number;
    tts: number;
    veed: number;
    lipsync: number;
    concat: number;
    upload: number;
  };
  scenes: EpisodeScene[];
}

type EpisodeDirectorResult = {
  script: EpisodeScript;
  costUsd: number;
  model: string;
  elapsedMs: number;
};

type SceneAudio = {
  path: string;
  rawTtsPath: string;
  costUsd: number;
  ttsDurationSec: number;
};

type EpisodeLipsyncMode = 'veed' | 'sync' | 'off';

const OPUS_PRICING = {
  input: 5.0,
  output: 25.0,
  cacheWrite: 6.25,
  cacheRead: 0.5,
};

const SONNET_PRICING = {
  input: 3.0,
  output: 15.0,
  cacheWrite: 3.75,
  cacheRead: 0.3,
};

const ANIMAL_VILLAGE_CAST_IDS = new Set(ANIMAL_VILLAGE_BIBLE.cast.map((member) => member.id));
const EPISODE_VOICE_EMOTION_SET = new Set<string>(EPISODE_VOICE_EMOTIONS);
const OUTPUT_VIDEO_WIDTH = 1920;
const OUTPUT_VIDEO_HEIGHT = 1080;
const DEFAULT_SCENE_FADE_SEC = 0.3;
const NARRATION_FADE_IN_SEC = 0.4;
const NARRATION_FADE_OUT_SEC = 0.5;
const NARRATION_AUDIO_DELAY_MS = 500;
const ANIMAL_VILLAGE_CASTING_TABLE = ANIMAL_VILLAGE_BIBLE.cast
  .map((member) => `- ${member.id} / ${member.nameKo} / ${member.description} / fixed voice: ${member.voice}`)
  .join('\n');
const ANIMAL_VILLAGE_EMOTION_WORDS = EPISODE_VOICE_EMOTIONS.join(' | ');

const EPISODE_SYSTEM_PROMPT = `너는 한국 어린이 교육 애니메이션의 90초 episode 총괄 감독이다.
반드시 연구 기준에 맞는 EpisodeScript JSON 을 작성한다.

## 모리 동물마을 스튜디오 바이블
- characters[0]은 반드시 모리(toto)이다. id="toto", displayName="모리", voice="Puck" 으로 고정한다.
- 캐스트 id/이름/성격/고정 voice:
${ANIMAL_VILLAGE_CASTING_TABLE}
- 내레이터는 voice="${ANIMAL_VILLAGE_BIBLE.narrator.voice}" 이며 스타일은 "${ANIMAL_VILLAGE_BIBLE.narrator.style}" 이다.
- 모든 character_speaking 씬은 speakerId 를 캐스트 id 중 하나로, voiceEmotion 을 ${ANIMAL_VILLAGE_EMOTION_WORDS} 중 하나로 반드시 지정한다.
- 대사는 speakerId 캐릭터의 성격과 고정 voice에 맞춰 쓴다. 단일 톤 TTS처럼 쓰지 말고 캐릭터별 말투를 분리한다.
- 5-7세 몰입 훅을 유지한다: direct question 씬 1개 + waitBeatSec 2-3, 내레이션 130wpm, 현실 연결.

## 연구/제작 룰
- 4-7 scenes only. Prefer 6 scenes.
- Total duration 85-95 seconds. Each scene duration is an integer 10-15 seconds when possible, never below 4 or above 15.
- Cut frequency must be 3-6 cuts/minute.
- Mix narration scenes and character_speaking scenes: 4-5 narration scenes plus 2-3 speaking scenes when scene count allows.
- Exactly one character_speaking scene asks a direct question to the child and includes waitBeatSec: 2 or 3.
- Korean narration should fit about 130 Korean words per minute. Keep text short enough for the scene duration.
- Reality anchoring is required: every fantasy or stage moment must connect to a real-world object, action, or observation.
- Mascot consistency is required: the main recurring character must stay visually identical across all scenes.
- Speaking scenes must use medium close-up or medium shot with the character facing camera so fal-ai/sync-lipsync can track the mouth.

## Output JSON schema
{
  "title": string,
  "topLevelPrompt": string,
  "styleDirectives": string | string[],
  "toneAndMood": string,
  "characters": [
    {
      "id": string,
      "displayName": string,
      "archetype": string,
      "appearance": string,
      "personality": string,
      "voice": "Puck" | "Leda" | "Aoede" | "Fenrir" | "Kore" | "Charon" | "Despina" | "Enceladus",
      "voiceNote": string
    }
  ],
  "scenes": [
    {
      "index": number,
      "type": "narration" | "character_speaking",
      "durationSec": number,
      "narrationText": string,
      "dialogueText": string,
      "speakerId": "toto" | "kkumi" | "bangul" | "naong" | "doto" | "owl",
      "voiceEmotion": "bright" | "serious" | "excited" | "storytelling" | "whisper",
      "waitBeatSec": number,
      "visualAction": string,
      "cameraDirective": string,
      "emotion": string,
      "location": string,
      "effects": string,
      "keyframeBrief": string
    }
  ],
  "totalDurationSec": number,
  "consistencyChecklist": string[],
  "cutsPerMinute": number,
  "speakingScenesCount": number
}

Rules:
- For type="narration", fill narrationText and omit dialogueText.
- For type="character_speaking", fill dialogueText, speakerId, voiceEmotion and omit narrationText.
- topLevelPrompt and keyframeBrief should be English visual prompts.
- narrationText/dialogueText must be natural Korean raw text with no markdown and no quotation marks.
- Output only pure JSON. No code fence, no explanation.`;

function buildEpisodeUserPrompt(brief: VideoBrief): string {
  return `다음 교육 브리프를 90초 EpisodeScript JSON 으로 작성해라.

## 교육 브리프
- 주제: ${brief.topic}
- 청중: ${brief.audience}
- 목표 길이: ${brief.targetDurationSec}초
- 학습 목표:
${brief.learningGoals.map((goal) => `  - ${goal}`).join('\n')}
- 시각 스타일: ${brief.styleReference}
- 톤: ${brief.tone}
${brief.roughSynopsis ? `- 러프 시놉시스: ${brief.roughSynopsis}` : ''}
${brief.protagonistHint ? `- 주인공 힌트: ${brief.protagonistHint}` : ''}
${brief.adjectives?.length ? `- GACS-3 형용사: ${brief.adjectives.join(', ')}` : ''}

## 추가 지시
- 동물마을 바이블 캐스트를 사용해 characters[0]=toto(모리)로 고정하고, 모든 character_speaking 씬에 speakerId/voiceEmotion 을 넣어라.
- 내레이션은 개념을 명확히 설명하고, 말하는 씬은 주인공 캐릭터가 화면을 보며 짧게 말하게 해라.
- 아이가 답할 시간을 주는 direct question 씬 1개를 반드시 넣고 waitBeatSec 를 2 또는 3 으로 설정해라.
- 현실 연결 예: 컵, 손 씻기, 창밖 비, 물병, 교실, 책상, 실제 동물, 그림 카드 등.
- Seedance silent video 용으로 visualAction/cameraDirective/effects 를 관찰 가능한 움직임 중심으로 써라.
${brief.referenceImagePaths?.length ? '- 이미지 생성 단계에는 정본 캐릭터 레퍼런스가 첨부된다. 스크립트의 주인공 외형은 주인공 힌트와 정본 레퍼런스에 맞춰라.' : ''}

EpisodeScript JSON 만 출력해라.`;
}

function emptyCost(): EpisodeOutput['perStageCostUsd'] {
  return {
    director: 0,
    refs: 0,
    keyframes: 0,
    videoSilent: 0,
    tts: 0,
    veed: 0,
    lipsync: 0,
    concat: 0,
    upload: 0,
  };
}

function totalCost(cost: EpisodeOutput['perStageCostUsd']): number {
  return cost.director + cost.refs + cost.keyframes + cost.videoSilent +
    cost.tts + cost.veed + cost.lipsync + cost.concat + cost.upload;
}

function resolveAnimationMode(inputMode: EpisodeAnimationMode | undefined): EpisodeAnimationMode {
  const raw = inputMode ?? process.env.EPISODE_ANIMATION_MODE ?? process.env.ANIMATION_MODE ?? 'premium';
  if (raw === 'premium' || raw === 'limited') return raw;
  throw new Error(`Episode animation mode must be "premium" or "limited" (got ${raw})`);
}

function resolveLipsyncMode(skipLipsync: boolean | undefined): EpisodeLipsyncMode {
  if (skipLipsync === true || process.env.SKIP_LIPSYNC === '1') return 'off';
  const raw = process.env.EPISODE_LIPSYNC ?? 'veed';
  if (raw === 'veed' || raw === 'sync' || raw === 'off') return raw;
  throw new Error(`EPISODE_LIPSYNC must be "veed", "sync", or "off" (got ${raw})`);
}

function styleDirective(script: EpisodeScript): string {
  return Array.isArray(script.styleDirectives)
    ? script.styleDirectives.join(', ')
    : script.styleDirectives;
}

function mainCharacter(script: EpisodeScript) {
  const character = script.characters[0];
  if (!character) throw new Error('EpisodeScript has no characters[0]');
  return character;
}

async function directEpisodeScript(brief: VideoBrief, workDir: string): Promise<EpisodeDirectorResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

  const startedAt = Date.now();
  const model = process.env.CLAUDE_MODEL ?? 'claude-opus-4-7';
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 9000,
    system: [
      {
        type: 'text',
        text: EPISODE_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildEpisodeUserPrompt(brief) }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude episode response has no text block');
  }

  const raw = textBlock.text.trim();
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`Claude episode response is not JSON: ${raw.slice(0, 500)}`);
  }

  const script = validateEpisodeScript(JSON.parse(raw.slice(jsonStart, jsonEnd + 1)));
  writeFileSync(join(workDir, 'episode-script.json'), JSON.stringify(script, null, 2), 'utf-8');

  const usage = response.usage;
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheCreation = usage.cache_creation_input_tokens ?? 0;
  const pricing = model.includes('opus') ? OPUS_PRICING : SONNET_PRICING;
  const costUsd =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output +
    (cacheCreation / 1_000_000) * pricing.cacheWrite +
    (cacheRead / 1_000_000) * pricing.cacheRead;

  return {
    script,
    costUsd,
    model,
    elapsedMs: Date.now() - startedAt,
  };
}

function validateEpisodeScript(value: unknown): EpisodeScript {
  if (!value || typeof value !== 'object') {
    throw new Error('EpisodeScript: not an object');
  }

  const raw = value as Record<string, unknown>;
  const title = requiredString(raw, 'title');
  const topLevelPrompt = requiredString(raw, 'topLevelPrompt');
  const toneAndMood = requiredString(raw, 'toneAndMood');
  const consistencyChecklist = asStringArray(raw.consistencyChecklist, 'consistencyChecklist');
  const styleDirectives = typeof raw.styleDirectives === 'string'
    ? raw.styleDirectives
    : asStringArray(raw.styleDirectives, 'styleDirectives');
  if (!Array.isArray(raw.characters) || raw.characters.length === 0) {
    throw new Error('EpisodeScript: characters must be a non-empty array');
  }
  if (!Array.isArray(raw.scenes)) {
    throw new Error('EpisodeScript: scenes must be an array');
  }
  if (raw.scenes.length < 4 || raw.scenes.length > 7) {
    throw new Error(`EpisodeScript: scenes length must be 4-7 (got ${raw.scenes.length})`);
  }

  const scenes = raw.scenes
    .map((scene, arrayIndex) => normalizeEpisodeScene(scene, arrayIndex))
    .map((scene) => (
      scene.type === 'character_speaking'
        ? {
            ...scene,
            speakerId: scene.speakerId ?? 'toto',
            voiceEmotion: scene.voiceEmotion ?? 'bright',
          }
        : scene
    ));
  const totalDurationSec = scenes.reduce((sum, scene) => sum + scene.durationSec, 0);
  if (totalDurationSec < 85 || totalDurationSec > 95) {
    throw new Error(`EpisodeScript: totalDurationSec must be 85-95 (got ${totalDurationSec})`);
  }

  const cutsPerMinute = Number((scenes.length / (totalDurationSec / 60)).toFixed(2));
  if (cutsPerMinute < 3 || cutsPerMinute > 6) {
    throw new Error(`EpisodeScript: cutsPerMinute must be 3-6 (got ${cutsPerMinute})`);
  }

  const speakingScenesCount = scenes.filter((scene) => scene.type === 'character_speaking').length;
  if (speakingScenesCount < 2 || speakingScenesCount > 3) {
    throw new Error(`EpisodeScript: speakingScenesCount must be 2-3 (got ${speakingScenesCount})`);
  }
  const narrationScenesCount = scenes.length - speakingScenesCount;
  if (narrationScenesCount < 4 || narrationScenesCount > 5) {
    throw new Error(`EpisodeScript: narration scenes must be 4-5 (got ${narrationScenesCount})`);
  }

  const hasWaitBeat = scenes.some((scene) =>
    scene.type === 'character_speaking' &&
    scene.waitBeatSec !== undefined &&
    scene.waitBeatSec >= 2 &&
    scene.waitBeatSec <= 3
  );
  if (!hasWaitBeat) {
    throw new Error('EpisodeScript: one character_speaking scene must include waitBeatSec 2-3');
  }

  return {
    title,
    topLevelPrompt,
    styleDirectives,
    toneAndMood,
    characters: raw.characters as EpisodeScript['characters'],
    scenes,
    totalDurationSec,
    consistencyChecklist,
    cutsPerMinute,
    speakingScenesCount,
  };
}

function normalizeEpisodeScene(value: unknown, arrayIndex: number): EpisodeScene {
  if (!value || typeof value !== 'object') {
    throw new Error(`EpisodeScene ${arrayIndex}: not an object`);
  }
  const raw = value as Record<string, unknown>;
  const type = raw.type;
  if (type !== 'narration' && type !== 'character_speaking') {
    throw new Error(`EpisodeScene ${arrayIndex}: invalid type`);
  }

  const durationSec = Math.round(requiredNumber(raw, 'durationSec'));
  if (durationSec < 4 || durationSec > 15) {
    throw new Error(`EpisodeScene ${arrayIndex}: durationSec must be 4-15 (got ${durationSec})`);
  }

  const narrationText = optionalString(raw.narrationText);
  const dialogueText = optionalString(raw.dialogueText);
  const speakerId = normalizeEpisodeSpeakerId(raw.speakerId ?? raw.speaker_id);
  const voiceEmotion = normalizeEpisodeVoiceEmotion(raw.voiceEmotion ?? raw.voice_emotion);
  if (type === 'narration' && !narrationText) {
    throw new Error(`EpisodeScene ${arrayIndex}: narrationText required`);
  }
  if (type === 'character_speaking' && !dialogueText) {
    throw new Error(`EpisodeScene ${arrayIndex}: dialogueText required`);
  }

  const waitBeatSecRaw = raw.waitBeatSec;
  const waitBeatSec = waitBeatSecRaw === undefined || waitBeatSecRaw === null
    ? undefined
    : Math.round(Number(waitBeatSecRaw));
  if (waitBeatSec !== undefined && (!Number.isFinite(waitBeatSec) || waitBeatSec < 0 || waitBeatSec > 5)) {
    throw new Error(`EpisodeScene ${arrayIndex}: waitBeatSec invalid`);
  }

  return {
    index: Number.isFinite(Number(raw.index)) ? Number(raw.index) : arrayIndex,
    type,
    durationSec,
    ...(narrationText ? { narrationText } : {}),
    ...(dialogueText ? { dialogueText } : {}),
    ...(speakerId ? { speakerId } : {}),
    ...(voiceEmotion ? { voiceEmotion } : {}),
    ...(waitBeatSec !== undefined ? { waitBeatSec } : {}),
    visualAction: requiredString(raw, 'visualAction'),
    cameraDirective: requiredString(raw, 'cameraDirective'),
    emotion: requiredString(raw, 'emotion'),
    ...(optionalString(raw.location) ? { location: optionalString(raw.location) } : {}),
    ...(optionalString(raw.effects) ? { effects: optionalString(raw.effects) } : {}),
    keyframeBrief: requiredString(raw, 'keyframeBrief'),
  };
}

function normalizeEpisodeSpeakerId(value: unknown): string | undefined {
  const speakerId = optionalString(value);
  return speakerId && ANIMAL_VILLAGE_CAST_IDS.has(speakerId) ? speakerId : undefined;
}

function normalizeEpisodeVoiceEmotion(value: unknown): EpisodeVoiceEmotion | undefined {
  const emotion = optionalString(value);
  return emotion && EPISODE_VOICE_EMOTION_SET.has(emotion)
    ? emotion as EpisodeVoiceEmotion
    : undefined;
}

function requiredString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`EpisodeScript: ${key} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requiredNumber(raw: Record<string, unknown>, key: string): number {
  const value = Number(raw[key]);
  if (!Number.isFinite(value)) {
    throw new Error(`EpisodeScript: ${key} must be a number`);
  }
  return value;
}

function asStringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`EpisodeScript: ${key} must be an array`);
  }
  const items = value.map((item) => String(item).trim()).filter(Boolean);
  if (items.length === 0) {
    throw new Error(`EpisodeScript: ${key} must be non-empty`);
  }
  return items;
}

async function stepCharacterRef(
  script: EpisodeScript,
  refsDir: string,
  referenceImagePaths: string[] = []
): Promise<{ path: string; costUsd: number }> {
  const googleKey = process.env.GOOGLE_API_KEY;
  if (!googleKey) throw new Error('GOOGLE_API_KEY missing');

  const nano = new NanoBananaProvider(googleKey);
  const main = mainCharacter(script);
  const promptCore = `Create a character reference model sheet on a clean pure white background for children's animation production.

CHARACTER: ${main.displayName}${main.archetype ? ` (${main.archetype})` : ''}
${getCharacterAppearance(main)}

Personality: ${main.personality}

SHEET: 4 body views (front, 3/4, side, back) + 4 mouth-focused expressions (neutral smile, talking with teeth, surprised O, wide smile).

STYLE: ${styleDirective(script)}

Upper and lower lips MUST be clearly drawn in every view. Mouth >= 5% of face area. This sheet is the definitive design bible for all 90s scenes.

If reference images are attached, treat them as the canonical character design. Preserve the character identity, head shape, ear/horn silhouette, scarf, body proportions, and color palette. Remove any stray text, letters, logos, or floating marks that are not part of the canonical character.`;
  const prompt = wrapWithPromptRules(promptCore);
  const referencePaths = referenceImagePaths.slice(0, 4);

  const missingReferencePaths = referencePaths.filter((path) => !existsSync(path));
  if (missingReferencePaths.length > 0) {
    throw new Error(`Character reference image missing: ${missingReferencePaths.join(', ')}`);
  }

  const result = await nano.generateImageFromFiles(prompt, referencePaths, '16:9');
  const path = join(refsDir, 'character_ref.png');
  writeFileSync(path, result.bytes);
  return { path, costUsd: result.costUsd };
}

async function stepKeyframe(
  script: EpisodeScript,
  scene: EpisodeScene,
  refPath: string,
  keyframesDir: string,
  sceneIndex: number,
  previousKeyframePath: string | null
): Promise<{ path: string; costUsd: number }> {
  const googleKey = process.env.GOOGLE_API_KEY;
  if (!googleKey) throw new Error('GOOGLE_API_KEY missing');

  const nano = new NanoBananaProvider(googleKey);
  const main = mainCharacter(script);
  const promptCore = `Create a single 16:9 keyframe for scene ${sceneIndex + 1} of a 90-second Korean children's educational animation.

TOP-LEVEL:
${script.topLevelPrompt}

SCENE BRIEF:
${scene.keyframeBrief}

Visual action: ${scene.visualAction}
Camera: ${scene.cameraDirective}
Emotion: ${scene.emotion}
Location: ${scene.location ?? 'same established world'}
${scene.effects ? `Effects: ${scene.effects}` : ''}

The attached reference is the EXACT character design bible. Match ${main.displayName} IDENTICALLY.
The attached references are the canonical character sheet and previously APPROVED production frames. Match them EXACTLY.

STYLE:
${styleDirective(script)}

No text, no UI, no subtitles, no watermarks.`;
  const prompt = wrapWithPromptRules(promptCore);
  const referencePaths = [
    refPath,
    ...listApprovedFrames(2),
    ...(previousKeyframePath ? [previousKeyframePath] : []),
  ].slice(0, 4);

  const result = await nano.generateImageFromFiles(prompt, referencePaths, '16:9');
  const filename = `s${String(sceneIndex + 1).padStart(2, '0')}_keyframe.png`;
  const path = join(keyframesDir, filename);
  writeFileSync(path, result.bytes);
  return { path, costUsd: result.costUsd };
}

async function stepSilentVideo(
  script: EpisodeScript,
  scene: EpisodeScene,
  refPath: string,
  keyframePath: string,
  previousLastFramePath: string | null,
  clipsDir: string,
  sceneIndex: number,
  tier: SeedanceTier
): Promise<{ path: string; lastFramePath: string; costUsd: number }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY missing');

  const seedance = new Seedance2Provider(falKey);
  const imageFilePaths = previousLastFramePath
    ? [refPath, previousLastFramePath, keyframePath]
    : [refPath, keyframePath];
  const prompt = buildSilentVideoPrompt(script, scene, sceneIndex, previousLastFramePath !== null);
  writeFileSync(join(clipsDir, `s${String(sceneIndex + 1).padStart(2, '0')}_seedance_prompt.txt`), prompt, 'utf-8');

  const result = await withRetry(`Seedance scene ${sceneIndex + 1}`, 3, () =>
    seedance.generateFromFiles({
      prompt,
      imageFilePaths,
      durationSec: scene.durationSec,
      resolution: '720p',
      aspectRatio: '16:9',
      generateAudio: false,
      tier,
    })
  );

  const path = join(clipsDir, `s${String(sceneIndex + 1).padStart(2, '0')}_silent.mp4`);
  await downloadToFile(result.videoUrl, path);
  const lastFramePath = join(clipsDir, `s${String(sceneIndex + 1).padStart(2, '0')}_last_frame.jpg`);
  extractLastFrame(path, lastFramePath);
  return { path, lastFramePath, costUsd: result.costUsd };
}

function buildSilentVideoPrompt(
  script: EpisodeScript,
  scene: EpisodeScene,
  sceneIndex: number,
  usesPreviousFrame: boolean
): string {
  const main = mainCharacter(script);
  const referenceNote = usesPreviousFrame
    ? '@Image1 is the character design bible. @Image2 is the exact last frame of the previous scene. @Image3 is the target composition for this scene.'
    : '@Image1 is the character design bible. @Image2 is the exact starting keyframe for this scene.';

  const speechNote = scene.type === 'character_speaking'
    ? `${main.displayName} faces the camera in a medium close-up or medium shot with clearly visible lips, but the video must remain silent.`
    : 'This is a narration voiceover scene: show expressive action and clear educational visuals, but the video must remain silent.';

  return `[Top-level episode visual statement]
${script.topLevelPrompt}

Style: ${styleDirective(script)}
Tone: ${script.toneAndMood}

[Scene ${sceneIndex + 1} — ${scene.durationSec}s silent video, generate_audio false]
${referenceNote}

Action: ${scene.visualAction}
Camera: ${scene.cameraDirective}
Emotion: ${scene.emotion}
Location: ${scene.location ?? 'established episode world'}
${scene.effects ? `Effects: ${scene.effects}` : ''}

${speechNote}

Continuity checklist:
${script.consistencyChecklist.map((item) => `- ${item}`).join('\n')}

No generated audio, no music, no sound effects, no text, no subtitles, no watermarks. 16:9 children's 2D cel animation.`;
}

async function stepSceneAudio(scene: EpisodeScene, audioDir: string, sceneIndex: number): Promise<SceneAudio> {
  const text = scene.type === 'narration' ? scene.narrationText : scene.dialogueText;
  if (!text) throw new Error(`Scene ${sceneIndex + 1}: missing TTS text`);

  const casting = scene.type === 'narration'
    ? { voice: ANIMAL_VILLAGE_BIBLE.narrator.voice, style: ANIMAL_VILLAGE_BIBLE.narrator.style }
    : resolveVoiceCasting(scene.speakerId);
  const styleOverride = scene.type === 'narration'
    ? ANIMAL_VILLAGE_BIBLE.narrator.style
    : resolveVoiceStyle(scene.speakerId, scene.voiceEmotion);
  const tts = await synthesizeKorean({
    text,
    voiceName: casting.voice,
    styleOverride,
    ...(scene.type === 'narration' ? { speedWpm: 130 } : {}),
  });

  const basePath = join(audioDir, `s${String(sceneIndex + 1).padStart(2, '0')}_tts.wav`);
  writeFileSync(basePath, tts.audioBytes);

  const withWaitPath = join(audioDir, `s${String(sceneIndex + 1).padStart(2, '0')}_tts_wait.wav`);
  const sourceForNormalize = scene.waitBeatSec && scene.waitBeatSec > 0
    ? appendSilence(basePath, scene.waitBeatSec, withWaitPath)
    : basePath;

  const normalizedPath = join(audioDir, `s${String(sceneIndex + 1).padStart(2, '0')}_audio.wav`);
  normalizeAudioToDuration(sourceForNormalize, normalizedPath, scene.durationSec, {
    delayMs: scene.type === 'narration' ? NARRATION_AUDIO_DELAY_MS : 0,
  });

  return {
    path: normalizedPath,
    rawTtsPath: basePath,
    costUsd: tts.costUsd,
    ttsDurationSec: tts.durationSec,
  };
}

async function stepCompositeScene(
  scene: EpisodeScene,
  silentVideoPath: string,
  audioPath: string,
  scenesDir: string,
  sceneIndex: number,
  skipLipsync: boolean
): Promise<{ path: string; lipsyncCostUsd: number }> {
  const outputPath = join(scenesDir, `s${String(sceneIndex + 1).padStart(2, '0')}.mp4`);

  if (scene.type === 'character_speaking' && !skipLipsync) {
    const result = await withRetry(`lipsync scene ${sceneIndex + 1}`, 2, () =>
      syncLipSync({
        videoFilePath: silentVideoPath,
        audioFilePath: audioPath,
        videoDurationSec: scene.durationSec,
      })
    );
    const lipPath = join(scenesDir, `s${String(sceneIndex + 1).padStart(2, '0')}_lipsync_raw.mp4`);
    writeFileSync(lipPath, result.resultMp4Bytes);
    normalizeVideo(lipPath, outputPath, scene.durationSec, {
      fadeInSec: DEFAULT_SCENE_FADE_SEC,
      fadeOutSec: DEFAULT_SCENE_FADE_SEC,
    });
    return { path: outputPath, lipsyncCostUsd: result.costUsd };
  }

  overlayAudio(silentVideoPath, audioPath, outputPath, scene.durationSec, {
    fadeInSec: scene.type === 'narration' ? NARRATION_FADE_IN_SEC : DEFAULT_SCENE_FADE_SEC,
    fadeOutSec: scene.type === 'narration' ? NARRATION_FADE_OUT_SEC : DEFAULT_SCENE_FADE_SEC,
  });
  return { path: outputPath, lipsyncCostUsd: 0 };
}

async function stepVeedSpeakingScene(
  keyframePath: string,
  audio: SceneAudio,
  scenesDir: string,
  sceneIndex: number,
  durationSec: number
): Promise<{ path: string; lastFramePath: string; costUsd: number }> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY missing');

  const veed = new VeedFabricProvider(falKey);
  const result = await withRetry(`VEED scene ${sceneIndex + 1}`, 2, () =>
    veed.generateSceneFromFiles({
      imageFilePath: keyframePath,
      audioFilePath: audio.rawTtsPath,
      resolution: '480p',
    })
  );

  const rawPath = join(scenesDir, `s${String(sceneIndex + 1).padStart(2, '0')}_veed_raw.mp4`);
  await downloadToFile(result.videoUrl, rawPath);
  const outputPath = join(scenesDir, `s${String(sceneIndex + 1).padStart(2, '0')}_veed.mp4`);
  normalizeVideo(rawPath, outputPath, durationSec, {
    fadeInSec: DEFAULT_SCENE_FADE_SEC,
    fadeOutSec: DEFAULT_SCENE_FADE_SEC,
  });
  const lastFramePath = join(scenesDir, `s${String(sceneIndex + 1).padStart(2, '0')}_veed_last_frame.jpg`);
  extractLastFrame(outputPath, lastFramePath);

  return { path: outputPath, lastFramePath, costUsd: result.costUsd };
}

function stepLimitedAnimationScene(
  scene: EpisodeScene,
  keyframePath: string,
  audio: SceneAudio,
  scenesDir: string,
  sceneIndex: number
): { path: string } {
  const outputPath = join(scenesDir, `s${String(sceneIndex + 1).padStart(2, '0')}_limited.mp4`);
  const isSpeakingScene = scene.type === 'character_speaking';
  renderLimitedAnimationScene({
    keyframePath,
    audioPath: audio.path,
    outputPath,
    durationSec: scene.durationSec,
    isSpeakingScene,
    speechDurationSec: isSpeakingScene ? Math.min(scene.durationSec, audio.ttsDurationSec) : undefined,
    mouthBox: parseNormalizedBox(process.env.LIMITED_MOUTH_BOX),
    cameraPreset: cameraPresetFromDirective(scene.cameraDirective, sceneIndex, isSpeakingScene),
    fadeInSec: scene.type === 'narration' ? NARRATION_FADE_IN_SEC : undefined,
    fadeOutSec: scene.type === 'narration' ? NARRATION_FADE_OUT_SEC : undefined,
  });
  return { path: outputPath };
}

function appendSilence(audioPath: string, silenceSec: number, outPath: string): string {
  const silencePath = outPath.replace(/\.wav$/, '.silence.wav');
  runFfmpeg([
    '-y', '-v', 'error',
    '-f', 'lavfi',
    '-i', 'anullsrc=channel_layout=mono:sample_rate=22050',
    '-t', String(silenceSec),
    '-c:a', 'pcm_s16le',
    silencePath,
  ], 'silent audio');

  const listPath = outPath.replace(/\.wav$/, '.list.txt');
  writeFileSync(listPath, [`file '${audioPath}'`, `file '${silencePath}'`].join('\n'), 'utf-8');
  runFfmpeg([
    '-y', '-v', 'error',
    '-f', 'concat', '-safe', '0',
    '-i', listPath,
    '-c:a', 'pcm_s16le',
    outPath,
  ], 'audio concat');
  return outPath;
}

function normalizeAudioToDuration(
  inputPath: string,
  outPath: string,
  durationSec: number,
  options: { delayMs?: number } = {}
): void {
  const delayMs = Math.max(0, options.delayMs ?? 0);
  const filters = [
    ...(delayMs > 0 ? [`adelay=${delayMs}:all=1`] : []),
    'apad',
    `atrim=0:${durationSec.toFixed(3)}`,
    'asetpts=PTS-STARTPTS',
  ].join(',');
  runFfmpeg([
    '-y', '-v', 'error',
    '-i', inputPath,
    '-af', filters,
    '-ar', '22050',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    '-t', durationSec.toFixed(3),
    outPath,
  ], 'audio normalize');
}

function overlayAudio(
  videoPath: string,
  audioPath: string,
  outPath: string,
  durationSec: number,
  options: { fadeInSec?: number; fadeOutSec?: number } = {}
): void {
  const videoFilter = buildNormalizedVideoFilter(durationSec, options);
  runFfmpeg([
    '-y', '-v', 'error',
    '-i', videoPath,
    '-i', audioPath,
    '-filter_complex',
    `[0:v]${videoFilter}[v];[1:a]apad,atrim=0:${durationSec.toFixed(3)},asetpts=PTS-STARTPTS[a]`,
    '-map', '[v]',
    '-map', '[a]',
    '-t', durationSec.toFixed(3),
    '-c:v', 'libx264',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-r', '24',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '44100',
    '-ac', '2',
    outPath,
  ], 'audio overlay');
}

function normalizeVideo(
  inputPath: string,
  outPath: string,
  durationSec: number,
  options: { fadeInSec?: number; fadeOutSec?: number } = {}
): void {
  const videoFilter = buildNormalizedVideoFilter(durationSec, options);
  runFfmpeg([
    '-y', '-v', 'error',
    '-i', inputPath,
    '-filter_complex',
    `[0:v]${videoFilter}[v];[0:a]apad,atrim=0:${durationSec.toFixed(3)},asetpts=PTS-STARTPTS[a]`,
    '-map', '[v]',
    '-map', '[a]',
    '-t', durationSec.toFixed(3),
    '-c:v', 'libx264',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-r', '24',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '44100',
    '-ac', '2',
    outPath,
  ], 'video normalize');
}

function buildNormalizedVideoFilter(
  durationSec: number,
  options: { fadeInSec?: number; fadeOutSec?: number }
): string {
  const fadeInSec = Math.max(0, options.fadeInSec ?? 0);
  const fadeOutSec = Math.max(0, options.fadeOutSec ?? 0);
  const filters = [
    `scale=${OUTPUT_VIDEO_WIDTH}:${OUTPUT_VIDEO_HEIGHT}:force_original_aspect_ratio=decrease`,
    `pad=${OUTPUT_VIDEO_WIDTH}:${OUTPUT_VIDEO_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`,
    `tpad=stop_mode=clone:stop_duration=${durationSec.toFixed(3)}`,
    `trim=duration=${durationSec.toFixed(3)}`,
    'setpts=PTS-STARTPTS',
  ];
  if (fadeInSec > 0) {
    filters.push(`fade=in:st=0:d=${fadeInSec.toFixed(3)}`);
  }
  if (fadeOutSec > 0) {
    filters.push(`fade=out:st=${Math.max(0, durationSec - fadeOutSec).toFixed(3)}:d=${fadeOutSec.toFixed(3)}`);
  }
  filters.push('format=yuv420p');
  return filters.join(',');
}

function ffmpegConcat(inputs: string[], outPath: string): void {
  const normalized: string[] = [];
  for (let i = 0; i < inputs.length; i += 1) {
    const normalizedPath = inputs[i].replace(/\.mp4$/, '.norm.mp4');
    normalizeVideo(inputs[i], normalizedPath, probeDurationSec(inputs[i], 15));
    normalized.push(normalizedPath);
  }

  const listPath = outPath.replace(/\.mp4$/, '.list.txt');
  writeFileSync(listPath, normalized.map((path) => `file '${path}'`).join('\n'), 'utf-8');
  runFfmpeg([
    '-y', '-v', 'error',
    '-f', 'concat', '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    outPath,
  ], 'concat');
}

function extractLastFrame(videoPath: string, outPath: string): void {
  runFfmpeg([
    '-y', '-v', 'error',
    '-sseof', '-0.1',
    '-i', videoPath,
    '-vframes', '1',
    '-q:v', '2',
    outPath,
  ], 'last-frame extract');
}

function extractThumbnail(videoPath: string, outPath: string): void {
  runFfmpeg([
    '-y', '-v', 'error',
    '-ss', '0.2',
    '-i', videoPath,
    '-vframes', '1',
    '-q:v', '2',
    outPath,
  ], 'thumbnail extract');
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

function runFfmpeg(args: string[], label: string): void {
  const result = spawnSync('ffmpeg', args, { encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`ffmpeg ${label} failed: ${result.stderr}`);
  }
}

async function downloadToFile(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed ${res.status} ${url}`);
  const fileStream = createWriteStream(outPath);
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), fileStream);
}

async function withRetry<T>(label: string, attempts: number, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[episode-pipeline] ${label} attempt ${attempt}/${attempts} failed: ${message}`);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function buildSubtitlesVtt(script: EpisodeScript): string {
  const lines = ['WEBVTT', ''];
  const speakerName = mainCharacter(script).displayName ?? '미리';
  let elapsed = 0;

  for (const scene of script.scenes) {
    const start = elapsed;
    const end = elapsed + scene.durationSec;
    const cueEnd = scene.waitBeatSec ? Math.max(start + 0.5, end - scene.waitBeatSec) : end;
    const text = scene.type === 'narration'
      ? `내레이터: ${scene.narrationText ?? ''}`
      : `${speakerName}: ${scene.dialogueText ?? ''}`;

    lines.push(`${formatVttTime(start)} --> ${formatVttTime(cueEnd)}`);
    lines.push(escapeVttText(text));
    lines.push('');
    elapsed = end;
  }

  return `${lines.join('\n')}\n`;
}

function formatVttTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const ms = Math.round((seconds - whole) * 1000);
  const hh = Math.floor(whole / 3600);
  const mm = Math.floor((whole % 3600) / 60);
  const ss = whole % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function escapeVttText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/-->/g, '->')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function runEpisodePipeline(input: EpisodeInput): Promise<EpisodeOutput> {
  const workDir = input.workDir;
  const refsDir = join(workDir, 'refs');
  const keyframesDir = join(workDir, 'keyframes');
  const clipsDir = join(workDir, 'clips');
  const audioDir = join(workDir, 'audio');
  const scenesDir = join(workDir, 'scenes');
  mkdirSync(refsDir, { recursive: true });
  mkdirSync(keyframesDir, { recursive: true });
  mkdirSync(clipsDir, { recursive: true });
  mkdirSync(audioDir, { recursive: true });
  mkdirSync(scenesDir, { recursive: true });

  const cost = emptyCost();
  const tier = input.seedanceTier ?? (process.env.SEEDANCE_TIER as SeedanceTier | undefined) ?? 'standard';
  const animationMode = resolveAnimationMode(input.animationMode);
  const lipsyncMode = resolveLipsyncMode(input.skipLipsync);

  const director = await directEpisodeScript(input.brief, workDir);
  cost.director += director.costUsd;
  const script = director.script;

  const ref = await stepCharacterRef(script, refsDir, input.brief.referenceImagePaths ?? []);
  cost.refs += ref.costUsd;

  const keyframes: string[] = [];
  for (let i = 0; i < script.scenes.length; i += 1) {
    const previousKeyframePath = keyframes.length > 0 ? keyframes[keyframes.length - 1] : null;
    const keyframe = await stepKeyframe(script, script.scenes[i], ref.path, keyframesDir, i, previousKeyframePath);
    keyframes.push(keyframe.path);
    cost.keyframes += keyframe.costUsd;
  }

  const sceneAudio: SceneAudio[] = [];
  for (let i = 0; i < script.scenes.length; i += 1) {
    const audio = await stepSceneAudio(script.scenes[i], audioDir, i);
    sceneAudio.push(audio);
    cost.tts += audio.costUsd;
  }

  const sceneVideos: string[] = [];

  if (animationMode === 'limited') {
    for (let i = 0; i < script.scenes.length; i += 1) {
      const scene = script.scenes[i];
      if (scene.type === 'character_speaking' && lipsyncMode === 'veed') {
        const veed = await stepVeedSpeakingScene(keyframes[i], sceneAudio[i], scenesDir, i, scene.durationSec);
        sceneVideos.push(veed.path);
        cost.veed += veed.costUsd;
      } else {
        const limited = stepLimitedAnimationScene(scene, keyframes[i], sceneAudio[i], scenesDir, i);
        sceneVideos.push(limited.path);
      }
    }
  } else if (lipsyncMode === 'veed') {
    let previousLastFramePath: string | null = null;
    for (let i = 0; i < script.scenes.length; i += 1) {
      const scene = script.scenes[i];
      if (scene.type === 'character_speaking') {
        const veed = await stepVeedSpeakingScene(keyframes[i], sceneAudio[i], scenesDir, i, scene.durationSec);
        sceneVideos.push(veed.path);
        previousLastFramePath = veed.lastFramePath;
        cost.veed += veed.costUsd;
        continue;
      }

      const silent = await stepSilentVideo(
        script,
        scene,
        ref.path,
        keyframes[i],
        previousLastFramePath,
        clipsDir,
        i,
        tier
      );
      cost.videoSilent += silent.costUsd;
      const composite = await stepCompositeScene(
        scene,
        silent.path,
        sceneAudio[i].path,
        scenesDir,
        i,
        true
      );
      sceneVideos.push(composite.path);
      previousLastFramePath = silent.lastFramePath;
    }
  } else {
    const silentVideos: string[] = [];
    let previousLastFramePath: string | null = null;
    for (let i = 0; i < script.scenes.length; i += 1) {
      const silent = await stepSilentVideo(
        script,
        script.scenes[i],
        ref.path,
        keyframes[i],
        previousLastFramePath,
        clipsDir,
        i,
        tier
      );
      silentVideos.push(silent.path);
      previousLastFramePath = silent.lastFramePath;
      cost.videoSilent += silent.costUsd;
    }

    for (let i = 0; i < script.scenes.length; i += 1) {
      const composite = await stepCompositeScene(
        script.scenes[i],
        silentVideos[i],
        sceneAudio[i].path,
        scenesDir,
        i,
        lipsyncMode !== 'sync'
      );
      sceneVideos.push(composite.path);
      cost.lipsync += composite.lipsyncCostUsd;
    }
  }

  const finalVideoLocalPath = join(workDir, 'final.mp4');
  if (sceneVideos.length === 1) {
    copyFileSync(sceneVideos[0], finalVideoLocalPath);
  } else {
    ffmpegConcat(sceneVideos, finalVideoLocalPath);
  }

  const thumbnailLocalPath = join(workDir, 'thumbnail.jpg');
  extractThumbnail(finalVideoLocalPath, thumbnailLocalPath);

  const subtitlesVttLocalPath = join(workDir, 'subtitles.vtt');
  writeFileSync(subtitlesVttLocalPath, buildSubtitlesVtt(script), 'utf-8');

  const finalVideoStoragePath = `${input.storagePrefix}/final.mp4`;
  const thumbnailStoragePath = `${input.storagePrefix}/thumbnail.jpg`;
  const subtitlesStoragePath = `${input.storagePrefix}/subtitles.vtt`;
  await uploadBytes(finalVideoStoragePath, readFileSync(finalVideoLocalPath), {
    contentType: 'video/mp4',
    upsert: true,
  });
  await uploadBytes(thumbnailStoragePath, readFileSync(thumbnailLocalPath), {
    contentType: 'image/jpeg',
    upsert: true,
  });
  await uploadBytes(subtitlesStoragePath, Buffer.from(readFileSync(subtitlesVttLocalPath, 'utf-8'), 'utf-8'), {
    contentType: 'text/vtt',
    upsert: true,
  });

  const measuredDurationSec = probeDurationSec(finalVideoLocalPath, script.totalDurationSec);

  return {
    script,
    finalVideoLocalPath,
    finalVideoStoragePath,
    thumbnailLocalPath,
    thumbnailStoragePath,
    subtitlesVttLocalPath,
    subtitlesStoragePath,
    totalDurationSec: measuredDurationSec,
    totalCostUsd: totalCost(cost),
    perStageCostUsd: cost,
    scenes: script.scenes,
  };
}
