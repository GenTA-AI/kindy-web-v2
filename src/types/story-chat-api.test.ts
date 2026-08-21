import assert from 'node:assert/strict';
import test from 'node:test';

import {
  StoryChatMessagesQuerySchema,
  StoryChatTurnRequestSchema,
} from './story-chat-api';

const VALID_TURN = {
  kind: 'choice',
  child_id: '11111111-1111-4111-8111-111111111111',
  session_id: '22222222-2222-4222-8222-222222222222',
  client_turn_id: '33333333-3333-4333-8333-333333333333',
  expected_revision: 0,
  selection: { node_id: 'n.choice', option_id: 'option.watch' },
} as const;

test('turn request accepts only bounded UUID/revision/authored ID shapes', () => {
  assert.equal(StoryChatTurnRequestSchema.safeParse(VALID_TURN).success, true);

  for (const invalid of [
    { ...VALID_TURN, child_id: 'not-a-uuid' },
    { ...VALID_TURN, session_id: 'not-a-uuid' },
    { ...VALID_TURN, client_turn_id: 'not-a-uuid' },
    { ...VALID_TURN, expected_revision: -1 },
    { ...VALID_TURN, expected_revision: 0.5 },
    { ...VALID_TURN, expected_revision: Number.MAX_SAFE_INTEGER },
    { ...VALID_TURN, selection: { node_id: '../node', option_id: 'option.watch' } },
    { ...VALID_TURN, selection: { node_id: 'n.choice', option_id: '' } },
    { ...VALID_TURN, unexpected: true },
  ]) {
    assert.equal(StoryChatTurnRequestSchema.safeParse(invalid).success, false);
  }
});

test('free-text shape is bounded but the runtime remains responsible for fixed fallback', () => {
  const base = {
    kind: 'free_text',
    child_id: VALID_TURN.child_id,
    session_id: VALID_TURN.session_id,
    client_turn_id: VALID_TURN.client_turn_id,
    expected_revision: 0,
    node_id: 'n.prompt',
  } as const;

  assert.equal(
    StoryChatTurnRequestSchema.safeParse({ ...base, text: '내 생각' }).success,
    true,
  );
  assert.equal(
    StoryChatTurnRequestSchema.safeParse({ ...base, text: '가'.repeat(241) }).success,
    false,
  );
  assert.equal(
    StoryChatTurnRequestSchema.safeParse({ ...base, text: '   ' }).success,
    false,
  );
});

test('message cursor defaults safely and rejects malformed or unsafe values', () => {
  assert.deepEqual(
    StoryChatMessagesQuerySchema.parse({ child_id: VALID_TURN.child_id }),
    { child_id: VALID_TURN.child_id, after: 0 },
  );
  for (const after of ['-1', '1.5', 'not-a-number', String(Number.MAX_SAFE_INTEGER + 1)]) {
    assert.equal(
      StoryChatMessagesQuerySchema.safeParse({
        child_id: VALID_TURN.child_id,
        after,
      }).success,
      false,
    );
  }
});
