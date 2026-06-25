'use client';

import Link from 'next/link';

interface ProfileRow {
  tag: string;
  score: number;
}

const CHILD_NAME = '서연';

const TIER1: ProfileRow[] = [
  { tag: '부드럽고 빛나는', score: 94 },
  { tag: '공주 캐릭터', score: 91 },
  { tag: '잔잔한 배경음악', score: 86 },
];

const TIER2: ProfileRow[] = [
  { tag: '판타지 세계관', score: 72 },
  { tag: '동물 친구', score: 64 },
];

const TIER3: ProfileRow[] = [
  { tag: '빠른 전개', score: 31 },
];

interface DemoVideo {
  id: string;
  episode_number: number;
  title: string;
  duration_sec: number;
}

const VIDEOS: DemoVideo[] = [
  { id: 'd01', episode_number: 1, title: '공주 미리와 물의 여행', duration_sec: 30 },
  { id: 'd02', episode_number: 2, title: '얼음이 사라졌어!', duration_sec: 30 },
  { id: 'd03', episode_number: 3, title: '무지개는 어떻게 생길까?', duration_sec: 30 },
  { id: 'd04', episode_number: 4, title: '비는 왜 올까?', duration_sec: 30 },
  { id: 'd05', episode_number: 5, title: '달은 왜 모양이 바뀔까?', duration_sec: 90 },
  { id: 'd06', episode_number: 6, title: '낮과 밤은 왜 생길까?', duration_sec: 30 },
  { id: 'd07', episode_number: 7, title: '태양계 친구들을 만나자', duration_sec: 90 },
  { id: 'd08', episode_number: 8, title: 'Color Words — 색깔 친구들', duration_sec: 30 },
  { id: 'd09', episode_number: 9, title: 'Number Words — 숫자 노래', duration_sec: 30 },
  { id: 'd10', episode_number: 10, title: 'I like ~ : 좋아하는 것 말하기', duration_sec: 30 },
  { id: 'd11', episode_number: 11, title: 'ㄱㄴㄷ 소리 놀이', duration_sec: 30 },
  { id: 'd12', episode_number: 12, title: '받침 친구를 만나자', duration_sec: 90 },
];

