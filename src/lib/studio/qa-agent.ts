import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ANIMAL_VILLAGE_BIBLE } from '../../content/studio/animal-village-bible';
import type { EpisodeScript } from '../video-providers/director.types';

export type QcVerdict = 'pass' | 'warn' | 'fail';

export interface QcSceneReport {
  index: number;
  verdict: QcVerdict;
  notes: string[];
}

export interface QcReport {
  overall: QcVerdict;
  scenes: QcSceneReport[];
  forbidden: string[];
  summaryKo: string;
  model: string;
  costUsd: number;
  checkedAt: string;
  raw?: string;
  error?: string;
}

export interface RunEpisodeQcInput {
  script: EpisodeScript;
  keyframePaths: string[];
  workDir: string;
}

interface GeminiTextPart {
  text?: string;
}

interface GeminiTextResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiTextPart[];
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  error?: {
    message?: string;
  };
}

interface GeminiRequestPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

const MODEL = 'gemini-2.5-flash';
const GEMINI_TEXT_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const FLASH_INPUT_USD_PER_MILLION_TOKENS = 0.3;
const FLASH_OUTPUT_USD_PER_MILLION_TOKENS = 2.5;

const FORBIDDEN_CANON = [
  '머리 위 A',
  '떠 있는 글자',
  '텍스트',
  '워터마크',
  '공포',
  '빌런',
  'photorealistic',
];

