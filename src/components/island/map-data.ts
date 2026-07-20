/**
 * 등대섬의 정본 지형 데이터.
 *
 * 팩 원본의 16px 타일 인덱스만 사용하며, 렌더링/Phaser 생명주기와 분리해
 * 해안선·동선·충돌을 한 곳에서 검증할 수 있게 둔다.
 */

export const MAP_TILE_SIZE = 16;
export const MAP_COLS = 60;
export const MAP_ROWS = 80;

export const AVATAR_START = { col: 30, row: 53 } as const;

export type TerrainTile = 'sea' | 'sand' | 'grass' | 'path' | 'farmland' | 'dock';

interface GridPoint {
  col: number;
  row: number;
}

interface CoastAnchor {
  row: number;
  left: number;
  right: number;
}

const COAST: readonly CoastAnchor[] = [
  { row: 7, left: 35, right: 40 },
  { row: 11, left: 29, right: 45 },
  { row: 16, left: 23, right: 48 },
  { row: 22, left: 16, right: 50 },
  { row: 29, left: 9, right: 51 },
  { row: 36, left: 6, right: 49 },
  { row: 43, left: 5, right: 47 },
  { row: 50, left: 7, right: 46 },
  { row: 57, left: 8, right: 45 },
  { row: 63, left: 11, right: 43 },
  { row: 68, left: 16, right: 40 },
  { row: 73, left: 23, right: 36 },
  { row: 76, left: 28, right: 32 },
] as const;

const ROUTES: readonly (readonly GridPoint[])[] = [
  // 남쪽 표류병 모래톱 → 오두막 마당
  [
    { col: 30, row: 62 },
    { col: 30, row: 56 },
    { col: 28, row: 50 },
    { col: 28, row: 45 },
    { col: 29, row: 43 },
  ],
  // 오두막 마당 → 북동 등대 곶의 완만한 오르막
  [
    { col: 29, row: 43 },
    { col: 30, row: 38 },
    { col: 33, row: 34 },
    { col: 35, row: 30 },
    { col: 36, row: 26 },
    { col: 36, row: 23 },
  ],
  // 오두막 마당 → 남서 부두
  [
    { col: 28, row: 43 },
    { col: 24, row: 46 },
    { col: 21, row: 51 },
    { col: 18, row: 57 },
    { col: 15, row: 62 },
  ],
  // 오두막 마당 → 서쪽 숲 가장자리의 작은 쉼터
  [
    { col: 25, row: 42 },
    { col: 21, row: 41 },
    { col: 18, row: 38 },
    { col: 15, row: 36 },
  ],
] as const;

const DOCK = { left: 13, right: 15, top: 62, bottom: 70 } as const;
const FARM = { left: 28, right: 30, top: 39, bottom: 41 } as const;

function interpolateCoast(row: number): { left: number; right: number } | null {
  if (row < COAST[0].row || row > COAST[COAST.length - 1].row) return null;

  for (let index = 0; index < COAST.length - 1; index += 1) {
    const from = COAST[index];
    const to = COAST[index + 1];
    if (row < from.row || row > to.row) continue;
    const ratio = (row - from.row) / (to.row - from.row);
    const leftWave = Math.sin(row * 0.78) * 0.7 + Math.sin(row * 0.31) * 0.45;
    const rightWave = Math.sin(row * 0.63 + 1.4) * 0.65 + Math.sin(row * 0.27) * 0.4;
    return {
      left: Math.round(from.left + (to.left - from.left) * ratio + leftWave),
      right: Math.round(from.right + (to.right - from.right) * ratio + rightWave),
    };
  }
  return null;
}

function isBaseLandAt(col: number, row: number): boolean {
  if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return false;
  const coast = interpolateCoast(row);
  return coast !== null && col >= coast.left && col <= coast.right;
}

function isDockAt(col: number, row: number): boolean {
  return col >= DOCK.left && col <= DOCK.right && row >= DOCK.top && row <= DOCK.bottom;
}

