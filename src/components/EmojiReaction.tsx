'use client';

import { useState } from 'react';

interface EmojiReactionProps {
  childName: string;
  onReact: (reaction: 'happy' | 'neutral' | 'sad') => void;
}

const reactions = [
  { type: 'happy' as const, emoji: '😊', label: '재밌었어!' },
  { type: 'neutral' as const, emoji: '😐', label: '보통이야' },
  { type: 'sad' as const, emoji: '😢', label: '별로야...' },
];

export default function EmojiReaction({ childName, onReact }: EmojiReactionProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (type: 'happy' | 'neutral' | 'sad') => {
    setSelected(type);
    onReact(type);
  };

  if (selected) {
    return (
      <div className="text-center py-6">
        <p className="text-lg font-medium text-gray-700">
          {selected === 'happy' ? '좋아했구나! 다음에도 이런 영상 만들어줄게 😊' :
           selected === 'neutral' ? '알겠어! 다음엔 더 재밌게 만들어볼게' :
           '괜찮아! 다음엔 더 좋은 영상 준비할게 💪'}
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-4">
      <p className="text-sm text-gray-500 mb-3">
        {childName}가 이 영상 좋아했나요?
      </p>
      <div className="flex justify-center gap-6">
        {reactions.map((r) => (
          <button
            key={r.type}
            onClick={() => handleSelect(r.type)}
            className="flex flex-col items-center gap-1 hover:scale-110 transition-transform"
          >
            <span className="text-4xl">{r.emoji}</span>
            <span className="text-xs text-gray-400">{r.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
