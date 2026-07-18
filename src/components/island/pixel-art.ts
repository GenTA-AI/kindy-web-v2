import { BODY_COLORS, type BodyColorId } from '@/lib/world/world-state';
import type { FurnitureId } from '@/lib/island/island-state';

/**
 * 등대섬 도트 픽셀아트 정의 (docs/plan/11 도트 전환) — Phaser 비의존 순수 모듈.
 * 문자 격자(Pix)로 스프라이트를 그리고, Phaser 텍스처(island-game)와 React 툴바 아이콘
 * (pixToDataUrl)이 같은 정의를 공유한다. 몸색은 팔레트 스왑으로 커스터마이즈.
 */

export const TILE = 16;

export type Pal = Record<string, string>;

export class Pix {
  readonly w: number;
  readonly h: number;
  readonly g: string[][];
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.g = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  }
  set(x: number, y: number, c: string) {
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.g[y][x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) this.set(x + i, y + j, c);
  }
  hline(x: number, y: number, w: number, c: string) {
    this.rect(x, y, w, 1, c);
  }
  // 현재 실루엣 바깥 1px 을 c 로 둘러싼다(도트 아웃라인).
  outline(c: string) {
    const src = this.g.map((r) => r.slice());
    const solid = (x: number, y: number) =>
      x >= 0 && x < this.w && y >= 0 && y < this.h && src[y][x] !== '.';
    for (let y = 0; y < this.h; y += 1)
      for (let x = 0; x < this.w; x += 1) {
        if (src[y][x] !== '.') continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) this.g[y][x] = c;
      }
  }
}

// 공용 팔레트(단색 키). 아바타 몸색 B/b 는 스왑.
export const PAL: Pal = {
  o: '#2b2620', e: '#2b2620', W: '#ffffff',
  s: '#5f8f5f', S: '#84c07a', p: '#eb93a6', m: '#b4574c',
  G: '#8bbf68', g: '#74a854', t: '#5f9146',
  A: '#e7d0a1', a: '#d3b985',
  C: '#4ea6cc', c: '#84ccea', D: '#3f8fb5',
  P: '#cdb074', Q: '#b1935a',
  L: '#f4efe4', R: '#c9573f', Y: '#ffe07a', K: '#3a3330',
  H: '#c08a58', h: '#9a6b3f', N: '#5b3f27',
  q: '#bfe6d6', k: '#8fc7b4',
  u: '#c98b6a', U: '#a86f4f',
  v: '#6aa06a', V: '#4d7d4d', w: '#caa46a',
  '1': '#d98a8a', '2': '#8ab0d8', '3': '#e0c56a',
  z: '#f3b4c8', Z: '#e389a6',
};

export function bodyPalette(bodyId: BodyColorId | null): Pal {
  const color = BODY_COLORS.find((c) => c.id === bodyId) ?? BODY_COLORS.find((c) => c.id === 'mint')!;
  return { ...PAL, B: color.base, b: color.dark };
}

/* ── 아바타 도트(20×22, 4방향 × 2프레임) ────────────────────────────── */

function avatarBlob(pix: Pix) {
  const rows: Array<[number, number]> = [
    [7, 6], [6, 8], [5, 10], [4, 12], [4, 12], [4, 12], [4, 12], [4, 12], [5, 10], [5, 10], [6, 8], [7, 6],
  ];
  rows.forEach(([x, w], i) => pix.hline(x, 3 + i, w, 'B'));
  pix.hline(6, 14, 8, 'b'); // 아랫배 그림자
}

function avatarFeet(pix: Pix, frame: number) {
  if (frame === 0) {
    pix.rect(6, 15, 3, 3, 'B');
    pix.rect(11, 15, 3, 3, 'B');
  } else {
    pix.rect(6, 16, 3, 3, 'B');
    pix.rect(11, 14, 3, 3, 'B');
  }
}

function avatarSprout(pix: Pix) {
  pix.set(9, 1, 's');
  pix.set(9, 2, 's');
  pix.set(8, 0, 'S');
  pix.set(7, 1, 'S');
  pix.set(10, 0, 'S');
  pix.set(11, 1, 'S');
}

export function drawAvatarDown(frame: number): Pix {
  const p = new Pix(20, 22);
  avatarBlob(p);
  avatarFeet(p, frame);
  avatarSprout(p);
  p.outline('o');
  p.rect(6, 8, 2, 2, 'e');
  p.rect(11, 8, 2, 2, 'e');
  p.set(6, 8, 'W');
  p.set(11, 8, 'W');
  p.set(5, 10, 'p');
  p.set(14, 10, 'p');
  p.rect(9, 11, 2, 1, 'm');
  return p;
}

export function drawAvatarSide(frame: number): Pix {
  const p = new Pix(20, 22);
  avatarBlob(p);
  if (frame === 0) {
    p.rect(7, 15, 3, 3, 'B');
    p.rect(11, 16, 3, 3, 'B');
  } else {
    p.rect(7, 16, 3, 3, 'B');
    p.rect(11, 15, 3, 3, 'B');
  }
  avatarSprout(p);
  p.outline('o');
  p.rect(11, 8, 2, 2, 'e'); // 오른쪽을 보는 한쪽 눈
  p.set(11, 8, 'W');
  p.set(14, 10, 'p');
  p.rect(13, 11, 2, 1, 'm');
  return p;
}

