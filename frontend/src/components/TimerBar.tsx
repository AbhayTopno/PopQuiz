import React from 'react';

type Props = {
  timeLeft: number;
  duration: number;
  isTimeLow?: boolean;
  onTransitionEnd?: (e: React.TransitionEvent<HTMLDivElement>) => void;
};

export default function TimerBar({ timeLeft, duration, isTimeLow, onTransitionEnd }: Props) {
  const timePercentage = (timeLeft / Math.max(1, duration)) * 100;

  return (
    <div className="mb-4 flex items-center gap-3">
      <div
        className="flex-1 relative h-3 bg-gray-700/50 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={timeLeft}
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-label="Time remaining"
      >
        <div
          className={`absolute left-0 top-0 h-full ${isTimeLow ? 'bg-red-500' : 'bg-cyan-400'} transition-all duration-1000 ease-linear`}
          style={{ width: `${Math.max(0, Math.min(100, timePercentage))}%` }}
          onTransitionEnd={onTransitionEnd}
        />
      </div>
      <div
        className={`min-w-[60px] px-3 py-1 rounded-lg text-sm font-mono text-center border ${
          isTimeLow
            ? 'bg-red-500/20 text-red-200 border-red-500/40'
            : 'bg-black/60 text-white border-cyan-400/30'
        }`}
      >
        {timeLeft}s
      </div>
    </div>
  );
}
