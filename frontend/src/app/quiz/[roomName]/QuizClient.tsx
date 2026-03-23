'use client';

import React, { useState } from 'react';
import { Props } from '@/types';
import { useQuizState } from '@/hooks/quiz/useQuizState';
import { useQuizTimer } from '@/hooks/quiz/useQuizTimer';

export default function QuizClient({ initialQuizData, initialDuration }: Props) {
  const {
    quizData,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    selectedAnswer,
    setSelectedAnswer,
    setScore,
    correctAnswersCount,
    setCorrectAnswersCount,
    isFinished,
    setIsFinished,
    showFeedback,
    setShowFeedback,
    isFadingOut,
    setIsFadingOut,
    handleNextBase,
  } = useQuizState(initialQuizData ?? null);

  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);

  const { timeLeft, duration, setTimeLeft, handleProgressTransitionEnd } = useQuizTimer({
    initialDuration: initialDuration ?? 10,
    isPaused: isLoading || isFinished || showFeedback,
    questionIndex: currentQuestionIndex,
    onTimeoutReveal: () => handleNext(null),
  });

  const handleNext = (selectedOption: string | null) => {
    handleNextBase(selectedOption, timeLeft, duration, () => {
      setTimeLeft(duration);
    });
  };

  const backgroundStyle = {
    backgroundImage: `url(${'/img/Quiz.png'})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };

  const getButtonClass = (option: string) => {
    if (!quizData) return '';

    const baseClass =
      'w-full rounded-lg px-4 py-3 font-general text-left text-white border-2 transition-all duration-300 transform active:scale-95 disabled:cursor-not-allowed';

    if (!showFeedback) {
      return `${baseClass} bg-black/30 border-cyan-400/50 hover:bg-cyan-400/20 hover:border-cyan-400`;
    }

    const { correctAnswer } = quizData.questions[currentQuestionIndex];
    if (option === correctAnswer) {
      return `${baseClass} bg-green-500/50 border-green-400 animate-pulse`;
    }
    if (option === selectedAnswer) {
      return `${baseClass} bg-red-500/50 border-red-400`;
    }

    return `${baseClass} bg-black/20 border-gray-600/50 opacity-60`;
  };

  const cleanOption = (option: string) => option.replace(/^[A-D]:\s*/i, '');

  if (isLoading) {
    return (
      <div className="flex-center h-screen" style={backgroundStyle}>
        <div className="loader"></div>
      </div>
    );
  }

  if (error || !quizData) {
    return (
      <div className="flex-center flex-col h-screen p-4 text-center" style={backgroundStyle}>
        <div className="w-full max-w-md bg-black/50 p-8 rounded-2xl border border-red-500/50 shadow-lg backdrop-blur-md">
          <h1 className="font-zentry text-4xl font-black uppercase text-red-500 mb-4 [text-shadow:_0_0_8px_rgb(239_68_68_/_50%)]">
            Error
          </h1>
          <p className="font-general text-xl text-gray-200 mb-6">
            {error || 'The quiz could not be found.'}
          </p>
          <button
            onClick={() => (window.location.href = '/')}
            className="rounded-lg bg-cyan-500 px-6 py-3 font-general font-semibold uppercase text-black transition-all hover:bg-cyan-400 hover:shadow-[0_0_15px_rgb(34_211_238_/_50%)]"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (isFinished) {
    const percentage = Math.floor((correctAnswersCount / quizData.questions.length) * 100);

    return (
      <div className="flex-center min-h-screen p-4" style={backgroundStyle}>
        <div className="w-full max-w-2xl bg-black/60 rounded-2xl border border-cyan-400/30 p-8 text-center shadow-2xl backdrop-blur-lg animate-fade-in">
          <h1 className="font-zentry text-4xl md:text-5xl font-black uppercase text-white mb-4 [text-shadow:_0_0_7px_#fff]">
            Quiz Complete!
          </h1>
          <p className="font-general text-2xl capitalize text-cyan-300 mb-8">{quizData.topic}</p>

          <div className="relative w-48 h-48 mx-auto mb-8 flex-center">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle
                className="text-gray-700"
                strokeWidth="8"
                stroke="currentColor"
                fill="transparent"
                r="44"
                cx="50"
                cy="50"
              />
              <circle
                className="text-cyan-400"
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - percentage / 100)}`}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="44"
                cx="50"
                cy="50"
                style={{
                  transition: 'stroke-dashoffset 1.5s ease-out',
                  transform: 'rotate(-90deg)',
                  transformOrigin: '50% 50%',
                }}
              />
            </svg>
            <span className="absolute text-5xl font-zentry text-white">{percentage}%</span>
          </div>

          <p className="font-general text-3xl text-white mb-8">
            You scored <span className="font-bold text-cyan-300">{correctAnswersCount}</span> out of{' '}
            <span className="font-bold text-cyan-300">{quizData.questions.length}</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => {
                setCurrentQuestionIndex(0);
                setScore(0);
                setCorrectAnswersCount(0);
                setSelectedAnswer(null);
                setShowFeedback(false);
                setIsFinished(false);
                setTimeLeft(duration);
                setIsFadingOut(false);
              }}
              className="flex-1 rounded-lg bg-cyan-500 py-3 font-general font-bold uppercase text-black transition-all hover:bg-cyan-400 hover:shadow-[0_0_15px_rgb(34_211_238_/_50%)]"
            >
              Retry
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              className="flex-1 rounded-lg bg-gray-700 py-3 font-general font-bold uppercase text-white transition-all hover:bg-gray-600"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = quizData.questions[currentQuestionIndex];
  const timePercentage = (timeLeft / duration) * 100;
  const isTimeLow = timeLeft <= 5;

  return (
    <div className="flex-center flex-col min-h-screen p-4 md:p-8" style={backgroundStyle}>
      <div
        className={`w-full max-w-3xl transition-opacity duration-300 ${
          isFadingOut ? 'opacity-0' : 'opacity-100'
        }`}
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
      </div>
    </div>
  );
}
