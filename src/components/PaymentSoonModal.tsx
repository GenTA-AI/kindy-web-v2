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
    ? `${bundle.label} (${bundle.priceKrw.toLocaleString()}원)`
    : '선택하신 이용권';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6" aria-modal="true" role="dialog">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-[375px] rounded-3xl border border-line bg-white p-6 text-left shadow-2xl">
        <div className="mb-5">
          <div className="mb-2 text-[11px] font-black uppercase tracking-[.16em] text-sage">
            무료 체험 안내
          </div>
          <h2 className="text-xl font-black leading-[1.35] text-ink">
            지금은 무료 체험을 먼저 열어드려요
          </h2>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-ink2">
            {bundleLabel} 이용은 체험 기록을 본 뒤 이어서 안내할게요. 아이는 바로 모리 이야기를 시작할 수 있어요.
          </p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-saged px-6 py-4 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
          >
            무료 체험 계속하기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-line bg-cream px-6 py-3 text-sm font-black text-saged transition hover:bg-mist active:scale-[0.98]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