function pointToSegmentDistance(point: GridPoint, from: GridPoint, to: GridPoint): number {
  const dx = to.col - from.col;
  const dy = to.row - from.row;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.col - from.col, point.row - from.row);
  const ratio = Math.max(
    0,
    Math.min(1, ((point.col - from.col) * dx + (point.row - from.row) * dy) / lengthSquared),
  );
  return Math.hypot(point.col - (from.col + ratio * dx), point.row - (from.row + ratio * dy));
}

function distanceToRoutes(col: number, row: number): number {
  const point = { col, row };
  let closest = Number.POSITIVE_INFINITY;
  for (const route of ROUTES) {
    for (let index = 0; index < route.length - 1; index += 1) {
      closest = Math.min(closest, pointToSegmentDistance(point, route[index], route[index + 1]));
    }
  }
  return closest;
}

function isPathAt(col: number, row: number): boolean {
  return isBaseLandAt(col, row) && distanceToRoutes(col, row) <= 1.35;
}

function isFarmAt(col: number, row: number): boolean {
  return col >= FARM.left && col <= FARM.right && row >= FARM.top && row <= FARM.bottom;
}

function isHeadlandAt(col: number, row: number): boolean {
  return ((col - 37) / 12) ** 2 + ((row - 23) / 12) ** 2 <= 1;
}

function isNearSea(col: number, row: number, radius: number): boolean {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (!isBaseLandAt(col + dx, row + dy)) return true;
    }
  }
  return false;
}

function isBeachAt(col: number, row: number): boolean {
  if (!isBaseLandAt(col, row) || isHeadlandAt(col, row)) return false;
  const southernSandbar = row >= 55 && col >= 18 && col <= 40;
  return southernSandbar || isNearSea(col, row, 2);
}

export function tileAt(col: number, row: number): TerrainTile {
  if (isDockAt(col, row)) return 'dock';
  if (!isBaseLandAt(col, row)) return 'sea';
  if (isFarmAt(col, row)) return 'farmland';
  if (isPathAt(col, row)) return 'path';
  return isBeachAt(col, row) ? 'sand' : 'grass';
}

/** Cute Fantasy terrain.png의 16px 셀 인덱스. */
export const TERRAIN_FRAME = {
  grass: 0,
  beachTopLeft: 1,
  beachTop: 2,
  beachTopRight: 3,
  beachLeft: 6,
  beachMiddle: 7,
  beachRight: 8,
  beachBottomLeft: 11,
  beachBottom: 12,
  beachBottomRight: 13,
  pathTopLeft: 16,
  pathTop: 17,
  pathTopRight: 18,
  pathLeft: 19,
  pathMiddle: 20,
  pathRight: 21,
  pathBottomLeft: 22,
  pathBottom: 23,
  pathBottomRight: 24,
  footprintLeft: 31,
  footprintMiddle: 32,
  footprintRight: 33,
  pathPlain: 34,
  cliffTopLeft: 35,
  cliffTop: 36,
  cliffTopRight: 37,
  cliffLeft: 38,
  cliffMiddle: 39,
  cliffRight: 40,
  cliffBottomLeft: 41,
  cliffBottom: 42,
  cliffBottomRight: 43,
  farmTopLeft: 53,
  farmTop: 54,
  farmTopRight: 55,
  farmLeft: 56,
  farmMiddle: 57,
  farmRight: 58,
  farmBottomLeft: 59,
  farmBottom: 60,
  farmBottomRight: 61,
} as const;

/** Cute Fantasy water.png의 물 바탕과 잔물결 프레임. */
export const WATER_FRAME = {
  ripples: [15, 16, 17] as const,
  middle: 18,
} as const;

function tileMatches(col: number, row: number, terrain: TerrainTile): boolean {
  return tileAt(col, row) === terrain;
}

interface AutoTileFrames {
  topLeft: number;
  top: number;
  topRight: number;
  left: number;
  middle: number;
  right: number;
  bottomLeft: number;
  bottom: number;
  bottomRight: number;
}

function autoTileFrame(col: number, row: number, matches: (col: number, row: number) => boolean, frames: AutoTileFrames): number {
  const north = matches(col, row - 1);
  const south = matches(col, row + 1);
  const west = matches(col - 1, row);
  const east = matches(col + 1, row);
  if (!north && !west) return frames.topLeft;
  if (!north && !east) return frames.topRight;
  if (!south && !west) return frames.bottomLeft;
  if (!south && !east) return frames.bottomRight;
  if (!north) return frames.top;
  if (!south) return frames.bottom;
  if (!west) return frames.left;
  if (!east) return frames.right;
  return frames.middle;
}

