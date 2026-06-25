'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import StyleGrid from '@/components/StyleGrid';
import { createBrowserClient } from '@/lib/supabase-browser';

type Step = 1 | 2 | 3;

// 정서+창의 통합 프로그램 하나뿐 — 프로그램 선택 단계 없이 항상 이 토픽으로 고정.
const PROGRAM_TOPIC = 'future_skills';

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addMode = searchParams.get('add') === '1';   // 기존 parent 가 아이 추가하는 케이스 — PIPA 스킵
  const totalSteps = addMode ? 2 : 3;
  const [step, setStep] = useState<Step>(1);
  const [authReady, setAuthReady] = useState(false);
  const [parentEmail, setParentEmail] = useState<string>('');

  // Step 1 — identity
  const [name, setName] = useState('');
  const [age, setAge] = useState('');

  // Step 2 — 취향 설문 (아이와 부모가 함께 고르는 스타일)
  const [styles, setStyles] = useState<string[]>([]);

  // Step 3 — PIPA consent (real phone verification deferred to PG checkout)
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentChild, setConsentChild] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAge = parseInt(age) || 0;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        const next = addMode ? '/onboarding?add=1' : '/onboarding';
        router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
        return;
      }

      setParentEmail(user.email ?? '');
      setAuthReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [addMode, router]);

  const allConsented = consentTerms && consentPrivacy && consentChild;
  const canSubmit = addMode ? !submitting : (allConsented && !submitting);

  const toggleAll = (checked: boolean) => {
    setConsentTerms(checked);
    setConsentPrivacy(checked);
    setConsentChild(checked);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      // PIPA consent confirmed via the 3 checkboxes above. Phone verification is handled
      // by the PG (Toss/Cafe24) at checkout time, so no separate SMS step here.

      // Option B(공유 영상 풀 매칭): 온보딩 시 per-child bespoke 영상을 생성하지 않는다.
      // 아이는 통합 프로그램(future_skills)으로 등록되고, /play 가 공유 라이브러리에서 매칭한다.
      const childRes = await fetch('/api/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, age: selectedAge, styles, topics: [PROGRAM_TOPIC] }),
      });
      const child = await childRes.json();
      if (!child?.id) throw new Error(child?.error ?? '아이 등록 실패');

      // 라이브러리 우회 없이 바로 첫 세션으로.
      router.push(`/play?childId=${child.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-violet-50 flex items-center justify-center">
        <p className="text-sm font-medium text-gray-400">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white">
      <div className="max-w-[375px] mx-auto px-6 py-10">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          <div className="text-[11px] font-bold text-violet-500 tracking-wider uppercase whitespace-nowrap">
            Step {step} / {totalSteps}
          </div>
          <div className="flex-1 flex gap-1">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all ${
                  s <= step ? 'bg-violet-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div>
            <h1 className="text-[26px] font-extrabold text-gray-900 leading-[1.3]">
              아이 정보를<br />알려주세요
            </h1>
            <p className="text-gray-500 text-sm mt-2 leading-relaxed">
              이름과 나이에 맞춰 학습 콘텐츠를 구성해드려요.
            </p>

            <div className="space-y-4 mt-8">
              <div>
                <label htmlFor="onboarding-child-name" className="block text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-2">아이 이름</label>
                <input
                  id="onboarding-child-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 서연"
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 text-base focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="onboarding-child-age" className="block text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-2">나이</label>
                <select
                  id="onboarding-child-age"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 text-base focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"
                >
                  <option value="">선택해주세요</option>
                  {[3, 4, 5, 6, 7, 8].map((a) => (
                    <option key={a} value={a}>
                      {a}세
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!name || !age}
              className="w-full mt-8 py-4 bg-violet-500 text-white font-bold rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-violet-600 shadow-lg shadow-violet-200/60 active:scale-[0.98] transition"
            >
              다음
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-[26px] font-extrabold text-gray-900 leading-[1.3]">
              {name && `${name}와 `}함께<br />골라요
            </h1>
            <p className="text-gray-500 text-sm mt-2 leading-relaxed">
              아이에게 &quot;어떤 게 제일 좋아?&quot; 물어보며 같이 골라주세요.<br />
              좋아하는 스타일에 맞춰 이야기를 보여드려요.
            </p>

            <div className="mt-6">
              <StyleGrid
                selected={styles}
                onToggle={(id) => setStyles((prev) => (prev.includes(id) ? [] : [id]))}
              />
            </div>

            <button
              onClick={() => {
                if (addMode) {
                  handleSubmit();
                } else {
                  setStep(3);
                }
              }}
              disabled={styles.length === 0 || submitting}
              className="w-full mt-8 py-4 bg-violet-500 text-white font-bold rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-violet-600 shadow-lg shadow-violet-200/60 active:scale-[0.98] transition"
            >
              {addMode ? (submitting ? '추가 중...' : `${name || '아이'} 추가하기`) : '다음'}
            </button>
            {addMode && error && <p className="text-xs text-red-500 mt-2 text-center">{error}</p>}
            <button
              onClick={() => setStep(1)}
              disabled={submitting}
              className="w-full mt-2 py-2 text-gray-400 text-[13px] font-medium hover:text-gray-600"
            >
              이전
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-[26px] font-extrabold text-gray-900 leading-[1.3]">
              마지막으로<br />동의가 필요해요
            </h1>
            <p className="text-gray-500 text-sm mt-2 leading-relaxed">
              14세 미만 아동의 데이터를 수집하려면 법정대리인(부모님)의 동의가 필요해요.
            </p>

            <div className="mt-7 bg-violet-50 rounded-2xl p-4 border border-violet-100">
              <p className="text-[11px] font-bold text-violet-500 tracking-wider uppercase mb-1.5">부모 본인 확인</p>
              <p className="text-sm font-bold text-gray-900 break-all">{parentEmail || '확인 중...'}</p>
              <p className="text-[11px] text-violet-500/80 mt-1.5 leading-relaxed">
                카카오 또는 이메일로 인증된 본인 계정이에요.
              </p>
            </div>

            <div className="mt-5 space-y-2.5">
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition">
                <input
                  type="checkbox"
                  checked={consentTerms && consentPrivacy && consentChild}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="sr-only peer"
                />
                <span className="w-5 h-5 mt-0.5 flex-shrink-0 rounded border-2 border-violet-300 peer-checked:bg-violet-500 peer-checked:border-violet-500 flex items-center justify-center transition">
                  {consentTerms && consentPrivacy && consentChild && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </span>
                <span className="text-sm font-bold text-gray-900 flex-1">전체 동의</span>
              </label>

              <div className="border-t border-gray-100 pt-2.5 space-y-1">
                <ConsentRow
                  checked={consentTerms}
                  onChange={setConsentTerms}
                  label="(필수) 이용약관 동의"
                  href="/legal/terms"
                />
                <ConsentRow
                  checked={consentPrivacy}
                  onChange={setConsentPrivacy}
                  label="(필수) 개인정보 처리방침 동의"
                  href="/legal/privacy"
                />
                <ConsentRow
                  checked={consentChild}
                  onChange={setConsentChild}
                  label={`(필수) ${name || '자녀'} 의 학습 데이터 수집·이용 동의 — 법정대리인으로 동의합니다`}
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full mt-7 py-4 bg-violet-500 text-white font-bold rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-violet-600 shadow-lg shadow-violet-200/60 active:scale-[0.98] transition"
            >
              {submitting ? '설정 중...' : '동의하고 시작하기'}
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={submitting}
              className="w-full mt-2 py-2 text-gray-400 text-[13px] font-medium hover:text-gray-600"
            >
              이전
            </button>
          </div>
        )}

        <p className="text-center text-xs text-gray-300 mt-8">
          입력하신 정보는 맞춤 영상 제작에만 사용됩니다.
        </p>
      </div>
    </div>
  );
}

function ConsentRow({
  checked,
  onChange,
  label,
  href,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  href?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer px-3 py-2.5 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <span className="w-4 h-4 mt-0.5 flex-shrink-0 rounded border-2 border-gray-300 peer-checked:bg-violet-500 peer-checked:border-violet-500 flex items-center justify-center transition">
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </span>
      <span className="text-[12px] text-gray-600 leading-relaxed flex-1">
        {label}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-1 text-violet-600 underline underline-offset-2"
          >
            보기
          </a>
        )}
      </span>
    </label>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-violet-50 flex items-center justify-center"><p className="text-gray-400">로딩 중...</p></div>}>
      <OnboardingContent />
    </Suspense>
  );
}
