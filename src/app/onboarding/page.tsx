'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MoriCharacter from '@/components/MoriCharacter';
import StyleGrid from '@/components/StyleGrid';
import { resolveOnboardingCompletionPath } from '@/lib/launch-surface';
import { createBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase-browser';

type Step = 1 | 2 | 3;

const PROGRAM_TOPIC = 'future_skills';
const AUTH_CHECK_TIMEOUT_MS = 4500;

type ChildCreateResponse = {
  id?: string;
  error?: string;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | 'timeout'> {
  return Promise.race([
    promise,
    new Promise<'timeout'>((resolve) => {
      window.setTimeout(() => resolve('timeout'), timeoutMs);
    }),
  ]);
}

function OnboardingContent() {
  const router = useRouter();
  const [addMode, setAddMode] = useState(false);
  const totalSteps = 3;
  const [step, setStep] = useState<Step>(1);
  const [authReady, setAuthReady] = useState(false);
  const [parentEmail, setParentEmail] = useState<string>('');
  const [requestedNext, setRequestedNext] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [styles, setStyles] = useState<string[]>([]);
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentChild, setConsentChild] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAge = parseInt(age) || 0;

  const loginNextPath = () => {
    const current = `${window.location.pathname}${window.location.search || ''}`;
    return `/auth/login?next=${encodeURIComponent(current)}`;
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setAddMode(searchParams.get('add') === '1');
    setRequestedNext(searchParams.get('next'));
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!isSupabaseBrowserConfigured()) {
        setParentEmail('local-preview@kindy.local');
        setAuthReady(true);
        return;
      }

      const supabase = createBrowserClient();
      const authResult = await withTimeout(supabase.auth.getSession(), AUTH_CHECK_TIMEOUT_MS);

      if (cancelled) return;

      if (authResult === 'timeout' || authResult.error || !authResult.data.session?.user) {
        const next = `${window.location.pathname}${window.location.search || ''}`;
        router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
        return;
      }

      setParentEmail(authResult.data.session.user.email ?? '');
      setAuthReady(true);
    })().catch(() => {
      if (!cancelled) {
        const next = `${window.location.pathname}${window.location.search || ''}`;
        router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [addMode, router]);

  const allConsented = consentTerms && consentPrivacy && consentChild;
  const canSubmit = allConsented && !submitting;

  const toggleAll = (checked: boolean) => {
    setConsentTerms(checked);
    setConsentPrivacy(checked);
    setConsentChild(checked);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!name.trim()) {
      setError('아이 이름을 입력해 주세요.');
      setStep(1);
      return;
    }
    if (!selectedAge) {
      setError('아이 나이를 선택해 주세요.');
      setStep(1);
      return;
    }
    if (styles.length === 0) {
      setError('좋아하는 숲길을 하나 골라 주세요.');
      setStep(2);
      return;
    }
    if (!allConsented) {
      setError('필수 동의를 확인해 주세요.');
      setStep(3);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const childRes = await fetch('/api/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          age: selectedAge,
          styles,
          topics: [PROGRAM_TOPIC],
          parent_consent: true,
        }),
      });
      const child = (await childRes.json().catch(() => null)) as ChildCreateResponse | null;

      if (childRes.status === 401) {
        router.replace(loginNextPath());
        return;
      }
      if (!childRes.ok || !child?.id) {
        throw new Error(child?.error ?? '아이 이름표를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
      }

      router.push(resolveOnboardingCompletionPath(requestedNext, child.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '아이 이름표를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-sm font-bold text-ink3">모리가 숲 문을 여는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream text-ink [word-break:keep-all]">
      <div className="mx-auto grid min-h-screen w-full max-w-5xl grid-cols-1 lg:grid-cols-[.88fr_1.12fr]">
        <aside className="hidden border-r border-line bg-mist p-8 lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3 text-xl font-black">
              <MoriCharacter className="h-12 w-12 overflow-hidden rounded-full border border-line bg-white" imageClassName="scale-125" label="모리" withGlow={false} />
              Kindy Mori
            </div>
            <h1 className="mt-10 text-4xl font-black leading-tight tracking-[-.03em]">
              아이 이름표를 만들면{' '}
              <br />
              바로 첫 영상이 열려요.
            </h1>
            <p className="mt-4 text-base font-semibold leading-relaxed text-ink2">
              이름, 나이, 좋아하는 숲길만 확인하면 바로 첫 플레이로 이어집니다.
            </p>
          </div>
          <MoriCharacter className="aspect-square w-full overflow-hidden rounded-[36px] border border-line bg-white shadow-sm" label="모리" />
        </aside>

        <main className="flex items-center px-5 py-8 sm:px-8">
          <div className="mx-auto w-full max-w-[460px]">
            <div className="mb-7 flex items-center gap-2">
              <div className="text-[11px] font-black uppercase tracking-[.16em] text-sage">
                시작 {step} / {totalSteps}
              </div>
              <div className="flex flex-1 gap-1.5">
                {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
                  <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-sage' : 'bg-line'}`} />
                ))}
              </div>
            </div>

            {step === 1 && (
              <section>
                <p className="text-xs font-black uppercase tracking-[.16em] text-sage">아이의 이름표</p>
                <h2 className="mt-2 text-[30px] font-black leading-tight tracking-[-.02em]">
                  모리가 어떻게 부르면 좋을까요?
                </h2>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-ink2">
                  아이 이름과 나이에 맞춰 말투와 놀이 길이를 부드럽게 맞춥니다.
                </p>

                <div className="mt-8 space-y-4">
                  <div>
                    <label htmlFor="onboarding-child-name" className="mb-2 block text-[11px] font-black uppercase tracking-[.14em] text-ink3">아이 이름</label>
                    <input
                      id="onboarding-child-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="예: 서연"
                      className="w-full rounded-2xl border border-line bg-white px-4 py-4 text-base font-bold text-ink outline-none transition focus:border-sage focus:ring-4 focus:ring-sagebg"
                    />
                  </div>
                  <div>
                    <label htmlFor="onboarding-child-age" className="mb-2 block text-[11px] font-black uppercase tracking-[.14em] text-ink3">나이</label>
                    <select
                      id="onboarding-child-age"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="w-full rounded-2xl border border-line bg-white px-4 py-4 text-base font-bold text-ink outline-none transition focus:border-sage focus:ring-4 focus:ring-sagebg"
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
                  className="mt-8 min-h-14 w-full rounded-2xl bg-saged px-5 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  모리에게 알려주기
                </button>
              </section>
            )}

            {step === 2 && (
              <section>
                <p className="text-xs font-black uppercase tracking-[.16em] text-sage">좋아하는 숲길</p>
                <h2 className="mt-2 text-[30px] font-black leading-tight tracking-[-.02em]">
                  {name ? `${name}에게 ` : ''}가장 반짝이는 길은?
                </h2>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-ink2">
                  아이에게 “오늘은 어떤 길이 끌려?”라고 물어보고 하나를 골라주세요.
                </p>

                <div className="mt-6">
                  <StyleGrid
                    selected={styles}
                    onToggle={(id) => setStyles((prev) => (prev.includes(id) ? [] : [id]))}
                  />
                </div>

                <button
                  onClick={() => {
                    setStep(3);
                  }}
                  disabled={styles.length === 0}
                  className="mt-8 min-h-14 w-full rounded-2xl bg-saged px-5 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  다음
                </button>
                <button
                  onClick={() => setStep(1)}
                  className="mt-2 min-h-11 w-full text-sm font-bold text-ink3 transition hover:text-ink"
                >
                  이전
                </button>
              </section>
            )}

            {step === 3 && (
              <section>
                <p className="text-xs font-black uppercase tracking-[.16em] text-sage">보호자 확인</p>
                <h2 className="mt-2 text-[30px] font-black leading-tight tracking-[-.02em]">
                  마지막으로 보호자 동의가 필요해요.
                </h2>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-ink2">
                  14세 미만 아동의 활동 기록은 법정대리인 동의 아래 안전하게 저장합니다.
                </p>

                <div className="mt-5 grid gap-2">
                  {[
                    ['저장해요', `${name || '아이'}의 이름표, 나이, 이야기 취향, 영상·놀이 기록(완료·정답·걸린 시간 포함)`],
                    ['보여드려요', '오늘 해낸 놀이와 집에서 이어볼 대화 힌트'],
                    ['쓰지 않아요', '아이 사진, 실제 음성, 위치 정보, 광고·마케팅 목적 활용'],
                  ].map(([title, body]) => (
                    <div key={title} className="rounded-2xl border border-line bg-white px-4 py-3">
                      <p className="text-xs font-black text-sage">{title}</p>
                      <p className="mt-1 text-xs font-semibold leading-relaxed text-ink2">{body}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-7 rounded-3xl border border-line bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[.14em] text-sage">확인된 보호자 계정</p>
                  <p className="mt-2 break-all text-sm font-black text-ink">{parentEmail || '확인 중...'}</p>
                  <p className="mt-1.5 text-xs font-semibold leading-relaxed text-ink3">
                    유료 이용이 필요한 경우 결제 확인은 그 단계에서 별도로 진행됩니다.
                  </p>
                </div>

                <div className="mt-5 space-y-2.5 rounded-3xl border border-line bg-white p-3">
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl p-3 transition hover:bg-mist">
                    <input
                      type="checkbox"
                      checked={consentTerms && consentPrivacy && consentChild}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="sr-only peer"
                    />
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-sages transition peer-checked:border-sage peer-checked:bg-sage">
                      {consentTerms && consentPrivacy && consentChild && <CheckIcon />}
                    </span>
                    <span className="flex-1 text-sm font-black text-ink">전체 동의</span>
                  </label>

                  <div className="border-t border-line pt-2">
                    <ConsentRow checked={consentTerms} onChange={setConsentTerms} label="(필수) 이용약관 동의" href="/legal/terms" />
                    <ConsentRow checked={consentPrivacy} onChange={setConsentPrivacy} label="(필수) 개인정보 처리방침 동의" href="/legal/privacy" />
                    <ConsentRow checked={consentChild} onChange={setConsentChild} label={`(필수) ${name || '자녀'}의 활동 기록 수집·이용 동의`} />
                  </div>
                </div>

                {error && <p className="mt-3 text-xs font-bold text-clay">{error}</p>}

                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="mt-7 min-h-14 w-full rounded-2xl bg-saged px-5 text-base font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? '숲 문 여는 중...' : addMode ? '동의하고 새 이야기 열기' : '동의하고 첫 이야기 열기'}
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={submitting}
                  className="mt-2 min-h-11 w-full text-sm font-bold text-ink3 transition hover:text-ink"
                >
                  이전
                </button>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
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
    <div className="flex items-start gap-2 rounded-2xl px-3 py-2 transition hover:bg-mist">
      <label className="flex min-h-10 flex-1 cursor-pointer items-start gap-3 py-1">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-sages transition peer-checked:border-sage peer-checked:bg-sage">
          {checked && <CheckIcon />}
        </span>
        <span className="flex-1 text-[12px] font-semibold leading-relaxed text-ink2">
          {label}
        </span>
      </label>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 shrink-0 items-center rounded-xl px-2 text-xs font-black text-sage underline underline-offset-2 transition hover:bg-sagebg"
        >
          보기
        </a>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  return <OnboardingContent />;
}
