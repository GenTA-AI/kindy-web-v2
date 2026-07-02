import type { LibraryVideo } from '@/types/library';
import { C6_AXIS_BY_ID, LEGACY_TOOL_TO_AXIS, type C6AxisId } from './axes';

export interface GrowthAxisProfileRow {
  axis_id: string | null;
  current_level: number | string | null;
  evidence_count: number | null;
}

function toNumber(value: number | string | null | undefined, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toAxisId(value: string | null | undefined): C6AxisId | null {
  return value && C6_AXIS_BY_ID.has(value as C6AxisId) ? (value as C6AxisId) : null;
}

export function pickGrowthAxisFromProfiles(rows: GrowthAxisProfileRow[]): C6AxisId | null {
  const profiles = rows
    .map((row, index) => {
      const axisId = toAxisId(row.axis_id);
      const currentLevel = toNumber(row.current_level, Number.NaN);
      const evidenceCount = Math.max(0, Math.trunc(toNumber(row.evidence_count, 0)));

      return axisId && Number.isFinite(currentLevel)
        ? { axisId, currentLevel, evidenceCount, index }
        : null;
    })
    .filter((profile): profile is { axisId: C6AxisId; currentLevel: number; evidenceCount: number; index: number } => (
      profile !== null
    ));

  const strongEvidence = profiles.filter((profile) => profile.evidenceCount >= 3);
  const candidates = strongEvidence.length > 0
    ? strongEvidence
    : profiles.filter((profile) => profile.evidenceCount >= 1);

  return [...candidates].sort((a, b) => a.currentLevel - b.currentLevel || a.index - b.index)[0]?.axisId ?? null;
}

export function deriveLibraryVideoAxis(video: Pick<LibraryVideo, 'target_axis' | 'c6_focus'>): C6AxisId | null {
  const targetAxis = toAxisId(video.target_axis);
  if (targetAxis) return targetAxis;

  const legacyAxis = video.c6_focus ? LEGACY_TOOL_TO_AXIS[video.c6_focus] : null;
  return legacyAxis ?? null;
}

export function orderLibraryByGrowthAxis(
  videos: LibraryVideo[],
  growthAxis: C6AxisId | null | undefined,
  seenIds: ReadonlySet<string> = new Set(),
): LibraryVideo[] {
  if (!growthAxis) return videos;

  const rank = (video: LibraryVideo): number => {
    const matches = deriveLibraryVideoAxis(video) === growthAxis;
    const unseen = !seenIds.has(video.id);

    if (unseen && matches) return 0;
    if (unseen) return 1;
    if (matches) return 2;
    return 3;
  };

  return [...videos].sort((a, b) => rank(a) - rank(b));
}
