import { notFound } from 'next/navigation';
import StoryChatRoom from '@/components/chat/StoryChatRoom';
import { DEMO_STORY_CHAT_ROOMS } from '@/lib/story-chat/demo-data';

export function generateStaticParams() {
  return Object.keys(DEMO_STORY_CHAT_ROOMS).map((roomId) => ({ roomId }));
}

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const room = DEMO_STORY_CHAT_ROOMS[roomId];

  if (!room) notFound();

  return <StoryChatRoom room={room} />;
}
