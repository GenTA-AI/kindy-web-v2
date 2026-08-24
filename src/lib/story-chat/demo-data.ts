import type {
  StoryChatActor,
  StoryChatRoomData,
  StoryChatRoomPreview,
} from '@/types/story-chat';

export const DEMO_CHILD: StoryChatActor = {
  id: 'child-seoyeon',
  name: '서연',
  role: 'child',
  avatarFallback: '서',
  accent: 'clay',
};

export const DEMO_MORI: StoryChatActor = {
  id: 'character-mori',
  name: '모리',
  role: 'character',
  avatarUrl: '/ip/generated/mori-cutout.png',
  avatarFallback: '모',
  accent: 'sage',
};

const KINDY_SYSTEM: StoryChatActor = {
  id: 'system-kindy',
  name: '킨디 알림',
  role: 'system',
  avatarFallback: 'K',
  accent: 'ink',
};

const MORI_POST: StoryChatActor = {
  id: 'system-mori-post',
  name: '모리의 우체국',
  role: 'system',
  avatarFallback: 'M',
  accent: 'gold',
};

export const DEMO_CHAT_ROOMS: StoryChatRoomPreview[] = [
  {
    id: 'picture-detectives',
    kind: 'world_invite',
    state: 'invited',
    title: '그림 속 탐정단',
    subtitle: '모리 · 점박이 강아지',
    lastMessage: '서연아, 그림 속에서 네 이름을 부르는 소리가 났어.',
    updatedLabel: '방금',
    href: '/chats/picture-detectives',
    coverUrl: '/landing/seurat-poster.jpg',
    participants: [DEMO_MORI],
  },
  {
    id: 'kindy-notice',
    kind: 'notice',
    state: 'active',
    title: '킨디 알림',
    subtitle: '새로운 소식과 이용 안내',
    lastMessage: '새 이야기 세계가 열렸어요.',
    updatedLabel: '오늘',
    href: '/chats/kindy-notice',
    participants: [KINDY_SYSTEM],
  },
  {
    id: 'mori-post',
    kind: 'notice',
    state: 'active',
    title: '모리의 우체국',
    subtitle: '모험이 끝난 뒤 도착하는 편지',
    lastMessage: '첫 모험을 위한 작은 약속을 확인해 봐.',
    updatedLabel: '8월 18일',
    href: '/chats/mori-post',
    participants: [MORI_POST],
  },
];

