'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import voiceManifest from '@/data/worlds/animal-village-voice.json';

// 음성 훅 — 사전 생성한 Gemini TTS 아동 음성(mp3/wav)을 라인 id 로 재생한다.
// 브라우저 Web Speech 는 품질이 낮아(외국인 같은 발음) 최후 폴백으로만 사용.
// 미취학(못 읽음) 아동 필수 기능. 음소거 토글 유지.

const MUTE_STORAGE_KEY = 'kindy:voice-muted';

interface ManifestEntry {
  file: string;
  durationSec: number;
}

const MANIFEST = voiceManifest as Record<string, ManifestEntry>;

function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function pickKoreanVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'ko-KR') ??
    voices.find((v) => v.lang?.toLowerCase().startsWith('ko')) ??
    null
  );
}

/** 라인 id 면 사전 생성 파일 경로, 아니면 null. */
function audioFileForId(id: string): string | null {
  return MANIFEST[id]?.file ?? null;
}

export interface SpeakInput {
  /** 사전 생성 음성 라인 id (있으면 mp3 재생). */
  id?: string;
  /** 폴백(또는 매니페스트 미존재 시) 읽을 텍스트. */
  text?: string;
}

export interface UseVoiceResult {
  /** id 면 사전 생성 mp3 재생, 없으면 text 를 Web Speech 폴백으로 읽음. 음소거면 무시. */
  speak: (input: SpeakInput | string) => void;
  /** 진행 중 발화/재생 중단. */
  cancel: () => void;
  muted: boolean;
  toggleMute: () => void;
  /** 사전 생성 오디오 재생 가능(브라우저 Audio 지원). */
  supported: boolean;
}

function readStoredMute(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function useVoice(): UseVoiceResult {
  // SSR 하이드레이션 안전: 서버 = 첫 클라이언트 렌더 모두 muted=false / supported=false 로 시작.
  // 마운트 effect 에서 localStorage·브라우저 지원 여부를 반영(서버엔 없는 값이라 초기 렌더에 쓰면 불일치).
  const [mounted, setMounted] = useState(false);
  const [muted, setMuted] = useState(false);
  const supported = mounted && typeof Audio !== 'undefined';
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const webVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMounted(true);
      setMuted(readStoredMute());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isSpeechSupported()) return undefined;
    // Web Speech 폴백용 한국어 음성 준비(비동기 로드 가능).
    webVoiceRef.current = pickKoreanVoice();
    const onVoices = () => {
      webVoiceRef.current = pickKoreanVoice();
    };
    window.speechSynthesis.addEventListener?.('voiceschanged', onVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', onVoices);
      try {
        window.speechSynthesis.cancel();
      } catch {
        // 무시.
      }
    };
  }, []);

  const cancel = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {
        // 무시.
      }
    }
    if (isSpeechSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // 무시.
      }
    }
  }, []);

  const speakWebFallback = useCallback((text: string) => {
    if (!isSpeechSupported()) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(trimmed);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.95;
      utterance.pitch = 1.1;
      const voice = webVoiceRef.current ?? pickKoreanVoice();
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    } catch {
      // 무시.
    }
  }, []);

  const speak = useCallback(
    (input: SpeakInput | string) => {
      if (muted) return;
      const id = typeof input === 'string' ? undefined : input.id;
      const text = typeof input === 'string' ? input : input.text;

      // 진행 중 음성 중단(겹침 방지).
      cancel();

      const file = id ? audioFileForId(id) : null;
      if (file && typeof Audio !== 'undefined') {
        try {
          const audio = new Audio(file);
          audioRef.current = audio;
          // 재생 실패(파일 누락 등) 시 텍스트가 있으면 Web Speech 폴백.
          audio.play().catch(() => {
            if (text) speakWebFallback(text);
          });
          return;
        } catch {
          // Audio 생성 실패 → 폴백.
        }
      }

      // 사전 생성 파일 없음 → Web Speech 폴백(품질 낮음, 최후수단).
      if (text) speakWebFallback(text);
    },
    [muted, cancel, speakWebFallback],
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // 무시.
      }
      if (next) cancel();
      return next;
    });
  }, [cancel]);

  return { speak, cancel, muted, toggleMute, supported };
}
