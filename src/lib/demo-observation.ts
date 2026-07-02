import { C6_AXIS_IDS, type C6AxisId } from '@/lib/c6/axes';

export const DEMO_OBSERVATION_COOKIE_NAME = 'kindy_demo_observation';
export const DEMO_OBSERVATION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const AXIS_ID_SET = new Set<C6AxisId>(C6_AXIS_IDS);

export interface DemoObservationChoice {
  choiceId: string;
  optionId: string;
  axisId: C6AxisId;
}

export interface DemoObservationCookie {
  v: 1;
  choices: DemoObservationChoice[];
  strength_axis: C6AxisId;
  growth_axis: C6AxisId;
  created_at: string;
}

export function parseDemoObservationCookie(value: string | null | undefined): DemoObservationCookie | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown;
    if (!isObservationCookie(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function serializeDemoObservationCookie(observation: DemoObservationCookie): string {
  return encodeURIComponent(JSON.stringify(observation));
}

export function serializeDemoObservationDocumentCookie(observation: DemoObservationCookie): string {
  return [
    `${DEMO_OBSERVATION_COOKIE_NAME}=${serializeDemoObservationCookie(observation)}`,
    `Max-Age=${DEMO_OBSERVATION_COOKIE_MAX_AGE_SECONDS}`,
    'Path=/',
    'SameSite=Lax',
  ].join('; ');
}

function isObservationCookie(value: unknown): value is DemoObservationCookie {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;

  return (
    record.v === 1
    && Array.isArray(record.choices)
    && record.choices.every(isObservationChoice)
    && isAxisId(record.strength_axis)
    && isAxisId(record.growth_axis)
    && typeof record.created_at === 'string'
  );
}

function isObservationChoice(value: unknown): value is DemoObservationChoice {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;

  return (
    typeof record.choiceId === 'string'
    && record.choiceId.length > 0
    && typeof record.optionId === 'string'
    && record.optionId.length > 0
    && isAxisId(record.axisId)
  );
}

function isAxisId(value: unknown): value is C6AxisId {
  return typeof value === 'string' && AXIS_ID_SET.has(value as C6AxisId);
}