const PICTURE_DETECTIVES_ROOM: StoryChatRoomData = {
  preview: DEMO_CHAT_ROOMS[0],
  child: DEMO_CHILD,
  composer: {
    mode: 'chat',
    placeholder: '모리에게 하고 싶은 말을 써 봐',
    maxLength: 240,
    helperText: '직접 쓰거나 위의 빠른 답장을 눌러도 돼요.',
  },
  messages: [
    {
      id: 'invite-notice',
      type: 'notice',
      eyebrow: '새 세계 초대장',
      title: '1884년 파리에서 편지가 도착했어요',
      body: '이 방에서 하는 선택은 그림 속 세계에 기억돼요.',
      createdAtLabel: '오늘',
    },
    {
      id: 'mori-hello',
      type: 'character_text',
      actor: DEMO_MORI,
      text: '서연아, 와 줘서 다행이야! 그림 속 사람들이 갑자기 멈췄어. 그런데 저 점박이 강아지만 우리를 보고 있어.',
      createdAtLabel: '오후 4:20',
    },
    {
      id: 'child-first',
      type: 'child_text',
      actor: DEMO_CHILD,
      text: '강아지가 뭔가 알고 있는 거 아냐?',
      delivery: 'sent',
      createdAtLabel: '오후 4:20',
    },
    {
      id: 'mori-clue',
      type: 'character_text',
      actor: DEMO_MORI,
      text: '나도 그렇게 생각해. 방금 강아지가 노란색 점 하나를 떨어뜨렸거든. 우리가 먼저 어디를 살펴볼까?',
      createdAtLabel: '오후 4:21',
    },
    {
      id: 'first-choice',
      type: 'choice',
      eyebrow: '첫 번째 행동',
      prompt: '사라진 색점의 단서를 찾아요',
      options: [
        { id: 'follow-dog', label: '강아지를 따라간다', hint: '움직이는 단서를 쫓아가요' },
        { id: 'check-parasol', label: '양산을 살펴본다', hint: '멈춘 그림을 자세히 봐요' },
        { id: 'ask-mori', label: '모리에게 작전을 묻는다', hint: '함께 방법을 생각해요' },
      ],
    },
    {
      id: 'first-cinematic',
      type: 'cinematic',
      title: '색점 폭풍을 통과하라',
      description: '서연이의 선택으로 이어진 5초 장면이에요. 원본 화면을 자르지 않고 그대로 보여 줍니다.',
      videoUrl: '/chat/seurat-alive-vertical.mp4',
      posterUrl: '/chat/seurat-vertical-poster.jpg',
      subtitlesUrl: '/chat/seurat-clue.vtt',
      durationLabel: '0:05',
    },
    {
      id: 'cinematic-return',
      type: 'notice',
      title: '그림 속 탐정단으로 돌아왔어요',
      body: '영상 속에서 발견한 노란 단서가 대화에 이어집니다.',
    },
    {
      id: 'first-memory',
      type: 'generated_image',
      status: 'ready',
      title: '서연이가 찾아낸 첫 단서',
      description: '강아지를 따라가 노란 색점을 발견한 순간이에요.',
      imageUrl: '/chat/seurat-memory-4x5.jpg',
      imageAlt: '그림 속 강가와 노란 색점 단서가 담긴 모험 장면',
    },
    {
      id: 'mori-next',
      type: 'character_text',
      actor: DEMO_MORI,
      text: '이 장면은 네 선택으로 만들어진 기억이야. 그런데 노란 점을 손에 쥐니까 보라색으로 변했어. 다음엔 어떻게 할까?',
      createdAtLabel: '오후 4:23',
    },
    {
      id: 'quick-replies',
      type: 'quick_replies',
      label: '바로 답하기',
      replies: [
        { id: 'parasol', label: '양산에 붙여 보자' },
        { id: 'river', label: '강물에 비춰 보자' },
        { id: 'why-purple', label: '왜 보라색이 됐지?' },
      ],
    },
  ],
};

const KINDY_NOTICE_ROOM: StoryChatRoomData = {
  preview: DEMO_CHAT_ROOMS[1],
  child: DEMO_CHILD,
  composer: {
    mode: 'read_only',
    placeholder: '읽기 전용 안내방이에요',
    helperText: '중요한 소식만 조용히 전해 드려요.',
  },
  messages: [
    {
      id: 'kindy-notice-welcome',
      type: 'notice',
      eyebrow: '킨디 알림',
      title: '새로운 이야기 세계가 열렸어요',
      body: '그림 속 탐정단 방에서 모리의 초대장을 확인해 보세요.',
      createdAtLabel: '오늘',
    },
    {
      id: 'kindy-notice-safety',
      type: 'notice',
      title: '대화는 보호자와 함께 관리해요',
      body: '보호자는 대화 기록과 개인화 정보를 확인하고 지울 수 있어요.',
    },
  ],
};

const MORI_POST_ROOM: StoryChatRoomData = {
  preview: DEMO_CHAT_ROOMS[2],
  child: DEMO_CHILD,
  composer: {
    mode: 'read_only',
    placeholder: '읽기 전용 안내방이에요',
    helperText: '모험이 끝나면 모리의 새 편지가 도착해요.',
  },
  messages: [
    {
      id: 'post-first-letter',
      type: 'notice',
      eyebrow: '모리의 첫 편지',
      title: '서연이에게',
      body: '이 세계에서 떠오른 생각을 자유롭게 말해도 괜찮아. 이름 전체, 학교, 주소는 적지 말고, 무섭거나 싫으면 언제든 방에서 나와도 돼.',
      createdAtLabel: '8월 18일',
    },
  ],
};

export const DEMO_STORY_CHAT_ROOMS: Record<string, StoryChatRoomData> = {
  [PICTURE_DETECTIVES_ROOM.preview.id]: PICTURE_DETECTIVES_ROOM,
  [KINDY_NOTICE_ROOM.preview.id]: KINDY_NOTICE_ROOM,
  [MORI_POST_ROOM.preview.id]: MORI_POST_ROOM,
};

export const DEMO_PRIMARY_STORY_ROOM = PICTURE_DETECTIVES_ROOM;
