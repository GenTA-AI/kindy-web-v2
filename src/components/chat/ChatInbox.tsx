'use client';

import Image from 'next/image';
import Link from 'next/link';
import ChatAvatar from '@/components/chat/ChatAvatar';
import type { StoryChatActor, StoryChatRoomPreview } from '@/types/story-chat';

interface ChatInboxProps {
  child: StoryChatActor;
  rooms: StoryChatRoomPreview[];
  onOpenRoom?: (room: StoryChatRoomPreview) => void;
}

function ForwardIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
    </svg>
  );
}

function NoticeArtwork({ room }: { room: StoryChatRoomPreview }) {
  const actor = room.participants[0];
  return actor ? (
    <ChatAvatar actor={actor} size="md" decorative />
  ) : (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-line bg-mist text-base font-bold text-saged">
      K
    </span>
  );
}

function NoticeRow({ room }: { room: StoryChatRoomPreview }) {
  return (
    <div className="flex min-h-20 items-center gap-3 py-4">
      <NoticeArtwork room={room} />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <h3 className="truncate text-[16px] font-bold text-ink">{room.title}</h3>
          <time className="shrink-0 text-[14px] text-ink2">{room.updatedLabel}</time>
        </div>
        <p className="mt-1 truncate text-[16px] leading-6 text-ink2">{room.lastMessage}</p>
      </div>
      <span className="shrink-0 text-ink2"><ForwardIcon className="h-5 w-5" /></span>
    </div>
  );
}

function WorldInvitation({ room }: { room: StoryChatRoomPreview }) {
  const actor = room.participants[0];

  return (
    <article className="overflow-hidden border border-ink/20 bg-white transition-colors hover:border-saged">
      <div className="relative aspect-[16/9] bg-deep">
        {room.coverUrl && (
          <Image
            src={room.coverUrl}
            alt="그림 속 탐정단 세계 미리보기"
            fill
            preload
            sizes="(max-width: 480px) calc(100vw - 40px), 438px"
            className="object-cover"
          />
        )}
      </div>
      <div className="p-5">
        <div className="flex items-center gap-3">
          {actor && <ChatAvatar actor={actor} size="sm" decorative />}
          <div>
            <p className="text-[14px] font-semibold tracking-[0.04em] text-sage">새로 도착한 초대</p>
            <p className="mt-0.5 text-[14px] text-ink2">{room.subtitle}</p>
          </div>
        </div>
        <h2 className="mt-4 text-[24px] font-bold leading-8 tracking-[-0.02em] text-ink">{room.title}</h2>
        <p className="mt-2 text-[16px] leading-7 text-ink2">{room.lastMessage}</p>
      </div>
      <div className="flex min-h-14 items-center justify-between border-t border-line px-5 text-[16px] font-bold text-saged">
        <span>초대장 열기</span>
        <ForwardIcon />
      </div>
    </article>
  );
}

export default function ChatInbox({ child, rooms, onOpenRoom }: ChatInboxProps) {
  const invitations = rooms.filter((room) => room.kind === 'world_invite');
  const notices = rooms.filter((room) => room.kind === 'notice');

  const roomLink = (room: StoryChatRoomPreview, children: React.ReactNode) => (
    onOpenRoom ? (
      <button
        type="button"
        className="block min-h-12 w-full touch-manipulation text-left"
        onClick={() => onOpenRoom(room)}
        aria-label={`${room.title} 대화방 열기`}
      >
        {children}
      </button>
    ) : (
      <Link href={room.href} className="block min-h-12 touch-manipulation" aria-label={`${room.title} 대화방 열기`}>
        {children}
      </Link>
    )
  );

  return (
    <main className="min-h-dvh bg-[#F1EEE7] text-ink">
      <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-cream md:border-x md:border-line">
        <header className="border-b border-line px-5 pb-5 pt-[max(24px,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-[30px] font-bold leading-9 tracking-[-0.03em]">대화</h1>
              <p className="mt-1 text-[16px] text-ink2">{child.name}이의 이야기 세계</p>
            </div>
            <ChatAvatar actor={child} size="md" />
          </div>
        </header>

        <section aria-labelledby="new-world-heading" className="px-5 py-6">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="new-world-heading" className="text-[17px] font-bold">새로운 세계</h2>
            <p className="text-[14px] text-ink2">초대 {invitations.length}개</p>
          </div>
          <div className="space-y-4">
            {invitations.map((room) => (
              <div key={room.id}>{roomLink(room, <WorldInvitation room={room} />)}</div>
            ))}
            {invitations.length === 0 && (
              <p className="border border-line bg-white p-5 text-[16px] leading-7 text-ink2">
                새 세계가 도착하면 이곳에 초대장이 보여요.
              </p>
            )}
          </div>
        </section>

        <section aria-labelledby="notice-room-heading" className="px-5 pb-[max(36px,env(safe-area-inset-bottom))] pt-2">
          <h2 id="notice-room-heading" className="mb-2 text-[17px] font-bold">알림</h2>
          <ul className="divide-y divide-line border-y border-line">
            {notices.map((room) => (
              <li key={room.id}>{roomLink(room, <NoticeRow room={room} />)}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