export function drawAvatarUp(frame: number): Pix {
  const p = new Pix(20, 22);
  avatarBlob(p);
  avatarFeet(p, frame);
  avatarSprout(p);
  p.outline('o');
  p.hline(8, 7, 4, 'b'); // 뒤통수 음영(눈 없음)
  return p;
}

/* ── 타일 도트(16×16) ───────────────────────────────────────────────── */

export function tileGrass(): Pix {
  const p = new Pix(TILE, TILE);
  p.rect(0, 0, TILE, TILE, 'G');
  [[3, 4], [10, 6], [6, 11], [12, 12], [8, 3]].forEach(([x, y]) => {
    p.set(x, y, 't');
    p.set(x + 1, y, 'g');
  });
  return p;
}

export function tileSand(): Pix {
  const p = new Pix(TILE, TILE);
  p.rect(0, 0, TILE, TILE, 'A');
  [[4, 5], [11, 8], [7, 12], [13, 3], [2, 10]].forEach(([x, y]) => p.set(x, y, 'a'));
  return p;
}

export function tileSea(frame: number): Pix {
  const p = new Pix(TILE, TILE);
  p.rect(0, 0, TILE, TILE, 'C');
  const off = frame === 0 ? 0 : 6;
  p.hline((2 + off) % 12, 4, 4, 'c');
  p.hline((9 + off) % 12, 9, 3, 'c');
  p.hline((5 + off) % 12, 12, 3, 'D');
  return p;
}

export function tilePath(): Pix {
  const p = new Pix(TILE, TILE);
  p.rect(0, 0, TILE, TILE, 'P');
  [[3, 3], [9, 6], [6, 10], [12, 12], [5, 13]].forEach(([x, y]) => p.set(x, y, 'Q'));
  return p;
}

/* ── 지물 도트 ──────────────────────────────────────────────────────── */

export function spriteLighthouse(): Pix {
  const p = new Pix(14, 30);
  p.rect(4, 24, 6, 4, 'K'); // 받침
  p.rect(3, 8, 8, 17, 'L'); // 탑
  p.rect(3, 11, 8, 3, 'R'); // 붉은 띠
  p.rect(3, 18, 8, 3, 'R');
  p.rect(4, 3, 6, 5, 'K'); // 등실
  p.rect(5, 4, 4, 3, 'Y'); // 램프(기본)
  p.rect(4, 1, 6, 2, 'K'); // 지붕
  p.outline('o');
  return p;
}

export function spriteCabin(): Pix {
  const p = new Pix(24, 18);
  p.rect(3, 7, 18, 10, 'H'); // 벽
  for (let i = 0; i < 10; i += 1) p.hline(11 - i, 7 - i, 2 + i * 2, 'h'); // 지붕(삼각)
  p.rect(9, 11, 5, 6, 'N'); // 문
  p.set(12, 14, 'Y');
  p.outline('o');
  return p;
}

export function spriteBottle(): Pix {
  const p = new Pix(10, 14);
  p.rect(3, 2, 4, 3, 'N'); // 코르크
  p.rect(2, 4, 6, 9, 'q'); // 병
  p.rect(3, 6, 4, 5, 'A'); // 편지
  p.set(3, 5, 'k');
  p.outline('o');
  return p;
}

export function spriteFurniture(id: FurnitureId): Pix {
  const p = new Pix(14, 12);
  switch (id) {
    case 'sofa':
      p.rect(1, 4, 12, 6, 'u');
      p.rect(1, 3, 2, 6, 'U');
      p.rect(11, 3, 2, 6, 'U');
      p.rect(3, 3, 8, 2, 'U');
      break;
    case 'plant':
      p.rect(4, 8, 6, 4, 'w');
      p.rect(5, 2, 4, 6, 'v');
      p.set(4, 4, 'V');
      p.set(9, 3, 'V');
      p.set(6, 1, 'v');
      break;
    case 'chair':
      p.rect(4, 1, 2, 10, 'w');
      p.rect(4, 6, 7, 2, 'w');
      p.rect(9, 6, 2, 5, 'w');
      break;
    case 'books':
      p.rect(2, 3, 10, 7, 'w');
      p.rect(3, 4, 2, 5, '1');
      p.rect(6, 4, 2, 5, '2');
      p.rect(9, 4, 2, 5, '3');
      break;
    case 'flowers':
      p.rect(2, 8, 10, 3, 'V');
      p.set(4, 5, 'z');
      p.set(4, 4, 'Z');
      p.set(7, 6, 'Z');
      p.set(10, 5, 'z');
      p.set(10, 4, 'Z');
      break;
    case 'lamp':
      p.rect(6, 4, 2, 7, 'w');
      p.rect(4, 1, 6, 3, 'Y');
      p.set(3, 2, 'Y');
      p.set(10, 2, 'Y');
      break;
  }
  p.outline('o');
  return p;
}

/* ── React 툴바용: Pix → 정수배 확대 PNG data URL(스무딩 없음, 캐시) ──── */

function pixToDataUrl(pix: Pix, pal: Pal, scale: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = pix.w * scale;
  canvas.height = pix.h * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  for (let y = 0; y < pix.h; y += 1)
    for (let x = 0; x < pix.w; x += 1) {
      const col = pal[pix.g[y][x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  return canvas.toDataURL();
}

const furnitureUrlCache: Partial<Record<FurnitureId, string>> = {};

export function furnitureDataUrl(id: FurnitureId): string {
  return (furnitureUrlCache[id] ??= pixToDataUrl(spriteFurniture(id), PAL, 4));
}
