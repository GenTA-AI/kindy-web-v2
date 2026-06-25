'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Child } from '@/types';

interface ChildSwitcherProps {
  currentChildId: string | null;
  currentChildName?: string;
  onSwitched?: (newChildId: string) => void;
}

export default function ChildSwitcher({ currentChildId, currentChildName, onSwitched }: ChildSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<Child[] | null>(null);
  const loading = open && children === null;

  useEffect(() => {
    if (!open || children !== null) return;
    let cancelled = false;

    fetch('/api/children')
      .then((r) => r.json())
      .then((list: Child[] | { error: string }) => {
        if (!cancelled) setChildren(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setChildren([]);
      });

    return () => {
      cancelled = true;
    };
  }, [children, open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [open]);

  const switchTo = (id: string) => {
    setOpen(false);
    if (onSwitched) onSwitched(id);
    // 현재 pathname 유지하면서 childId 만 교체
    const url = `${pathname}?childId=${id}`;
    router.replace(url);
  };

  const addChild = () => {
    setOpen(false);
    router.push('/onboarding?add=1');
  };

  return (
    <>
      <button
        onClick={() => {
          setChildren(null);
          setOpen(true);
        }}
        className="flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-white/30 transition"
      >
        {currentChildName ?? '...'}
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
          <button
            aria-label="닫기"
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            className="relative w-full max-w-md bg-white rounded-t-[28px] shadow-2xl"
            style={{ animation: 'kindy-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <style>{`@keyframes kindy-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3" />

            <div className="px-6 pt-4 pb-2 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">아이 선택</h2>
                <p className="text-sm text-gray-500 mt-0.5">여러 아이를 한 계정에서 관리해요</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="닫기" className="text-gray-400 p-1 -mr-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 pb-5 pt-2 space-y-2 max-h-[60vh] overflow-y-auto">
              {loading && <p className="text-sm text-gray-400 text-center py-6">불러오는 중...</p>}
              {!loading && (children?.length ?? 0) === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">등록된 아이가 없어요</p>
              )}
              {(children ?? []).map((c) => {
                const isCurrent = c.id === currentChildId;
                return (
                  <button
                    key={c.id}
                    onClick={() => switchTo(c.id)}
                    className={`w-full text-left rounded-2xl p-4 flex items-center gap-3 transition ${
                      isCurrent
                        ? 'bg-violet-50 border-2 border-violet-500'
                        : 'bg-gray-50 border-2 border-gray-100 hover:border-violet-300'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-lg font-bold text-violet-600">
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-bold text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.age}세 · {c.topics?.[0] ?? '주제 미설정'}</div>
                    </div>
                    {isCurrent && (
                      <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}

              <button
                onClick={addChild}
                className="w-full text-left rounded-2xl p-4 flex items-center gap-3 border-2 border-dashed border-violet-300 text-violet-600 hover:bg-violet-50 transition mt-3"
              >
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <div className="text-base font-bold">아이 추가하기</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