const PATH_FRAMES: AutoTileFrames = {
  topLeft: TERRAIN_FRAME.pathTopLeft,
  top: TERRAIN_FRAME.pathTop,
  topRight: TERRAIN_FRAME.pathTopRight,
  left: TERRAIN_FRAME.pathLeft,
  middle: TERRAIN_FRAME.pathMiddle,
  right: TERRAIN_FRAME.pathRight,
  bottomLeft: TERRAIN_FRAME.pathBottomLeft,
  bottom: TERRAIN_FRAME.pathBottom,
  bottomRight: TERRAIN_FRAME.pathBottomRight,
};

const FARM_FRAMES: AutoTileFrames = {
  topLeft: TERRAIN_FRAME.farmTopLeft,
  top: TERRAIN_FRAME.farmTop,
  topRight: TERRAIN_FRAME.farmTopRight,
  left: TERRAIN_FRAME.farmLeft,
  middle: TERRAIN_FRAME.farmMiddle,
  right: TERRAIN_FRAME.farmRight,
  bottomLeft: TERRAIN_FRAME.farmBottomLeft,
  bottom: TERRAIN_FRAME.farmBottom,
  bottomRight: TERRAIN_FRAME.farmBottomRight,
};

function beachFrameAt(col: number, row: number): number {
  const north = isBaseLandAt(col, row - 1);
  const south = isBaseLandAt(col, row + 1);
  const west = isBaseLandAt(col - 1, row);
  const east = isBaseLandAt(col + 1, row);
  if (!north && !west) return TERRAIN_FRAME.beachTopLeft;
  if (!north && !east) return TERRAIN_FRAME.beachTopRight;
  if (!south && !west) return TERRAIN_FRAME.beachBottomLeft;
  if (!south && !east) return TERRAIN_FRAME.beachBottomRight;
  if (!north) return TERRAIN_FRAME.beachTop;
  if (!south) return TERRAIN_FRAME.beachBottom;
  if (!west) return TERRAIN_FRAME.beachLeft;
  if (!east) return TERRAIN_FRAME.beachRight;
  return TERRAIN_FRAME.beachMiddle;
}

function terrainFrameAt(col: number, row: number): number {
  const terrain = tileAt(col, row);
  if (terrain === 'sea' || terrain === 'dock') return -1;
  if (terrain === 'grass') return TERRAIN_FRAME.grass;
  if (terrain === 'sand') return beachFrameAt(col, row);
  if (terrain === 'farmland') {
    return autoTileFrame(col, row, (x, y) => tileMatches(x, y, 'farmland'), FARM_FRAMES);
  }

  // 모래톱 위에서는 초록 테두리 대신 팩의 발자국 프레임으로 길을 잇는다.
  if (isBeachAt(col, row)) {
    const footprint = (col + row) % 4;
    if (footprint === 0) return TERRAIN_FRAME.footprintLeft;
    if (footprint === 2) return TERRAIN_FRAME.footprintRight;
    return footprint === 1 ? TERRAIN_FRAME.footprintMiddle : TERRAIN_FRAME.pathPlain;
  }
  return autoTileFrame(col, row, (x, y) => tileMatches(x, y, 'path'), PATH_FRAMES);
}

function isPlateauAt(col: number, row: number): boolean {
  return ((col - 37) / 10) ** 2 + ((row - 23) / 9) ** 2 <= 1;
}

function isCliffRampAt(col: number, row: number): boolean {
  return row >= 29 && row <= 32 && col >= 34 && col <= 37;
}

function isCliffAt(col: number, row: number): boolean {
  if (!isPlateauAt(col, row) || isCliffRampAt(col, row)) return false;
  return (
    !isPlateauAt(col, row - 1) ||
    !isPlateauAt(col, row + 1) ||
    !isPlateauAt(col - 1, row) ||
    !isPlateauAt(col + 1, row)
  );
}

