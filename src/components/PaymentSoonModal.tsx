'use client';

import { useEffect } from 'react';

interface PaymentSoonModalProps {
  open: boolean;
  onClose: () => void;
  bundle?: {
    label: string;
    priceKrw: number;
    credits: number;
  };
}

export default function PaymentSoonModal({ open, onClose, bundle }: PaymentSoonModalProps) {
  useEffect(() => {
    if (!open) return;

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const bundleLabel = bundle
    ? `${bundle.label} (${bundle.priceKrw.toLocaleString()}원, ${bundle.credits}크레딧)`
    : '선택하신 번들';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6" aria-modal="true" role="dialog">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-[375px] rounded-3xl bg-white p-6 text-left shadow-2xl">
        <div className="mb-5">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-violet-500">
            Closed beta
          </div>
          <h2 className="text-xl font-extrabold leading-[1.35] text-gray-900">
            결제 시스템 준비 중
          </h2>
          <p className="mt-3 text-sm font-medium leading-relaxed text-gray-600">
            현재 클로즈드 베타 기간이에요. {bundleLabel} 결제는 곧 오픈해요.
          </p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-violet-500 px-6 py-4 text-base font-bold text-white shadow-lg shadow-violet-200/60 transition hover:bg-violet-600 active:scale-[0.98]"
          >
            알림 받기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-violet-100 bg-violet-50 px-6 py-3 text-sm font-bold text-violet-600 transition hover:bg-violet-100 active:scale-[0.98]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
