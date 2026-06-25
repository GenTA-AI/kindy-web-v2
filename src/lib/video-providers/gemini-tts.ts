/**
 * Gemini 2.5 Flash TTS provider
 *
 * Ported from: art&science/ocean-edu-imagen/generate_ep01_veed.py (generate_tts function)
 *
 * 캐릭터 보이스 매핑 (art&science 검증):
 *   Puck    — 7세 여자아이 밝고 활기찬 (기본 주인공)
 *   Leda    — 8세 남자아이 걱정/여린
 *   Aoede   — 9세 여자아이 또박또박 관찰자
 *   Fenrir  — 8세 남자아이 힘없고 슬픈
 *   Kore    — 10세 여자아이 내레이션 (뉴스 앵커 톤)
 *
 * Pricing: Preview tier 무료. GA 전환 시 재확인 필요.
 * Output format: WAV 24kHz mono 16-bit
 */

import type { CharacterVoice, TtsProvider } from './types';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';

const DEFAULT_STYLES: Record<Exclude<CharacterVoice, 'auto'>, string> = {
  Puck: '7살 여자아이가 말하는 것처럼 아주 높고 맑은 목소리로, 밝고 신나는 톤. 또래에게 이야기하듯 활기차게. 절대 어른 목소리가 아닌, 초등학교 1학년 여자아이 목소리.',
  Leda: '8살 남자아이가 걱정하며 말하는 것처럼, 높고 여린 목소리로. 조금 떨리듯 불안한 톤. 초등학교 2학년 남자아이 느낌. 절대 어른 목소리가 아닌.',
  Aoede: '9살 여자아이가 친구 걱정하며 말하는 것처럼, 높고 맑은 목소리. 관찰력 있는 친구처럼 또박또박, 걱정되는 마음이 담긴 톤. 초등학교 3학년 여자아이 목소리.',
  Fenrir: '8살 남자아이가 힘없이 천천히 말하는 것처럼, 높지만 약간 가라앉은 목소리. 부드럽고 슬픈 느낌이지만 기본적으로 어린 남자아이 음색.',
  Kore: '어린이 교육 방송 여자 내레이터처럼, 따뜻하고 차분하며 신뢰감 있게. EBS 어린이 프로그램 내레이션 느낌으로, 또박또박.',
  Charon: '9살 남자아이가 답답하고 힘들게 말하는 것처럼, 낮은 톤이지만 어린이 음색 유지. 천천히, 조금 쉬어가며.',
  Despina: '8살 여자아이가 불안하고 떨리게 말하는 것처럼, 높고 가는 목소리. 조심스럽고 연약한 느낌.',
  Enceladus: '10살 남자아이가 차분하고 깊게 말하는 것처럼, 살짝 낮지만 어린이 음색. 천천히 또박또박.',
};

interface GeminiTtsResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        inlineData?: { data: string; mimeType: string };
      }>;
    };
  }>;
  error?: { message: string };
}

export class GeminiTtsProvider implements TtsProvider {
  name = 'gemini-tts';

  constructor(private readonly googleApiKey: string) {
    if (!googleApiKey) throw new Error('GOOGLE_API_KEY required for GeminiTtsProvider');
  }

  /** 오디오 raw 바이트 + 길이 반환 (스모크/파일 저장용) */
  async generateTtsToBuffer(
    dialogue: string,
    voice: Exclude<CharacterVoice, 'auto'>,
    style?: string
  ): Promise<{ bytes: Buffer; wavBytes: Buffer; durationSec: number; costUsd: number }> {
    const styleText = style ?? DEFAULT_STYLES[voice];
    const fullPrompt = `${styleText}\n\n${dialogue}`;

    const body = {
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    };

    const res = await fetch(`${GEMINI_API_URL}?key=${this.googleApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini TTS failed (${res.status}): ${text.slice(0, 500)}`);
    }

    const data: GeminiTtsResponse = await res.json();
    if (data.error) throw new Error(`Gemini TTS error: ${data.error.message}`);

    const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) {
      throw new Error('Gemini TTS response missing audio data');
    }

    // Gemini 는 PCM 16-bit 24kHz mono raw bytes 를 반환 (WAV 헤더 없음).
    // WAV 컨테이너로 감싸야 fal.ai 등 표준 디코더가 재생 가능.
    const pcmBytes = Buffer.from(inlineData.data, 'base64');
    const wavBytes = wrapPcmAsWav(pcmBytes, 24000, 1, 16);

    // PCM 16-bit mono 24kHz: bytes / (24000 * 2) = seconds
    const durationSec = pcmBytes.length / (24000 * 2);

    return {
      bytes: pcmBytes,
      wavBytes,
      durationSec,
      costUsd: 0, // preview tier free
    };
  }

  /** 기존 TtsProvider 인터페이스 (data URI 반환, 파이프라인 orchestrator 용) */
  async generateTts(
    dialogue: string,
    voice: CharacterVoice,
    style?: string
  ): Promise<{ audioPath: string; durationSec: number; costUsd: number }> {
    if (voice === 'auto') {
      throw new Error('GeminiTtsProvider: resolve "auto" voice before calling generateTts');
    }
    const { wavBytes, durationSec, costUsd } = await this.generateTtsToBuffer(dialogue, voice, style);
    const audioPath = `data:audio/wav;base64,${wavBytes.toString('base64')}`;
    return { audioPath, durationSec, costUsd };
  }
}

/**
 * PCM raw bytes 를 WAV 컨테이너로 감싸기.
 * Gemini TTS 는 RIFF 헤더 없이 raw PCM 을 주므로, fal/브라우저가 읽을 수 있게 WAV 로 래핑.
 */
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
  header.writeUInt32LE(16, 16);                    // PCM fmt chunk size
  header.writeUInt16LE(1, 20);                     // audio format = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

export { DEFAULT_STYLES as GEMINI_TTS_STYLES };
