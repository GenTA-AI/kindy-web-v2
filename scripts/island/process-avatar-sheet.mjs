/**
 * 등대섬 아바타 스프라이트시트 가공 (docs/plan/11 I1).
 * 입력: 크로마 그린 배경의 4행×4열 캐릭터 시트(모리스튜디오 PoC).
 * 처리: 그린 스크린 제거(그린 비율 키) + 그린 스필 억제 + 512×512 다운스케일 →
 *       public/island/avatar-sheet.png (프레임 128×128, row0=down/1=left/2=right/3=up).
 *
 * 실행: node scripts/island/process-avatar-sheet.mjs [입력경로]
 * 본 스크립트는 자산 생성 절차의 기록용 — 산출 PNG 는 public/ 에 커밋한다.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const DEFAULT_INPUT = '/Users/jongwonlee/dev/mori-studio/out/poc/sprite-cand-1.png';
const OUT_SIZE = 512; // 출력 시트 한 변(프레임 128px)

const input = process.argv[2] ?? DEFAULT_INPUT;
const outPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../public/island/avatar-sheet.png',
);

// 그린 정도 = g 가 r,b 최댓값을 얼마나 초과하는가.
// 배경(채도 높은 순수 그린)은 큰 값, 파스텔 민트 몸통은 작은 값 → 분리된다.
const BG_CUT = 60; // 이상이면 완전 투명(배경/그림자)
const EDGE_CUT = 28; // 이 사이는 반투명 경계 + 그린 스필 억제

async function main() {
  const src = sharp(input).ensureAlpha();
  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.from(data);

  for (let i = 0; i < out.length; i += channels) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const greenness = g - Math.max(r, b);

    if (greenness >= BG_CUT) {
      out[i + 3] = 0;
    } else if (greenness > EDGE_CUT) {
      // 경계 픽셀 — 알파 페이드 + 초록기 눌러 프린지 제거.
      const t = (BG_CUT - greenness) / (BG_CUT - EDGE_CUT); // 1(불투명)→0(투명)
      out[i + 3] = Math.round(255 * t);
      out[i + 1] = Math.max(r, b);
    }
  }

  await sharp(out, { raw: { width, height, channels } })
    .resize(OUT_SIZE, OUT_SIZE, { fit: 'fill' })
    .png()
    .toFile(outPath);

  console.log(`wrote ${outPath} (${OUT_SIZE}x${OUT_SIZE}, frame ${OUT_SIZE / 4}px)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
