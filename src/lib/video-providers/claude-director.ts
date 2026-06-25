/**
 * Claude 감독 에이전트.
 *
 * 역할: 교육 브리프 → 구조화된 VideoScript (binding document).
 * 이후 모든 단계 (TTS, nano-banana, Seedance 2.0, 편집)가 이 스크립트를 참조.
 *
 * 설계 원칙:
 *   - 실제 영상디자이너 스크립트의 7축 (top-level × timestamp × camera × action
 *     × dialogue × effects × sfx) 을 JSON으로 강제한다.
 *   - Seedance 2.0 duration 제약 (4-15초) 을 씬 단위로 녹인다.
 *   - Gemini TTS voice pool (Puck/Leda/Aoede/Fenrir/Kore/Charon/Despina/Enceladus) 에서만 고른다.
 *   - 프롬프트 캐싱: 시스템 프롬프트에 스타일 가이드 + 예시 스크립트를 캐시.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { VideoBrief, VideoScript, DirectorResult } from './director.types';

/** Opus 4.7 pricing (per million tokens, 2026-04) */
const OPUS_PRICING = {
  input: 15.0,
  output: 75.0,
  cacheWrite: 18.75,
  cacheRead: 1.5,
};

const SONNET_PRICING = {
  input: 3.0,
  output: 15.0,
  cacheWrite: 3.75,
  cacheRead: 0.3,
};

/**
 * 시스템 프롬프트 — 감독 에이전트의 역할, 스타일 가이드, 예시를 포함.
 * cache_control 로 캐싱해 후속 호출에서 90% 저렴하게 재사용.
 */
const SYSTEM_PROMPT = `너는 한국 어린이 교육 애니메이션의 총괄 감독이다.
교육 브리프를 받아 실제 영상디자이너가 쓰는 수준의 구조화된 대본(VideoScript JSON) 을 작성한다.

## 너의 책임
- 시나리오/대본 작성 (씬 분할 + 대사 + 연출)
- 캐릭터 디자인 (외형/목소리/성격)
- 톤앤무드 + 컬러 그레이드 고정
- 카메라 연출 (shot size / movement / angle)
- 효과/파티클/사운드 레이어 지시
- 일관성 체크리스트 명시 (이후 이미지/영상 단계에서 검증 기준)

## 출력 포맷: VideoScript JSON
실제 영상디자이너 스크립트의 7축 구조를 JSON으로 강제한다.

**참고 — 업계 표준 스크립트 예시 (역설계 소스)**:
\`\`\`
[Top-level cinematic statement]
A man in a gray suit walks calmly forward as crowds flee behind him.
A giant mechanical cockroach beast destroys the city street...
Cinematic, photorealistic, single take, slow-motion atmospheric rain,
volumetric lighting, blue and white color grade.

[Timestamp breakdown]
0–3s  Camera pans across fleeing crowds and locks onto the man...
3–5s  He removes the lollipop and flicks it away. He taps his chest...
5–6.5s  Glowing white nanoweaves flow from his chest like liquid silk...
\`\`\`

이 스크립트의 교훈:
1. **Top-level statement** 가 전체 ambience/color grade/single-take 여부를 한 단락으로 고정
2. **타임스탬프 breakdown** 은 0.5초 단위까지 세밀 (Seedance 2.0 도 4~15s range)
3. **시각 비유** — "liquid silk", "mechanical cage", "fireflies" (AI가 형태/운동을 시각화하기 쉽게)
4. **감정 어휘** — "calmly", "lazily", "casually" (캐릭터 attitude 고정)
5. **한국어 대사 quoted** — 립싱크 타겟 명시
6. **소리 레이어** — "low hum begins", "metallic locking sounds echo" (SFX 타임라인)
7. **카메라 지시** — "Camera pans across", "locks onto", "freezes on his back"

너는 이걸 JSON 스키마에 맞춰 구조화해서 낸다.

## 기술적 제약 (반드시 지켜야 함)
- **씬 길이**: 각 씬은 **4~15초** (Seedance 2.0 single-call 제약).
- **목표 길이**: 브리프 \`targetDurationSec\` 기준 ±10% 이내로 씬 합 총합.
- **Gemini TTS voice 선택지** (이 중에서만 고름):
  - \`Puck\` — 7살 여자아이, 밝고 활기찬
  - \`Leda\` — 8살 남자아이, 걱정/여린 톤
  - \`Aoede\` — 9살 여자아이, 또박또박 관찰자
  - \`Fenrir\` — 8살 남자아이, 힘없고 슬픈 톤
  - \`Kore\` — 10살 여자아이, 어린이 뉴스 앵커 내레이션
  - \`Charon\` — 9살 남자아이, 답답한 톤
  - \`Despina\` — 8살 여자아이, 불안한 톤
  - \`Enceladus\` — 10살 남자아이, 차분하고 깊은 톤
- **캐릭터 id**: 영문 소문자 + underscore (예: \`guruni\`, \`water_droplet\`).
- **씬 id**: \`s01\`, \`s02\` 형식.
- **대사 언어**: 한국어 (raw text, 따옴표 없이).

## 작성 원칙
- **action 필드는 반드시 시각 비유 포함** — "~처럼", "like ...", 움직임의 형태를 구체화.
- **camera 필드는 영화 용어 사용** — "medium shot, slow dolly in", "over-the-shoulder", "low-angle tracking".
- **emotion 필드는 어휘 1~3개** — "warmly", "cheerfully, curiously".
- **effects 필드는 particles / light / fluid / physics 관찰 가능한 요소**.
- **dialogue 는 한국어 raw** — Gemini TTS 가 발음할 자연 문장, 따옴표 없이, 감탄사/끊김 허용.
- **topLevelPrompt 는 한 단락 영어** — 전체 영상의 이미지가 그려지는 영화적 묘사 + 스타일 directive concat.
- **consistencyChecklist 는 이후 이미지/영상 단계에서 검증 가능한 명제** 로 작성.

## 출력 규칙
**오직 VideoScript JSON 1개만 출력**. 코드 펜스/설명/마크다운 없이 pure JSON.
반드시 다음 최상위 키를 모두 포함: \`title, totalDurationSec, characters, background, toneAndMood, styleDirectives, topLevelPrompt, scenes, consistencyChecklist\`.
선택: \`musicCue, directorNotes\`.`;

