/**
 * 감독 에이전트 입출력 스키마.
 *
 * 설계 철학: 실제 영상디자이너 스크립트를 역설계한 7축 구조를 JSON으로 표현.
 * (top-level cinematic × timestamp × camera × action × dialogue × effects × sfx)
 *
 * 이 JSON은 "binding document" — TTS/이미지/영상/편집 단계가 모두 이걸 참조한다.
 */

/** 교육 브리프 — 감독 에이전트 입력 */
export interface VideoBrief {
  topic: string;
  audience: string;
  /** 목표 길이 (초). Seedance 2.0 single-call max=15, 그 이상은 멀티씬 */
  targetDurationSec: number;
  learningGoals: string[];
  /** 시각 스타일 (예: "cinematic 2D cel animation ... pastel") */
  styleReference: string;
  /** 톤 (예: "밝고 친근", "차분하고 신뢰감 있는") */
  tone: string;
  roughSynopsis?: string;
  protagonistHint?: string;
  /** GACS-3 상위 형용사 */
  adjectives?: string[];
}

/** 캐릭터 정의 — nano-banana 레퍼런스 시트 + Gemini TTS voice 매칭 */
export interface CharacterDef {
  /** 영문 소문자 식별자 (예: "doori", "water_droplet") */
  id: string;
  /** 한국어 이름 */
  displayName: string;
  /** 캐릭터 원형 (예: "의인화된 물방울 요정") */
  archetype?: string;
  /** 외형 — nano-banana 레퍼런스 시트 프롬프트 source */
  appearance: string;
  personality: string;
  /** Gemini TTS voice (Puck/Leda/Aoede/Fenrir/Kore/Charon/Despina/Enceladus) */
  voice: string;
  /** TTS style 지시문 */
  voiceNote: string;
}

/** 배경 정의 — nano-banana 배경 레퍼런스용 */
export interface BackgroundDef {
  /** 전체 세계관 묘사 */
  worldDescription: string;
  /** 씬별 핵심 공간 (ordered) */
  keyLocations: string[];
  /** 컬러 팔레트 hex */
  paletteHex: string[];
  /** 조명 특성 (옵셔널) */
  lighting?: string;
  /** 씬 진행에 따른 배경 변화 (옵셔널) */
  progression?: string;
}

/** 씬 정의 — Seedance 2.0 reference-to-video 단일 호출 1개에 매핑 */
export interface SceneDef {
  /** 씬 식별자 (예: "s01") */
  id: string;
  /** 씬 길이 (초). Seedance 2.0 제약: 4~15 */
  durationSec: number;
  /** 타임 범위 (옵셔널 참고 문자열 예: "0-7s") */
  timeRange?: string;
  /** 공간 */
  location?: string;
  /** 등장 캐릭터 ID 리스트 */
  characters: string[];
  /** 한국어 대사 (따옴표 없이 raw). 없으면 null (내레이션/무음씬) */
  dialogue: string | null;
  /** 대사 화자 ID */
  speakerId?: string;
  /** 액션 묘사 (시각 비유 권장) */
  action: string;
  /** 카메라 지시 (shot size, movement, angle) */
  camera: string;
  /** 감정/태도 어휘 */
  emotion: string;
  /** 효과/파티클/빛 묘사 */
  effects?: string;
  /** SFX (string or string[]) */
  sfx?: string | string[];
  /** 다음 씬 전환 지시 */
  transitionOut?: string;
}

/** 감독 에이전트 최종 출력 — binding document */
export interface VideoScript {
  title: string;
  totalDurationSec: number;
  characters: CharacterDef[];
  background: BackgroundDef;
  toneAndMood: string;
  /**
   * 스타일 디렉티브. string 또는 string[] 둘 다 허용.
   * Opus 는 종종 한 단락으로 씀 — 그대로 수용.
   */
  styleDirectives: string | string[];
  /**
   * Top-level cinematic prompt — 영상 전체를 한 단락으로 요약한 영어.
   * 각 씬 Seedance 프롬프트 머리에 붙는다.
   */
  topLevelPrompt: string;
  scenes: SceneDef[];
  /** 일관성 체크리스트 (명제 배열) */
  consistencyChecklist: string[];
  /** BGM 단서 */
  musicCue?: string;
  /** 감독 노트 (사람용 메모) */
  directorNotes?: string;
}

// 90s episode pipeline 의 풍부한 씬 메타. 기존 VideoScript 와 별개 — 구조가 다름.
export interface EpisodeScene {
  index: number;
  type: 'narration' | 'character_speaking';
  durationSec: number;       // 4-15 권장 (research)

  // narration 또는 character_speaking 둘 다 narrationText 또는 dialogueText 중 하나 채워짐
  narrationText?: string;    // type='narration' 일 때 — 보이스오버 한국어 텍스트
  dialogueText?: string;     // type='character_speaking' 일 때 — 캐릭터가 화면 보고 말하는 한국어
  waitBeatSec?: number;      // direct_question 후 침묵 (Blue's Clues)

  // 시각 메타
  visualAction: string;      // Seedance 프롬프트용
  cameraDirective: string;   // "medium close-up, character facing camera" 등
  emotion: string;           // "curious", "excited", "calm" 등
  location?: string;
  effects?: string;

