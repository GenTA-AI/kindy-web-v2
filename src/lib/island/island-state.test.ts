import assert from 'node:assert/strict';
import test from 'node:test';

import propsAtlas from '../../../public/island/tiles/props.json';

import {
  EMPTY_ISLAND,
  FURNITURE,
  GRID_COLS,
  GRID_ROWS,
  REWARD_PIECES,
  canPlace,
  isCellOccupied,
  lighthouseLevel,
  needsCelebration,
  parseIsland,
  serializeIsland,
  withBottleOpened,
  withCelebrated,
  withPlaced,
  withReward,
} from './island-state';

test('parseIsland: null/손상 입력은 빈 섬으로 폴백', () => {
  assert.deepEqual(parseIsland(null), EMPTY_ISLAND);
  assert.deepEqual(parseIsland('{bad'), EMPTY_ISLAND);
  assert.deepEqual(parseIsland('7'), EMPTY_ISLAND);
});

test('parseIsland: 잘못된 가구·격자밖·중복칸·음수조각을 정규화', () => {
  const raw = JSON.stringify({
    v: 1,
    pieces: -5,
    placed: [
      { item: 'sofa', x: 0, y: 0 },
      { item: 'unknown', x: 1, y: 0 },
      { item: 'chair', x: 99, y: 0 },
      { item: 'plant', x: 0, y: 0 }, // 중복 칸
    ],
    bottlesOpened: ['a', 'a', 3],
    claimed: ['seurat-01', 'seurat-01'],
  });
  const parsed = parseIsland(raw);
  assert.equal(parsed.pieces, 0);
  assert.deepEqual(parsed.placed, [{ item: 'sofa', x: 0, y: 0 }]);
  assert.deepEqual(parsed.bottlesOpened, ['a']);
  assert.deepEqual(parsed.claimed, ['seurat-01']);
});

test('withReward: 최초 지급 +3, 재지급 멱등', () => {
  const once = withReward(EMPTY_ISLAND, 'seurat-01');
  assert.equal(once.pieces, REWARD_PIECES);
  assert.deepEqual(once.claimed, ['seurat-01']);
  const twice = withReward(once, 'seurat-01');
  assert.equal(twice, once); // 같은 참조
  assert.equal(twice.pieces, REWARD_PIECES);
});

test('canPlace/withPlaced: 조각 소모·빈 칸 규칙', () => {
  const funded = withReward(EMPTY_ISLAND, 'seurat-01'); // pieces=3
  assert.equal(canPlace(funded, 0, 0), true);
  const placed = withPlaced(funded, 'sofa', 0, 0);
  assert.equal(placed.pieces, 2);
  assert.equal(isCellOccupied(placed, 0, 0), true);
  // 같은 칸 재배치 불가(원본 유지)
  assert.equal(withPlaced(placed, 'chair', 0, 0), placed);
  // 격자 밖 불가
  assert.equal(canPlace(placed, GRID_COLS, 0), false);
  assert.equal(canPlace(placed, 0, GRID_ROWS), false);
});

test('조각 0이면 배치 불가', () => {
  assert.equal(canPlace(EMPTY_ISLAND, 0, 0), false);
  assert.equal(withPlaced(EMPTY_ISLAND, 'sofa', 0, 0), EMPTY_ISLAND);
});

test('withBottleOpened: 추가·멱등', () => {
  const opened = withBottleOpened(EMPTY_ISLAND, 'seurat-bottle');
  assert.deepEqual(opened.bottlesOpened, ['seurat-bottle']);
  assert.equal(withBottleOpened(opened, 'seurat-bottle'), opened);
});

test('lighthouseLevel = 보상 지급한 수업 수', () => {
  assert.equal(lighthouseLevel(EMPTY_ISLAND), 0);
  assert.equal(lighthouseLevel(withReward(EMPTY_ISLAND, 'seurat-01')), 1);
});

test('축하 연출: claimed→celebrated 전이 1회 감지', () => {
  const funded = withReward(EMPTY_ISLAND, 'seurat-01');
  assert.equal(needsCelebration(funded, 'seurat-01'), true);
  const shown = withCelebrated(funded, 'seurat-01');
  assert.equal(needsCelebration(shown, 'seurat-01'), false);
  assert.equal(withCelebrated(shown, 'seurat-01'), shown); // 멱등
  // 아직 claimed 안 된 수업은 축하 대상 아님
  assert.equal(needsCelebration(EMPTY_ISLAND, 'seurat-01'), false);
});

test('serialize ↔ parse 라운드트립', () => {
  const save = withPlaced(withReward(EMPTY_ISLAND, 'seurat-01'), 'plant', 2, 1);
  assert.deepEqual(parseIsland(serializeIsland(save)), save);
});

test('가구 6종·격자 3×2', () => {
  assert.equal(FURNITURE.length, 6);
  assert.equal(GRID_COLS * GRID_ROWS, 6);
});

test('가구 6종의 카탈로그 프레임 키가 props 아틀라스에 실존', () => {
  const atlasFrames = new Set(Object.keys(propsAtlas.frames));

  for (const furniture of FURNITURE) {
    assert.ok(atlasFrames.has(furniture.emoji), `${furniture.label}: ${furniture.emoji}`);
  }
});
