/**
 * 등대섬 Web Audio 사운드스케이프.
 *
 * 파도·새·짧은 상호작용음은 런타임에서 합성하고, 읽어주기는 사전 렌더링 에셋만 재생한다.
 * AudioContext는 반드시 unlock()을 호출한 첫 사용자 제스처 안에서만 만든다.
 */

export const ISLAND_AUDIO_KEYS = [
  'island-wave-ambience-island-audio',
  'island-birds-ambience-island-audio',
  'island-move-sfx-island-audio',
  'island-letter-sfx-island-audio',
  'island-place-sfx-island-audio',
  'island-lighthouse-sfx-island-audio',
] as const;

export type IslandAudioKey = (typeof ISLAND_AUDIO_KEYS)[number];
export type IslandSfxKey = Extract<IslandAudioKey, `${string}-sfx-${string}`>;

interface IslandAudioDefinition {
  kind: 'ambience' | 'sfx';
  label: string;
}

export const ISLAND_AUDIO_DEFINITIONS: Readonly<Record<IslandAudioKey, IslandAudioDefinition>> = {
  'island-wave-ambience-island-audio': { kind: 'ambience', label: '잔잔한 파도' },
  'island-birds-ambience-island-audio': { kind: 'ambience', label: '먼 바닷새' },
  'island-move-sfx-island-audio': { kind: 'sfx', label: '탭 이동' },
  'island-letter-sfx-island-audio': { kind: 'sfx', label: '편지 열기' },
  'island-place-sfx-island-audio': { kind: 'sfx', label: '이야기 조각 놓기' },
  'island-lighthouse-sfx-island-audio': { kind: 'sfx', label: '등대 점등' },
};

export const ISLAND_AUDIO_MUTED_STORAGE_KEY = 'kindy:island-audio-muted';

const AMBIENCE_INTERVAL_MS = 5_600;
const MOVE_THROTTLE_MS = 90;
const MASTER_VOLUME = 0.72;

interface IslandAudioOptions {
  muted: boolean;
  reducedMotion: boolean;
}

export interface IslandAudioController {
  destroy(): void;
  play(key: IslandSfxKey): void;
  playReadAloud(
    src: string,
    onSettled: (result: 'ended' | 'error' | 'stopped') => void,
  ): Promise<void>;
  setMuted(muted: boolean): void;
  setPaused(paused: boolean): void;
  setReducedMotion(reducedMotion: boolean): void;
  stopReadAloud(): void;
  unlock(): void;
}

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

class IslandAudio implements IslandAudioController {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambienceTimer: number | null = null;
  private ambienceCycle = 0;
  private readonly pendingSfx = new Set<IslandSfxKey>();
  private readAloud: HTMLAudioElement | null = null;
  private readAloudSettled: ((result: 'ended' | 'error' | 'stopped') => void) | null = null;
  private lastMoveAt = 0;
  private muted: boolean;
  private reducedMotion: boolean;
  private paused = false;
  private destroyed = false;
  private unlocked = false;

  constructor({ muted, reducedMotion }: IslandAudioOptions) {
    this.muted = muted;
    this.reducedMotion = reducedMotion;
  }

  unlock(): void {
    if (this.destroyed) return;
    const context = this.ensureContext();
    if (!context) return;
    this.unlocked = true;

    const afterResume = () => {
      if (this.destroyed || this.context !== context) return;
      this.applyMasterVolume();
      this.startAmbience();
      const pending = [...this.pendingSfx];
      this.pendingSfx.clear();
      if (!this.muted && !this.paused) pending.forEach((key) => this.playNow(key));
    };

    if (context.state === 'suspended') {
      void context.resume().then(afterResume).catch(() => {
        // 브라우저가 재생을 거부하면 다음 사용자 제스처에서 다시 시도한다.
        this.unlocked = false;
      });
      return;
    }
    afterResume();
  }

  play(key: IslandSfxKey): void {
    if (this.destroyed || this.muted || this.paused) return;
    if (key === 'island-move-sfx-island-audio') {
      const now = Date.now();
      if (now - this.lastMoveAt < MOVE_THROTTLE_MS) return;
      this.lastMoveAt = now;
    }
    if (!this.unlocked || !this.context || this.context.state !== 'running') {
      this.pendingSfx.add(key);
      return;
    }
    this.playNow(key);
  }

  async playReadAloud(
    src: string,
    onSettled: (result: 'ended' | 'error' | 'stopped') => void,
  ): Promise<void> {
    if (this.destroyed || this.muted || this.paused || !this.unlocked) {
      throw new Error('읽어주기 재생 전에 사용자 제스처와 소리 활성화가 필요합니다.');
    }

    this.stopReadAloud();
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.volume = 0.92;
    audio.onended = () => this.releaseReadAloud(audio, 'ended');
    audio.onerror = () => this.releaseReadAloud(audio, 'error');
    this.readAloud = audio;
    this.readAloudSettled = onSettled;
    this.applyAmbienceVolume();

    try {
      await audio.play();
    } catch (error) {
      this.releaseReadAloud(audio, 'error');
      throw error;
    }
  }

