/**
 * 이야기 등대섬 상태 모델 — 데모용 localStorage 스키마 (docs/plan/11 I1).
 * 서버 상태(child_island_state)는 I3에서 신설. I1은 브라우저 localStorage 한 벌
 * ('kindy:island')로만 시뮬레이션 — 개인 데이터 없음, 공개 페이지.
 * 아바타 커스텀은 /world 의 kindy:world 를 재사용(별도 저장 안 함).
 * 순수 헬퍼(window 불필요)만 단위 테스트한다.
 */

export const ISLAND_STORAGE_KEY = 'kindy:island';
export const ISLAND_SAVE_VERSION = 1;

/** 수업 1편 완료 시 지급되는 이야기 조각 수 (기획 I1 데모). */
export const REWARD_PIECES = 3;

/** 첫 표류병 = 쇠라 그림 섬 편지. */
export const SEURAT_BOTTLE_ID = 'seurat-bottle';
export const SEURAT_LESSON_ID = 'seurat-01';

/** 오두막 옆 꾸미기 격자 크기 (3×2 = 6칸). */
export const GRID_COLS = 3;
export const GRID_ROWS = 2;

export type FurnitureId = 'sofa' | 'plant' | 'chair' | 'books' | 'flowers' | 'lamp';

export interface Furniture {
  id: FurnitureId;
  label: string;
  emoji: string;
  /** 유료 props 아틀라스에서 조립할 원본 16px 셀 범위. */
  stamp: {
    prefix: string;
    startRow: number;
    startColumn: number;
    rows: number;
    columns: number;
  };
  /** Phaser 배치 타일 바탕색. */
  tile: string;
}

// 가구 6종 — DOM 카탈로그와 Phaser 배치가 이 한 벌의 실프레임 매핑을 함께 쓴다.
export const FURNITURE: readonly Furniture[] = [
  {
    id: 'sofa', label: '소파', emoji: 'chairs__r005_c006', tile: '#EAD9BE',
    stamp: { prefix: 'chairs', startRow: 4, startColumn: 5, rows: 2, columns: 3 },
  },
  {
    id: 'plant', label: '화분', emoji: 'house-plants__r000_c000', tile: '#DDE8DE',
    stamp: { prefix: 'house-plants', startRow: 0, startColumn: 0, rows: 1, columns: 1 },
  },
  {
    id: 'chair', label: '의자', emoji: 'chairs__r001_c002', tile: '#F1E4CB',
    stamp: { prefix: 'chairs', startRow: 0, startColumn: 2, rows: 2, columns: 1 },
  },
  {
    id: 'books', label: '책장', emoji: 'bookshelves__r001_c000', tile: '#E7D8C0',
    stamp: { prefix: 'bookshelves', startRow: 0, startColumn: 0, rows: 2, columns: 1 },
  },
  {
    id: 'flowers', label: '꽃밭', emoji: 'flowers__r000_c000', tile: '#F6DCE6',
    stamp: { prefix: 'flowers', startRow: 0, startColumn: 0, rows: 1, columns: 1 },
  },
  {
    id: 'lamp', label: '등불', emoji: 'lantern__r000_c000', tile: '#F3E7C4',
    stamp: { prefix: 'lantern', startRow: 0, startColumn: 0, rows: 1, columns: 1 },
  },
];

export interface PlacedItem {
  item: FurnitureId;
  /** 격자 칸 좌표. */
  x: number;
  y: number;
}

export interface IslandSave {
  v: number;
  /** 이야기 조각 — 배치의 유일한 재화(기획 §5). 시간제한·소멸 없음. */
  pieces: number;
  placed: PlacedItem[];
  /** 탭해서 편지를 연 표류병 id. */
  bottlesOpened: string[];
  /** 조각 보상을 이미 지급한 수업 id — 재방문 시 중복 지급 방지. */
  claimed: string[];
  /** 점등 축하 연출을 이미 보여준 수업 id — claimed→celebrated 전이 시 1회만 연출. */
  celebrated: string[];
}

export const EMPTY_ISLAND: IslandSave = {
  v: ISLAND_SAVE_VERSION,
  pieces: 0,
  placed: [],
  bottlesOpened: [],
  claimed: [],
  celebrated: [],
};

const FURNITURE_IDS = new Set<string>(FURNITURE.map((f) => f.id));

function isFurnitureId(value: unknown): value is FurnitureId {
  return typeof value === 'string' && FURNITURE_IDS.has(value);
}

