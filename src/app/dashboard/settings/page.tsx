'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Child } from '@/types';
import ChildSwitcher from '@/components/ChildSwitcher';

interface Purchase {
  id: string;
  bundle_type: 'single' | 'pack6' | 'pack15';
  credits_added: number;
  amount_krw: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled';
  created_at: string;
  paid_at: string | null;
}

interface Credits {
  parent_id: string;
  balance: number;
  lifetime_granted: number;
  lifetime_purchased: number;
  lifetime_consumed: number;
}

interface SettingsData {
  children: Child[];
  purchases: Purchase[];
  credits: Credits | null;
}

const STATUS_LABEL: Record<Purchase['status'], string> = {
  pending: '결제 중',
  paid: '완료',
  failed: '실패',
  refunded: '환불',
  canceled: '취소',
};

const BUNDLE_LABEL: Record<Purchase['bundle_type'], string> = {
  single: '단품',
  pack6: '6개 번들',
  pack15: '15개 번들',
};

async function fetchSettingsData(): Promise<SettingsData> {
  const [cs, ps, cr] = await Promise.all([
    fetch('/api/children').then((r) => r.json()),
    fetch('/api/purchases').then((r) => r.json()),
    fetch('/api/credits').then((r) => r.json()),
  ]);

  return {
    children: Array.isArray(cs) ? cs : [],
    purchases: Array.isArray(ps) ? ps : [],
    credits: cr,
  };
}

function SettingsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const childId = params.get('childId');

  const [children, setChildren] = useState<Child[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const applySettingsData = (data: SettingsData) => {
    setChildren(data.children);
    setPurchases(data.purchases);
    setCredits(data.credits);
  };

  const reload = async () => {
    applySettingsData(await fetchSettingsData());
  };

  useEffect(() => {
    let cancelled = false;

    fetchSettingsData().then((data) => {
      if (!cancelled) applySettingsData(data);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const currentChild = children.find((c) => c.id === childId) ?? null;

  const startEdit = (c: Child) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditAge(String(c.age));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const res = await fetch(`/api/children/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, age: parseInt(editAge) }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? '수정 실패');
      return;
    }
    setEditingId(null);
    await reload();
  };

  const confirmDelete = async (id: string) => {
    if (deletingId !== id) {
      setDeletingId(id);
      return;
    }
    const res = await fetch(`/api/children/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? '삭제 실패');
      setDeletingId(null);
      return;
    }
    setDeletingId(null);
    await reload();
    // 삭제한 아이가 현재 선택된 아이였다면 첫 번째로 이동
    if (id === childId) {
      const remaining = children.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        router.replace(`/dashboard/settings?childId=${remaining[0].id}`);
      } else {
        router.replace('/onboarding');
      }
    }
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-violet-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-500 to-violet-400 text-white px-6 pt-12 pb-10 rounded-b-[28px]">
        <div className="flex items-start justify-between mb-4">
          <ChildSwitcher currentChildId={childId} currentChildName={currentChild?.name} />
          <button
            onClick={() => router.push(`/dashboard?childId=${childId ?? children[0]?.id ?? ''}`)}
            className="bg-white/20 backdrop-blur rounded-full px-3 py-1.5 text-xs font-semibold hover:bg-white/30"
          >
            돌아가기
          </button>
        </div>
        <h1 className="text-[22px] font-extrabold leading-tight">설정</h1>
        <p className="text-violet-100 text-sm mt-1">
          크레딧 {credits?.balance ?? 0}개 · 누적 구매 {credits?.lifetime_purchased ?? 0}개
        </p>
      </div>

      {/* Children management */}
      <div className="px-6 mt-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700">아이 관리 ({children.length})</h2>
          <button
            onClick={() => router.push('/onboarding?add=1')}
            className="text-xs text-violet-500 font-semibold"
          >
            + 아이 추가
          </button>
        </div>

        <div className="space-y-2">
          {children.map((c) => {
            const isEditing = editingId === c.id;
            const needsDeleteConfirm = deletingId === c.id;
            return (
              <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm">
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="아이 이름"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                    />
                    <select
                      value={editAge}
                      onChange={(e) => setEditAge(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                    >
                      {[3, 4, 5, 6, 7, 8].map((a) => (
                        <option key={a} value={a}>
                          {a}세
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="flex-1 py-2 bg-violet-500 text-white text-sm font-bold rounded-xl"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-base font-bold text-violet-600">
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-900 truncate">{c.name}</div>
                      <div className="text-[11px] text-gray-500">
                        {c.age}세 · {c.styles?.[0] ?? '-'} · {c.topics?.[0] ?? '-'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => startEdit(c)}
                        className="text-xs text-violet-500 font-semibold px-2 py-1"
                      >
                        편집
                      </button>
                      <button
                        onClick={() => confirmDelete(c.id)}
                        className={`text-xs font-semibold px-2 py-1 ${
                          needsDeleteConfirm ? 'text-red-500' : 'text-gray-400'
                        }`}
                      >
                        {needsDeleteConfirm ? '한번더' : '삭제'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {children.length === 0 && (
            <div className="bg-white rounded-2xl p-6 text-center">
              <p className="text-sm text-gray-500">등록된 아이가 없어요</p>
              <button
                onClick={() => router.push('/onboarding')}
                className="mt-3 px-4 py-2 bg-violet-500 text-white text-sm rounded-xl font-semibold"
              >
                첫 아이 등록하기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Credits summary */}
      <div className="px-6 mt-6">
        <h2 className="text-sm font-bold text-gray-700 mb-3">크레딧</h2>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-3xl font-black text-violet-600 tabular-nums">{credits?.balance ?? 0}</span>
            <span className="text-sm text-gray-500">개 보유 중</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-400">받은 크레딧</div>
              <div className="text-sm font-bold text-gray-700 mt-0.5">{credits?.lifetime_granted ?? 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">구매</div>
              <div className="text-sm font-bold text-gray-700 mt-0.5">{credits?.lifetime_purchased ?? 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">사용</div>
              <div className="text-sm font-bold text-gray-700 mt-0.5">{credits?.lifetime_consumed ?? 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Purchase history */}
      <div className="px-6 mt-6">
        <h2 className="text-sm font-bold text-gray-700 mb-3">결제 내역</h2>
        {purchases.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center">
            <p className="text-sm text-gray-400">아직 결제 내역이 없어요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {purchases.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900">{BUNDLE_LABEL[p.bundle_type]}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {fmtDate(p.created_at)} · {p.credits_added} 크레딧
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-extrabold text-gray-900 tabular-nums">
                      ₩{p.amount_krw.toLocaleString()}
                    </div>
                    <div
                      className={`text-[11px] font-semibold mt-0.5 ${
                        p.status === 'paid'
                          ? 'text-violet-500'
                          : p.status === 'failed' || p.status === 'canceled'
                            ? 'text-red-400'
                            : p.status === 'refunded'
                              ? 'text-gray-400'
                              : 'text-amber-500'
                      }`}
                    >
                      {STATUS_LABEL[p.status]}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account info (placeholder) */}
      <div className="px-6 mt-6">
        <h2 className="text-sm font-bold text-gray-700 mb-3">계정</h2>
        <div className="bg-white rounded-2xl divide-y divide-gray-100 shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">부모 계정</span>
            <span className="text-sm font-semibold text-gray-900 truncate max-w-[180px]">{credits?.parent_id ?? '-'}</span>
          </div>
          <button className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition">
            <span className="text-sm text-gray-600">개인정보 처리방침</span>
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <button className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition">
            <span className="text-sm text-gray-600">이용약관</span>
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <button className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition">
            <span className="text-sm text-gray-600">문의하기</span>
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[11px] text-gray-300 mt-4">Kindy v0.1 · MVP</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-violet-50 flex items-center justify-center"><p className="text-gray-400">로딩 중...</p></div>}>
      <SettingsContent />
    </Suspense>
  );
}