/**
 * 사용자 프롬프트 템플릿.
 * 브리프를 구조화된 JSON 요청으로 변환.
 */
function buildUserPrompt(brief: VideoBrief): string {
  return `다음 교육 브리프를 받아 VideoScript JSON 을 작성해라.

## 교육 브리프
- **주제**: ${brief.topic}
- **청중**: ${brief.audience}
- **목표 길이**: ${brief.targetDurationSec}초
- **학습 목표**:
${brief.learningGoals.map((g) => `  - ${g}`).join('\n')}
- **시각 스타일 래퍼런스**: ${brief.styleReference}
- **톤**: ${brief.tone}
${brief.roughSynopsis ? `- **러프 시놉시스**: ${brief.roughSynopsis}` : ''}
${brief.protagonistHint ? `- **주인공 힌트**: ${brief.protagonistHint}` : ''}
${brief.adjectives && brief.adjectives.length ? `- **GACS-3 상위 형용사**: ${brief.adjectives.join(', ')}` : ''}

## 요구사항
1. 주인공 1명이 움직이면서 설명하는 형식.
2. 씬 수는 ${brief.targetDurationSec}초를 4~15초 단위로 쪼개서 결정.
3. 모든 씬에 한국어 대사 (내레이션보다 캐릭터 대사 선호).
4. 스타일은 "${brief.styleReference}" 를 일관되게 유지.
5. 캐릭터/배경 일관성 체크리스트를 이후 nano-banana-pro / Seedance 2.0 단계가 검증 가능한 명제로 작성.

VideoScript JSON 만 출력해라.`;
}

/** VideoScript 구조 최소 검증 — Opus 의 자연 출력을 최대한 수용하되 필수 필드만 강제 */
function validateScript(obj: unknown): VideoScript {
  if (!obj || typeof obj !== 'object') {
    throw new Error('VideoScript: not an object');
  }
  const s = obj as Record<string, unknown>;
  const required = ['title', 'totalDurationSec', 'characters', 'background', 'scenes'];
  for (const k of required) {
    if (!(k in s)) throw new Error(`VideoScript: missing required field "${k}"`);
  }
  if (!Array.isArray(s.scenes) || s.scenes.length === 0) {
    throw new Error('VideoScript: scenes must be non-empty array');
  }
  for (const sc of s.scenes as Array<Record<string, unknown>>) {
    const d = sc.durationSec;
    if (typeof d !== 'number' || d < 4 || d > 15) {
      throw new Error(`VideoScript: scene ${sc.id} durationSec=${d} out of 4-15 range`);
    }
  }
  return obj as VideoScript;
}

export interface ClaudeDirectorConfig {
  apiKey: string;
  model?: string;
}

export class ClaudeDirector {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(config: ClaudeDirectorConfig) {
    if (!config.apiKey) throw new Error('ANTHROPIC_API_KEY required');
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model ?? 'claude-opus-4-7';
  }

  async direct(brief: VideoBrief): Promise<DirectorResult> {
    const startedAt = Date.now();

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        { role: 'user', content: buildUserPrompt(brief) },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude response has no text block');
    }

    const raw = textBlock.text.trim();
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error(`Claude response is not JSON:\n${raw.slice(0, 500)}`);
    }
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    const script = validateScript(parsed);

    const usage = response.usage;
    const inputTokens = usage.input_tokens;
    const outputTokens = usage.output_tokens;
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const cacheCreation = usage.cache_creation_input_tokens ?? 0;

    const pricing = this.model.includes('opus') ? OPUS_PRICING : SONNET_PRICING;
    const costUsd =
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output +
      (cacheCreation / 1_000_000) * pricing.cacheWrite +
      (cacheRead / 1_000_000) * pricing.cacheRead;

    return {
      script,
      costUsd,
      model: this.model,
      inputTokens,
      outputTokens,
      cacheReadTokens: cacheRead,
      cacheCreationTokens: cacheCreation,
      elapsedMs: Date.now() - startedAt,
    };
  }
}
