import { useState, useEffect, useCallback } from 'react';

type QuizTimerProps = {
  initialDuration: number;
  isPaused: boolean;
  onTimeoutReveal: () => void;
};

export function useQuizTimer({ initialDuration, isPaused, onTimeoutReveal }: QuizTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(initialDuration);
  const [duration, setDuration] = useState<number>(initialDuration);
  const [pendingTimeoutReveal, setPendingTimeoutReveal] = useState(false);

  useEffect(() => {
    setTimeLeft(duration);
  }, [duration]);

  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (isPaused) return prev;
        const next = prev - 1;
        if (next <= 0) {
          setPendingTimeoutReveal(true);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, duration]);

  const handleProgressTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== 'width') return;
      if (!pendingTimeoutReveal) return;
      if (timeLeft > 0) return;
      setPendingTimeoutReveal(false);
      onTimeoutReveal();
    },
    [pendingTimeoutReveal, timeLeft, onTimeoutReveal],
  );

  return {
    timeLeft,
    duration,
    setTimeLeft,
    setDuration,
    handleProgressTransitionEnd,
  };
}
