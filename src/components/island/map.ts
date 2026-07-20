import type Phaser from 'phaser';
import {
  PAL,
  TILE,
  tileGrass,
  tilePath,
  tileSand,
  tileSea,
  type Pal,
  type Pix,
} from '@/components/island/pixel-art';

export const MAP_COLS = 60;
export const MAP_ROWS = 80;
export const WORLD_WIDTH = MAP_COLS * TILE;
export const WORLD_HEIGHT = MAP_ROWS * TILE;
export const WORLD_BACKGROUND = PAL.C;

export const AVATAR_START = { col: 30, row: 53 } as const;

const ISLE = { cx: 29.5, cy: 39.5, rx: 27, ry: 37 } as const;
const BEACH_START_ROW = 58;
const PATH_COLUMN = 30;
const PATH_START_ROW = 42;
const PATH_END_ROW = 59;

export type TerrainTile = 'sea' | 'sand' | 'grass' | 'path';

export type PixelTextureFactory = (scene: Phaser.Scene, key: string, pix: Pix, pal: Pal) => void;

function baseTileAt(col: number, row: number): Exclude<TerrainTile, 'path'> {
  if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return 'sea';
  const distance = ((col - ISLE.cx) / ISLE.rx) ** 2 + ((row - ISLE.cy) / ISLE.ry) ** 2;
  if (distance > 1) return 'sea';
  return row >= BEACH_START_ROW ? 'sand' : 'grass';
}

export function tileAt(col: number, row: number): TerrainTile {
  const base = baseTileAt(col, row);
  const onPath = col === PATH_COLUMN && row >= PATH_START_ROW && row <= PATH_END_ROW;
  return base === 'grass' && onPath ? 'path' : base;
}

/** 정본 지형 행렬. 후속 태스크는 렌더러와 독립적으로 이 데이터만 교체할 수 있다. */
export const TERRAIN_DATA: readonly (readonly TerrainTile[])[] = Array.from({ length: MAP_ROWS }, (_, row) =>
  Array.from({ length: MAP_COLS }, (_, col) => tileAt(col, row)),
);

export function isWalkableWorld(x: number, y: number): boolean {
  if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return false;
  return tileAt(Math.floor(x / TILE), Math.floor(y / TILE)) !== 'sea';
}

export interface WorldPoint {
  x: number;
  y: number;
}

export function clampWorldPoint(point: WorldPoint): WorldPoint {
  return {
    x: Math.min(WORLD_WIDTH - TILE / 2, Math.max(TILE / 2, point.x)),
    y: Math.min(WORLD_HEIGHT - TILE / 2, Math.max(TILE, point.y)),
  };
}

export function registerMapTextures(scene: Phaser.Scene, makeTexture: PixelTextureFactory): void {
  makeTexture(scene, 'tile-grass', tileGrass(), PAL);
  makeTexture(scene, 'tile-sand', tileSand(), PAL);
  makeTexture(scene, 'tile-sea-0', tileSea(0), PAL);
  makeTexture(scene, 'tile-sea-1', tileSea(1), PAL);
  makeTexture(scene, 'tile-path', tilePath(), PAL);
}

const TILE_INDEX = {
  sea0: 0,
  sea1: 1,
  grass: 2,
  sand: 3,
  path: 4,
} as const;

export interface TerrainLayer {
  setSeaFrame(frame: 0 | 1): void;
}

export function createTerrain(scene: Phaser.Scene): TerrainLayer {
  const data = TERRAIN_DATA.map((row) =>
    row.map((tile) => (tile === 'sea' ? TILE_INDEX.sea0 : TILE_INDEX[tile])),
  );
  const map = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
  const definitions = [
    ['sea-0', 'tile-sea-0', TILE_INDEX.sea0],
    ['sea-1', 'tile-sea-1', TILE_INDEX.sea1],
    ['grass', 'tile-grass', TILE_INDEX.grass],
    ['sand', 'tile-sand', TILE_INDEX.sand],
    ['path', 'tile-path', TILE_INDEX.path],
  ] as const;
  const tilesets = definitions.map(([name, key, gid]) => map.addTilesetImage(name, key, TILE, TILE, 0, 0, gid));
  if (tilesets.some((tileset) => tileset === null)) throw new Error('등대섬 타일셋을 만들지 못했습니다.');

  const layer = map.createLayer(0, tilesets as Phaser.Tilemaps.Tileset[], 0, 0);
  if (!layer) throw new Error('등대섬 지형 레이어를 만들지 못했습니다.');
  layer.setDepth(0);

  let currentFrame: 0 | 1 = 0;
  return {
    setSeaFrame(frame) {
      if (frame === currentFrame) return;
      layer.replaceByIndex(currentFrame === 0 ? TILE_INDEX.sea0 : TILE_INDEX.sea1, frame === 0 ? TILE_INDEX.sea0 : TILE_INDEX.sea1);
      currentFrame = frame;
    },
  };
}
