import Link from 'next/link';

export default function DemoIndex() {
  return (
    <div className="min-h-screen bg-violet-50 px-6 py-12">
      <div className="mx-auto max-w-md">
        <p className="text-[11px] font-bold uppercase tracking-wider text-violet-500">Kindy 데모</p>
        <h1 className="mt-1 text-2xl font-extrabold text-gray-900">헤비 유저 UI 샘플</h1>
        <p className="mt-2 text-sm text-gray-600">스크린샷용 정적 데모 페이지입니다. API/인증 호출 없음.</p>

        <div className="mt-8 space-y-3">
          <Link
            href="/demo/kiosk"
            className="block rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">/demo/kiosk</p>
            <h2 className="mt-1 text-base font-bold text-gray-900">도서관 키오스크 (가로)</h2>
            <p className="mt-1 text-xs text-gray-500">꿈샘 어린이실 · 3문항 그림 퀴즈 · QR 집에서 이어보기</p>
          </Link>
          <Link
            href="/demo/ipad"
            className="block rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">/demo/ipad</p>
            <h2 className="mt-1 text-base font-bold text-gray-900">아이 iPad 화면 (세로)</h2>
            <p className="mt-1 text-xs text-gray-500">영상 종료 직후 · 이모지 리액션 · engine 다음 영상 reframing</p>
          </Link>
          <Link
            href="/demo/dashboard"
            className="block rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">/demo/dashboard</p>
            <h2 className="mt-1 text-base font-bold text-gray-900">부모 대시보드 (헤비 유저)</h2>
            <p className="mt-1 text-xs text-gray-500">12편 시청 · 87% 완주율 · 취향 프로파일 활성</p>
          </Link>
          <Link
            href="/demo/library"
            className="block rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">/demo/library</p>
            <h2 className="mt-1 text-base font-bold text-gray-900">라이브러리 (헤비 유저)</h2>
            <p className="mt-1 text-xs text-gray-500">14편 카드 · 이어보기 스트립 · NEW/HOT 뱃지</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
