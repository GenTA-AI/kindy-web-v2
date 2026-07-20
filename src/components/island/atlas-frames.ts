import runtimeAtlas from '../../../public/island/tiles/runtime-atlas.json';

export type IslandAtlasName = 'avatar-parts' | 'character' | 'props';

interface AtlasMeta {
  frames: Record<string, { h: number; w: number; x: number; y: number }>;
  image: string;
  size: { h: number; w: number };
}

const ATLASES = runtimeAtlas as Readonly<Record<IslandAtlasName, AtlasMeta>>;

export function atlasFrameName(prefix: string, row: number, column: number): string {
  return `${prefix}__r${String(row).padStart(3, '0')}_c${String(column).padStart(3, '0')}`;
}

/** 생성된 atlas JSON을 정본으로 삼아 DOM 스프라이트의 위치를 계산한다. */
export function atlasFrameStyle(atlasName: IslandAtlasName, frameName: string, scale = 1) {
  const atlas = ATLASES[atlasName];
  const entry = atlas.frames[frameName];
  if (!entry || !Number.isInteger(scale) || scale < 1) return undefined;
  const frame = entry;

  return {
    width: frame.w * scale,
    height: frame.h * scale,
    backgroundImage: `url(/island/tiles/${atlas.image})`,
    backgroundPosition: `${-frame.x * scale}px ${-frame.y * scale}px`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${atlas.size.w * scale}px ${atlas.size.h * scale}px`,
    imageRendering: 'pixelated' as const,
  };
}

export function atlasHasFrame(atlasName: IslandAtlasName, frameName: string): boolean {
  return frameName in ATLASES[atlasName].frames;
}
