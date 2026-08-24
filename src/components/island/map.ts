import type Phaser from 'phaser';
import { PAL } from '@/components/island/pixel-art';
import {
  AVATAR_START,
  CLIFF_FRAME_DATA,
  COLLISION_DATA,
  MAP_COLS,
  MAP_ROWS,
  MAP_TILE_SIZE,
  SCENERY_DATA,
  TERRAIN_DATA,
  TERRAIN_FRAME_DATA,
  WATER_FRAME,
  WATER_RIPPLES,
  isWalkableTile,
  tileAt,
  type TerrainTile,
} from '@/components/island/map-data';

export { AVATAR_START, MAP_COLS, MAP_ROWS, TERRAIN_DATA, tileAt, type TerrainTile };

export const TILE = MAP_TILE_SIZE;
export const WORLD_WIDTH = MAP_COLS * MAP_TILE_SIZE;
export const WORLD_HEIGHT = MAP_ROWS * MAP_TILE_SIZE;
// 씬 로딩 중에만 보이는 기존 테마 토큰. 실제 월드는 팩 물 타일이 전부 덮는다.
export const WORLD_BACKGROUND = PAL.C;

const COLLISION_EDGE_INSET_PX = 0.51;

const TERRAIN_TEXTURE_KEY = 'island-terrain-pack';
const WATER_TEXTURE_KEY = 'island-water-pack';
const SCENERY_TEXTURE_KEY = 'island-scenery-pack';
const TERRAIN_IMAGE_URL = '/island/tiles/terrain.png';
const WATER_IMAGE_URL = '/island/tiles/water.png';
const SCENERY_IMAGE_URL = '/island/tiles/props.png';
const SCENERY_ATLAS_URL = '/island/tiles/props.json';

export function isWalkableWorld(x: number, y: number): boolean {
  if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return false;
  return isWalkableTile(Math.floor(x / MAP_TILE_SIZE), Math.floor(y / MAP_TILE_SIZE));
}

export interface WorldPoint {
  x: number;
  y: number;
}

export interface TapFeedback {
  kind: 'blocked' | 'destination';
  point: WorldPoint;
}

export function clampWorldPoint(point: WorldPoint): WorldPoint {
  return {
    x: Math.min(WORLD_WIDTH - MAP_TILE_SIZE / 2, Math.max(MAP_TILE_SIZE / 2, point.x)),
    y: Math.min(WORLD_HEIGHT - MAP_TILE_SIZE / 2, Math.max(MAP_TILE_SIZE, point.y)),
  };
}

function normalizedTapTarget(point: WorldPoint): WorldPoint {
  return clampWorldPoint({ x: Math.round(point.x), y: Math.round(point.y) });
}

/**
 * 이동 계산과 같은 정규화 좌표를 기준으로 탭 피드백의 위치와 종류를 정한다.
 * 목적지까지 닿지 못한 경우에는 실제 탭 지점을 가리켜 장애물 탭이 무반응처럼 보이지 않게 한다.
 */
export function resolveTapFeedback(desired: WorldPoint, destination: WorldPoint): TapFeedback {
  const target = normalizedTapTarget(desired);
  const reachedTarget = Math.hypot(destination.x - target.x, destination.y - target.y) <= COLLISION_EDGE_INSET_PX;
  return reachedTarget
    ? { kind: 'destination', point: destination }
    : { kind: 'blocked', point: target };
}

function nearestWalkableTileCenter(point: WorldPoint, preferred: WorldPoint): WorldPoint {
  let nearest: WorldPoint | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearestPreferredDistance = Number.POSITIVE_INFINITY;

  for (let row = 0; row < MAP_ROWS; row += 1) {
    for (let col = 0; col < MAP_COLS; col += 1) {
      if (!isWalkableTile(col, row)) continue;
      const candidate = {
        x: (col + 0.5) * MAP_TILE_SIZE,
        y: (row + 0.5) * MAP_TILE_SIZE,
      };
      const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      const preferredDistance = Math.hypot(candidate.x - preferred.x, candidate.y - preferred.y);
      if (
        distance < nearestDistance ||
        (distance === nearestDistance && preferredDistance < nearestPreferredDistance)
      ) {
        nearest = candidate;
        nearestDistance = distance;
        nearestPreferredDistance = preferredDistance;
      }
    }
  }

  if (!nearest) throw new Error('등대섬에 보행 가능한 안전 칸이 없습니다.');
  return nearest;
}

