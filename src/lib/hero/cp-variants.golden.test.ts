import assert from 'node:assert/strict';
import test from 'node:test';

import { validateCpVariants, type BranchingScript, type CpOptionsVariants } from './cp-variants';

const branchingScript: BranchingScript = {
  start_node_id: 'S1',
  nodes: [
    { id: 'S1', type: 'segment', next: 'CP1' },
    {
      id: 'CP1',
      type: 'choice',
      timeout_default: 'a',
      options: [
        { id: 'a', next: 'S2a' },
        { id: 'b', next: 'S2b' },
        { id: 'c', next: 'S2b' },
      ],
    },
    { id: 'S2a', type: 'segment', next: 'END' },
    { id: 'S2b', type: 'segment', next: 'END' },
    { id: 'END', type: 'segment' },
  ],
};

test('⑫ CP 2택 서브셋: 진부분집합 + timeout_default 포함 + 도달성', () => {
  const validVariants: CpOptionsVariants = {
    CP1: { '2': ['a', 'b'], '3': ['a', 'b', 'c'] },
  };

  assert.deepEqual(validateCpVariants(branchingScript, validVariants), {
    ok: true,
    errors: [],
  });

  const invalidVariants: CpOptionsVariants = {
    CP1: { '2': ['b', 'c'], '3': ['a', 'b', 'c'] },
  };
  const invalid = validateCpVariants(branchingScript, invalidVariants);

  assert.equal(invalid.ok, false);
  assert.deepEqual(
    invalid.errors.map((error) => error.code),
    ['missing_timeout_default', 'unreachable_node'],
  );
});
