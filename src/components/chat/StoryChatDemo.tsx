'use client';

import { useState } from 'react';
import ChatInbox from '@/components/chat/ChatInbox';
import StoryChatRoom from '@/components/chat/StoryChatRoom';
import {
  DEMO_CHAT_ROOMS,
  DEMO_CHILD,
  DEMO_STORY_CHAT_ROOMS,
} from '@/lib/story-chat/demo-data';

interface StoryChatDemoProps {
  initialRoomId?: string;
}

/**
 * 라우트·API 연결 전에도 /chats 전체 흐름을 한 번에 확인하는 데모 셸.
 * 실제 페이지에서는 ChatInbox와 StoryChatRoom을 각각 직접 사용할 수 있다.
 */
export default function StoryChatDemo({ initialRoomId }: StoryChatDemoProps) {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(initialRoomId ?? null);
  const activeRoom = activeRoomId ? DEMO_STORY_CHAT_ROOMS[activeRoomId] : null;

  if (activeRoom) {
    return <StoryChatRoom key={activeRoom.preview.id} room={activeRoom} onBack={() => setActiveRoomId(null)} />;
  }

  return (
    <ChatInbox
      child={DEMO_CHILD}
      rooms={DEMO_CHAT_ROOMS}
      onOpenRoom={(room) => setActiveRoomId(room.id)}
    />
  );
}
