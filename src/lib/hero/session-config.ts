import type { AgeBand, ProductDefaultsRow } from './product-defaults';

export type HoldoutArm = 'control' | string;

export type MoodStateInput = {
  mood_preset?: string | null;
} | string | null | undefined;

export type SessionConfig = {
  age_band: AgeBand;
  defaults: ProductDefaultsRow;
  holdout_arm: HoldoutArm;
  mood_preset: string;
};

function parseYearMonth(value: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid year-month value: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid year-month value: ${value}`);
  }

  return { year, month };
}

function asYearMonth(asOf: Date | string | undefined): { year: number; month: number } {
  if (typeof asOf === 'string') return parseYearMonth(asOf);
  const date = asOf ?? new Date();
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  };
}

export function resolveAgeBand(birthYm: string, asOf?: Date | string): AgeBand {
  const birth = parseYearMonth(birthYm);
  const current = asYearMonth(asOf);
  const age = current.year - birth.year - (current.month < birth.month ? 1 : 0);

  if (age <= 5) return 5;
  if (age >= 7) return 7;
  return 6;
}

function resolveMoodPreset(moodState: MoodStateInput): string {
  if (!moodState) return 'gentle';

  // TODO: implement GACS mood dictionary mapping when product spec §7 is fixed in R1.
  if (typeof moodState === 'string') return moodState || 'gentle';
  return moodState.mood_preset || 'gentle';
}

export function resolveSessionConfig(
  birthYm: string,
  defaultsRows: ProductDefaultsRow[],
  holdoutArm: HoldoutArm,
  moodState?: MoodStateInput,
  asOf?: Date | string,
): SessionConfig {
  const ageBand = resolveAgeBand(birthYm, asOf);
  const defaults = defaultsRows.find((row) => row.age_band === ageBand);

  if (!defaults) {
    throw new Error(`Missing product defaults for age band ${ageBand}`);
  }

  return {
    age_band: ageBand,
    defaults,
    holdout_arm: holdoutArm,
    mood_preset: resolveMoodPreset(moodState),
  };
}
