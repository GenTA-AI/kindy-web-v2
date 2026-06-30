'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Child } from '@/types';
import { topicLabel } from '@/lib/topic-label';

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
        className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-sm font-bold backdrop-blur transition hover:bg-white/30"
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
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            className="relative w-full max-w-md rounded-t-[28px] border border-line bg-white shadow-2xl"
            style={{ animation: 'kindy-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <style>{`@keyframes kindy-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

            <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-line" />

            <div className="flex items-start justify-between px-6 pb-2 pt-4">
              <div>
                <h2 className="text-lg font-black text-ink">아이 선택</h2>
                <p className="mt-0.5 text-sm font-semibold text-ink2">오늘 기록을 볼 아이를 골라주세요</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="닫기" className="-mr-1 p-1 text-ink3">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="max-h-[60vh] space-y-2 overflow-y-auto px-6 pb-5 pt-2">
              {loading && <p className="py-6 text-center text-sm font-semibold text-ink3">불러오는 중...</p>}
              {!loading && (children?.length ?? 0) === 0 && (
                <p className="py-6 text-center text-sm font-semibold text-ink3">등록된 아이가 없어요</p>
              )}
              {(children ?? []).map((c) => {
                const isCurrent = c.id === currentChildId;
                return (
                  <button
                    key={c.id}
                    onClick={() => switchTo(c.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${
                      isCurrent
                        ? 'border-sage bg-sagebg'
                        : 'border-line bg-cream hover:border-sage hover:bg-mist'
                    }`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg font-black text-saged">
                      {c.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-black text-ink">{c.name}</div>
                      <div className="text-xs font-semibold text-ink3">{c.age}세 · {topicLabel(c.topics?.[0])}</div>
                    </div>
                    {isCurrent && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-saged">
                        <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}

              <button
                onClick={addChild}
                className="mt-3 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-sages p-4 text-left text-saged transition hover:bg-mist"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sagebg">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <div className="text-base font-black">아이 추가하기</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
