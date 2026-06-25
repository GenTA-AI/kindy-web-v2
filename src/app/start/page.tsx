'use client';

import { Suspense, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase-browser';
import { ATTRIBUTION_COOKIE, ATTRIBUTION_COOKIE_MAX_AGE_DAYS } from '@/lib/attribution';

/**
 * /start?ks=<qr_token> — 키오스크 QR 랜딩 (퍼널: 키오스크 데모 → 가정 전환).
 * 1) ks 토큰을 90일 쿠키(kindy_attr)에 보관
 * 2) 이미 로그인된 부모면 즉시 /api/attribution/claim 으로 first-touch 연결
 * 3) 앱 안내 + 가입 CTA(/auth/login)
 */
function StartContent() {
  const searchParams = useSearchParams();
  const ks = searchParams.get('ks');
  const claimedRef = useRef(false);

  useEffect(() => {
    if (ks) {
      const maxAge = ATTRIBUTION_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
      document.cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(ks)}; path=/; max-age=${maxAge}; samesite=lax`;
    }

    if (claimedRef.current) return;
    claimedRef.current = true;

    // 이미 로그인된 부모면 바로 attribution 연결 (실패해도 UI 를 막지 않음).
    (async () => {
      try {
        const supabase = createBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        await fetch('/api/attribution/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ks ? { ks } : {}),
        });
      } catch {
        // 퍼널 측정 실패는 조용히 무시.
      }
    })();
  }, [ks]);

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-[375px] mx-auto px-6 py-12">
        <p className="text-[11px] font-bold text-violet-500 tracking-wider uppercase mb-2">
          AI 책 놀이, 재미있었나요?
        </p>
        <h1 className="text-2xl font-extrabold text-gray-900 leading-snug mb-3">
          집에서도 Kindy와
          <br />
          이어서 놀아요
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-8">
          방금 키오스크에서 만난 이야기 그대로, 우리 아이 취향에 맞춘 학습 영상과 놀이가
          매주 새로 도착해요.
        </p>

        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="text-[10px] font-bold text-violet-500 tracking-wider uppercase mb-2">
            이렇게 시작해요
          </div>
          <ol className="space-y-3 text-sm text-gray-600">
            <li className="flex gap-3">
              <span className="w-6 h-6 flex-shrink-0 rounded-full bg-violet-50 text-violet-600 text-xs font-extrabold flex items-center justify-center">1</span>
              <span><b className="text-gray-900">부모님 계정 만들기</b> — 카카오 또는 이메일로 1분이면 끝나요.</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 flex-shrink-0 rounded-full bg-violet-50 text-violet-600 text-xs font-extrabold flex items-center justify-center">2</span>
              <span><b className="text-gray-900">아이 등록</b> — 이름과 취향만 알려주세요.</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 flex-shrink-0 rounded-full bg-violet-50 text-violet-600 text-xs font-extrabold flex items-center justify-center">3</span>
              <span><b className="text-gray-900">iPad 앱에서 시청</b> — 앱 다운로드 안내를 가입 후 보내드려요.</span>
            </li>
          </ol>
        </div>

        <Link
          href="/auth/login?next=/onboarding"
          className="block w-full text-center px-6 py-4 bg-violet-500 hover:bg-violet-600 text-white font-bold text-base rounded-2xl shadow-lg shadow-violet-200/60 active:scale-[0.98] transition"
        >
          Kindy 시작하기
        </Link>
        <p className="text-[11px] text-gray-400 text-center mt-3">
          가입은 무료 · 첫 영상도 무료로 만들어드려요
        </p>
      </div>
    </main>
  );
}

export default function StartPage() {
  return (
    <Suspense fallback={null}>
      <StartContent />
    </Suspense>
  );
}
