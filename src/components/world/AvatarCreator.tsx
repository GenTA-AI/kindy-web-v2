'use client';

import { useState } from 'react';
import Avatar from '@/components/world/Avatar';
import { BUTTON_PRIMARY } from '@/components/ui/glass';
import {
  ACCESSORIES,
  BODY_COLORS,
  EYE_STYLES,
  type AccessoryId,
  type AvatarConfig,
  type BodyColorId,
  type EyeStyleId,
} from '@/lib/world/world-state';

/**
 * 아바타 만들기 — 미리보기(크게) + 옵션 스와치 3행 + "모험 시작!".
 * 조합을 즉시 미리보기에 반영. 텍스트는 아이 눈높이로 짧게 (docs/plan/10 §6 W1).
 */
export default function AvatarCreator({
  initial,
  isFirst,
  onDone,
  onBack,
}: {
  initial: AvatarConfig;
  isFirst: boolean;
  onDone: (avatar: AvatarConfig) => void;
  onBack?: () => void;
}) {
  const [body, setBody] = useState<BodyColorId>(initial.body);
  const [eyes, setEyes] = useState<EyeStyleId>(initial.eyes);
  const [accessory, setAccessory] = useState<AccessoryId>(initial.accessory);
  const config: AvatarConfig = { body, eyes, accessory };

  return (
    <main className="flex min-h-[100svh] flex-col bg-cream text-ink [word-break:keep-all]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-5">
        <header className="flex items-center justify-between">
          <span className="text-xs font-black tracking-[0.3em] text-ink3">KINDY 이야기 지도</span>
          {!isFirst && onBack && (
            <button
              onClick={onBack}
              className="min-h-11 rounded-full border border-line bg-white/70 px-4 text-sm font-bold text-ink2"
            >
              지도로
            </button>
          )}
        </header>

        <h1 className="mt-4 text-center text-3xl font-black leading-snug">
          {isFirst ? '내 친구를 만들어요' : '내 캐릭터 꾸미기'}
        </h1>

        {/* 미리보기 */}
        <div className="relative mt-3 flex items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(221,232,222,.9),rgba(251,247,239,0)_70%)]"
          />
          <div className="world-float relative">
            <Avatar config={config} size={190} title="내 아바타 미리보기" />
          </div>
        </div>

        {/* 옵션 스와치 3행 */}
        <div className="mt-2 space-y-4">
          <SwatchRow label="몸 색깔">
            {BODY_COLORS.map((color) => (
              <SwatchButton
                key={color.id}
                selected={body === color.id}
                label={color.label}
                onClick={() => setBody(color.id)}
              >
                <span
                  aria-hidden="true"
                  className="h-9 w-9 rounded-full shadow-inner"
                  style={{
                    background: `radial-gradient(circle at 34% 30%, ${color.light}, ${color.base} 58%, ${color.dark})`,
                  }}
                />
              </SwatchButton>
            ))}
          </SwatchRow>

          <SwatchRow label="눈">
            {EYE_STYLES.map((style) => (
              <SwatchButton
                key={style.id}
                selected={eyes === style.id}
                label={style.label}
                onClick={() => setEyes(style.id)}
              >
                <Avatar config={{ body, eyes: style.id, accessory: 'sprout' }} size={44} />
              </SwatchButton>
            ))}
          </SwatchRow>

          <SwatchRow label="꾸미기">
            {ACCESSORIES.map((item) => (
              <SwatchButton
                key={item.id}
                selected={accessory === item.id}
                label={item.label}
                onClick={() => setAccessory(item.id)}
              >
                <Avatar config={{ body, eyes, accessory: item.id }} size={44} />
              </SwatchButton>
            ))}
          </SwatchRow>
        </div>

        <button onClick={() => onDone(config)} className={`${BUTTON_PRIMARY} mt-8 w-full`}>
          {isFirst ? '모험 시작!' : '다 됐어요!'}
        </button>
      </div>
    </main>
  );
}

function SwatchRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-black text-ink2">{label}</p>
      <div className="flex flex-wrap gap-2.5">{children}</div>
    </div>
  );
}

function SwatchButton({
  selected,
  label,
  onClick,
  children,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 transition active:scale-95 ${
        selected ? 'border-gold bg-white shadow-sm' : 'border-line bg-white/60'
      }`}
    >
      {children}
    </button>
  );
}
