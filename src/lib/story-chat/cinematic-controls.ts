export type CinematicMediaController = {
  readonly paused: boolean;
  currentTime: number;
  play: () => Promise<void>;
  pause: () => void;
};

export async function toggleCinematicPlayback(
  media: CinematicMediaController,
): Promise<'playing' | 'paused'> {
  if (media.paused) {
    await media.play();
    return 'playing';
  }

  media.pause();
  return 'paused';
}

export function rewindCinematic(
  media: CinematicMediaController,
): 'ready' {
  media.pause();
  media.currentTime = 0;
  return 'ready';
}
