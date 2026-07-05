import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPTY_WORLD_STATE,
  NEUTRAL_WORLD_STATE_DIGEST,
  checkContinuity,
  foldWorldState,
  neutralizeWorldStateForContinuity,
  type WorldState,
  type WorldStateEvent,
} from './world-state';

function storyChoiceHelp(overrides: Partial<WorldStateEvent> = {}): WorldStateEvent {
  return {
    event_type: 'story_choice',
    ep: 3,
    response_payload: {
      node: 'CP1',
      choice: 'help_bo',
      prosocial: 'help',
      character_id: 'bo',
      open_thread: {
        id: 'bo_promise',
        desc: 'Bo promised to return the favor',
        opened_ep: 3,
        resolve_by_ep: 6,
      },
    },
    ...overrides,
  };
}

function expressionSaved(overrides: Partial<WorldStateEvent> = {}): WorldStateEvent {
  return {
    event_type: 'expression_saved',
    ep: 4,
    response_payload: {
      template_id: 'T7',
      item_id: 'rainbow_lantern',
      name: 'Rainbow Lantern',
      asset_ref: 'asset://rainbow-lantern',
    },
    ...overrides,
  };
}

function withCompanion(namedByChild: string): WorldState {
  return {
    ...EMPTY_WORLD_STATE,
    companion: {
      id: 'mori',
      named_by_child: namedByChild,
    },
  };
}

test('① "helped 관계 캐릭터가 적대적으로 재등장"', () => {
  const worldState = foldWorldState([storyChoiceHelp()]);

  assert.deepEqual(worldState.characters_met, [
    {
      id: 'bo',
      relation: 'helped',
      ep: 3,
      choice_node: 'CP1',
    },
  ]);
  assert.deepEqual(worldState.open_threads, [
    {
      id: 'bo_promise',
      desc: 'Bo promised to return the favor',
      opened_ep: 3,
      resolve_by_ep: 6,
    },
  ]);

  const rejections = checkContinuity(
    {
      ep: 4,
      characters: [{ id: 'bo', relation: 'hostile' }],
    },
    worldState,
  );

  assert.deepEqual(rejections.map((rejection) => rejection.code), ['relation_conflict']);
});

test('② "open_thread 기한 도과 미회수"', () => {
  const worldState = foldWorldState([storyChoiceHelp()]);
  const rejections = checkContinuity(
    {
      ep: 7,
      resolved_thread_ids: [],
    },
    worldState,
  );

  assert.deepEqual(rejections.map((rejection) => rejection.code), ['open_thread_overdue']);
});

test('③ "발명 아이템 존재 부정 대사"', () => {
  const worldState = foldWorldState([expressionSaved()]);
  const rejections = checkContinuity(
    {
      ep: 5,
      item_mentions: [{ id: 'rainbow_lantern', denies_existence: true }],
    },
    worldState,
  );

  assert.deepEqual(worldState.items_invented, [
    {
      id: 'rainbow_lantern',
      name: 'Rainbow Lantern',
      ep: 4,
      asset_ref: 'asset://rainbow-lantern',
    },
  ]);
  assert.deepEqual(rejections.map((rejection) => rejection.code), ['item_existence_denied']);
});

test('④ "미방문 지명을 다시 왔다고 서술"', () => {
  const rejections = checkContinuity(
    {
      ep: 2,
      place_mentions: [{ id: 'cloud_cave', revisit: true }],
    },
    EMPTY_WORLD_STATE,
  );

  assert.deepEqual(rejections.map((rejection) => rejection.code), ['place_revisit_without_visit']);
});

test('⑤ "단짝 이름 오기" (avatars.companion_name 불일치)', () => {
  const rejections = checkContinuity(
    {
      ep: 3,
      companion_name: 'Mori',
    },
    withCompanion('Bori'),
  );

  assert.deepEqual(rejections.map((rejection) => rejection.code), ['companion_name_mismatch']);
});

test('⑥ "기한 내 스레드 회수"', () => {
  const worldState = foldWorldState([storyChoiceHelp()]);
  const rejections = checkContinuity(
    {
      ep: 6,
      resolved_thread_ids: ['bo_promise'],
    },
    worldState,
  );

  assert.deepEqual(rejections, []);
});

test('⑦ "아이템 자연 재등장"', () => {
  const worldState = foldWorldState([expressionSaved()]);
  const rejections = checkContinuity(
    {
      ep: 5,
      item_mentions: [{ id: 'rainbow_lantern', appears: true }],
    },
    worldState,
  );

  assert.deepEqual(rejections, []);
});

test('⑧ "신규 캐릭터 도입"', () => {
  const worldState = foldWorldState([
    storyChoiceHelp(),
    {
      event_type: 'episode_completed',
      ep: 4,
      response_payload: { place_id: 'rainbow_bridge' },
    },
  ]);
  const rejections = checkContinuity(
    {
      ep: 4,
      characters: [{ id: 'nari', relation: 'new_friend' }],
    },
    worldState,
  );

  assert.equal(worldState.version, 2);
  assert.deepEqual(worldState.places_visited, ['rainbow_bridge']);
  assert.deepEqual(rejections, []);
});

test('⑨ "world_state 공백(신규 가입)→중립판 통과"', () => {
  const noResponse = foldWorldState([
    {
      event_type: 'story_choice',
      ep: 1,
      response_payload: {
        node: 'CP0',
        choice: 'timeout',
        prosocial: 'help',
        character_id: 'nari',
        timeout_default: true,
      },
    },
  ]);
  const worldState = neutralizeWorldStateForContinuity(null);
  const rejections = checkContinuity(
    {
      ep: 1,
      characters: [{ id: 'nari', relation: 'new_friend' }],
    },
    worldState,
  );

  assert.deepEqual(noResponse, EMPTY_WORLD_STATE);
  assert.equal(worldState.digest, NEUTRAL_WORLD_STATE_DIGEST);
  assert.deepEqual(rejections, []);
});

test('⑩ "digest 실패 폴백→중립판 통과"', () => {
  const original = foldWorldState([storyChoiceHelp()]);
  const neutral = neutralizeWorldStateForContinuity(original);
  const rejections = checkContinuity(
    {
      ep: 7,
      characters: [{ id: 'bo', relation: 'hostile' }],
    },
    neutral,
  );

  assert.equal(neutral.digest, NEUTRAL_WORLD_STATE_DIGEST);
  assert.deepEqual(neutral.characters_met, []);
  assert.deepEqual(neutral.open_threads, []);
  assert.deepEqual(rejections, []);
});
