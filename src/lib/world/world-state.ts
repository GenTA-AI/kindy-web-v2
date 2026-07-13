/**
 * 이야기 지도(Story Atlas) 상태 모델 — 데모용 localStorage 스키마 (docs/plan/10 §6 W1).
 * 라이브 서버 상태(child_world_state)는 W2에서 신설. W1은 아바타 조합·지역 완료를
 * 브라우저 localStorage 한 벌('kindy:world')로만 시뮬레이션한다 — 개인 데이터 없음, 공개 페이지.
 * 순수 헬퍼(window 불필요)와 브라우저 래퍼를 분리해 로직만 단위 테스트한다.
 */

export const WORLD_STORAGE_KEY = 'kindy:world';
export const WORLD_SAVE_VERSION = 1;

export type BodyColorId = 'peach' | 'mint' | 'sky' | 'lavender' | 'lemon' | 'rose';
export type EyeStyleId = 'round' | 'curve' | 'sparkle';
export type AccessoryId = 'sprout' | 'ribbon' | 'star' | 'glasses';

export interface AvatarConfig {
  body: BodyColorId;
  eyes: EyeStyleId;
  accessory: AccessoryId;
}

export interface WorldSave {
  v: number;
  /** 아바타 미생성이면 null — /world 첫 방문 시 만들기 화면으로 유도. */
  avatar: AvatarConfig | null;
  /** 완료한 수업 id 목록(예: ['seurat-01']). 지역 잠금 해제·완료 판정의 근거. */
  completed: string[];
}

export interface BodyColor {
  id: BodyColorId;
  label: string;
  /** 말랑한 3D 토이 하이라이트→베이스→그림자 (몸통 radial-gradient 스톱). */
  light: string;
  base: string;
  dark: string;
}

export interface EyeStyle {
  id: EyeStyleId;
  label: string;
}

export interface Accessory {
  id: AccessoryId;
  label: string;
}

// 파스텔 6종 — 크림/세이지/골드 팔레트와 어울리는 채도. 성별 중립 구성.
export const BODY_COLORS: readonly BodyColor[] = [
  { id: 'peach', label: '복숭아', light: '#FFE3D1', base: '#FBC0A3', dark: '#E89B78' },
  { id: 'mint', label: '민트', light: '#D9F2E5', base: '#A9E0C8', dark: '#7FC3A6' },
  { id: 'sky', label: '하늘', light: '#DAEDFB', base: '#AFD6F5', dark: '#82B6E6' },
  { id: 'lavender', label: '라벤더', light: '#E9E2F8', base: '#CBBEEE', dark: '#A995DC' },
  { id: 'lemon', label: '레몬', light: '#FBF1CE', base: '#F5DE9A', dark: '#E7C56A' },
  { id: 'rose', label: '장미', light: '#FBDDE7', base: '#F3B4C8', dark: '#E389A6' },
];

export const EYE_STYLES: readonly EyeStyle[] = [
  { id: 'round', label: '동그란 눈' },
  { id: 'curve', label: '방긋 눈' },
  { id: 'sparkle', label: '반짝 눈' },
];

// 성별 고정관념 없는 4종.
export const ACCESSORIES: readonly Accessory[] = [
  { id: 'sprout', label: '새싹' },
  { id: 'ribbon', label: '리본' },
  { id: 'star', label: '별머리핀' },
  { id: 'glasses', label: '둥근안경' },
];

export const DEFAULT_AVATAR: AvatarConfig = { body: 'mint', eyes: 'round', accessory: 'sprout' };

export const AVATAR_COMBINATIONS = BODY_COLORS.length * EYE_STYLES.length * ACCESSORIES.length;

export const EMPTY_WORLD: WorldSave = { v: WORLD_SAVE_VERSION, avatar: null, completed: [] };

export type RegionThemeId = 'pointillism' | 'music' | 'fog';

export interface RegionDef {
  id: string;
  name: string;
  theme: RegionThemeId;
  /** 연결된 수업 id(없으면 null — 준비 중 지역). */
  lessonId: string | null;
  /** 이 수업이 완료돼야 잠금 해제(null이면 처음부터 열림). */
  requires: string | null;
  /** 지도 위 좌표 — 캔버스 너비/높이의 %(0..100). */
  pos: { x: number; y: number };
  /** 곡선 이동을 위한 중간 웨이포인트 1개. */
  waypoint: { x: number; y: number };
  /** 아이 눈높이 한 줄 소개. */
  blurb: string;
}

/** 아바타 출발 위치(지도 상단 홈 — 고정 헤더 아래로 내려 겹침 방지). */
export const AVATAR_HOME = { x: 50, y: 12 };

