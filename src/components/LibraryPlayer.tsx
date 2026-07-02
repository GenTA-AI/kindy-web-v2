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
  // 에러 상태를 videoUrl 로 키잉해, 영상이 바뀌면 별도 effect 없이 자동으로 초기화된다.
  const [errorUrl, setErrorUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playedRef = useRef(false);
  const showSubtitles = subtitleState.sourceKey === subtitleSourceKey ? subtitleState.show : true;
  const loadError = errorUrl === videoUrl;

  useEffect(() => {
    playedRef.current = false;
  }, [videoUrl]);

  const handlePlay = () => {
    if (!playedRef.current) {
      playedRef.current = true;
      onPlay?.();
    }
  };

  const handleRetry = () => {
    setErrorUrl(null);
    const video = videoRef.current;
    if (video) {
      video.load();
      void video.play().catch(() => {});
    }
  };

  return (
    <div>
      <div className="relative">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          poster={posterUrl ?? undefined}
          onPlay={handlePlay}
          onEnded={onEnded}
          onError={() => setErrorUrl(videoUrl)}
          className="aspect-video w-full bg-black"
        >
          {subtitlesUrl && showSubtitles && (
            <track kind="subtitles" srcLang="ko" label="한국어" src={subtitlesUrl} default />
          )}
        </video>

        {subtitlesUrl && !loadError && (
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

        {loadError && (
          // 영상 로드 실패 시 검은 화면 대신 모리 톤 폴백 카드로 덮는다(P1-11).
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-cream px-6 text-center">
            <p className="text-sm font-black text-ink">이야기를 불러오지 못했어요</p>
            <p className="text-xs font-medium leading-relaxed text-ink2">잠시 후 다시 볼까요?</p>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-saged px-5 text-sm font-black text-white shadow-lg shadow-sagebg transition hover:bg-ink active:scale-[0.98]"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>

      {/* 보호자용 상시 AI 표시(P1-18). 아이가 아닌 어른이 읽는 작은 안내. */}
      <p className="mt-2 px-4 text-[10px] font-medium leading-relaxed text-ink3">
        모리 이야기는 AI로 만들고, 사람이 한 편씩 살펴봐요.
      </p>
    </div>
  );
}
