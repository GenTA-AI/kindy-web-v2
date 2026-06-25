'use client';

interface Hotspot {
  start: number;
  end: number;
  count: number;
}

interface FocusBarProps {
  durationSec: number;
  watchedSec: number;
  hotspots: Hotspot[];
  childName: string;
}

export default function FocusBar({ durationSec, watchedSec, hotspots, childName }: FocusBarProps) {
  const progress = Math.min(watchedSec / durationSec, 1) * 100;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-violet-50 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-violet-600 mb-2">
        {childName}의 집중도
      </h3>
      <div className="relative h-2 bg-violet-200 rounded-full">
        <div
          className="absolute inset-y-0 left-0 bg-violet-500 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
        {hotspots.map((spot, i) => (
          <div
            key={i}
            className="absolute -top-1 w-4 h-4 bg-rose-400 rounded-full border-2 border-white shadow-sm"
            style={{ left: `${(spot.start / durationSec) * 100}%` }}
            title={`반복 재생 ${spot.count}회: ${formatTime(spot.start)}-${formatTime(spot.end)}`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-gray-400">
        <span>0:00</span>
        {hotspots.length > 0 && (
          <span className="text-rose-400 font-medium">반복 재생 구간</span>
        )}
        <span>{formatTime(durationSec)}</span>
      </div>
    </div>
  );
}
