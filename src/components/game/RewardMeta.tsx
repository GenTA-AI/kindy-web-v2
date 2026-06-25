'use client';

import { collectionProgressPct } from '@/lib/game/rewards';
import type { CollectionState, RewardDelta } from '@/types/game';

interface RewardMetaProps {
  state: CollectionState;
  lastDelta?: RewardDelta | null;
  totalSlots: number;
}

const MAX_VISIBLE_STICKERS = 12;
const MIN_SHELF_SLOTS = 6;

const STICKER_META: Record<string, { mark: string; label: string; className: string }> = {
  perfect: {
    mark: '★',
    label: '완벽 마무리',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  clear: {
    mark: '✓',
    label: '해냈어요',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  challenge: {
    mark: '◆',
    label: '도전 성공',
    className: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  steady_try: {
    mark: '↺',
    label: '다시 해낸 힘',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
  },
};

function nonNegativeWhole(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function cleanUnique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function stickerKind(sticker: string): string {
  const parts = sticker.split(':').filter(Boolean);
  return parts[parts.length - 1] ?? 'sticker';
}

function stickerMeta(sticker: string): { mark: string; label: string; className: string } {
  return (
    STICKER_META[stickerKind(sticker)] ?? {
      mark: '✦',
      label: '컬렉션 스티커',
      className: 'border-violet-200 bg-violet-50 text-violet-700',
    }
  );
}

function collectionFilledCount(state: CollectionState): number {
  return Object.values(state.collection).reduce(
    (sum, count) => sum + nonNegativeWhole(count),
    0,
  );
}

export default function RewardMeta({ state, lastDelta = null, totalSlots }: RewardMetaProps) {
  const totalStars = nonNegativeWhole(state.total_stars);
  const newStars = nonNegativeWhole(lastDelta?.stars);
  const newStickerIds = cleanUnique(lastDelta?.stickers ?? []);
  const newStickerSet = new Set(newStickerIds);
  const allStickers = cleanUnique([...state.stickers, ...newStickerIds]);
  const visibleStickers = allStickers.slice(0, MAX_VISIBLE_STICKERS);
  const hiddenStickerCount = Math.max(0, allStickers.length - visibleStickers.length);
  const emptySlotCount = Math.max(0, Math.min(MIN_SHELF_SLOTS, MIN_SHELF_SLOTS - visibleStickers.length));
  const progressPct = collectionProgressPct(state, totalSlots);
  const roundedProgress = Math.round(progressPct);
  const safeTotalSlots = nonNegativeWhole(totalSlots);
  const filledSlots = safeTotalSlots > 0
    ? Math.min(collectionFilledCount(state), safeTotalSlots)
    : collectionFilledCount(state);
  const newCollectionCount = cleanUnique(lastDelta?.collection_unlocks ?? []).length;
  const hasNewReward = newStars > 0 || newStickerIds.length > 0 || newCollectionCount > 0;

  return (
    <section
      aria-labelledby="reward-meta-title"
      className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm shadow-violet-100/60"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-violet-500">보상 모음</p>
          <h2 id="reward-meta-title" className="mt-1 text-xl font-bold text-gray-900">
            해낸 만큼 차곡차곡 모였어요
          </h2>
        </div>

        <div
          className={`flex min-h-[44px] items-center gap-2 rounded-2xl border px-4 py-2 transition-all duration-300 ${
            newStars > 0
              ? 'scale-105 border-violet-200 bg-violet-50 text-violet-700'
              : 'border-gray-100 bg-gray-50 text-gray-700'
          }`}
        >
          <span className="text-2xl" aria-hidden="true">
            ★
          </span>
          <div>
            <p className="text-xs font-medium text-gray-500">모은 별</p>
            <p className="text-lg font-extrabold leading-tight">{totalStars.toLocaleString('ko-KR')}개</p>
          </div>
        </div>
      </div>

      {hasNewReward && (
        <div className="mt-4 flex flex-wrap gap-2">
          {newStars > 0 && (
            <span className="inline-flex min-h-[44px] items-center rounded-full bg-violet-100 px-4 text-sm font-bold text-violet-700 transition-all duration-300">
              이번 판 별 +{newStars}
            </span>
          )}
          {newStickerIds.length > 0 && (
            <span className="inline-flex min-h-[44px] items-center rounded-full bg-amber-100 px-4 text-sm font-bold text-amber-700 transition-all duration-300">
              새 스티커 +{newStickerIds.length}
            </span>
          )}
          {newCollectionCount > 0 && (
            <span className="inline-flex min-h-[44px] items-center rounded-full bg-emerald-100 px-4 text-sm font-bold text-emerald-700 transition-all duration-300">
              컬렉션 +{newCollectionCount}칸
            </span>
          )}
        </div>
      )}

      <div className="mt-5 rounded-2xl bg-violet-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-violet-900">컬렉션 진행률</p>
            <p className="mt-1 text-xs font-medium text-violet-600">
              {safeTotalSlots > 0 ? `${filledSlots}/${safeTotalSlots}칸` : '새 컬렉션 준비 중'} · {roundedProgress}%
            </p>
          </div>
          <span className="inline-flex min-h-[44px] min-w-[64px] items-center justify-center rounded-full bg-white px-3 text-sm font-extrabold text-violet-700 shadow-sm">
            {roundedProgress}%
          </span>
        </div>

        <div
          aria-label={`컬렉션 진행률 ${roundedProgress}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={roundedProgress}
          className="mt-3 h-4 overflow-hidden rounded-full bg-white"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <p className="mt-3 text-sm font-semibold text-violet-700">
          {roundedProgress >= 100
            ? '컬렉션을 모두 채웠어요. 다음 보상도 차곡차곡 이어가요!'
            : `컬렉션이 ${roundedProgress}% 채워졌어요. 다음 보상까지 조금만 더!`}
        </p>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-gray-900">스티커 선반</h3>
          <p className="text-xs font-medium text-gray-500">{allStickers.length.toLocaleString('ko-KR')}개 모음</p>
        </div>

        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visibleStickers.map((sticker) => {
            const meta = stickerMeta(sticker);
            const isNew = newStickerSet.has(sticker);

            return (
              <li
                key={sticker}
                className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 transition-all duration-300 ${
                  meta.className
                } ${isNew ? 'scale-105 ring-2 ring-violet-200' : ''}`}
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-base font-black"
                >
                  {meta.mark}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{meta.label}</span>
                  {isNew && <span className="block text-xs font-semibold opacity-80">새로 모음</span>}
                </span>
              </li>
            );
          })}

          {Array.from({ length: emptySlotCount }).map((_, index) => (
            <li
              key={`empty-${index}`}
              className="flex min-h-[44px] items-center justify-center rounded-xl border border-dashed border-violet-200 bg-violet-50/60 px-3 py-2 text-xs font-semibold text-violet-400"
            >
              다음 스티커 자리
            </li>
          ))}

          {hiddenStickerCount > 0 && (
            <li className="flex min-h-[44px] items-center justify-center rounded-xl border border-violet-100 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-500">
              +{hiddenStickerCount.toLocaleString('ko-KR')}개 더
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
