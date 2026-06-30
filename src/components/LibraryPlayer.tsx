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
  const subtitleSourceKey = `${videoUrl}:${subtitlesUrl ?? ''}`;
  const [subtitleState, setSubtitleState] = useState({ sourceKey: subtitleSourceKey, show: true });
  const playedRef = useRef(false);
  const showSubtitles = subtitleState.sourceKey === subtitleSourceKey ? subtitleState.show : true;

  useEffect(() => {
    playedRef.current = false;
  }, [videoUrl]);

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

      {subtitlesUrl && (
        <button
          type="button"
          onClick={() => setSubtitleState({ sourceKey: subtitleSourceKey, show: !showSubtitles })}
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
