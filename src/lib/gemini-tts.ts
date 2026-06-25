/**
 * Gemini TTS Korean narration helper.
 * 90s episode pipeline 에서 narration + character dialogue 음성 생성.
 */

export type GeminiVoiceTone = 'narrator-warm' | 'character-bright' | 'character-curious';

export interface GeminiTtsInput {
  text: string;                  // 한국어 단순 텍스트 (한 문단 추천)
  voice: GeminiVoiceTone;        // narrator vs character 분리
  speedWpm?: number;             // 기본 130 (Korean kids 적정)
}

export interface GeminiTtsResult {
  audioBytes: Buffer;            // WAV mono 22050Hz
  audioMimeType: 'audio/wav';
  durationSec: number;           // WAV PCM byte length 기반 측정값
  costUsd: number;
  voiceUsed: string;             // 실제 Gemini voice id 기록
}

type VoiceSpec = {
  voiceName: string;
  style: string;
};

type GeminiTtsResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

type PcmAudio = {
  pcm: Buffer;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
};

const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`;
const GEMINI_SOURCE_SAMPLE_RATE = 24000;
const OUTPUT_SAMPLE_RATE = 22050;
const CHANNELS_MONO = 1;
const BITS_PER_SAMPLE = 16;
const DEFAULT_SPEED_WPM = 130;
// Gemini 2.5 Flash Preview TTS pricing docs: $0.50/1M text input tokens,
// $10/1M audio output tokens. Audio token fallback follows docs note: 25 tokens/sec.
const TEXT_INPUT_USD_PER_MILLION_TOKENS = 0.5;
const AUDIO_OUTPUT_USD_PER_MILLION_TOKENS = 10;
const AUDIO_OUTPUT_TOKENS_PER_SEC = 25;

// Gemini TTS has multilingual prebuilt voices rather than Korean-specific IDs.
// Mapping favors docs-listed tone labels: Sulafat=Warm, Puck=Upbeat, Aoede=Breezy.
const VOICE_MAP: Record<GeminiVoiceTone, VoiceSpec> = {
  'narrator-warm': {
    voiceName: 'Sulafat',
    style: 'Warm, gentle female story narrator for Korean children; calm, kind, clear, never dramatic.',
  },
  'character-bright': {
    voiceName: 'Puck',
    style: 'Bright upbeat Korean girl character around eight years old; lively, friendly, K-pop kid energy.',
  },
  'character-curious': {
    voiceName: 'Aoede',
    style: 'Curious Korean girl character asking questions; breezy, slightly quicker, playful but clear.',
  },
};

export async function synthesizeKorean(input: GeminiTtsInput): Promise<GeminiTtsResult> {
  const text = input.text.trim();
  if (!text) throw new Error('Gemini TTS text is required');

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY is required for Gemini TTS');

  const voiceSpec = VOICE_MAP[input.voice];
  const speedWpm = input.speedWpm ?? DEFAULT_SPEED_WPM;
  if (!Number.isFinite(speedWpm) || speedWpm <= 0) {
    throw new Error('Gemini TTS speedWpm must be a positive number');
  }

  const prompt = buildPrompt(text, voiceSpec.style, speedWpm);
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      temperature: 0,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceSpec.voiceName },
        },
      },
    },
  };

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini TTS failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  const data = (await response.json()) as GeminiTtsResponse;
  if (data.error?.message) throw new Error(`Gemini TTS error: ${data.error.message}`);

  const inlineData = data.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
  if (!inlineData?.data) throw new Error('Gemini TTS response missing audio data');

  const geminiAudio = decodeGeminiAudio(Buffer.from(inlineData.data, 'base64'));
  const monoPcm = ensurePcm16Mono(geminiAudio);
  const outputPcm = resamplePcm16Mono(monoPcm, geminiAudio.sampleRate, OUTPUT_SAMPLE_RATE);
  const audioBytes = wrapPcmAsWav(outputPcm, OUTPUT_SAMPLE_RATE, CHANNELS_MONO, BITS_PER_SAMPLE);
  const durationSec = outputPcm.length / ((OUTPUT_SAMPLE_RATE * BITS_PER_SAMPLE) / 8);

  return {
    audioBytes,
    audioMimeType: 'audio/wav',
    durationSec,
    costUsd: estimateCostUsd(prompt, durationSec, data.usageMetadata),
    voiceUsed: voiceSpec.voiceName,
  };
}

function buildPrompt(text: string, style: string, speedWpm: number): string {
  return [
    `Read the following Korean text exactly as written in Korean.`,
    `Voice direction: ${style}`,
    `Prosody: child-friendly, warm, natural Korean pronunciation, about ${Math.round(speedWpm)} Korean words per minute.`,
    `Keep pauses short and lip-sync friendly. Do not add words, sound effects, or explanations.`,
    '',
    text,
  ].join('\n');
}

function decodeGeminiAudio(audio: Buffer): PcmAudio {
  const wav = parseWav(audio);
  if (wav) return wav;

  return {
    pcm: trimToEvenLength(audio),
    sampleRate: GEMINI_SOURCE_SAMPLE_RATE,
    channels: CHANNELS_MONO,
    bitsPerSample: BITS_PER_SAMPLE,
  };
}

function parseWav(bytes: Buffer): PcmAudio | null {
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let audioFormat = 0;
  let pcm: Buffer | null = null;

  while (offset + 8 <= bytes.length) {
    const chunkId = bytes.toString('ascii', offset, offset + 4);
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = Math.min(chunkStart + chunkSize, bytes.length);

    if (chunkId === 'fmt ' && chunkSize >= 16) {
      audioFormat = bytes.readUInt16LE(chunkStart);
      channels = bytes.readUInt16LE(chunkStart + 2);
      sampleRate = bytes.readUInt32LE(chunkStart + 4);
      bitsPerSample = bytes.readUInt16LE(chunkStart + 14);
    } else if (chunkId === 'data') {
      pcm = bytes.subarray(chunkStart, chunkEnd);
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  if (!pcm || audioFormat !== 1 || !sampleRate || !channels || !bitsPerSample) {
    throw new Error('Gemini TTS returned unsupported WAV audio');
  }

  return { pcm: trimToEvenLength(pcm), sampleRate, channels, bitsPerSample };
}

function ensurePcm16Mono(audio: PcmAudio): Buffer {
  if (audio.bitsPerSample !== BITS_PER_SAMPLE) {
    throw new Error(`Gemini TTS returned unsupported ${audio.bitsPerSample}-bit audio`);
  }
  if (audio.channels === CHANNELS_MONO) return audio.pcm;
  if (audio.channels < CHANNELS_MONO) throw new Error('Gemini TTS returned audio with no channels');

  const frameSize = audio.channels * (BITS_PER_SAMPLE / 8);
  const frameCount = Math.floor(audio.pcm.length / frameSize);
  const mono = Buffer.alloc(frameCount * 2);

  for (let frame = 0; frame < frameCount; frame += 1) {
    let sum = 0;
    const frameOffset = frame * frameSize;
    for (let channel = 0; channel < audio.channels; channel += 1) {
      sum += audio.pcm.readInt16LE(frameOffset + channel * 2);
    }
    mono.writeInt16LE(clampPcm16(Math.round(sum / audio.channels)), frame * 2);
  }

  return mono;
}

function resamplePcm16Mono(pcm: Buffer, sourceRate: number, targetRate: number): Buffer {
  const input = trimToEvenLength(pcm);
  if (input.length < 2) throw new Error('Gemini TTS returned empty audio');
  if (!Number.isFinite(sourceRate) || sourceRate <= 0 || !Number.isFinite(targetRate) || targetRate <= 0) {
    throw new Error('Gemini TTS audio sample rate is invalid');
  }
  if (sourceRate === targetRate) return input;

  const inputSamples = input.length / 2;
  const outputSamples = Math.max(1, Math.round((inputSamples * targetRate) / sourceRate));
  const output = Buffer.alloc(outputSamples * 2);
  const rateRatio = sourceRate / targetRate;

  for (let i = 0; i < outputSamples; i += 1) {
    const sourceIndex = i * rateRatio;
    const leftIndex = Math.floor(sourceIndex);
    const rightIndex = Math.min(leftIndex + 1, inputSamples - 1);
    const fraction = sourceIndex - leftIndex;
    const left = input.readInt16LE(leftIndex * 2);
    const right = input.readInt16LE(rightIndex * 2);
    const sample = Math.round(left + (right - left) * fraction);
    output.writeInt16LE(clampPcm16(sample), i * 2);
  }

  return output;
}

function wrapPcmAsWav(
  pcm: Buffer,
  sampleRate: number,
  channels: number,
  bitsPerSample: number
): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

function estimateCostUsd(
  prompt: string,
  durationSec: number,
  usageMetadata?: GeminiTtsResponse['usageMetadata']
): number {
  const inputTokens = usageMetadata?.promptTokenCount ?? estimateTextTokens(prompt);
  const outputTokens = usageMetadata?.candidatesTokenCount ?? Math.ceil(durationSec * AUDIO_OUTPUT_TOKENS_PER_SEC);
  const cost =
    (inputTokens * TEXT_INPUT_USD_PER_MILLION_TOKENS) / 1_000_000 +
    (outputTokens * AUDIO_OUTPUT_USD_PER_MILLION_TOKENS) / 1_000_000;

  return Number(cost.toFixed(6));
}

function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function trimToEvenLength(bytes: Buffer): Buffer {
  return bytes.length % 2 === 0 ? bytes : bytes.subarray(0, bytes.length - 1);
}

function clampPcm16(sample: number): number {
  return Math.max(-32768, Math.min(32767, sample));
}
