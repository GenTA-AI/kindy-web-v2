import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SUBSCRIPTION_LIST_DAILY_PRICE_KRW,
  SUBSCRIPTION_LIST_PRICE_KRW,
  SUBSCRIPTION_PRICE_KRW,
  formatKrw,
  formatKrwWithSymbol,
} from './subscription-pricing';

test('청구가와 정가 표시를 공유 가격 상수에서 포맷한다', () => {
  assert.equal(formatKrw(SUBSCRIPTION_PRICE_KRW), '24,900원');
  assert.equal(formatKrwWithSymbol(SUBSCRIPTION_PRICE_KRW), '₩24,900');
  assert.equal(formatKrw(SUBSCRIPTION_LIST_PRICE_KRW), '34,900원');
  assert.equal(formatKrw(SUBSCRIPTION_LIST_DAILY_PRICE_KRW), '1,163원');
});