function walkablePoint(point: WorldPoint, preferred: WorldPoint): WorldPoint {
  return isWalkableWorld(point.x, point.y)
    ? point
    : nearestWalkableTileCenter(point, preferred);
}

function addGridBoundaryRatios(start: number, delta: number, ratios: number[]): void {
  if (delta === 0) return;
  const end = start + delta;
  const lower = Math.min(start, end);
  const upper = Math.max(start, end);
  for (
    let boundary = (Math.floor(lower / MAP_TILE_SIZE) + 1) * MAP_TILE_SIZE;
    boundary < upper;
    boundary += MAP_TILE_SIZE
  ) {
    const ratio = (boundary - start) / delta;
    if (ratio > 0 && ratio < 1) ratios.push(ratio);
  }
}

function collisionIntervalRatios(from: WorldPoint, target: WorldPoint): number[] {
  const ratios = [0, 1];
  addGridBoundaryRatios(from.x, target.x - from.x, ratios);
  addGridBoundaryRatios(from.y, target.y - from.y, ratios);
  ratios.sort((a, b) => a - b);
  return ratios.filter((ratio, index) => index === 0 || Math.abs(ratio - ratios[index - 1]) > 1e-12);
}

/**
 * 직선이 지나는 모든 타일 구간을 검사해 물·장애물을 건너뛰지 않게 한다.
 * 비보행 칸에서 시작한 경우에는 첫 보행 지점까지 검사를 이어가 탈출을 허용한다.
 */
export function findWalkableDestination(from: WorldPoint, desired: WorldPoint): WorldPoint {
  const target = normalizedTapTarget(desired);
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return walkablePoint(from, target);

  let lastWalkable = isWalkableWorld(from.x, from.y) ? from : undefined;
  const ratios = collisionIntervalRatios(from, target);
  for (let index = 0; index < ratios.length - 1; index += 1) {
    const intervalStart = ratios[index];
    const intervalEnd = ratios[index + 1];
    const midpointRatio = (intervalStart + intervalEnd) / 2;
    const midpoint = { x: from.x + dx * midpointRatio, y: from.y + dy * midpointRatio };

    if (isWalkableWorld(midpoint.x, midpoint.y)) {
      const endPoint = { x: from.x + dx * intervalEnd, y: from.y + dy * intervalEnd };
      if (intervalEnd === 1 && isWalkableWorld(endPoint.x, endPoint.y)) {
        lastWalkable = endPoint;
      } else {
        const insetRatio = Math.min(
          (intervalEnd - intervalStart) / 2,
          COLLISION_EDGE_INSET_PX / distance,
        );
        const safeRatio = intervalEnd - insetRatio;
        lastWalkable = { x: from.x + dx * safeRatio, y: from.y + dy * safeRatio };
      }
    } else if (lastWalkable) {
      break;
    }

    if (intervalEnd < 1 && lastWalkable) {
      const boundary = { x: from.x + dx * intervalEnd, y: from.y + dy * intervalEnd };
      if (!isWalkableWorld(boundary.x, boundary.y)) break;
    }
  }

  return walkablePoint(lastWalkable ?? from, target);
}

/**
 * 지형·물·배경 소품은 구매 팩 아틀라스만 로드한다.
 */
export function registerMapTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TERRAIN_TEXTURE_KEY)) scene.load.image(TERRAIN_TEXTURE_KEY, TERRAIN_IMAGE_URL);
  if (!scene.textures.exists(WATER_TEXTURE_KEY)) scene.load.image(WATER_TEXTURE_KEY, WATER_IMAGE_URL);
  if (!scene.textures.exists(SCENERY_TEXTURE_KEY)) {
    scene.load.atlas(SCENERY_TEXTURE_KEY, SCENERY_IMAGE_URL, SCENERY_ATLAS_URL);
  }
}

