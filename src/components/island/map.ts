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

export function clampWorldPoint(point: WorldPoint): WorldPoint {
  return {
    x: Math.min(WORLD_WIDTH - MAP_TILE_SIZE / 2, Math.max(MAP_TILE_SIZE / 2, point.x)),
    y: Math.min(WORLD_HEIGHT - MAP_TILE_SIZE / 2, Math.max(MAP_TILE_SIZE, point.y)),
  };
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