function normalizePlaced(value: unknown): PlacedItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: PlacedItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const x = rec.x;
    const y = rec.y;
    if (!isFurnitureId(rec.item) || typeof x !== 'number' || typeof y !== 'number') continue;
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) continue;
    const key = `${x},${y}`;
    if (seen.has(key)) continue; // 한 칸에 하나만.
    seen.add(key);
    out.push({ item: rec.item, x, y });
  }
  return out;
}

function normalizeStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((v): v is string => typeof v === 'string')));
}

function normalizeIsland(value: unknown): IslandSave {
  if (!value || typeof value !== 'object') return { ...EMPTY_ISLAND };
  const rec = value as Record<string, unknown>;
  const pieces = typeof rec.pieces === 'number' && rec.pieces >= 0 ? Math.floor(rec.pieces) : 0;
  return {
    v: ISLAND_SAVE_VERSION,
    pieces,
    placed: normalizePlaced(rec.placed),
    bottlesOpened: normalizeStrings(rec.bottlesOpened),
    claimed: normalizeStrings(rec.claimed),
    celebrated: normalizeStrings(rec.celebrated),
  };
}

export function parseIsland(raw: string | null): IslandSave {
  if (!raw) return { ...EMPTY_ISLAND };
  try {
    return normalizeIsland(JSON.parse(raw));
  } catch {
    return { ...EMPTY_ISLAND };
  }
}

export function serializeIsland(save: IslandSave): string {
  return JSON.stringify({
    v: ISLAND_SAVE_VERSION,
    pieces: save.pieces,
    placed: save.placed,
    bottlesOpened: save.bottlesOpened,
    claimed: save.claimed,
    celebrated: save.celebrated,
  });
}

export function withBottleOpened(save: IslandSave, bottleId: string): IslandSave {
  if (save.bottlesOpened.includes(bottleId)) return save;
  return { ...save, bottlesOpened: [...save.bottlesOpened, bottleId] };
}

/** 수업 완료 보상 지급(멱등) — 이미 지급한 수업이면 그대로 반환. */
export function withReward(save: IslandSave, lessonId: string, pieces = REWARD_PIECES): IslandSave {
  if (save.claimed.includes(lessonId)) return save;
  return { ...save, pieces: save.pieces + pieces, claimed: [...save.claimed, lessonId] };
}

/** claimed 됐지만 아직 축하 연출을 안 본 수업이면 true(전이 1회 감지). */
export function needsCelebration(save: IslandSave, lessonId: string): boolean {
  return save.claimed.includes(lessonId) && !save.celebrated.includes(lessonId);
}

/** 축하 연출을 봤다고 표시(멱등). */
export function withCelebrated(save: IslandSave, lessonId: string): IslandSave {
  if (save.celebrated.includes(lessonId)) return save;
  return { ...save, celebrated: [...save.celebrated, lessonId] };
}

export function isCellOccupied(save: IslandSave, x: number, y: number): boolean {
  return save.placed.some((p) => p.x === x && p.y === y);
}

export function canPlace(save: IslandSave, x: number, y: number): boolean {
  if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return false;
  return save.pieces > 0 && !isCellOccupied(save, x, y);
}

/** 조각 1개로 빈 칸에 가구 배치 — 불가하면 원본 그대로. */
export function withPlaced(save: IslandSave, item: FurnitureId, x: number, y: number): IslandSave {
  if (!canPlace(save, x, y)) return save;
  return {
    ...save,
    pieces: save.pieces - 1,
    placed: [...save.placed, { item, x, y }],
  };
}

/** 등대 밝기 단계 = 보상 지급한 수업(=완주한 이야기) 수. */
export function lighthouseLevel(save: IslandSave): number {
  return save.claimed.length;
}

// ── 브라우저 래퍼 (window 없는 환경에선 무해) ──────────────────────────────

export function readIsland(): IslandSave {
  if (typeof window === 'undefined') return { ...EMPTY_ISLAND };
  try {
    return parseIsland(window.localStorage.getItem(ISLAND_STORAGE_KEY));
  } catch {
    return { ...EMPTY_ISLAND };
  }
}

export function writeIsland(save: IslandSave): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ISLAND_STORAGE_KEY, serializeIsland(save));
  } catch {
    /* localStorage 접근 불가 — 데모 상태라 무시. */
  }
}
