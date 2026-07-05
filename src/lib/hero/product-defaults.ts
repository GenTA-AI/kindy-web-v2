export type AgeBand = 5 | 6 | 7;

export type WorkshopMode = 'tap' | 'tap_drag_exp';

export type ProductDefaultsRow = {
  age_band: AgeBand;
  session_len_min: number;
  cp_options: number;
  cp_lead_count: number;
  tts_rate: number;
  workshop_mode: WorkshopMode;
  refresh_points: number;
};

export const PRODUCT_DEFAULTS: ProductDefaultsRow[] = [
  {
    age_band: 5,
    session_len_min: 14,
    cp_options: 2,
    cp_lead_count: 2,
    tts_rate: 0.9,
    workshop_mode: 'tap',
    refresh_points: 6,
  },
  {
    age_band: 6,
    session_len_min: 17,
    cp_options: 2,
    cp_lead_count: 1,
    tts_rate: 1.0,
    workshop_mode: 'tap',
    refresh_points: 5,
  },
  {
    age_band: 7,
    session_len_min: 20,
    cp_options: 3,
    cp_lead_count: 0,
    tts_rate: 1.0,
    workshop_mode: 'tap_drag_exp',
    refresh_points: 5,
  },
];

export const PRODUCT_DEFAULTS_BY_AGE_BAND: Record<AgeBand, ProductDefaultsRow> = {
  5: PRODUCT_DEFAULTS[0],
  6: PRODUCT_DEFAULTS[1],
  7: PRODUCT_DEFAULTS[2],
};
