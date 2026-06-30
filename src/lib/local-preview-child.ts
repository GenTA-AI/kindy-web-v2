import type { Child } from '@/types';

export const LOCAL_PREVIEW_CHILD_ID = 'local-preview-child';
export const LOCAL_PREVIEW_PARENT_ID = 'local-preview-parent';
export const LOCAL_PREVIEW_CHILD_COOKIE = 'kindy_preview_child';
export const LOCAL_PREVIEW_CHILD_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const DEFAULT_STYLES = ['story_forest'];
const DEFAULT_TOPICS = ['future_skills'];

export const DEFAULT_LOCAL_PREVIEW_CHILD: Child = {
  id: LOCAL_PREVIEW_CHILD_ID,
  name: '서연',
  age: 6,
  parent_id: LOCAL_PREVIEW_PARENT_ID,
  styles: DEFAULT_STYLES,
  topics: DEFAULT_TOPICS,
  created_at: '2026-06-29T00:00:00.000Z',
};

type LocalPreviewChildInput = Partial<Pick<Child, 'id' | 'name' | 'age' | 'parent_id' | 'styles' | 'topics' | 'created_at'>>;

function cleanName(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 40)
    : fallback;
}

function cleanAge(value: unknown, fallback: number): number {
  const age = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(age) && age >= 3 && age <= 8 ? age : fallback;
}

function cleanStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;

  const list = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);

  return list.length > 0 ? list : fallback;
}

export function normalizeLocalPreviewChild(input: LocalPreviewChildInput = {}): Child {
  return {
    id: cleanName(input.id, LOCAL_PREVIEW_CHILD_ID),
    name: cleanName(input.name, DEFAULT_LOCAL_PREVIEW_CHILD.name),
    age: cleanAge(input.age, DEFAULT_LOCAL_PREVIEW_CHILD.age),
    parent_id: cleanName(input.parent_id, LOCAL_PREVIEW_PARENT_ID),
    styles: cleanStringList(input.styles, DEFAULT_STYLES),
    topics: cleanStringList(input.topics, DEFAULT_TOPICS),
    created_at: cleanName(input.created_at, DEFAULT_LOCAL_PREVIEW_CHILD.created_at),
  };
}

export function serializeLocalPreviewChild(child: Child): string {
  return encodeURIComponent(JSON.stringify({
    name: child.name,
    age: child.age,
    styles: child.styles,
    topics: child.topics,
  }));
}

export function parseLocalPreviewChildCookie(value?: string | null): Child {
  if (!value) return DEFAULT_LOCAL_PREVIEW_CHILD;

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as LocalPreviewChildInput;
    return normalizeLocalPreviewChild(parsed);
  } catch {
    return DEFAULT_LOCAL_PREVIEW_CHILD;
  }
}
