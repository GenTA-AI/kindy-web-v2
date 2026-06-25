'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  videoUrl: string;
  posterUrl?: string | null;
  subtitlesUrl?: string | null;
  onPlay?: () => void;
  onEnded?: () => void;
}

export default function LibraryPlayer({
  videoUrl,
  posterUrl,
  subtitlesUrl,
  onPlay,
  onEnded,
}: Props) {
  const [showSubtitles, setShowSubtitles] = useState(true);
  const playedRef = useRef(false);

  useEffect(() => {
    playedRef.current = false;
    setShowSubtitles(true);
  }, [videoUrl, subtitlesUrl]);

  const handlePlay = () => {
    if (!playedRef.current) {
      playedRef.current = true;
      onPlay?.();
    }
  };

  return (
    <div className="relative">
      <video
        src={videoUrl}
        controls
        poster={posterUrl ?? undefined}
        onPlay={handlePlay}
        onEnded={onEnded}
        className="aspect-video w-full bg-black"
      >
        {subtitlesUrl && showSubtitles && (
          <track kind="subtitles" srcLang="ko" label="한국어" src={subtitlesUrl} default />
        )}
      </video>

      <div className="pointer-events-none absolute bottom-14 right-2 select-none rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">
        AI로 생성된 영상이에요
      </div>

      {subtitlesUrl && (
        <button
          type="button"
          onClick={() => setShowSubtitles((v) => !v)}
          aria-label="자막"
          aria-pressed={showSubtitles}
          className="absolute right-2 top-2 inline-flex min-h-[44px] items-center rounded-md bg-black/60 px-3 text-[10px] font-semibold text-white/90 transition hover:bg-black/80"
        >
          {showSubtitles ? '자막 켜짐' : '자막 꺼짐'}
        </button>
      )}
    </div>
  );
}
