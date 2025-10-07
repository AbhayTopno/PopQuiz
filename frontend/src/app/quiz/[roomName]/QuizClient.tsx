'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { QuizData, Props } from '@/types';

const FEEDBACK_DELAY_MS = 3000; // Delay for showing feedback before next question

export default function QuizClient({
  initialQuizData,
  initialDuration,
}: Props) {
  // --- State (use server-provided initial data)
  const [quizData] = useState<QuizData | null>(initialQuizData ?? null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading] = useState(false); // data already loaded from server
  const [error] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(initialDuration ?? 10);
  const [duration] = useState<number>(initialDuration ?? 10);
  const [isFadingOut, setIsFadingOut] = useState(false); // For question transition

  // --- Background style (restored from original)
  const backgroundStyle = {
    backgroundImage: `url(${'/img/Quiz.png'})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };

  // Keep timeLeft sync when duration changes
  useEffect(() => {
    setTimeLeft(duration);
  }, [duration]);

  // Memoize handleNext to stabilize for useEffect dependency
  const handleNext = useCallback(
    (selectedOption: string | null) => {
      if (!quizData) return;

      setShowFeedback(true);
      setSelectedAnswer(selectedOption);

      if (
        selectedOption &&
        selectedOption ===
          quizData.questions[currentQuestionIndex].correctAnswer
      ) {
        setScore((prev) => prev + 1);
      }

      setTimeout(() => {
        setIsFadingOut(true);
        setTimeout(() => {
          const nextIndex = currentQuestionIndex + 1;
          if (nextIndex < quizData.questions.length) {
            setCurrentQuestionIndex(nextIndex);
            setSelectedAnswer(null);
            setShowFeedback(false);
            setTimeLeft(duration);
            setIsFadingOut(false);
          } else {
            setIsFinished(true);
          }
        }, 300);
      }, FEEDBACK_DELAY_MS);
    },
    [quizData, currentQuestionIndex, duration]
  );

  // Timer countdown effect
  useEffect(() => {
    if (isLoading || isFinished || showFeedback) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleNext(null); // Time's up
          return duration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [
    isLoading,
    isFinished,
    showFeedback,
    currentQuestionIndex,
    duration,
    handleNext,
  ]);

  // --- UI helpers (restored classes & styles) ---
  const getButtonClass = (option: string) => {
    if (!quizData) return ''; // Guard against null quizData

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

  // --- Render flows with original styling ---

  // Loading UI (restored background & loader)
  if (isLoading) {
    return (
      <div className="flex-center h-screen" style={backgroundStyle}>
        {/* Thematic Loader */}
        <div className="loader"></div>
      </div>
    );
  }

  // Error UI (restored)
  if (error || !quizData) {
    return (
      <div
        className="flex-center flex-col h-screen p-4 text-center"
        style={backgroundStyle}
      >
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

  // Finished UI (restored visuals)
  if (isFinished) {
    const percentage = Math.round((score / quizData.questions.length) * 100);

    return (
      <div className="flex-center min-h-screen p-4" style={backgroundStyle}>
        <div className="w-full max-w-2xl bg-black/60 rounded-2xl border border-cyan-400/30 p-8 text-center shadow-2xl backdrop-blur-lg animate-fade-in">
          <h1 className="font-zentry text-4xl md:text-5xl font-black uppercase text-white mb-4 [text-shadow:_0_0_7px_#fff]">
            Quiz Complete!
          </h1>
          <p className="font-general text-2xl capitalize text-cyan-300 mb-8">
            {quizData.topic}
          </p>

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
                strokeDashoffset={`${
                  2 * Math.PI * 44 * (1 - percentage / 100)
                }`}
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
            <span className="absolute text-5xl font-zentry text-white">
              {percentage}%
            </span>
          </div>

          <p className="font-general text-3xl text-white mb-8">
            You scored <span className="font-bold text-cyan-300">{score}</span>{' '}
            out of{' '}
            <span className="font-bold text-cyan-300">
              {quizData.questions.length}
            </span>
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => {
                setCurrentQuestionIndex(0);
                setScore(0);
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

  // Active quiz UI (restored layout, transitions, timer bar, options)
  const currentQuestion = quizData.questions[currentQuestionIndex];
  const timePercentage = (timeLeft / duration) * 100;
  const isTimeLow = timeLeft <= 5;

  return (
    <div
      className="flex-center flex-col min-h-screen p-4 md:p-8"
      style={backgroundStyle}
    >
      <div
        className={`w-full max-w-3xl transition-opacity duration-300 ${
          isFadingOut ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {/* --- Header --- */}
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

        {/* --- Main Quiz Card --- */}
        <div className="bg-black/50 rounded-2xl border border-cyan-400/30 p-6 md:p-8 shadow-2xl backdrop-blur-md">
          {/* Timer Bar */}
          <div
            className="w-full bg-gray-700/50 rounded-full h-2.5 mb-6"
            role="progressbar"
            aria-valuenow={timeLeft}
            aria-valuemin={0}
            aria-valuemax={duration}
          >
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                isTimeLow ? 'bg-red-500' : 'bg-cyan-400'
              }`}
              style={{ width: `${timePercentage}%` }}
            />
          </div>
          <h2 className="font-general text-lg md:text-xl mb-8 font-bold text-white text-center">
            {currentQuestion.questionText}
          </h2>
          <div className="space-y-4 text-md">
            {currentQuestion.options.map((option, index) => (
              <button
                key={option}
                onClick={() => handleNext(option)}
                disabled={showFeedback}
                className={getButtonClass(option)}
                aria-label={`Option ${String.fromCharCode(
                  65 + index
                )}: ${cleanOption(option)}`}
              >
                <span className="font-semibold mr-4 bg-cyan-500/80 text-black rounded px-2 py-0.5">
                  {String.fromCharCode(65 + index)}
                </span>
                {cleanOption(option)}
              </button>
            ))}
          </div>
          {showFeedback && selectedAnswer === null && (
            <p className="mt-4 text-center text-red-300 font-general">
              Time&apos;s up!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
