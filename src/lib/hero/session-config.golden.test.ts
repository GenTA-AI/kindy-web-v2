import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRODUCT_DEFAULTS,
  type AgeBand,
  type ProductDefaultsRow,
} from './product-defaults';
import { resolveSessionConfig } from './session-config';

const EXPECTED_DEFAULTS_BY_AGE_BAND: Record<AgeBand, ProductDefaultsRow> = {
  5: {
    age_band: 5,
    session_len_min: 14,
    cp_options: 2,
    cp_lead_count: 2,
    tts_rate: 0.9,
    workshop_mode: 'tap',
    refresh_points: 6,
  },
  6: {
    age_band: 6,
    session_len_min: 17,
    cp_options: 2,
    cp_lead_count: 1,
    tts_rate: 1.0,
    workshop_mode: 'tap',
    refresh_points: 5,
  },
  7: {
    age_band: 7,
    session_len_min: 20,
    cp_options: 3,
    cp_lead_count: 0,
    tts_rate: 1.0,
    workshop_mode: 'tap_drag_exp',
    refresh_points: 5,
  },
};

test('⑪ 연령 기본값 3밴드 + control 기본값 + 콜드스타트 gentle', () => {
  const asOf = '2026-07';
  const cases: Array<{ birthYm: string; ageBand: AgeBand }> = [
    { birthYm: '2021-07', ageBand: 5 },
    { birthYm: '2020-07', ageBand: 6 },
    { birthYm: '2019-07', ageBand: 7 },
  ];

  assert.deepEqual(PRODUCT_DEFAULTS, [
    EXPECTED_DEFAULTS_BY_AGE_BAND[5],
    EXPECTED_DEFAULTS_BY_AGE_BAND[6],
    EXPECTED_DEFAULTS_BY_AGE_BAND[7],
  ]);

  for (const fixture of cases) {
    const result = resolveSessionConfig(
      fixture.birthYm,
      PRODUCT_DEFAULTS,
      'control',
      undefined,
      asOf,
    );

    assert.deepEqual(result, {
      age_band: fixture.ageBand,
      defaults: EXPECTED_DEFAULTS_BY_AGE_BAND[fixture.ageBand],
      holdout_arm: 'control',
      mood_preset: 'gentle',
    });
  }
});