const CLIFF_FRAMES: AutoTileFrames = {
  topLeft: TERRAIN_FRAME.cliffTopLeft,
  top: TERRAIN_FRAME.cliffTop,
  topRight: TERRAIN_FRAME.cliffTopRight,
  left: TERRAIN_FRAME.cliffLeft,
  middle: TERRAIN_FRAME.cliffMiddle,
  right: TERRAIN_FRAME.cliffRight,
  bottomLeft: TERRAIN_FRAME.cliffBottomLeft,
  bottom: TERRAIN_FRAME.cliffBottom,
  bottomRight: TERRAIN_FRAME.cliffBottomRight,
};

function cliffFrameAt(col: number, row: number): number {
  if (!isCliffAt(col, row)) return -1;
  return autoTileFrame(col, row, isPlateauAt, CLIFF_FRAMES);
}

export const TERRAIN_DATA: readonly (readonly TerrainTile[])[] = Array.from({ length: MAP_ROWS }, (_, row) =>
  Array.from({ length: MAP_COLS }, (_, col) => tileAt(col, row)),
);

export const TERRAIN_FRAME_DATA: readonly (readonly number[])[] = Array.from({ length: MAP_ROWS }, (_, row) =>
  Array.from({ length: MAP_COLS }, (_, col) => terrainFrameAt(col, row)),
);

export const CLIFF_FRAME_DATA: readonly (readonly number[])[] = Array.from({ length: MAP_ROWS }, (_, row) =>
  Array.from({ length: MAP_COLS }, (_, col) => cliffFrameAt(col, row)),
);

function hashCell(col: number, row: number): number {
  let value = Math.imul(col + 17, 374761393) ^ Math.imul(row + 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value ^ (value >>> 16)) >>> 0;
}

export interface WaterRipple {
  col: number;
  row: number;
  variant: number;
}

export const WATER_RIPPLES: readonly WaterRipple[] = Array.from({ length: MAP_ROWS }, (_, row) =>
  Array.from({ length: MAP_COLS }, (_, col) => ({ col, row })),
)
  .flat()
  .filter(({ col, row }) => tileAt(col, row) === 'sea' && hashCell(col, row) % 23 === 0)
  .map(({ col, row }) => ({ col, row, variant: hashCell(col + 3, row + 7) % WATER_FRAME.ripples.length }));

function atlasCell(prefix: string, row: number, col: number): string {
  return `${prefix}__r${String(row).padStart(3, '0')}_c${String(col).padStart(3, '0')}`;
}

export interface MapSceneryTile {
  col: number;
  row: number;
  frame: string;
  /** 같은 큰 오브젝트 조각은 동일 depthRow를 공유한다. */
  depthRow: number;
  ground: boolean;
}

const scenery: MapSceneryTile[] = [];
const blockedScenery = new Set<string>();

function blockCell(col: number, row: number): void {
  blockedScenery.add(`${col},${row}`);
}

function addStamp(col: number, row: number, prefix: string, width: number, height: number): void {
  const depthRow = row + height;
  for (let sourceRow = 0; sourceRow < height; sourceRow += 1) {
    for (let sourceCol = 0; sourceCol < width; sourceCol += 1) {
      scenery.push({
        col: col + sourceCol,
        row: row + sourceRow,
        frame: atlasCell(prefix, sourceRow, sourceCol),
        depthRow,
        ground: false,
      });
    }
  }
}

const OAKS: readonly GridPoint[] = [
  { col: 7, row: 25 },
  { col: 12, row: 20 },
  { col: 17, row: 22 },
  { col: 6, row: 34 },
  { col: 10, row: 43 },
  { col: 15, row: 28 },
  { col: 7, row: 50 },
  { col: 18, row: 47 },
  { col: 43, row: 32 },
  { col: 40, row: 43 },
] as const;

for (const oak of OAKS) {
  addStamp(oak.col, oak.row, 'oak-tree', 4, 5);
  blockCell(oak.col + 1, oak.row + 4);
  blockCell(oak.col + 2, oak.row + 4);
}