function mutableTileData(data: readonly (readonly number[])[]): number[][] {
  return data.map((row) => [...row]);
}

function createPackLayer(
  scene: Phaser.Scene,
  data: readonly (readonly number[])[],
  textureKey: string,
  tilesetName: string,
  depth: number,
): Phaser.Tilemaps.TilemapLayer {
  const map = scene.make.tilemap({
    data: mutableTileData(data),
    tileWidth: MAP_TILE_SIZE,
    tileHeight: MAP_TILE_SIZE,
  });
  const tileset = map.addTilesetImage(
    tilesetName,
    textureKey,
    MAP_TILE_SIZE,
    MAP_TILE_SIZE,
    0,
    0,
    0,
  );
  if (!tileset) throw new Error(`등대섬 ${tilesetName} 타일셋을 만들지 못했습니다.`);
  const layer = map.createLayer(0, tileset, 0, 0);
  if (!layer) throw new Error(`등대섬 ${tilesetName} 레이어를 만들지 못했습니다.`);
  return layer.setDepth(depth);
}

function createOceanData(): number[][] {
  return Array.from({ length: MAP_ROWS }, () => Array<number>(MAP_COLS).fill(WATER_FRAME.middle));
}

function createRippleData(phase: 0 | 1): number[][] {
  const data = Array.from({ length: MAP_ROWS }, () => Array<number>(MAP_COLS).fill(-1));
  for (const ripple of WATER_RIPPLES) {
    const frame = WATER_FRAME.ripples[(ripple.variant + phase) % WATER_FRAME.ripples.length];
    data[ripple.row][ripple.col] = frame;
  }
  return data;
}

function renderScenery(scene: Phaser.Scene): void {
  for (const tile of SCENERY_DATA) {
    const image = scene.add.image(
      (tile.col + 0.5) * MAP_TILE_SIZE,
      (tile.row + 0.5) * MAP_TILE_SIZE,
      SCENERY_TEXTURE_KEY,
      tile.frame,
    );
    image.setOrigin(0.5).setDepth(tile.ground ? 0.45 : tile.depthRow * MAP_TILE_SIZE);
  }
}

export interface TerrainLayer {
  setSeaFrame(frame: 0 | 1): void;
}

export function createTerrain(scene: Phaser.Scene): TerrainLayer {
  let currentFrame: 0 | 1 = 0;
  let rippleLayer: Phaser.Tilemaps.TilemapLayer | undefined;
  let built = false;

  const buildTerrain = () => {
    if (built) return;
    if (
      !scene.textures.exists(TERRAIN_TEXTURE_KEY) ||
      !scene.textures.exists(WATER_TEXTURE_KEY) ||
      !scene.textures.exists(SCENERY_TEXTURE_KEY)
    ) {
      return;
    }
    built = true;

    createPackLayer(scene, createOceanData(), WATER_TEXTURE_KEY, 'water-base', 0);
    rippleLayer = createPackLayer(
      scene,
      createRippleData(currentFrame),
      WATER_TEXTURE_KEY,
      'water-ripples',
      0.1,
    );
    createPackLayer(scene, TERRAIN_FRAME_DATA, TERRAIN_TEXTURE_KEY, 'terrain-surface', 0.2);
    createPackLayer(scene, CLIFF_FRAME_DATA, TERRAIN_TEXTURE_KEY, 'terrain-cliffs', 0.3);
    renderScenery(scene);
  };

  buildTerrain();
  if (!built) {
    scene.load.once('complete', buildTerrain);
    if (!scene.load.isLoading()) scene.load.start();
  }

  return {
    setSeaFrame(frame) {
      if (frame === currentFrame) return;
      currentFrame = frame;
      if (!rippleLayer) return;
      for (const ripple of WATER_RIPPLES) {
        const index = WATER_FRAME.ripples[(ripple.variant + currentFrame) % WATER_FRAME.ripples.length];
        rippleLayer.putTileAt(index, ripple.col, ripple.row, false);
      }
    },
  };
}

// 정적 충돌 행렬도 공개해 데이터/엔진 계약을 한눈에 추적할 수 있게 한다.
export { COLLISION_DATA };
