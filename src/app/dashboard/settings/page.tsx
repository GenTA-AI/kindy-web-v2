'use client';

import Link from 'next/link';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { STYLE_OPTIONS, type Child } from '@/types';
import ChildSwitcher from '@/components/ChildSwitcher';
import { businessInfo } from '@/lib/business-info';
import { topicLabel } from '@/lib/topic-label';
import type { EntitlementRow, SubscriptionRow } from '@/lib/subscription-types';

interface Purchase {
  id: string;
  bundle_type: 'single' | 'pack6' | 'pack15' | 'subscription';
  amount_krw: number;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled';
  created_at: string;
  paid_at: string | null;
}

interface SettingsData {
  children: Child[];
  purchases: Purchase[];
  membership: SubscriptionState;
}

type SubscriptionState = {
  subscription: SubscriptionRow | null;
  entitlement: EntitlementRow;
}

const LOCAL_PREVIEW_CHILD: Child = {
  id: 'local-preview-child',
  name: '서연',
  age: 6,
  parent_id: 'local-preview-parent',
  styles: ['story_forest'],
  topics: ['future_skills'],
  created_at: '2026-06-29T00:00:00.000Z',
};

const STATUS_LABEL: Record<Purchase['status'], string> = {
  pending: '결제 중',
  paid: '완료',
  failed: '실패',
  refunded: '환불',
  canceled: '취소',
};

const BUNDLE_LABEL: Record<Purchase['bundle_type'], string> = {
  single: '모리 이용권',
  pack6: '이야기 이용권',
  pack15: '이야기 이용권',
  subscription: '월 구독',
};

const DEFAULT_MEMBERSHIP: SubscriptionState = {
  subscription: null,
  entitlement: {
    parent_id: 'local-preview-parent',
    is_premium: false,
    premium_until: null,
    source: null,
    updated_at: '2026-06-29T00:00:00.000Z',
  },
};