  stopReadAloud(): void {
    if (!this.readAloud) return;
    this.releaseReadAloud(this.readAloud, 'stopped');
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.pendingSfx.clear();
      this.stopAmbience();
      this.stopReadAloud();
    }
    this.applyMasterVolume();
    this.applyAmbienceVolume();
    if (!muted) this.startAmbience();
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    if (reducedMotion) this.stopAmbience();
    else this.startAmbience();
    this.applyAmbienceVolume();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.stopAmbience();
      this.stopReadAloud();
    }
    else this.startAmbience();
    this.applyMasterVolume();
    this.applyAmbienceVolume();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopAmbience();
    this.stopReadAloud();
    const context = this.context;
    this.context = null;
    this.master = null;
    this.ambienceBus = null;
    this.sfxBus = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    const audioWindow = window as AudioWindow;
    const AudioContextClass = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextClass) return null;

    try {
      const context = new AudioContextClass();
      const master = context.createGain();
      const ambienceBus = context.createGain();
      const sfxBus = context.createGain();
      master.gain.value = 0;
      ambienceBus.gain.value = 0.82;
      sfxBus.gain.value = 0.9;
      ambienceBus.connect(master);
      sfxBus.connect(master);
      master.connect(context.destination);
      this.context = context;
      this.master = master;
      this.ambienceBus = ambienceBus;
      this.sfxBus = sfxBus;
      this.applyAmbienceVolume();
      return context;
    } catch {
      return null;
    }
  }

  private applyMasterVolume(): void {
    if (!this.context || !this.master) return;
    const volume = this.muted || this.paused ? 0 : MASTER_VOLUME;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(volume, this.context.currentTime, 0.035);
  }

  private applyAmbienceVolume(): void {
    if (!this.context || !this.ambienceBus) return;
    const volume = this.muted || this.paused || this.reducedMotion
      ? 0
      : this.readAloud
        ? 0.12
        : 0.82;
    this.ambienceBus.gain.cancelScheduledValues(this.context.currentTime);
    this.ambienceBus.gain.setTargetAtTime(volume, this.context.currentTime, 0.08);
  }

  private startAmbience(): void {
    if (
      this.ambienceTimer !== null
      || !this.unlocked
      || !this.context
      || this.context.state !== 'running'
      || this.muted
      || this.paused
      || this.reducedMotion
    ) return;

    this.playWave();
    this.ambienceTimer = window.setInterval(() => {
      this.playWave();
      this.ambienceCycle += 1;
      if (this.ambienceCycle % 2 === 1) this.playBirds();
    }, AMBIENCE_INTERVAL_MS);
  }

  private stopAmbience(): void {
    if (this.ambienceTimer === null) return;
    window.clearInterval(this.ambienceTimer);
    this.ambienceTimer = null;
  }

  private releaseReadAloud(
    audio: HTMLAudioElement,
    result: 'ended' | 'error' | 'stopped',
  ): void {
    if (this.readAloud !== audio) return;
    const onSettled = this.readAloudSettled;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    this.readAloud = null;
    this.readAloudSettled = null;
    this.applyAmbienceVolume();
    onSettled?.(result);
  }

  private createNoise(duration: number): AudioBufferSourceNode | null {
    if (!this.context) return null;
    const sampleCount = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  private playWave(): void {
    if (!this.context || !this.ambienceBus) return;
    const now = this.context.currentTime;
    const noise = this.createNoise(4.8);
    if (!noise) return;
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(460, now);
    filter.frequency.linearRampToValueAtTime(760, now + 2.1);
    filter.frequency.linearRampToValueAtTime(380, now + 4.8);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.042, now + 1.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.8);
    noise.connect(filter).connect(gain).connect(this.ambienceBus);
    noise.start(now);
    noise.stop(now + 4.8);
  }

  private playBirds(): void {
    if (!this.context || !this.ambienceBus) return;
    const now = this.context.currentTime + 0.6;
    for (let call = 0; call < 2; call += 1) {
      const start = now + call * 0.22;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1_250 + call * 110, start);
      oscillator.frequency.exponentialRampToValueAtTime(1_820 + call * 140, start + 0.1);
      oscillator.frequency.exponentialRampToValueAtTime(1_420 + call * 90, start + 0.23);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.014, start + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
      oscillator.connect(gain).connect(this.ambienceBus);
      oscillator.start(start);
      oscillator.stop(start + 0.25);
    }
  }

  private playNow(key: IslandSfxKey): void {
    switch (key) {
      case 'island-move-sfx-island-audio':
        this.playTone(155, 112, 0.09, 0.035, 'triangle');
        break;
      case 'island-letter-sfx-island-audio':
        this.playRustle();
        break;
      case 'island-place-sfx-island-audio':
        this.playTone(330, 520, 0.2, 0.06, 'triangle');
        break;
      case 'island-lighthouse-sfx-island-audio':
        [523.25, 659.25, 783.99].forEach((frequency, index) => {
          this.playTone(frequency, frequency * 1.015, 0.48, 0.052, 'sine', index * 0.17);
        });
        break;
    }
  }

  private playTone(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    delay = 0,
  ): void {
    if (!this.context || !this.sfxBus) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.025, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.sfxBus);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  private playRustle(): void {
    if (!this.context || !this.sfxBus) return;
    const now = this.context.currentTime;
    const noise = this.createNoise(0.34);
    if (!noise) return;
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1_600, now);
    filter.frequency.linearRampToValueAtTime(2_350, now + 0.34);
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.038, now + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    noise.connect(filter).connect(gain).connect(this.sfxBus);
    noise.start(now);
    noise.stop(now + 0.34);
  }
}

export function createIslandAudio(options: IslandAudioOptions): IslandAudioController {
  return new IslandAudio(options);
}
