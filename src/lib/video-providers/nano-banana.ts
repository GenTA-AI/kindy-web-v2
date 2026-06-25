/**
 * Nano-banana-pro (Gemini 3 Pro Image) provider
 *
 * Ported from: art&science/ocean-edu-imagen/generate_nano.py
 *
 * 핵심 노하우:
 *   - 캐릭터 레퍼런스 시트를 멀티이미지 입력으로 넣으면 일관성 유지
 *   - 첫 키프레임 생성 후 그 키프레임도 추가 레퍼런스로 넣어 다음 씬 생성 (chain)
 *   - 프롬프트에 "MUST match the attached reference images EXACTLY" 포함
 *
 * Pricing: ~$0.039/image (paid tier, 2026-04 estimate).
 */

import { readFileSync } from 'node:fs';
import type { ImageProvider } from './types';

const MODEL = 'gemini-3-pro-image-preview';
const GEMINI_IMAGE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const COST_PER_IMAGE_USD = 0.039;

const CONSISTENCY_SUFFIX =
  "\n\nMUST match the attached reference images EXACTLY in character design, color palette, and artistic style. Children's 2D animation TV show aesthetic.";

interface GeminiImagePart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  inline_data?: { mime_type: string; data: string };
}

interface GeminiImageResponse {
  candidates?: Array<{
    content: {
      parts: GeminiImagePart[];
    };
  }>;
  error?: { message: string };
}

/** 프롬프트 + 레퍼런스 이미지 parts → Gemini REST request body */
function buildRequestBody(
  prompt: string,
  refImages: Array<{ mimeType: string; base64: string }>,
  aspect: '16:9' | '1:1' = '16:9'
) {
  const parts: GeminiImagePart[] = [];
  for (const ref of refImages) {
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
  }
  parts.push({ text: prompt + CONSISTENCY_SUFFIX });

  return {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: aspect },
    },
  };
}

/** Gemini 응답에서 첫 이미지 part 추출 */
function extractImageBytes(data: GeminiImageResponse): { mimeType: string; bytes: Buffer } {
  if (data.error) throw new Error(`Gemini image error: ${data.error.message}`);
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const inline = p.inlineData ?? p.inline_data;
    if (inline?.data) {
      const mimeType =
        ('mimeType' in inline ? inline.mimeType : undefined) ??
        ('mime_type' in inline ? inline.mime_type : undefined) ??
        'image/png';
      return { mimeType, bytes: Buffer.from(inline.data, 'base64') };
    }
  }
  throw new Error(`Gemini image response missing image part: ${JSON.stringify(data).slice(0, 400)}`);
}

export class NanoBananaProvider implements ImageProvider {
  name = 'nano-banana-pro';

  constructor(private readonly googleApiKey: string) {
    if (!googleApiKey) throw new Error('GOOGLE_API_KEY required for NanoBananaProvider');
  }

  /** ImageProvider 인터페이스 — URL 레퍼런스 (파이프라인 orchestrator 용) */
  async generateImage(prompt: string, referenceUrls: string[]): Promise<{ url: string; costUsd: number }> {
    const refs: Array<{ mimeType: string; base64: string }> = [];
    for (const refUrl of referenceUrls) {
      const imgRes = await fetch(refUrl);
      if (!imgRes.ok) continue;
      const buf = await imgRes.arrayBuffer();
      refs.push({
        mimeType: imgRes.headers.get('content-type') ?? 'image/png',
        base64: Buffer.from(buf).toString('base64'),
      });
    }
    const { bytes, mimeType } = await this.callRaw(prompt, refs);
    return { url: `data:${mimeType};base64,${bytes.toString('base64')}`, costUsd: COST_PER_IMAGE_USD };
  }

  /**
   * 스모크/로컬용 헬퍼 — 로컬 파일 경로 레퍼런스, Buffer 반환.
   * 파이프라인 orchestrator 는 generateImage(URL 레퍼런스) 를 쓰고,
   * CLI 스모크는 이 메서드로 Supabase 없이 파일 시스템에 저장한다.
   */
  async generateImageFromFiles(
    prompt: string,
    refFilePaths: string[],
    aspect: '16:9' | '1:1' = '16:9'
  ): Promise<{ bytes: Buffer; mimeType: string; costUsd: number }> {
    const refs = refFilePaths.map((p) => {
      const buf = readFileSync(p);
      const mimeType = p.toLowerCase().endsWith('.jpg') || p.toLowerCase().endsWith('.jpeg')
        ? 'image/jpeg'
        : 'image/png';
      return { mimeType, base64: buf.toString('base64') };
    });
    const { bytes, mimeType } = await this.callRaw(prompt, refs, aspect);
    return { bytes, mimeType, costUsd: COST_PER_IMAGE_USD };
  }

  private async callRaw(
    prompt: string,
    refs: Array<{ mimeType: string; base64: string }>,
    aspect: '16:9' | '1:1' = '16:9'
  ): Promise<{ bytes: Buffer; mimeType: string }> {
    const body = buildRequestBody(prompt, refs, aspect);
    const res = await fetch(`${GEMINI_IMAGE_URL}?key=${this.googleApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Nano-banana image gen failed (${res.status}): ${text.slice(0, 600)}`);
    }
    const data = (await res.json()) as GeminiImageResponse;
    return extractImageBytes(data);
  }
}
