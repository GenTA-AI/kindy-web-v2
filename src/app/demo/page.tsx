import Link from 'next/link';

const DEMOS = [
  {
    href: '/demo/kiosk',
    label: '짧은 체험',
    title: '모리 3분 체험',
    body: '영상 하나, 단서 질문 하나, 놀이 기록 하나를 빠르게 확인해요.',
  },
  {
    href: '/demo/mori',
    label: '모리 영상',
    title: '영상 보고 기록 미리보기',
    body: '모리 이야기 영상을 보고 아이가 고른 단서와 다음에 해볼 놀이를 확인해요.',
  },
  {
    href: '/sample/library',
    label: '이야기 숲',
    title: '첫 이야기 미리보기',
    body: '가입 전에도 영상과 단서 놀이가 어떻게 이어지는지 볼 수 있어요.',
  },
  {
    href: '/onboarding',
    label: '집에서 시작',
    title: '오늘의 모리 모험',
    body: '아이 이름표를 만들고 영상과 단서 놀이를 지나 보호자 기록으로 이어져요.',
  },
  {
    href: '/sample/report',
    label: '보호자 화면',
    title: '첫 놀이 기록',
    body: '완료한 놀이, 다시 본 순간, 다음 대화 힌트를 봐요.',
  },
];

export default function DemoIndex() {
  return (
    <main className="min-h-screen bg-cream px-6 py-12 text-ink">
      <div className="mx-auto max-w-md">
        <p className="text-[11px] font-black uppercase tracking-wider text-sage">모리 미리보기</p>
        <h1 className="mt-1 text-2xl font-black">지금 확인할 화면</h1>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-ink2">
          고객이 실제로 보게 될 체험, 아이 플레이, 보호자 기록 화면만 모았습니다.
        </p>

        <div className="mt-8 space-y-3">
          {DEMOS.map((demo) => (
            <Link
              key={demo.href}
              href={demo.href}
              className="block rounded-2xl border border-line bg-white p-5 shadow-sm transition hover:bg-mist"
            >
              <p className="text-[10px] font-black uppercase tracking-wider text-sage">{demo.label}</p>
              <h2 className="mt-1 text-base font-black text-ink">{demo.title}</h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-ink3">{demo.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
