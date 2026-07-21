import assert from 'node:assert/strict';
import test from 'node:test';

import { COLLISION_DATA, MAP_COLS, MAP_ROWS, MAP_TILE_SIZE, isWalkableTile } from './map-data';
import {
  findWalkableDestination,
  isWalkableWorld,
  resolveTapFeedback,
  type WorldPoint,
} from './map';
import { guidanceTargetForSave } from './props';
import { EMPTY_ISLAND, SEURAT_BOTTLE_ID } from '../../lib/island/island-state';

interface GridPoint {
  col: number;
  row: number;
}

interface GridBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const CARDINAL_OFFSETS: readonly GridPoint[] = [
  { col: -1, row: 0 },
  { col: 1, row: 0 },
  { col: 0, row: -1 },
  { col: 0, row: 1 },
];

function tileCenter({ col, row }: GridPoint): WorldPoint {
  return {
    x: (col + 0.5) * MAP_TILE_SIZE,
    y: (row + 0.5) * MAP_TILE_SIZE,
  };
}

function walkableNeighbors({ col, row }: GridPoint): GridPoint[] {
  return CARDINAL_OFFSETS.map((offset) => ({ col: col + offset.col, row: row + offset.row })).filter(
    (point) => isWalkableTile(point.col, point.row),
  );
}

function blockedBoundaryCells(bounds: GridBounds): GridPoint[] {
  const cells: GridPoint[] = [];
  for (let row = bounds.top; row <= bounds.bottom; row += 1) {
    for (let col = bounds.left; col <= bounds.right; col += 1) {
      if (!COLLISION_DATA[row]?.[col] || walkableNeighbors({ col, row }).length === 0) continue;
      cells.push({ col, row });
    }
  }
  return cells;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

test('저장 상태에서 표류병 → 오두막 격자 순서로 다음 시각 목표를 고른다', () => {
  assert.equal(guidanceTargetForSave(EMPTY_ISLAND), 'bottle');
  assert.equal(
    guidanceTargetForSave({ ...EMPTY_ISLAND, bottlesOpened: [SEURAT_BOTTLE_ID], pieces: 2 }),
    'cabin',
  );
  assert.equal(
    guidanceTargetForSave({ ...EMPTY_ISLAND, bottlesOpened: [SEURAT_BOTTLE_ID] }),
    null,
  );
});

test('실충돌행렬: 밭 북측 울타리와 절벽 경계에 탈출 가능한 충돌 칸이 있다', () => {
  const farmFence = blockedBoundaryCells({ left: 27, right: 31, top: 38, bottom: 42 });
  const cliffs = blockedBoundaryCells({ left: 27, right: 47, top: 14, bottom: 32 });

  assert.ok(farmFence.some(({ row }) => row === 38), '밭 북측 레일 충돌 칸');
  assert.ok(cliffs.length > 0, '절벽 포켓 경계 충돌 칸');
});

test('비보행 경계에 걸린 시작점도 인접 보행 칸으로 탈출한다', () => {
  const regions = [
    blockedBoundaryCells({ left: 27, right: 31, top: 38, bottom: 42 }),
    blockedBoundaryCells({ left: 27, right: 47, top: 14, bottom: 32 }),
  ];

  for (const cells of regions) {
    for (const cell of cells) {
      const from = tileCenter(cell);
      const desired = tileCenter(walkableNeighbors(cell)[0]);
      const destination = findWalkableDestination(from, desired);

      assert.equal(isWalkableWorld(destination.x, destination.y), true, `탈출 종료 ${cell.col},${cell.row}`);
      assert.deepEqual(destination, desired, `인접 칸 탈출 ${cell.col},${cell.row}`);
    }
  }
});

test('장애물을 탭하면 막히기 직전 보행 지점까지 부분 이동한다', () => {
  const from = tileCenter({ col: 29, row: 37 });
  const desired = tileCenter({ col: 29, row: 39 });
  const destination = findWalkableDestination(from, desired);

  assert.equal(isWalkableWorld(destination.x, destination.y), true);
  assert.ok(destination.y > from.y, '울타리 앞까지 전진');
  assert.ok(destination.y < desired.y, '울타리를 통과하지 않음');
  assert.deepEqual(resolveTapFeedback(desired, destination), {
    kind: 'blocked',
    point: desired,
  });
});

test('보행 가능한 목적지 탭은 실제 도착점에 도착 피드백을 준다', () => {
  const from = tileCenter({ col: 29, row: 37 });
  const desired = tileCenter({ col: 28, row: 37 });
  const destination = findWalkableDestination(from, desired);

  assert.deepEqual(resolveTapFeedback(desired, destination), {
    kind: 'destination',
    point: destination,
  });
});

test('물·절벽 탭 피드백은 보행 종료점이 아니라 누른 지점을 가리킨다', () => {
  const from = tileCenter({ col: 29, row: 37 });
  const blockedCell = blockedBoundaryCells({ left: 27, right: 31, top: 38, bottom: 42 })[0];
  assert.ok(blockedCell);
  const blockedTap = tileCenter(blockedCell);
  const destination = findWalkableDestination(from, blockedTap);
  const feedback = resolveTapFeedback(blockedTap, destination);

  assert.equal(isWalkableWorld(feedback.point.x, feedback.point.y), false);
  assert.deepEqual(feedback, { kind: 'blocked', point: blockedTap });
});

test('절벽 모서리를 스치는 직선 트윈도 도중에 비보행 칸을 지나지 않는다', () => {
  // 정수 시작점이어도 1px 샘플 사이의 짧은 절벽 포켓을 통과하던 실충돌 회귀 좌표다.
  const from = { x: 771, y: 369 };
  const destination = findWalkableDestination(from, { x: 736, y: 358 });
  const distance = Math.hypot(destination.x - from.x, destination.y - from.y);
  const steps = Math.ceil(distance / 0.01);

  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    const point = {
      x: from.x + (destination.x - from.x) * ratio,
      y: from.y + (destination.y - from.y) * ratio,
    };
    assert.equal(isWalkableWorld(point.x, point.y), true, `트윈 중단 지점 ${step}/${steps}`);
  }
});

test('밭 울타리·절벽 경계 근방 무작위 탭의 종료 위치는 항상 보행 가능하다', () => {
  const random = seededRandom(0x7_10_2026);
  const regions: readonly GridBounds[] = [
    { left: 25, right: 33, top: 36, bottom: 44 },
    { left: 25, right: 49, top: 12, bottom: 34 },
  ];
  const trappedStarts = regions.flatMap(blockedBoundaryCells);
  assert.ok(trappedStarts.length > 0);

  for (let index = 0; index < 400; index += 1) {
    const cell = trappedStarts[Math.floor(random() * trappedStarts.length)];
    const from = {
      x: (cell.col + 0.05 + random() * 0.9) * MAP_TILE_SIZE,
      y: (cell.row + 0.05 + random() * 0.9) * MAP_TILE_SIZE,
    };
    const desired = {
      x: random() * MAP_COLS * MAP_TILE_SIZE,
      y: random() * MAP_ROWS * MAP_TILE_SIZE,
    };
    const destination = findWalkableDestination(from, desired);

    assert.equal(
      isWalkableWorld(destination.x, destination.y),
      true,
      `seeded tap ${index}: (${from.x}, ${from.y}) -> (${desired.x}, ${desired.y})`,
    );
  }
});