export default function DemoDashboardPage() {
  const totalVideos = VIDEOS.length;
  const avgCompletion = 87;
  const topReplay = TIER1[0].tag;
  const creditsBalance = 8;

  return (
    <div className="min-h-screen bg-violet-50 pb-24">
      {/* Header */}
      <div className="relative rounded-b-[32px] bg-gradient-to-br from-violet-500 to-violet-400 px-6 pb-14 pt-12 text-white">
        <div className="mb-5 flex items-start justify-between">
          <button className="flex min-h-[44px] items-center gap-2 rounded-full bg-white/15 px-3 backdrop-blur-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-extrabold text-violet-600">
              서
            </div>
            <span className="text-sm font-bold">{CHILD_NAME}</span>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <button className="inline-flex min-h-[44px] items-center rounded-full bg-white px-4 text-xs font-bold text-violet-600 transition hover:bg-violet-50">
              크레딧 {creditsBalance}
            </button>
            <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur transition hover:bg-white/30" aria-label="설정">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-violet-100">이번 주 취향 리포트</div>
        <h1 className="text-[24px] font-extrabold leading-[1.3] tracking-tight">
          {CHILD_NAME}은{' '}
          <span className="rounded-xl bg-white/15 px-2 backdrop-blur">부드럽고 빛나는</span>
          <br />
          이야기를 좋아해요
        </h1>
        <p className="mt-2 text-sm text-violet-100">
          {totalVideos}편의 영상에서 학습한 선호도
        </p>
      </div>

      {/* Stats strip */}
      <div className="relative z-10 -mt-8 px-6">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl bg-white p-3.5 text-center shadow-sm">
            <div className="text-[22px] font-extrabold leading-none text-violet-600">{totalVideos}</div>
            <div className="mt-1.5 text-[11px] font-medium text-gray-400">영상 시청</div>
          </div>
          <div className="rounded-2xl bg-white p-3.5 text-center shadow-sm">
            <div className="text-[22px] font-extrabold leading-none text-violet-600">{avgCompletion}%</div>
            <div className="mt-1.5 text-[11px] font-medium text-gray-400">평균 완주율</div>
          </div>
          <div className="rounded-2xl bg-white p-3.5 text-center shadow-sm">
            <div className="truncate pt-1 text-[13px] font-bold leading-tight text-violet-600">{topReplay}</div>
            <div className="mt-1 text-[11px] font-medium text-gray-400">TOP 반복</div>
          </div>
        </div>
      </div>

      {/* Taste profile card */}
      <div className="mt-5 px-6">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="text-base font-bold text-gray-900">취향 프로파일</h2>
            <span className="text-[11px] font-semibold text-violet-500">{totalVideos}편 학습</span>
          </div>

          <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-violet-500">매우 좋아함</div>
          <div className="mb-5 space-y-3">
            {TIER1.map((row) => (
              <div key={row.tag}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-sm font-bold text-gray-800">{row.tag}</span>
                  <span className="text-sm font-extrabold tabular-nums text-violet-600">{row.score}</span>
                </div>
                <div className="h-[7px] overflow-hidden rounded-full bg-violet-50">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${row.score}%`,
                      background: 'linear-gradient(90deg, #79A271 0%, #335A2E 100%)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mb-3 border-t border-gray-100 pt-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">좋아함</div>
          <div className="mb-5 space-y-3">
            {TIER2.map((row) => (
              <div key={row.tag}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-gray-600">{row.tag}</span>
                  <span className="text-sm font-bold tabular-nums text-gray-500">{row.score}</span>
                </div>
                <div className="h-[7px] overflow-hidden rounded-full bg-gray-50">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${row.score}%`,
                      background: 'linear-gradient(90deg, #C2D5B9 0%, #79A271 100%)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mb-3 border-t border-gray-100 pt-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">아직 잘 모르겠어요</div>
          <div className="space-y-3">
            {TIER3.map((row) => (
              <div key={row.tag}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-sm font-medium text-gray-400">{row.tag}</span>
                  <span className="text-sm font-bold tabular-nums text-gray-400">{row.score}</span>
                </div>
                <div className="h-[7px] overflow-hidden rounded-full bg-gray-50">
                  <div className="h-full rounded-full bg-gray-300" style={{ width: `${row.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Video list */}
      <div className="mt-5 px-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-gray-700">{CHILD_NAME}의 영상</h2>
          <Link href="/demo/library" className="text-[11px] font-semibold text-violet-500">
            라이브러리 →
          </Link>
        </div>
        <div className="space-y-2">
          {VIDEOS.map((video) => (
            <button
              key={video.id}
              className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm transition hover:shadow-md"
            >
              <div className="flex h-12 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xs font-bold text-violet-500">
                EP.{video.episode_number}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-800">{video.title}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {`${Math.floor(video.duration_sec / 60)}:${(video.duration_sec % 60).toString().padStart(2, '0')}`}
                </p>
              </div>
              <span className="text-base text-violet-400">▶</span>
            </button>
          ))}
        </div>
      </div>

      {/* Insight + CTA */}
      <div className="mt-5 px-6">
        <div className="mb-3 rounded-2xl border border-violet-100 bg-white p-4">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-500">다음 영상</div>
          <p className="text-sm font-semibold leading-relaxed text-violet-900">
            "부드럽고 빛나는 공주 토끼" 스타일로 만들어져요
          </p>
        </div>
        <button className="w-full rounded-2xl bg-violet-500 py-4 text-base font-bold text-white shadow-lg shadow-violet-200/60 transition hover:bg-violet-600 active:scale-[0.98]">
          새 영상 만들기
        </button>
        <p className="mt-2 text-center text-[11px] text-gray-400">
          계정 크레딧 {creditsBalance}개 · {CHILD_NAME}에게 할당
        </p>
      </div>

      {/* Bottom nav mock */}
      <div className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-md -translate-x-1/2 border-t border-gray-100 bg-white px-2 pb-6 pt-2">
        <NavItem active label="홈" icon={
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        } />
        <NavItem label="영상" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        } />
        <NavItem label="설정" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        } />
      </div>
    </div>
  );
}

function NavItem({ label, icon, active = false }: { label: string; icon: React.ReactNode; active?: boolean }) {
  return (
    <div className={`flex flex-1 flex-col items-center gap-0.5 py-1 ${active ? 'text-violet-500' : 'text-gray-400'}`}>
      {icon}
      <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </div>
  );
}
