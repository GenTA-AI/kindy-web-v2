// fal.ai Whisper STT → WebVTT.
// 영상 (mp4) URL 받아서 자막 파일 생성.

import { fal } from '@fal-ai/client';

export interface WhisperResult {
  vtt: string;        // WebVTT 텍스트
  language: string;   // detected (보통 'ko')
  costUsd: number;    // 추정 비용 (whisper-1: $0.006/min)
}

interface WhisperChunkLike {
  timestamp?: unknown;
  timestamps?: unknown;
  start?: unknown;
  end?: unknown;
  text?: unknown;
}

interface WhisperResponseLike {
  text?: unknown;
  chunks?: unknown;
  inferred_languages?: unknown;
  languages?: unknown;
}

interface VttSegment {
  start: number;
  end: number;
  text: string;
}

const WHISPER_ENDPOINT = 'fal-ai/whisper';
const WHISPER_COST_PER_MIN_USD = 0.006;

export async function transcribeToVtt(audioUrl: string, durationSec: number): Promise<WhisperResult> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY required for fal.ai Whisper transcription');
  fal.config({ credentials: falKey });

  const result = await fal.subscribe(WHISPER_ENDPOINT, {
    input: {
      audio_url: audioUrl,
      task: 'transcribe',
      language: 'ko',
      chunk_level: 'word',
      version: '3',
      prompt: '한국어 어린이 교육 애니메이션 대사. 주인공 이름은 미리입니다.',
      diarize: false,
    },
    logs: true,
  });

  const data = result.data as WhisperResponseLike;
  const chunks = Array.isArray(data.chunks) ? data.chunks : [];
  const wordOrSegmentChunks = normalizeChunks(chunks);
  const segments = wordOrSegmentChunks.length > 0
    ? groupShortChunks(wordOrSegmentChunks)
    : fallbackSegment(data.text, durationSec);

  return {
    vtt: segmentsToVtt(segments),
    language: detectLanguage(data) ?? 'ko',
    costUsd: (Math.max(0, durationSec) / 60) * WHISPER_COST_PER_MIN_USD,
  };
}

function normalizeChunks(chunks: unknown[]): VttSegment[] {
  const segments: VttSegment[] = [];
  for (const chunk of chunks) {
    if (!chunk || typeof chunk !== 'object') continue;
    const c = chunk as WhisperChunkLike;
    const timestamps = parseTimestamps(c.timestamp ?? c.timestamps ?? { start: c.start, end: c.end });
    const text = typeof c.text === 'string' ? cleanCueText(c.text) : '';
    if (!timestamps || !text) continue;
    const [start, end] = timestamps;
    if (end <= start) continue;
    segments.push({ start, end, text });
  }
  return segments.sort((a, b) => a.start - b.start);
}

function parseTimestamps(value: unknown): [number, number] | null {
  if (Array.isArray(value) && value.length >= 2) {
    const start = Number(value[0]);
    const end = Number(value[1]);
    if (Number.isFinite(start) && Number.isFinite(end)) return [start, end];
  }

  if (value && typeof value === 'object') {
    const obj = value as { start?: unknown; end?: unknown };
    const start = Number(obj.start);
    const end = Number(obj.end);
    if (Number.isFinite(start) && Number.isFinite(end)) return [start, end];
  }

  return null;
}

function groupShortChunks(chunks: VttSegment[]): VttSegment[] {
  const grouped: VttSegment[] = [];
  let current: VttSegment | null = null;

  for (const chunk of chunks) {
    if (!current) {
      current = { ...chunk };
      continue;
    }

    const mergedText = `${current.text} ${chunk.text}`.trim();
    const duration = chunk.end - current.start;
    const gap = chunk.start - current.end;
    const shouldBreak =
      duration > 3.5 ||
      gap > 0.8 ||
      current.text.length >= 28 ||
      /[.!?。！？]$/.test(current.text);

    if (shouldBreak) {
      grouped.push(current);
      current = { ...chunk };
    } else {
      current = {
        start: current.start,
        end: chunk.end,
        text: mergedText,
      };
    }
  }

  if (current) grouped.push(current);
  return grouped;
}

function fallbackSegment(text: unknown, durationSec: number): VttSegment[] {
  const cleaned = typeof text === 'string' ? cleanCueText(text) : '';
  if (!cleaned) return [];
  return [{ start: 0, end: Math.max(1, durationSec), text: cleaned }];
}

function segmentsToVtt(segments: Array<{ start: number; end: number; text: string }>): string {
  const cues = segments
    .filter((segment) => segment.text.trim())
    .map((segment) => [
      `${formatVttTime(segment.start)} --> ${formatVttTime(segment.end)}`,
      cleanCueText(segment.text),
    ].join('\n'));

  return ['WEBVTT', '', ...cues].join('\n\n') + '\n';
}

function formatVttTime(seconds: number): string {
  const totalMillis = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMillis / 3_600_000);
  const minutes = Math.floor((totalMillis % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((totalMillis % 60_000) / 1000);
  const millis = totalMillis % 1000;
  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(wholeSeconds).padStart(2, '0'),
  ].join(':') + `.${String(millis).padStart(3, '0')}`;
}

function cleanCueText(text: string): string {
  return text
    .replace(/-->/g, '→')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectLanguage(data: WhisperResponseLike): string | null {
  const candidates = data.inferred_languages ?? data.languages;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const first = candidates[0];
  return typeof first === 'string' && first ? first : null;
}