function supportMailto(subject: string, bodyLines: string[]): string {
  return `mailto:${businessInfo.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
}

function styleLabel(style?: string | null): string {
  const value = style?.trim();
  if (!value) return '이야기 취향 고르기 전';

  return STYLE_OPTIONS.find((option) => option.id === value)?.label ?? value;
}

async function fetchJson(path: string): Promise<unknown> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function normalizeSubscriptionState(value: unknown): SubscriptionState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_MEMBERSHIP;
  const record = value as Partial<SubscriptionState>;
  const entitlement = record.entitlement && typeof record.entitlement === 'object'
    ? record.entitlement
    : DEFAULT_MEMBERSHIP.entitlement;

  return {
    subscription: record.subscription && typeof record.subscription === 'object'
      ? record.subscription as SubscriptionRow
      : null,
    entitlement: entitlement as EntitlementRow,
  };
}

async function fetchSettingsData(currentChildId?: string | null): Promise<SettingsData> {
  const [cs, ps, ss] = await Promise.all([
    fetchJson('/api/children'),
    fetchJson('/api/purchases'),
    fetchJson('/api/subscription'),
  ]);
  const children = Array.isArray(cs)
    ? cs
    : currentChildId === LOCAL_PREVIEW_CHILD.id
      ? [LOCAL_PREVIEW_CHILD]
      : [];

  return {
    children,
    purchases: Array.isArray(ps) ? ps : [],
    membership: normalizeSubscriptionState(ss),
  };
}

function SettingsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const childId = params.get('childId');

  const [children, setChildren] = useState<Child[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [membership, setMembership] = useState<SubscriptionState>(DEFAULT_MEMBERSHIP);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<{ tone: 'info' | 'error'; message: string } | null>(null);

  const applySettingsData = (data: SettingsData) => {
    setChildren(data.children);
    setPurchases(data.purchases);
    setMembership(data.membership);
  };

  const reload = async () => {
    applySettingsData(await fetchSettingsData(childId));
  };

  useEffect(() => {
    let cancelled = false;

    fetchSettingsData(childId).then((data) => {
      if (!cancelled) applySettingsData(data);
    });

    return () => {
      cancelled = true;
    };
  }, [childId]);

  const currentChild = children.find((c) => c.id === childId) ?? null;
  const membershipActive =
    membership.entitlement.is_premium ||
    membership.subscription?.status === 'active' ||
    membership.subscription?.status === 'past_due';

  const startEdit = (c: Child) => {
    setDeletingId(null);
    setSettingsNotice(null);
    setEditingId(c.id);
    setEditName(c.name);
    setEditAge(String(c.age));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSettingsNotice(null);
    const res = await fetch(`/api/children/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, age: parseInt(editAge) }),
    });
    if (!res.ok) {
      const err = await res.json();
      setSettingsNotice({ tone: 'error', message: err.error ?? '아이 정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' });
      return;
    }
    setEditingId(null);
    setSettingsNotice({ tone: 'info', message: '아이 정보를 저장했어요.' });
    await reload();
  };

  const requestDelete = (child: Child) => {
    setEditingId(null);
    setDeletingId(child.id);
    setSettingsNotice({
      tone: 'info',
      message: `${child.name}의 아이 이름표와 놀이 기록을 삭제하기 전에 내용을 확인해 주세요.`,
    });
  };

  const deleteChild = async (id: string) => {
    if (deletePendingId) return;
    setDeletePendingId(id);
    setSettingsNotice(null);
    const res = await fetch(`/api/children/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      setSettingsNotice({ tone: 'error', message: err.error ?? '아이 정보를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.' });
      setDeletePendingId(null);
      return;
    }
    setDeletingId(null);
    setDeletePendingId(null);
    setSettingsNotice({
      tone: 'info',
      message: '아이 정보를 삭제했어요. 멤버십, 결제 내역, 필수 동의 기록은 보호자 계정 기준으로 관리돼요.',
    });
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

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-cream pb-24 text-ink">
      {/* Header */}
      <div className="rounded-b-[28px] bg-saged px-6 pb-10 pt-12 text-white">
        <div className="mb-4 flex items-start justify-between">
          <ChildSwitcher currentChildId={childId} currentChildName={currentChild?.name} />
          <button
            onClick={() => router.push(`/dashboard?childId=${childId ?? children[0]?.id ?? ''}`)}
            className="min-h-10 rounded-full bg-white/20 px-4 text-xs font-bold backdrop-blur hover:bg-white/30"
          >
            돌아가기
          </button>
        </div>
        <h1 className="text-[22px] font-black leading-tight">설정</h1>
        <p className="mt-1 text-sm font-semibold text-white/78">아이 프로필과 이용 정보를 관리해요</p>
      </div>

      {/* Children management */}
      <div className="mt-4 px-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-black text-ink2">아이 관리 ({children.length})</h2>
          <button
            onClick={() => router.push('/onboarding?add=1')}
            className="min-h-10 rounded-full px-3 text-xs font-black text-saged hover:bg-mist"
          >
            + 아이 추가
          </button>
        </div>

        {settingsNotice && (
          <div
            className={`mb-3 rounded-2xl border px-4 py-3 text-sm font-bold leading-relaxed ${
              settingsNotice.tone === 'error'
                ? 'border-clay/30 bg-white text-clay'
                : 'border-line bg-sagebg text-saged'
            }`}
            aria-live="polite"
          >
            {settingsNotice.message}
          </div>
        )}

        <div className="space-y-2">
          {children.map((c) => {
            const isEditing = editingId === c.id;
            const needsDeleteConfirm = deletingId === c.id;
            const isDeletePending = deletePendingId === c.id;
            return (
              <div key={c.id} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="아이 이름"
                      className="min-h-11 w-full rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-sage focus:ring-4 focus:ring-sagebg"
                    />
                    <select
                      value={editAge}
                      onChange={(e) => setEditAge(e.target.value)}
                      className="min-h-11 w-full rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-sage focus:ring-4 focus:ring-sagebg"
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
                        className="min-h-11 flex-1 rounded-xl bg-saged py-2 text-sm font-black text-white"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="min-h-11 flex-1 rounded-xl bg-mist py-2 text-sm font-bold text-ink2"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sagebg text-base font-black text-saged">
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-black text-ink">{c.name}</div>
                      <div className="text-[11px] font-semibold text-ink3">
                        {c.age}세 · {styleLabel(c.styles?.[0])} · {topicLabel(c.topics?.[0])}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => startEdit(c)}
                        disabled={Boolean(deletePendingId)}
                        className="min-h-10 rounded-xl px-3 text-xs font-black text-saged hover:bg-mist"
                      >
                        편집
                      </button>
                      <button
                        onClick={() => requestDelete(c)}
                        disabled={Boolean(deletePendingId)}
                        className={`min-h-10 rounded-xl px-3 text-xs font-semibold hover:bg-mist ${
                          needsDeleteConfirm ? 'text-clay' : 'text-ink3'
                        }`}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
                {!isEditing && needsDeleteConfirm && (
                  <div className="mt-4 rounded-2xl border border-clay/25 bg-cream p-4">
                    <p className="text-sm font-black text-clay">{c.name} 이름표를 삭제할까요?</p>
                    <p className="mt-2 text-xs font-semibold leading-relaxed text-ink2">
                      삭제하면 이 아이의 이름표, 놀이 기록, 영상 시청 기록, 학습 진도가 함께 사라지고 되돌릴 수 없어요.
                      멤버십, 결제 내역, 필수 동의 기록은 보호자 계정 기준으로 남습니다.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDeletingId(null);
                          setSettingsNotice(null);
                        }}
                        disabled={isDeletePending}
                        className="min-h-11 rounded-xl bg-white px-3 text-xs font-black text-ink2 ring-1 ring-line transition hover:bg-mist disabled:opacity-50"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteChild(c.id)}
                        disabled={isDeletePending}
                        className="min-h-11 rounded-xl bg-clay px-3 text-xs font-black text-white transition hover:bg-ink disabled:opacity-60"
                      >
                        {isDeletePending ? '삭제 중...' : `${c.name} 삭제`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {children.length === 0 && (
            <div className="rounded-2xl border border-line bg-white p-6 text-center">
              <p className="text-sm font-semibold text-ink3">등록된 아이가 없어요</p>
              <button
                onClick={() => router.push('/onboarding')}
                className="mt-3 rounded-xl bg-saged px-4 py-2 text-sm font-black text-white"
              >
                첫 아이 등록하기
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 px-6">
        <h2 className="mb-3 text-sm font-black text-ink2">멤버십</h2>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.14em] text-sage">
                {membershipActive ? '이용 중' : '기본 이용'}
              </p>
              <h3 className="mt-1 text-lg font-black text-ink">
                {membershipActive ? '모리 이야기를 이어가고 있어요' : '필요할 때 멤버십을 시작할 수 있어요'}
              </h3>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">
                {membershipActive
                  ? `${fmtDate(membership.subscription?.current_period_end ?? membership.entitlement.premium_until)}까지 혜택이 유지됩니다.`
                  : '모리 이야기를 계속 이용하고 싶을 때 카드 등록 단계에서 월 구독 조건을 확인해요.'}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${membershipActive ? 'bg-sagebg text-saged' : 'bg-cream text-ink3'}`}>
              {membershipActive ? '활성' : '무료'}
            </span>
          </div>
          <Link
            href="/subscribe"
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-saged px-5 text-sm font-black text-white transition hover:bg-ink"
          >
            {membershipActive ? '멤버십 관리' : '멤버십 보기'}
          </Link>
        </section>
      </div>

      {/* Purchase history */}
      <div className="mt-6 px-6">
        <h2 className="mb-3 text-sm font-black text-ink2">결제 내역</h2>
        {purchases.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white p-6 text-center">
            <p className="text-sm font-semibold text-ink3">아직 결제 내역이 없어요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {purchases.map((p) => (
              <div key={p.id} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-ink">{BUNDLE_LABEL[p.bundle_type]}</div>
                    <div className="mt-0.5 text-[11px] font-semibold text-ink3">{fmtDate(p.created_at)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black tabular-nums text-ink">
                      ₩{p.amount_krw.toLocaleString()}
                    </div>
                    <div
                      className={`text-[11px] font-semibold mt-0.5 ${
                        p.status === 'paid'
                          ? 'text-saged'
                        : p.status === 'failed' || p.status === 'canceled'
                            ? 'text-clay'
                            : p.status === 'refunded'
                              ? 'text-ink3'
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

      <div className="mt-6 px-6">
        <h2 className="mb-3 text-sm font-black text-ink2">아이 화면 안심</h2>
        <div className="grid gap-2">
          {[
            ['광고 없음', '아이 플레이 화면에는 광고 배너를 넣지 않습니다.'],
            ['결제 버튼 없음', '구독과 결제 관리는 보호자 화면에서만 진행합니다.'],
            ['기록은 관찰 중심', '완료한 놀이와 집에서 이어볼 대화 힌트를 보여줍니다.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
              <p className="text-sm font-black text-ink">{title}</p>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-ink3">{body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 px-6">
        <h2 className="mb-3 text-sm font-black text-ink2">개인정보 권리</h2>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-ink">보호자 요청으로 확인하고 처리해요</p>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-ink3">
            아이 이름표 삭제는 위의 아이 관리에서 바로 할 수 있어요. 내 정보 열람, 처리 정지,
            회원 탈퇴처럼 확인이 필요한 요청은 고객센터로 보내주세요. 필수 동의·결제 기록은 요청 확인 후 함께 안내해요.
          </p>
          <div className="mt-4 grid gap-2">
            {[
              {
                label: '내 정보 열람·정정 요청',
                href: supportMailto('Kindy 개인정보 열람·정정 요청', [
                  'Kindy 개인정보 열람·정정을 요청합니다.',
                  '',
                  '확인할 내용:',
                  '요청 사유:',
                ]),
              },
              {
                label: '처리 정지·회원 탈퇴 요청',
                href: supportMailto('Kindy 개인정보 처리 정지·회원 탈퇴 요청', [
                  'Kindy 개인정보 처리 정지 또는 회원 탈퇴를 요청합니다.',
                  '',
                  '요청 유형: 처리 정지 / 회원 탈퇴 중 선택',
                  '요청 사유:',
                  '확인할 아이 이름표:',
                ]),
              },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="flex min-h-12 items-center justify-between rounded-2xl bg-mist px-4 text-sm font-black text-saged transition hover:bg-sagebg"
              >
                <span>{item.label}</span>
                <svg className="h-4 w-4 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </a>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 px-6">
        <h2 className="mb-3 text-sm font-black text-ink2">계정</h2>
        <div className="divide-y divide-line rounded-2xl border border-line bg-white shadow-sm">
          <Link href="/legal/privacy" className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-mist">
            <span className="text-sm font-semibold text-ink2">개인정보 처리방침</span>
            <svg className="h-4 w-4 text-ink3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
          <Link href="/legal/terms" className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-mist">
            <span className="text-sm font-semibold text-ink2">이용약관</span>
            <svg className="h-4 w-4 text-ink3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
          <a href={`mailto:${businessInfo.email}`} className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-mist">
            <span className="text-sm font-semibold text-ink2">문의하기</span>
            <svg className="h-4 w-4 text-ink3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </a>
        </div>
        <p className="mt-4 text-center text-[11px] font-semibold text-ink3">Kindy Mori</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-cream"><p className="text-ink3">모리가 설정을 불러오는 중...</p></div>}>
      <SettingsContent />
    </Suspense>
  );
}