// 3칸 폭의 부두: 모래톱에서 시작해 물 위에서 끝나는 미완성 다리.
for (let row = DOCK.top; row <= DOCK.bottom - 2; row += 1) {
  for (let colOffset = 0; colOffset < 3; colOffset += 1) {
    scenery.push({
      col: DOCK.left + colOffset,
      row,
      frame: atlasCell('bridge-wood', 0, colOffset),
      depthRow: row + 1,
      ground: true,
    });
  }
}
for (let sourceRow = 1; sourceRow <= 2; sourceRow += 1) {
  for (let sourceCol = 0; sourceCol < 3; sourceCol += 1) {
    const row = DOCK.bottom - 2 + sourceRow;
    scenery.push({
      col: DOCK.left + sourceCol,
      row,
      frame: atlasCell('bridge-wood', sourceRow, sourceCol),
      depthRow: row + 1,
      ground: true,
    });
  }
}

function addFence(col: number, row: number, frameRow: number, frameCol: number): void {
  scenery.push({
    col,
    row,
    frame: atlasCell('fences', frameRow, frameCol),
    depthRow: row + 1,
    ground: false,
  });
  blockCell(col, row);
}

for (let col = 27; col <= 31; col += 1) addFence(col, 38, 0, col === 27 ? 1 : col === 31 ? 3 : 2);
for (let row = 39; row <= 41; row += 1) {
  addFence(27, row, 1, 1);
  addFence(31, row, 1, 3);
}
for (let col = 27; col <= 31; col += 1) {
  if (col === 29) continue;
  addFence(col, 42, 3, col === 27 ? 1 : col === 31 ? 3 : 2);
}

interface SingleScenery extends GridPoint {
  sourceRow: number;
  sourceCol: number;
  blocking?: boolean;
}

const ROCKS: readonly SingleScenery[] = [
  { col: 20, row: 60, sourceRow: 2, sourceCol: 1, blocking: true },
  { col: 23, row: 65, sourceRow: 2, sourceCol: 2, blocking: true },
  { col: 37, row: 62, sourceRow: 3, sourceCol: 0, blocking: true },
  { col: 41, row: 57, sourceRow: 3, sourceCol: 2, blocking: true },
  { col: 10, row: 57, sourceRow: 3, sourceCol: 1, blocking: true },
  { col: 47, row: 36, sourceRow: 3, sourceCol: 3, blocking: true },
] as const;

for (const rock of ROCKS) {
  scenery.push({
    col: rock.col,
    row: rock.row,
    frame: atlasCell('outdoor-decor-free', rock.sourceRow, rock.sourceCol),
    depthRow: rock.row + 1,
    ground: false,
  });
  if (rock.blocking) blockCell(rock.col, rock.row);
}

const FLOWER_FRAMES = [
  [8, 0],
  [8, 1],
  [9, 0],
  [9, 1],
  [10, 0],
  [10, 1],
  [11, 0],
  [11, 1],
] as const;

for (let row = 13; row < 68; row += 1) {
  for (let col = 6; col < 50; col += 1) {
    if (tileAt(col, row) !== 'grass' || isCliffAt(col, row)) continue;
    if (col >= 24 && col <= 33 && row >= 34 && row <= 44) continue;
    const hash = hashCell(col, row);
    if (hash % 37 !== 0) continue;
    const [sourceRow, sourceCol] = FLOWER_FRAMES[hash % FLOWER_FRAMES.length];
    scenery.push({
      col,
      row,
      frame: atlasCell('outdoor-decor-free', sourceRow, sourceCol),
      depthRow: row + 1,
      ground: false,
    });
  }
}

export const SCENERY_DATA: readonly MapSceneryTile[] = scenery;

/** true는 이동 불가. engine.ts의 isWalkableWorld 계약이 이 행렬을 조회한다. */
export const COLLISION_DATA: readonly (readonly boolean[])[] = Array.from({ length: MAP_ROWS }, (_, row) =>
  Array.from({ length: MAP_COLS }, (_, col) => {
    const terrain = tileAt(col, row);
    if (terrain === 'sea') return true;
    if (isCliffAt(col, row)) return true;
    return blockedScenery.has(`${col},${row}`);
  }),
);

export function isWalkableTile(col: number, row: number): boolean {
  if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return false;
  return !COLLISION_DATA[row][col];
}

