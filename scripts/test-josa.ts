import assert from 'node:assert/strict';
import { withJosa } from '../src/lib/josa';

const cases: Array<[string, Parameters<typeof withJosa>[1], string]> = [
  ['서연', '이/가', '서연이'],
  ['민수', '이/가', '민수가'],
  ['Alex', '이/가', 'Alex(이)가'],
  ['철수', '을/를', '철수를'],
  ['수민', '을/를', '수민을'],
  ['지원', '은/는', '지원은'],
  ['유나', '은/는', '유나는'],
  ['민수', '으로/로', '민수로'],
  ['지원', '으로/로', '지원으로'],
  ['길', '으로/로', '길로'],
  ['서울', '으로/로', '서울로'],
  ['방울', '으로/로', '방울로'],
  ['철수', '와/과', '철수와'],
  ['수민', '와/과', '수민과'],
  ['하늘', '이/가', '하늘이'],
  ['바다', '이/가', '바다가'],
  ['꽃', '을/를', '꽃을'],
  ['나무', '을/를', '나무를'],
  ['봄', '은/는', '봄은'],
  ['여름', '와/과', '여름과'],
  ['Mia', '을/를', 'Mia(을)를'],
  ['도윤', '의', '도윤의'],
  ['Alex', '의', 'Alex의'],
  ['하준', '에게', '하준에게'],
  ['민수', '에게', '민수에게'],
];

for (const [name, particle, expected] of cases) {
  assert.strictEqual(withJosa(name, particle), expected);
}

console.log(`OK ${cases.length}/${cases.length}`);
