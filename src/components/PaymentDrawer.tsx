'use client';

import { useEffect } from 'react';

export type BundleType = 'single' | 'pack6' | 'pack15';

export interface BundleInfo {
  type: BundleType;
  credits: number;
  priceKrw: number;
  originalKrw: number;
  label: string;
}

export const BUNDLES: Record<BundleType, BundleInfo> = {
  single: { type: 'single', credits: 1, priceKrw: 1500, originalKrw: 1500, label: '단품 1개' },
  pack6: { type: 'pack6', credits: 6, priceKrw: 7500, originalKrw: 9000, label: '6개 번들' },
  pack15: { type: 'pack15', credits: 15, priceKrw: 15000, originalKrw: 22500, label: '15개 번들' },
};

interface PaymentDrawerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: BundleType) => void;
  childName?: string;
  reason?: string;       // 닫기 위 headline 에 노출 ("크레딧이 필요해요")
  disabled?: boolean;    // 처리 중 클릭 차단
}

const krw = (n: number) => `₩${n.toLocaleString('ko-KR')}`;

export default function PaymentDrawer({ open, onClose, onSelect, childName, reason, disabled }: PaymentDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const pack6Discount = Math.round((1 - BUNDLES.pack6.priceKrw / BUNDLES.pack6.originalKrw) * 100);
  const pack15Discount = Math.round((1 - BUNDLES.pack15.priceKrw / BUNDLES.pack15.originalKrw) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <button
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
      />

      {/* Sheet */}
      <div
        className="relative w-full max-w-md bg-white rounded-t-[28px] shadow-2xl"
        style={{ animation: 'kindy-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <style>{`
          @keyframes kindy-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        `}</style>

        {/* Handle */}
        <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3" />

        <div className="flex items-start justify-between px-6 pt-5 pb-1">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">{reason ?? '크레딧이 필요해요'}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {childName ? `${childName}이의 ` : ''}맞춤 영상을 1개 더 만들려면 크레딧이 필요해요.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-gray-400 hover:text-gray-600 p-1 -mr-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          {/* PRIMARY: 6-pack */}
          <button
            onClick={() => onSelect('pack6')}
            disabled={disabled}
            className="w-full text-left bg-gradient-to-br from-violet-500 to-violet-600 text-white rounded-2xl p-5 shadow-lg shadow-violet-300/40 active:scale-[0.98] transition relative overflow-hidden disabled:opacity-60"
          >
            <div className="absolute top-3 right-3 bg-yellow-300 text-violet-900 text-[10px] font-extrabold tracking-wider uppercase px-2 py-1 rounded-full">
              ★ 추천
            </div>
            <div className="text-[11px] font-bold text-violet-200 tracking-wider uppercase mb-1">6개 번들</div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-black">{krw(BUNDLES.pack6.priceKrw)}</span>
              <span className="text-sm text-violet-200 line-through">{krw(BUNDLES.pack6.originalKrw)}</span>
            </div>
            <div className="text-sm text-violet-100 font-medium mb-3">
              영상 6개 · {pack6Discount}% 할인 · 약 2주치
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur rounded-full px-3 py-1.5 text-xs font-bold inline-flex">
              결제하기
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </button>

          {/* SECONDARY: 15-pack */}
          <button
            onClick={() => onSelect('pack15')}
            disabled={disabled}
            className="w-full text-left bg-violet-50 text-gray-900 rounded-2xl p-4 border border-violet-100 active:scale-[0.98] transition flex items-center justify-between disabled:opacity-60"
          >
            <div>
              <div className="text-[10px] font-bold text-violet-500 tracking-wider uppercase mb-0.5">15개 번들 · 주 3회 사용자</div>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-xl font-extrabold text-gray-900">{krw(BUNDLES.pack15.priceKrw)}</span>
                <span className="text-xs text-gray-400 line-through">{krw(BUNDLES.pack15.originalKrw)}</span>
              </div>
              <div className="text-xs text-violet-600 font-semibold">영상 15개 · {pack15Discount}% 할인 · 약 5주치</div>
            </div>
            <svg className="w-5 h-5 text-violet-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* TERTIARY: single */}
          <div className="text-center pt-2">
            <button
              onClick={() => onSelect('single')}
              disabled={disabled}
              className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 font-medium disabled:opacity-60"
            >
              단품 1개 {krw(BUNDLES.single.priceKrw)}만 구매하기
            </button>
          </div>
        </div>

        {/* Trust bar */}
        <div className="border-t border-gray-100 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            7일 내 미사용 크레딧 전액 환불
          </div>
          <div className="text-[11px] text-gray-400">토스페이먼츠 보안 결제</div>
        </div>
      </div>
    </div>
  );
}
