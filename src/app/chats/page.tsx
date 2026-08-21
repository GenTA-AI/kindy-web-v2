import ChatInbox from '@/components/chat/ChatInbox';
import { DEMO_CHAT_ROOMS, DEMO_CHILD } from '@/lib/story-chat/demo-data';

export default function ChatsPage() {
  return <ChatInbox child={DEMO_CHILD} rooms={DEMO_CHAT_ROOMS} />;
}
