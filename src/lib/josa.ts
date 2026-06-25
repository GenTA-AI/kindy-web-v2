export type JosaParticle =
  | '이/가'
  | '을/를'
  | '은/는'
  | '으로/로'
  | '와/과'
  | '의'
  | '에게';

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

function hasBatchim(value: string): boolean | null {
  const jongseong = jongseongIndex(value);
  return jongseong === null ? null : jongseong !== 0;
}

function jongseongIndex(value: string): number | null {
  const last = value.trim().at(-1);
  if (!last) return null;
  const code = last.charCodeAt(0);
  if (code < HANGUL_START || code > HANGUL_END) return null;
  return (code - HANGUL_START) % 28;
}

export function withJosa(name: string, particle: JosaParticle): string {
  const batchim = hasBatchim(name);
  const parts = particle.split('/');
  // 의/에게는 받침 무관 -> non-Korean 이름도 폴백 불필요.
  if (parts.length === 1) return `${name}${particle}`;
  const [first, second] = parts;
  const [withFinal, withoutFinal] = particle === '와/과' ? [second, first] : [first, second];
  if (batchim === null) return `${name}(${first})${second}`;
  if (particle === '으로/로' && jongseongIndex(name) === 8) return `${name}${second}`;
  return `${name}${batchim ? withFinal : withoutFinal}`;
}
