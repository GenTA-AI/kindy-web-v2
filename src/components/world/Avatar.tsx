import { useId } from 'react';
import { BODY_COLORS, type AvatarConfig } from '@/lib/world/world-state';

/**
 * 이야기 지도 아바타 — SVG로 그린 소프트매트 3D 토이(티니핑풍).
 * 둥근 몸통 + radial-gradient 하이라이트로 말랑한 입체감, 큰 반짝 눈 + 볼터치.
 * 남녀 모두 좋아할 중성 디자인. 이미지 에셋 없이 순수 SVG (docs/plan/10 비주얼 방침).
 */

const EYE_LEFT_X = 37.5;
const EYE_RIGHT_X = 62.5;
const EYE_Y = 55;

export default function Avatar({
  config,
  size = 160,
  className = '',
  title,
}: {
  config: AvatarConfig;
  size?: number;
  className?: string;
  title?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const color = BODY_COLORS.find((c) => c.id === config.body) ?? BODY_COLORS[0];
  const bodyGrad = `${uid}-body`;
  const shine = `${uid}-shine`;

  return (
    <svg
      viewBox="0 0 100 118"
      width={size}
      height={size * 1.18}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <radialGradient id={bodyGrad} cx="36%" cy="30%" r="82%">
          <stop offset="0%" stopColor={color.light} />
          <stop offset="55%" stopColor={color.base} />
          <stop offset="100%" stopColor={color.dark} />
        </radialGradient>
        <radialGradient id={shine} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 바닥 그림자 — 접지감 */}
      <ellipse cx="50" cy="107" rx="26" ry="6" fill="#233126" opacity="0.12" />

      {/* 발 */}
      <ellipse cx="39" cy="96" rx="8.5" ry="5.5" fill={color.dark} />
      <ellipse cx="61" cy="96" rx="8.5" ry="5.5" fill={color.dark} />
      {/* 팔 */}
      <ellipse cx="15" cy="66" rx="7" ry="9" fill={color.dark} transform="rotate(18 15 66)" />
      <ellipse cx="85" cy="66" rx="7" ry="9" fill={color.dark} transform="rotate(-18 85 66)" />

      {/* 몸통 */}
      <circle cx="50" cy="58" r="35" fill={`url(#${bodyGrad})`} />
      {/* 스펙큘러 하이라이트 */}
      <ellipse cx="37" cy="39" rx="15" ry="11" fill={`url(#${shine})`} transform="rotate(-18 37 39)" />
      <circle cx="63" cy="35" r="3.2" fill="#ffffff" opacity="0.45" />

      {/* 볼터치 */}
      <ellipse cx="28" cy="65" rx="6.5" ry="4.2" fill="#FF9DB0" opacity="0.55" />
      <ellipse cx="72" cy="65" rx="6.5" ry="4.2" fill="#FF9DB0" opacity="0.55" />

      <Eyes eyes={config.eyes} />
      <Mouth />
      <Accessory accessory={config.accessory} />
      {config.accessory === 'glasses' && <Glasses />}
    </svg>
  );
}

function Eyes({ eyes }: { eyes: AvatarConfig['eyes'] }) {
  if (eyes === 'curve') {
    // 방긋 감은 눈 — 위로 볼록한 호.
    return (
      <g fill="none" stroke="#2A2320" strokeWidth={3.4} strokeLinecap="round">
        <path d={`M${EYE_LEFT_X - 6},${EYE_Y + 1} Q${EYE_LEFT_X},${EYE_Y - 6} ${EYE_LEFT_X + 6},${EYE_Y + 1}`} />
        <path d={`M${EYE_RIGHT_X - 6},${EYE_Y + 1} Q${EYE_RIGHT_X},${EYE_Y - 6} ${EYE_RIGHT_X + 6},${EYE_Y + 1}`} />
      </g>
    );
  }

  const rx = eyes === 'sparkle' ? 6.4 : 5.6;
  const ry = eyes === 'sparkle' ? 8 : 7.2;
  return (
    <g>
      {[EYE_LEFT_X, EYE_RIGHT_X].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy={EYE_Y} rx={rx} ry={ry} fill="#2A2320" />
          <ellipse cx={cx - 1.8} cy={EYE_Y - 2.6} rx={2.1} ry={2.6} fill="#ffffff" />
          {eyes === 'sparkle' ? (
            <path
              d={`M${cx + 1.6},${EYE_Y + 1} l1.1,2 2,1.1 -2,1.1 -1.1,2 -1.1,-2 -2,-1.1 2,-1.1 z`}
              fill="#ffffff"
            />
          ) : (
            <circle cx={cx + 1.6} cy={EYE_Y + 2.4} r={1.1} fill="#ffffff" opacity="0.85" />
          )}
        </g>
      ))}
    </g>
  );
}

function Mouth() {
  return (
    <path
      d="M44,69 Q50,74 56,69"
      fill="none"
      stroke="#B4574C"
      strokeWidth={2.6}
      strokeLinecap="round"
    />
  );
}

function Accessory({ accessory }: { accessory: AvatarConfig['accessory'] }) {
  if (accessory === 'sprout') {
    return (
      <g>
        <path d="M50,26 L50,12" fill="none" stroke="#6DA36F" strokeWidth={2.6} strokeLinecap="round" />
        <path d="M50,17 C44,13 40,15 39,20 C45,22 49,21 50,17 Z" fill="#8FC58F" />
        <path d="M50,14 C55,10 60,12 61,17 C55,19 51,18 50,14 Z" fill="#6DA36F" />
      </g>
    );
  }
  if (accessory === 'ribbon') {
    return (
      <g transform="translate(50 24)">
        <path d="M0,0 L-13,-6 L-13,6 Z" fill="#D19A43" />
        <path d="M0,0 L13,-6 L13,6 Z" fill="#D19A43" />
        <path d="M0,0 L-13,-6 L-13,6 Z" fill="#ffffff" opacity="0.18" />
        <circle cx="0" cy="0" r="4" fill="#B87F2E" />
      </g>
    );
  }
  if (accessory === 'star') {
    return (
      <g transform="translate(50 20)">
        <path d="M0,-9 L2.6,-2.8 9,-2.8 3.8,1.4 5.6,8 0,4 -5.6,8 -3.8,1.4 -9,-2.8 -2.6,-2.8 Z" fill="#EFB84B" />
        <path d="M0,-9 L2.6,-2.8 9,-2.8 3.8,1.4 5.6,8 0,4 Z" fill="#ffffff" opacity="0.25" />
        <circle cx="0" cy="0" r="2" fill="#fff6df" />
      </g>
    );
  }
  // glasses: 렌즈는 눈 위에 별도 레이어(Glasses)로 그린다.
  return null;
}

function Glasses() {
  return (
    <g fill="none" stroke="#3A322C" strokeWidth={2.4}>
      <circle cx={EYE_LEFT_X} cy={EYE_Y} r={9.5} fill="#ffffff" fillOpacity="0.16" />
      <circle cx={EYE_RIGHT_X} cy={EYE_Y} r={9.5} fill="#ffffff" fillOpacity="0.16" />
      <path d={`M${EYE_LEFT_X + 9.5},${EYE_Y} Q50,${EYE_Y - 3} ${EYE_RIGHT_X - 9.5},${EYE_Y}`} />
    </g>
  );
}
