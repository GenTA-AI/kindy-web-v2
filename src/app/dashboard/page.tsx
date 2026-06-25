'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Child } from '@/types';
import ChildSwitcher from '@/components/ChildSwitcher';
import { withJosa } from '@/lib/josa';

// 새 방향(정서·창의 통합 세션 · per-child 영상생성 없음 = Option B · 구독 모델):
// /dashboard = parent home = 세션 런처 + 발달 리포트 홈.
// per-video 결제/크레딧/영상생성/취향(princess·space) 하드코딩은 모두 제거.

// 시즌 "나만의 이야기" 진행 placeholder(라이브 데이터 연결 전).
const STORYBOOK_SLOT_PLACEHOLDER = 1;
const STORYBOOK_TOTAL_PLACEHOLDER = 5;

function safeName(child: Child | null): string {
  const name = typeof child?.name === 'string' ? child.name.trim() : '';
  return name || '우리 아이';
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const childId = searchParams.get('childId');

  const [child, setChild] = useState<Child | null>(null);
  const [loadingChild, setLoadingChild] = useState(true);
  const [childError, setChildError] = useState(false);
  const [childrenRedirectChecked, setChildrenRedirectChecked] = useState(false);

  // childId 가 있을 때만 해당 아이를 안전하게 로드.
  const load = useCallback(async () => {
    if (!childId) return;
    setLoadingChild(true);
    setChildError(false);
    try {
      const res = await fetch(`/api/children?id=${childId}`);
      const data: unknown = await res.json().catch(() => null);

      // 응답이 에러/배열/누락이어도 안전하게 처리.
      if (!res.ok || !data || typeof data !== 'object' || Array.isArray(data) || !('id' in data)) {
        setChild(null);
        setChildError(true);
        return;
      }
      setChild(data as Child);
    } catch {
      setChild(null);
      setChildError(true);
    } finally {
      setLoadingChild(false);
    }
  }, [childId]);

  // childId 없으면: 자녀 없으면 /onboarding, 있으면 첫 아이로 redirect (기존 로직 유지).
  useEffect(() => {
    if (childId) return;
    let cancelled = false;
    setChildrenRedirectChecked(false);

    (async () => {
      try {
        const res = await fetch('/api/children');
        const list: unknown = await res.json().catch(() => null);
        if (cancelled) return;
        if (Array.isArray(list) && list.length === 0) {
          router.replace('/onboarding');
          return;
        }
        if (Array.isArray(list) && list.length > 0 && list[0]?.id) {
          router.replace(`/dashboard?childId=${list[0].id}`);
          return;
        }
      } catch {
        // 자녀 목록 로드 실패 시 폴백 UI 유지.
      }
      if (!cancelled) setChildrenRedirectChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [childId, router]);

  useEffect(() => {
    if (!childId) return;
    void load();
  }, [childId, load]);

  // childId 없는 상태: redirect 확인 중 → 로딩, 아니면 온보딩 안내.
  if (!childId) {
    if (!childrenRedirectChecked) {
      return (
        <div className="min-h-screen bg-violet-50 flex items-center justify-center">
          <p className="text-sm font-medium text-gray-400">로딩 중...</p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-violet-50 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-gray-500 mb-4">아이 프로필을 먼저 등록해주세요</p>
          <button
            onClick={() => router.push('/onboarding')}
            className="px-6 py-3 bg-violet-500 text-white rounded-xl font-bold"
          >
            시작하기
          </button>
        </div>
      </div>
    );
  }

  const name = safeName(child);
  const ageLabel = typeof child?.age === 'number' && Number.isFinite(child.age) ? `${child.age}세` : null;

  return (
    <div className="min-h-screen bg-violet-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-500 to-violet-400 text-white px-6 pt-12 pb-14 rounded-b-[32px]">
        <div className="flex items-start justify-between mb-6">
          <ChildSwitcher currentChildId={childId} currentChildName={child?.name} />
          <button
            onClick={() => router.push(`/dashboard/settings?childId=${childId}`)}
            className="bg-white/20 backdrop-blur rounded-full w-11 h-11 flex items-center justify-center hover:bg-white/30 transition"
            aria-label="설정"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>
        </div>

        <div className="text-[11px] font-bold text-violet-100 tracking-wider uppercase mb-2">미래역량 홈</div>
        <h1 className="text-[24px] font-extrabold leading-[1.3] tracking-tight">
          {loadingChild ? (
            '불러오는 중...'
          ) : (
            <>
              {withJosa(name, '은/는')}<br />
              <span className="bg-white/15 backdrop-blur px-2 rounded-xl">생각하는 힘</span>을 키우고 있어요
            </>
          )}
        </h1>
        <p className="text-violet-100 text-sm mt-2">
          {ageLabel ? `${ageLabel} · ` : ''}이야기와 놀이로 사고력·표현·문제해결을 함께 길러요.
        </p>
        {childError && (
          <p className="text-violet-100/90 text-xs mt-2">
            아이 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </p>
        )}
      </div>

      {/* 주 CTA — 오늘의 이야기 시작하기 */}
      <div className="px-6 -mt-8 relative z-10">
        <button
          onClick={() => router.push(`/play?childId=${childId}`)}
          className="w-full bg-white rounded-3xl p-6 shadow-lg shadow-violet-200/50 text-left active:scale-[0.99] transition"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center text-2xl flex-shrink-0">
              ▶
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-violet-500 tracking-wider uppercase">오늘의 세션</p>
              <h2 className="text-xl font-extrabold text-gray-900 leading-snug">오늘의 이야기 시작하기</h2>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">영상 한 편과 놀이로 약 15~20분</p>
            </div>
          </div>
        </button>
      </div>

      {/* 발달 리포트 카드 */}
      <div className="px-6 mt-4">
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">이번 주 발달 리포트</h2>
            <span className="text-[11px] text-violet-500 font-semibold">미래역량</span>
          </div>
          <p className="text-sm font-semibold leading-relaxed text-gray-600">
            이야기를 시작하면 발달 기록이 쌓여요. 완료한 활동만 보여드리고, 능력을 점수로 단정하지 않아요.
          </p>
          <button
            onClick={() => router.push(`/dashboard/report?childId=${childId}`)}
            className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-violet-50 px-6 text-sm font-bold text-violet-700 transition hover:bg-violet-100"
          >
            리포트 보기
          </button>
        </div>
      </div>

      {/* 나만의 이야기 진행 */}
      <div className="px-6 mt-4">
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">나만의 이야기</h2>
            <span className="text-[11px] text-violet-500 font-semibold">
              {STORYBOOK_SLOT_PLACEHOLDER}/{STORYBOOK_TOTAL_PLACEHOLDER}칸
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-700">
            나만의 이야기 {STORYBOOK_SLOT_PLACEHOLDER}칸째를 채우고 있어요
          </p>
          <div
            className="mt-4 flex gap-1.5"
            aria-label={`나만의 이야기 ${STORYBOOK_TOTAL_PLACEHOLDER}칸 중 ${STORYBOOK_SLOT_PLACEHOLDER}칸`}
          >
            {Array.from({ length: STORYBOOK_TOTAL_PLACEHOLDER }, (_, i) => (
              <div
                key={i}
                className={`h-2.5 flex-1 rounded-full ${i < STORYBOOK_SLOT_PLACEHOLDER ? 'bg-violet-500' : 'bg-violet-100'}`}
              />
            ))}
          </div>
          <p className="mt-3 text-xs font-medium leading-relaxed text-gray-400">
            세션을 마칠 때마다 이야기책이 한 칸씩 채워져요.
          </p>
        </div>
      </div>

      {/* 하단: 설정 링크 */}
      <div className="px-6 mt-4">
        <button
          onClick={() => router.push(`/dashboard/settings?childId=${childId}`)}
          className="w-full rounded-2xl bg-white px-5 py-4 text-left text-sm font-semibold text-gray-600 shadow-sm transition hover:text-gray-900"
        >
          설정
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-violet-50 flex items-center justify-center"><p className="text-gray-400">로딩 중...</p></div>}>
      <DashboardContent />
    </Suspense>
  );
}