export async function runEpisodeQc(input: RunEpisodeQcInput): Promise<QcReport> {
  const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY missing for episode QC');
  }

  mkdirSync(input.workDir, { recursive: true });
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(`${GEMINI_TEXT_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: buildRequestParts(input.script, input.keyframePaths) }],
        generationConfig: {
          responseModalities: ['TEXT'],
          responseMimeType: 'application/json',
          temperature: 0,
        },
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new Error(`Gemini QC failed (${response.status}): ${raw.slice(0, 600)}`);
    }

    const data = (await response.json()) as GeminiTextResponse;
    if (data.error?.message) throw new Error(`Gemini QC error: ${data.error.message}`);

    const raw = extractText(data);
    const report = reportFromModelText(raw, input.script, estimateCostUsd(data), checkedAt);
    writeReport(input.workDir, report);
    return report;
  } catch (error) {
    const report = fallbackReport(input.script, checkedAt, {
      summaryKo: 'QC 실행 중 오류가 발생해 사람 검수가 필요합니다.',
      error: error instanceof Error ? error.message : String(error),
    });
    writeReport(input.workDir, report);
    return report;
  }
}

function buildRequestParts(script: EpisodeScript, keyframePaths: string[]): GeminiRequestPart[] {
  const parts: GeminiRequestPart[] = [
    { text: buildQcPrompt(script) },
  ];

  keyframePaths.forEach((path, index) => {
    parts.push({ text: `KEYFRAME scene ${index + 1}: ${path}` });
    parts.push({
      inline_data: {
        mime_type: mimeTypeFor(path),
        data: readFileSync(path).toString('base64'),
      },
    });
  });

  return parts;
}

function buildQcPrompt(script: EpisodeScript): string {
  const { visualStyle, promptRules } = ANIMAL_VILLAGE_BIBLE;

  return `You are the HITL-support QC agent for a Korean children's animation studio.
Review the attached keyframes and EpisodeScript. QC is advisory only: do not assume publication approval.

Return ONLY valid JSON in this exact shape:
{
  "overall": "pass" | "warn" | "fail",
  "scenes": [{"index": number, "verdict": "pass" | "warn" | "fail", "notes": string[]}],
  "forbidden": string[],
  "summaryKo": string
}

Rubric:
1. visual_style: must follow cream + sage palette, picture-book 2D stylized illustration, soft warm lighting, rounded gentle shapes. It must NOT be photorealistic or a 3D render.
2. character_consistency: Mori and recurring characters must keep the same body shape, face, scarf, ears, palette, and child-safe picture-book style across all scenes.
3. forbidden_elements: flag any ${FORBIDDEN_CANON.join(', ')}. Also flag captions, subtitles, logos, UI, sharp teeth, violence, dark horror shadows, predators, or realistic humans.
4. age_5_7_fit: script must avoid threat, rushing, shaming, or evaluation phrases such as "틀렸어", "빨리 해", "왜 못해", "정답 아니야". It should include a direct child question and a wait beat.

Bible style:
- artDirection: ${visualStyle.artDirection}
- characterStyle: ${visualStyle.characterStyle}
- backgroundStyle: ${visualStyle.backgroundStyle}
- lighting: ${visualStyle.lighting}
- mandatoryPrefix: ${promptRules.mandatoryPrefix}
- mandatorySuffix: ${promptRules.mandatorySuffix}
- negativePrompt: ${promptRules.negativePrompt}

EpisodeScript JSON:
${JSON.stringify(script, null, 2)}`;
}

function extractText(data: GeminiTextResponse): string {
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('\n')
    .trim();
  if (!text) throw new Error('Gemini QC response missing text');
  return text;
}

function reportFromModelText(raw: string, script: EpisodeScript, costUsd: number, checkedAt: string): QcReport {
  try {
    const parsed = parseJsonObject(raw);
    return normalizeReport(parsed, script, costUsd, checkedAt);
  } catch (error) {
    return fallbackReport(script, checkedAt, {
      summaryKo: 'QC 응답 JSON 파싱에 실패했습니다. 원문을 확인해 사람 검수에 반영하세요.',
      costUsd,
      raw,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function parseJsonObject(raw: string): unknown {
  const unfenced = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('QC response does not contain a JSON object');
    }
    return JSON.parse(unfenced.slice(start, end + 1));
  }
}

function normalizeReport(value: unknown, script: EpisodeScript, costUsd: number, checkedAt: string): QcReport {
  const raw = isRecord(value) ? value : {};
  const scenesRaw = Array.isArray(raw.scenes) ? raw.scenes : [];
  const scenes = scenesRaw.length > 0
    ? scenesRaw.map((scene, arrayIndex) => normalizeSceneReport(scene, arrayIndex))
    : script.scenes.map((scene) => ({
        index: scene.index,
        verdict: 'warn' as QcVerdict,
        notes: ['모델이 씬별 판정을 반환하지 않았습니다.'],
      }));

  return {
    overall: normalizeVerdict(raw.overall),
    scenes,
    forbidden: stringArray(raw.forbidden),
    summaryKo: typeof raw.summaryKo === 'string' && raw.summaryKo.trim()
      ? raw.summaryKo.trim()
      : 'QC 요약이 비어 있어 사람 검수가 필요합니다.',
    model: MODEL,
    costUsd,
    checkedAt,
  };
}

function normalizeSceneReport(value: unknown, arrayIndex: number): QcSceneReport {
  const raw = isRecord(value) ? value : {};
  const index = Number(raw.index);
  return {
    index: Number.isFinite(index) ? index : arrayIndex,
    verdict: normalizeVerdict(raw.verdict),
    notes: stringArray(raw.notes),
  };
}

function fallbackReport(
  script: EpisodeScript,
  checkedAt: string,
  options: { summaryKo: string; costUsd?: number; raw?: string; error?: string }
): QcReport {
  return {
    overall: 'warn',
    scenes: script.scenes.map((scene) => ({
      index: scene.index,
      verdict: 'warn',
      notes: ['자동 QC를 완료하지 못했습니다. 사람이 영상, 키프레임, 대본을 확인해야 합니다.'],
    })),
    forbidden: [],
    summaryKo: options.summaryKo,
    model: MODEL,
    costUsd: options.costUsd ?? 0,
    checkedAt,
    ...(options.raw ? { raw: options.raw } : {}),
    ...(options.error ? { error: options.error } : {}),
  };
}

function normalizeVerdict(value: unknown): QcVerdict {
  return value === 'pass' || value === 'warn' || value === 'fail' ? value : 'warn';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function mimeTypeFor(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
}

function estimateCostUsd(data: GeminiTextResponse): number {
  const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
  const cost =
    (promptTokens / 1_000_000) * FLASH_INPUT_USD_PER_MILLION_TOKENS +
    (outputTokens / 1_000_000) * FLASH_OUTPUT_USD_PER_MILLION_TOKENS;
  return Number(cost.toFixed(6));
}

function writeReport(workDir: string, report: QcReport): void {
  writeFileSync(join(workDir, 'qc-report.json'), JSON.stringify(report, null, 2), 'utf-8');
}
