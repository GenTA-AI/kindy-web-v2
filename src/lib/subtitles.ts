/**
 * VideoScript → 시간축 자막 큐 변환.
 *
 * 각 씬의 duration 을 누적해 cumulative start/end 를 계산.
 * - scene.dialogue 가 string 또는 {speaker, text} 객체 (Opus variance). getSceneDialogue 로 정규화.
 * - dialogue=null 이면 내레이션/무음씬 — 자막 없음 (cue 생성 생략).
 * - scene.durationSec 이 없으면 기본 7s 로 assume.
 */

import { getSceneDialogue } from './video-providers/director.types';

export interface SubtitleCue {
  start: number;   // seconds
  end: number;
  text: string;
  speakerId?: string;
}

export function buildSubtitleCues(script: unknown): SubtitleCue[] {
  if (!script || typeof script !== 'object') return [];
  const s = script as { scenes?: unknown };
  if (!Array.isArray(s.scenes)) return [];

  const cues: SubtitleCue[] = [];
  let cursor = 0;
  for (const scene of s.scenes) {
    const sc = scene as Record<string, unknown>;
    const duration = typeof sc.durationSec === 'number' ? sc.durationSec : 7;
    const dialogue = getSceneDialogue(scene);
    if (dialogue?.text) {
      cues.push({
        start: cursor,
        end: cursor + duration,
        text: dialogue.text,
        speakerId: dialogue.speakerId,
      });
    }
    cursor += duration;
  }
  return cues;
}

/** currentTime 에 해당하는 큐 하나 반환 (없으면 null). */
export function findActiveCue(cues: SubtitleCue[], currentTime: number): SubtitleCue | null {
  for (const c of cues) {
    if (currentTime >= c.start && currentTime < c.end) return c;
  }
  return null;
}
