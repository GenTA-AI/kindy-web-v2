/**
 * 선별 기반 초개인화 — 공유 라이브러리를 아이 약점(C6)에 맞춰 재정렬.
 *
 * per-child '생성'은 비용/노동이 안 맞아 베타로 둔다. 대신 넓은 라이브러리에서 그 아이
 * 약점을 겨냥한 영상을 앞에 배치해 "나에게 맞춰지는" 경험을 한계비용 0으로 준다
 * (넷플릭스식 personalization = 선별). 영상의 C6 초점은 library_videos.c6_focus 로 태깅.
 */
import type { LibraryVideo } from '@/types/library';
import type { C6ToolKey } from './c6-profile';

const C6_KEYS = new Set<C6ToolKey>(['observe', 'imagine', 'pattern', 'transform', 'design', 'compose']);

/** 영상의 C6 초점(태깅된 경우). 미태깅/무효 값은 null(알 수 없음). */
export function deriveC6Focus(video: Pick<LibraryVideo, 'c6_focus'>): C6ToolKey | null {
  const raw = video.c6_focus;
  return raw && C6_KEYS.has(raw as C6ToolKey) ? (raw as C6ToolKey) : null;
}

/**
 * 약점 도구 우선으로 라이브러리를 재정렬(안정 정렬).
 * 우선순위: ① 미시청 & 약점 초점 → ② 미시청 → ③ 시청함 & 약점 초점 → ④ 나머지.
 * weakToolKey 가 없으면 원본 순서 유지.
 */
export function orderLibraryByWeakTool(
  videos: LibraryVideo[],
  weakToolKey: C6ToolKey | null | undefined,
  seenIds: ReadonlySet<string> = new Set(),
): LibraryVideo[] {
  if (!weakToolKey) return videos;
  const rank = (v: LibraryVideo): number => {
    const matches = deriveC6Focus(v) === weakToolKey;
    const unseen = !seenIds.has(v.id);
    if (unseen && matches) return 0;
    if (unseen) return 1;
    if (matches) return 2;
    return 3;
  };
  // Array.prototype.sort 는 안정 정렬(Node ≥ 11) → 동점은 원본 순서 유지.
  return [...videos].sort((a, b) => rank(a) - rank(b));
}