  // 키프레임용 (nano-banana 프롬프트 빌드용)
  keyframeBrief: string;     // "Miri standing at the seashore, sun rising, water sparkles" 등
}

export interface EpisodeScript {
  title: string;
  topLevelPrompt: string;        // 전체 episode 분위기
  styleDirectives: string | string[];
  toneAndMood: string;
  characters: VideoScript['characters']; // 기존 캐릭터 schema 재사용
  scenes: EpisodeScene[];          // 4-7 권장
  totalDurationSec: number;        // 합계 (75-95)
  consistencyChecklist: string[];

  // research 룰 자동 검증용
  cutsPerMinute: number;           // = scenes.length / (totalDurationSec / 60)
  speakingScenesCount: number;     // type='character_speaking' 개수
}

/** 감독 에이전트 호출 결과 (메타 포함) */
export interface DirectorResult {
  script: VideoScript;
  costUsd: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  elapsedMs: number;
}

/** styleDirectives 를 string[] 로 정규화 */
export function normalizeStyleDirectives(input: string | string[]): string[] {
  if (Array.isArray(input)) return input;
  return input
    .split(/[,.\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════
// Opus 자연 스키마 variance 흡수 헬퍼 — 코드 전체에서 이걸 경유.
// Opus 는 호출마다 필드명을 약간 다르게 쓰지만 내용은 풍부함. 우리는 strict
// 파싱 대신 유연한 accessor 를 제공해서 파이프라인 breakage 를 막는다.
// ═══════════════════════════════════════════════════════════════════

/**
 * scene.dialogue 가 string / {text, speaker} / [{text, character}] 중 아무 포맷이든 정규화.
 * Opus 는 호출마다 모양을 바꾸므로 관대하게 파싱. 배열이면 전체 text 를 개행으로 결합.
 */
export function getSceneDialogue(
  scene: unknown
): { text: string; speakerId?: string } | null {
  const s = scene as Record<string, unknown>;
  const d = s.dialogue;
  if (!d) return null;

  if (typeof d === 'string') {
    return { text: d, speakerId: s.speakerId as string | undefined };
  }

  if (Array.isArray(d)) {
    const texts: string[] = [];
    let firstSpeaker: string | undefined;
    for (const item of d) {
      if (typeof item === 'string') {
        texts.push(item);
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const t = (obj.text ?? obj.dialogue ?? obj.line) as string | undefined;
        if (t) texts.push(t);
        if (!firstSpeaker) {
          firstSpeaker = (obj.speaker ?? obj.speakerId ?? obj.speaker_id ?? obj.character) as string | undefined;
        }
      }
    }
    if (texts.length === 0) return null;
    return { text: texts.join('\n'), speakerId: firstSpeaker };
  }

  if (typeof d === 'object') {
    const obj = d as Record<string, unknown>;
    const text = (obj.text ?? obj.dialogue ?? obj.line) as string | undefined;
    const speakerId = (obj.speaker ?? obj.speakerId ?? obj.speaker_id ?? obj.character) as string | undefined;
    if (text) return { text, speakerId };
  }

  return null;
}

/** background.worldDescription / worldStyle / description 중 사용 가능한 것 */
export function getBackgroundDescription(script: unknown): string {
  const s = script as { background?: Record<string, unknown> };
  const b = s.background ?? {};
  return (
    (b.worldDescription as string | undefined) ??
    (b.worldStyle as string | undefined) ??
    (b.description as string | undefined) ??
    ''
  );
}

/** background.keyLocations (string[]) 또는 locations ({id,description}[]) — 표시용 string[] */
export function getBackgroundLocations(script: unknown): string[] {
  const s = script as { background?: Record<string, unknown> };
  const b = s.background ?? {};
  const raw = (b.keyLocations ?? b.locations) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && item) {
      const o = item as Record<string, unknown>;
      return (o.description as string) ?? (o.id as string) ?? '';
    }
    return '';
  }).filter(Boolean);
}

/** scene.location 이 location id 참조일 경우 description 으로 해석 */
export function resolveSceneLocation(script: unknown, sceneLocation: unknown): string {
  if (typeof sceneLocation !== 'string') return '';
  const s = script as { background?: Record<string, unknown> };
  const locs = s.background?.locations as unknown;
  if (Array.isArray(locs)) {
    const match = locs.find((l) => typeof l === 'object' && l && (l as { id?: string }).id === sceneLocation);
    if (match && typeof match === 'object') {
      return (match as { description?: string }).description ?? sceneLocation;
    }
  }
  return sceneLocation;
}

/** character.appearance / visualDescription / description 중 사용 가능한 것 */
export function getCharacterAppearance(character: unknown): string {
  const c = character as Record<string, unknown>;
  return (
    (c.appearance as string | undefined) ??
    (c.visualDescription as string | undefined) ??
    (c.description as string | undefined) ??
    ''
  );
}

/** character.voiceNote / voiceStyle 중 사용 가능한 것 */
export function getCharacterVoiceNote(character: unknown): string | undefined {
  const c = character as Record<string, unknown>;
  return (
    (c.voiceNote as string | undefined) ??
    (c.voiceStyle as string | undefined)
  );
}
