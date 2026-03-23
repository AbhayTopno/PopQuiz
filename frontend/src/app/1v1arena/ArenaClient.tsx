'use client';

import React, { useState } from 'react';
import { QuizData } from '@/types';
import { useArenaSocket } from '@/hooks/arena/useArenaSocket';
import { useQuizTimer } from '@/hooks/quiz/useQuizTimer';
import { useQuizState } from '@/hooks/quiz/useQuizState';

type ArenaClientProps = {
  roomId: string;
  username: string;
  initialQuizData: QuizData;
  initialDuration?: number;
  quizId?: string;
};

export default function ArenaClient({
  roomId,
  username,
  initialQuizData,
  initialDuration = 10,
  quizId,
}: ArenaClientProps) {
  const {
    quizData,
    currentQuestionIndex,
    selectedAnswer,
    score,
    setScore,
    isFinished,
    setIsFinished,
    showFeedback,
    isFadingOut,
    handleNextBase,
    overrideState,
  } = useQuizState(initialQuizData ?? null);

  const [selfFinished, setSelfFinished] = useState(false);
  const [selfFinalScore, setSelfFinalScore] = useState<number | null>(null);

  const { socket, connected, opponent } = useArenaSocket({
    roomId,
    username,
    quizId: quizId || initialQuizData?._id,
    setScore,
    setIsFinished,
    onReconnectState: (state) => {
      overrideState(state.currentQuestionIndex, state.score);
      const elapsed = (state.serverTime - state.questionStartTime) / 1000;
      const remaining = Math.max(0, initialDuration - elapsed);
      // Delay so that useQuizTimer's questionIndex effect runs first and doesn't overwrite
      setTimeout(() => setTimeLeft(Math.floor(remaining)), 0);
    },
  });

  const { timeLeft, duration, handleProgressTransitionEnd, setTimeLeft } = useQuizTimer({
    initialDuration,
    isPaused: isFinished || selfFinished || showFeedback,
    questionIndex: currentQuestionIndex,
    onTimeoutReveal: () => handleNext(null),
  });

  const handleNext = (selectedOption: string | null) => {
    handleNextBase(selectedOption, timeLeft, duration, (nextIndex, nextScore, finished) => {
      if (!finished) {
        socket.emit('score-update', {
          roomId,
          score: nextScore,
          currentQuestion: nextIndex,
          finished: false,
        });
      } else {
        setSelfFinished(true);
        setSelfFinalScore(nextScore);
        socket.emit('player-finished', { roomId, username, score: nextScore });
        socket.emit('score-update', {
          roomId,
          score: nextScore,
          currentQuestion: nextIndex,
          finished: true,
        });
      }
    });
  };

  const backgroundStyle = {
    backgroundImage: `url(${'/img/Quiz.png'})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  } as const;

  const getButtonClass = (option: string) => {
    if (!quizData) return '';
    const baseClass =
      'w-full rounded-lg px-4 py-3 font-general text-left text-white border-2 transition-all duration-300 transform active:scale-95 disabled:cursor-not-allowed';

    if (!showFeedback)
      return `${baseClass} bg-black/30 border-cyan-400/50 hover:bg-cyan-400/20 hover:border-cyan-400`;

    const { correctAnswer } = quizData.questions[currentQuestionIndex];
    if (option === correctAnswer)
      return `${baseClass} bg-green-500/50 border-green-400 animate-pulse`;
    if (option === selectedAnswer) return `${baseClass} bg-red-500/50 border-red-400`;
    return `${baseClass} bg-black/20 border-gray-600/50 opacity-60`;
  };

  const cleanOption = (option: string) => option.replace(/^[A-D]:\s*/i, '');

  if (!quizData) {
    return (
      <div className="flex-center flex-col h-screen p-4 text-center" style={backgroundStyle}>
        <div className="w-full max-w-md bg-black/50 p-8 rounded-2xl border border-red-500/50 shadow-lg backdrop-blur-md">
          <h1 className="font-zentry text-4xl font-black uppercase text-red-500 mb-4">Error</h1>
          <p className="font-general text-xl text-gray-200 mb-6">The quiz could not be found.</p>
          <button
            onClick={() => (window.location.href = '/')}
            className="rounded-lg bg-cyan-500 px-6 py-3 font-general font-semibold uppercase text-black transition-all hover:bg-cyan-400"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = quizData.questions[currentQuestionIndex];
  const timePercentage = (timeLeft / duration) * 100;
  const isTimeLow = timeLeft <= 5;

  if (isFinished) {
    const oppScore = opponent?.score ?? 0;
    const result = score === oppScore ? 'Draw' : score > oppScore ? 'You Win!' : 'You Lose';

    return (
      <div className="flex-center min-h-screen p-4" style={backgroundStyle}>
        <div className="w-full max-w-2xl bg-black/60 rounded-2xl border border-cyan-400/30 p-8 text-center shadow-2xl backdrop-blur-lg animate-fade-in">
          <h1 className="font-zentry text-4xl md:text-5xl font-black uppercase text-white mb-2">
            Battle Complete
          </h1>
          <p className="font-general text-xl text-cyan-300 mb-6">{result}</p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="rounded-xl bg-black/40 border border-cyan-400/30 p-4">
              <p className="text-sm text-white/70">You</p>
              <p className="text-4xl font-zentry text-white">{score}</p>
            </div>
            <div className="rounded-xl bg-black/40 border border-cyan-400/30 p-4">
              <p className="text-sm text-white/70">{opponent?.username || 'Opponent'}</p>
              <p className="text-4xl font-zentry text-white">{oppScore}</p>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                const qid = quizId || quizData._id;
                const url = `/waiting-room?roomId=${encodeURIComponent(roomId)}&quizId=${encodeURIComponent(qid)}&username=${encodeURIComponent(username)}&mode=1v1`;
                window.location.href = url;
              }}
              className="rounded-lg bg-gray-700 px-6 py-3 font-general font-bold uppercase text-white transition-all hover:bg-gray-600"
            >
              Waiting Room
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              className="rounded-lg bg-cyan-500 px-6 py-3 font-general font-bold uppercase text-black transition-all hover:bg-cyan-400"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (selfFinished && !isFinished) {
    return (
      <div className="flex-center min-h-screen p-4" style={backgroundStyle}>
        <div className="w-full max-w-2xl bg-black/60 rounded-2xl border border-cyan-400/30 p-8 text-center shadow-2xl backdrop-blur-lg animate-fade-in">
          <h1 className="font-zentry text-4xl md:text-5xl font-black uppercase text-white mb-2">
            Waiting for Opponent
          </h1>
          <p className="font-general text-xl text-cyan-300 mb-6">Your final score</p>
          <div className="rounded-xl bg-black/40 border border-cyan-400/30 p-6 mb-6">
            <p className="text-5xl font-zentry text-white">{selfFinalScore ?? score}</p>
          </div>
          <p className="text-white/70 font-general">Hang tight while your opponent finishes…</p>
        </div>
      </div>
    );
  }

  const leading = (a: number, b: number) => (a === b ? 'Tie' : a > b ? 'Leading' : 'Trailing');

  return (
    <div className="flex-center flex-col min-h-screen p-4 md:p-8" style={backgroundStyle}>
      <div className="w-full max-w-3xl mb-4 grid grid-cols-2 gap-3">
        <div
          className={`rounded-xl p-4 border ${score >= (opponent?.score ?? 0) ? 'border-green-400/50' : 'border-cyan-400/30'} bg-black/40`}
        >
          <div className="flex items-center justify-between text-white">
            <span className="font-general">You</span>
            <span className="text-xs text-white/60">{leading(score, opponent?.score ?? 0)}</span>
          </div>
          <div className="text-3xl font-zentry text-white">{score}</div>
        </div>
        <div
          className={`rounded-xl p-4 border ${(opponent?.score ?? 0) > score ? 'border-green-400/50' : 'border-cyan-400/30'} bg-black/40`}
        >
          <div className="flex items-center justify-between text-white">
            <span className="font-general">{opponent?.username || 'Opponent'}</span>
            <span className="text-xs text-white/60">{leading(opponent?.score ?? 0, score)}</span>
          </div>
          <div className="text-3xl font-zentry text-white">{opponent?.score ?? 0}</div>
        </div>
      </div>

      <div
        className={`w-full max-w-3xl transition-opacity duration-300 ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="mb-6 text-white">
          <div className="flex justify-center items-center mb-2">
            <h1 className="font-zentry text-2xl md:text-3xl font-black uppercase text-gray-100 shadow-lg [text-shadow:_0_0_10px_rgb(239_68_68_/_50%)]">
              {quizData.topic}
            </h1>
          </div>
          <div className="flex justify-between items-center text-cyan-300/80 font-general">
            <p className="capitalize">Difficulty: {quizData.difficulty}</p>
            <p>
              Question {currentQuestionIndex + 1} / {quizData.questions.length}
            </p>
          </div>
        </div>

        <div className="bg-black/50 rounded-2xl border border-cyan-400/30 p-6 md:p-8 shadow-2xl backdrop-blur-md">
          <div className="mb-6 flex items-center gap-3">
            <div
              className="flex-1 relative h-2.5 bg-gray-700/50 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={timeLeft}
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-label="Time remaining"
            >
              <div
                className={`absolute left-0 top-0 h-full ${isTimeLow ? 'bg-red-500' : 'bg-cyan-400'} transition-all duration-1000 ease-linear`}
                style={{
                  width: `${Math.max(0, Math.min(100, timePercentage))}%`,
                }}
                onTransitionEnd={handleProgressTransitionEnd}
              />
            </div>
            <div
              className={`min-w-[64px] px-3 py-1 rounded-lg text-sm font-mono text-center border ${
                isTimeLow
                  ? 'bg-red-500/20 text-red-200 border-red-500/40'
                  : 'bg-black/60 text-white border-cyan-400/30'
              }`}
            >
              {timeLeft}s
            </div>
          </div>

          <h2 className="font-general text-lg md:text-xl mb-8 font-bold text-white text-center">
            {currentQuestion.questionText}
          </h2>

          <div className="space-y-4 text-md">
            {currentQuestion.options.map((option, index) => (
              <button
                key={option}
                onClick={() => handleNext(option)}
                disabled={showFeedback || timeLeft === 0}
                className={getButtonClass(option)}
                aria-label={`Option ${String.fromCharCode(65 + index)}: ${cleanOption(option)}`}
              >
                <span className="font-semibold mr-4 bg-cyan-500/80 text-black rounded px-2 py-0.5">
                  {String.fromCharCode(65 + index)}
                </span>
                {cleanOption(option)}
              </button>
            ))}
          </div>
          {showFeedback && selectedAnswer === null && (
            <p className="mt-4 text-center text-red-300 font-general">Time&apos;s up!</p>
          )}
        </div>

        {!connected && (
          <p className="mt-3 text-center text-xs text-red-300">
            Disconnected from server… attempting to reconnect
          </p>
        )}
      </div>
    </div>
  );
}
