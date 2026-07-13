import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AVATAR_COMBINATIONS,
  EMPTY_WORLD,
  REGIONS,
  isRegionDone,
  isRegionUnlocked,
  parseWorld,
  serializeWorld,
  withAvatar,
  withLessonComplete,
  type RegionDef,
} from './world-state';

function region(id: string): RegionDef {
  const found = REGIONS.find((r) => r.id === id);
  assert.ok(found, `region ${id} exists`);
  return found;
}

test('parseWorld: null/손상 입력은 빈 세계로 폴백', () => {
  assert.deepEqual(parseWorld(null), EMPTY_WORLD);
  assert.deepEqual(parseWorld('not json {'), EMPTY_WORLD);
  assert.deepEqual(parseWorld('42'), EMPTY_WORLD);
});

test('parseWorld: 유효 아바타·완료목록을 정규화하고 중복 제거', () => {
  const raw = JSON.stringify({
    v: 1,
    avatar: { body: 'sky', eyes: 'sparkle', accessory: 'star' },
    completed: ['seurat-01', 'seurat-01'],
  });
  assert.deepEqual(parseWorld(raw), {
    v: 1,
    avatar: { body: 'sky', eyes: 'sparkle', accessory: 'star' },
    completed: ['seurat-01'],
  });
});

test('parseWorld: 알 수 없는 옵션의 아바타는 버린다', () => {
  const raw = JSON.stringify({ avatar: { body: 'neon', eyes: 'round', accessory: 'sprout' } });
  assert.equal(parseWorld(raw).avatar, null);
});

test('withLessonComplete: 추가·멱등', () => {
  const once = withLessonComplete(EMPTY_WORLD, 'seurat-01');
  assert.deepEqual(once.completed, ['seurat-01']);
  const twice = withLessonComplete(once, 'seurat-01');
  assert.equal(twice, once); // 이미 있으면 동일 참조 반환
});

test('withAvatar: 아바타만 교체하고 완료목록 보존', () => {
  const base = withLessonComplete(EMPTY_WORLD, 'seurat-01');
  const next = withAvatar(base, { body: 'rose', eyes: 'curve', accessory: 'ribbon' });
  assert.deepEqual(next.avatar, { body: 'rose', eyes: 'curve', accessory: 'ribbon' });
  assert.deepEqual(next.completed, ['seurat-01']);
});

test('지역 잠금: ①은 처음부터 열림, ②는 seurat-01 완료 후, ③은 늘 잠김', () => {
  const grandeJatte = region('grande-jatte');
  const seville = region('seville');
  const misty = region('misty-vale');

  assert.equal(isRegionUnlocked(grandeJatte, EMPTY_WORLD), true);
  assert.equal(isRegionUnlocked(seville, EMPTY_WORLD), false);
  assert.equal(isRegionUnlocked(misty, EMPTY_WORLD), false);

  const afterSeurat = withLessonComplete(EMPTY_WORLD, 'seurat-01');
  assert.equal(isRegionUnlocked(seville, afterSeurat), true);
  assert.equal(isRegionDone(grandeJatte, afterSeurat), true);
  // ③은 존재하지 않는 수업을 요구하므로 데모 내내 잠김 유지.
  assert.equal(isRegionUnlocked(misty, afterSeurat), false);
});

test('serializeWorld ↔ parseWorld 라운드트립', () => {
  const save = withAvatar(withLessonComplete(EMPTY_WORLD, 'seurat-01'), {
    body: 'lemon',
    eyes: 'round',
    accessory: 'glasses',
  });
  assert.deepEqual(parseWorld(serializeWorld(save)), save);
});

test('아바타 조합 수 = 6 × 3 × 4 = 72', () => {
  assert.equal(AVATAR_COMBINATIONS, 72);
});