// 위→아래로 이어지는 지도: ① 그랑드 자트(열림) → ② 세빌리아(①완료 시) → ③ 안개(잠김).
export const REGIONS: readonly RegionDef[] = [
  {
    id: 'grande-jatte',
    name: '그랑드 자트 강가',
    theme: 'pointillism',
    lessonId: 'seurat-01',
    requires: null,
    pos: { x: 30, y: 24 },
    waypoint: { x: 60, y: 16 },
    blurb: '점으로 그린 강가로 놀러 가 볼까?',
  },
  {
    id: 'seville',
    name: '세빌리아 마을',
    theme: 'music',
    lessonId: null,
    requires: 'seurat-01',
    pos: { x: 70, y: 50 },
    waypoint: { x: 34, y: 37 },
    blurb: '노래가 들려오는 마을이야.',
  },
  {
    // 잠금 지역 — 실루엣만. requires 로 지정한 수업은 아직 없어 데모에서 늘 잠김.
    id: 'misty-vale',
    name: '???',
    theme: 'fog',
    lessonId: null,
    requires: 'seville-lesson',
    pos: { x: 40, y: 78 },
    waypoint: { x: 66, y: 64 },
    blurb: '아직 안개에 싸여 있어.',
  },
];

function isBodyColorId(value: unknown): value is BodyColorId {
  return BODY_COLORS.some((color) => color.id === value);
}

function isEyeStyleId(value: unknown): value is EyeStyleId {
  return EYE_STYLES.some((eye) => eye.id === value);
}

function isAccessoryId(value: unknown): value is AccessoryId {
  return ACCESSORIES.some((accessory) => accessory.id === value);
}

function normalizeAvatar(value: unknown): AvatarConfig | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (!isBodyColorId(record.body) || !isEyeStyleId(record.eyes) || !isAccessoryId(record.accessory)) {
    return null;
  }
  return { body: record.body, eyes: record.eyes, accessory: record.accessory };
}

function normalizeWorld(value: unknown): WorldSave {
  if (!value || typeof value !== 'object') return { ...EMPTY_WORLD };
  const record = value as Record<string, unknown>;
  const completed = Array.isArray(record.completed)
    ? Array.from(new Set(record.completed.filter((id): id is string => typeof id === 'string')))
    : [];
  return { v: WORLD_SAVE_VERSION, avatar: normalizeAvatar(record.avatar), completed };
}

/** 저장 문자열(또는 null)을 안전하게 파싱 — 손상/구버전이면 빈 세계로. */
export function parseWorld(raw: string | null): WorldSave {
  if (!raw) return { ...EMPTY_WORLD };
  try {
    return normalizeWorld(JSON.parse(raw));
  } catch {
    return { ...EMPTY_WORLD };
  }
}

export function serializeWorld(save: WorldSave): string {
  return JSON.stringify({ v: WORLD_SAVE_VERSION, avatar: save.avatar, completed: save.completed });
}

export function withLessonComplete(save: WorldSave, lessonId: string): WorldSave {
  if (save.completed.includes(lessonId)) return save;
  return { ...save, completed: [...save.completed, lessonId] };
}

export function withAvatar(save: WorldSave, avatar: AvatarConfig): WorldSave {
  return { ...save, avatar };
}

export function isRegionUnlocked(region: RegionDef, save: WorldSave): boolean {
  return region.requires === null || save.completed.includes(region.requires);
}

export function isRegionDone(region: RegionDef, save: WorldSave): boolean {
  return region.lessonId !== null && save.completed.includes(region.lessonId);
}

// ── 브라우저 래퍼 (window 없는 환경에선 무해하게 no-op) ──────────────────────

export function readWorld(): WorldSave {
  if (typeof window === 'undefined') return { ...EMPTY_WORLD };
  try {
    return parseWorld(window.localStorage.getItem(WORLD_STORAGE_KEY));
  } catch {
    return { ...EMPTY_WORLD };
  }
}

export function writeWorld(save: WorldSave): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WORLD_STORAGE_KEY, serializeWorld(save));
  } catch {
    /* localStorage 접근 불가(프라이빗 모드 등) — 데모 상태라 무시. */
  }
}

/** 수업 완료 마킹 — DocentLessonPlayer 완료 단계에서 호출(멱등). */
export function markLessonComplete(lessonId: string): WorldSave {
  const next = withLessonComplete(readWorld(), lessonId);
  writeWorld(next);
  return next;
}

export function saveAvatar(avatar: AvatarConfig): WorldSave {
  const next = withAvatar(readWorld(), avatar);
  writeWorld(next);
  return next;
}
