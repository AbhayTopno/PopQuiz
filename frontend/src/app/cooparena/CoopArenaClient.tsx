'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QuizData } from '@/types';
import { getSocket } from '@/utils/socket';
import { calculateScore, type Difficulty } from '@/utils/scoring';

type CoopArenaClientProps = {
  roomId: string;
  username: string;
  initialQuizData: QuizData;
  initialDuration?: number;
  quizId?: string;
};

type TeamMember = {
  id: string;
  username: string;
  avatar?: string;
};

const FEEDBACK_DELAY_MS = 3000;

export default function CoopArenaClient({
  roomId,
  username,
  initialQuizData,
  initialDuration = 10,
  quizId,
}: CoopArenaClientProps) {
  const socket = useMemo(() => getSocket(), []);
  const [quizData] = useState<QuizData | null>(initialQuizData ?? null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  // Team states
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamScore, setTeamScore] = useState(0);

  const [isFinished, setIsFinished] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(initialDuration);
  const [duration] = useState<number>(initialDuration);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [connected, setConnected] = useState(false);
  const [canAnswer, setCanAnswer] = useState(true);
  const [someoneAnswered, setSomeoneAnswered] = useState(false);
  const [answeringPlayer, setAnsweringPlayer] = useState<string | null>(null);
  const joinedRef = useRef(false);
  const [pendingTimeoutReveal, setPendingTimeoutReveal] = useState(false);

  const backgroundStyle = {
    backgroundImage: `url(${'/img/Quiz.png'})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  } as const;

  useEffect(() => {
    setTimeLeft(duration);
  }, [duration]);

  // Connect/join and wire events
  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      if (!joinedRef.current && roomId) {
        joinedRef.current = true;
        socket.emit('join-coop-room', {
          roomId,
          quizId: quizId || initialQuizData._id,
          username,
        });
      }
    };
    const onDisconnect = () => setConnected(false);

    // Team members update
    const onTeamUpdate = (data: { members: TeamMember[]; score: number }) => {
      setTeamMembers(data.members);
      setTeamScore(data.score);
    };

    // Someone answered - lock everyone else and show feedback
    const onAnswerLocked = (data: {
      answeredBy: string;
      playerName: string;
      answer: string;
      isCorrect: boolean;
    }) => {
      // Lock all players immediately
      setCanAnswer(false);
      setSomeoneAnswered(true);
      setAnsweringPlayer(data.playerName);

      // Show feedback for all players
      setShowFeedback(true);
      setSelectedAnswer(data.answer);

      // Advance all players after feedback delay
      setTimeout(() => {
        setIsFadingOut(true);
        setTimeout(() => {
          const nextIndex = currentQuestionIndex + 1;
          if (nextIndex < quizData!.questions.length) {
            setCurrentQuestionIndex(nextIndex);
            setSelectedAnswer(null);
            setShowFeedback(false);
            setTimeLeft(duration);
            setIsFadingOut(false);
            setCanAnswer(true);
            setSomeoneAnswered(false);
            setAnsweringPlayer(null);
          } else {
            // Last question finished - only the answering player emits finish
            if (data.answeredBy === socket.id) {
              socket.emit('coop-quiz-finished', { roomId });
            }
          }
        }, 300);
      }, FEEDBACK_DELAY_MS);
    };

    // Score update after answer
    const onScoreUpdate = (data: {
      score: number;
      currentQuestion: number;
      answeredBy: string;
      answer?: string;
      isCorrect?: boolean;
    }) => {
      setTeamScore(data.score);
    };

    // Quiz complete
    const onQuizComplete = (data: { finalScore: number; members: TeamMember[] }) => {
      setTeamScore(data.finalScore);
      setTeamMembers(data.members);
      setIsFinished(true);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('coop-team-update', onTeamUpdate);
    socket.on('coop-answer-locked', onAnswerLocked);
    socket.on('coop-score-update', onScoreUpdate);
    socket.on('coop-quiz-complete', onQuizComplete);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('coop-team-update', onTeamUpdate);
      socket.off('coop-answer-locked', onAnswerLocked);
      socket.off('coop-score-update', onScoreUpdate);
      socket.off('coop-quiz-complete', onQuizComplete);
    };
  }, [
    socket,
    roomId,
    username,
    quizId,
    initialQuizData?._id,
    currentQuestionIndex,
    quizData,
    duration,
  ]);

  const handleNext = useCallback(
    (selectedOption: string | null) => {
      if (!quizData || !canAnswer) return;

      // Lock out immediately for the current player
      setCanAnswer(false);

      const isCorrect =
        !!selectedOption &&
        selectedOption === quizData.questions[currentQuestionIndex].correctAnswer;

      // Calculate scoring based on difficulty and remaining time
      const difficulty = (quizData.difficulty || 'medium') as Difficulty;
      const gainedPoints = calculateScore(difficulty, timeLeft, duration, !!isCorrect);

      // Emit answer to server - server will broadcast to all players
      socket.emit('submit-coop-answer', {
        roomId,
        answer: selectedOption,
        isCorrect,
        points: isCorrect ? gainedPoints : 0,
        currentQuestion: currentQuestionIndex,
        timeLeft,
      });

      // Note: Advancement is handled by the 'coop-answer-locked' socket event
      // which ensures all players advance together
    },
    [quizData, currentQuestionIndex, duration, roomId, socket, timeLeft, canAnswer],
  );

  // Timer
  useEffect(() => {
    if (isFinished || showFeedback) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (isFinished || showFeedback) return prev;

        const next = prev - 1;
        if (next <= 0) {
          setPendingTimeoutReveal(true);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isFinished, showFeedback]);

  // Handle timeout
  const handleProgressTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== 'width') return;
      if (!pendingTimeoutReveal) return;
      if (timeLeft > 0) return;
      setPendingTimeoutReveal(false);
      if (canAnswer) {
        handleNext(null);
      }
    },
    [pendingTimeoutReveal, timeLeft, handleNext, canAnswer],
  );

  // UI helpers
  const getButtonClass = (option: string) => {
    if (!quizData) return '';
    const baseClass =
      'w-full rounded-lg px-4 py-3 font-general text-left text-white border-2 transition-all duration-300 transform active:scale-95 disabled:cursor-not-allowed';

    if (!showFeedback) {
      if (!canAnswer) {
        return `${baseClass} bg-black/20 border-gray-600/50 opacity-40`;
      }
      return `${baseClass} bg-black/30 border-cyan-400/50 hover:bg-cyan-400/20 hover:border-cyan-400`;
    }

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
    return (
      <div className="flex-center min-h-screen p-4" style={backgroundStyle}>
        <div className="w-full max-w-3xl bg-black/60 rounded-2xl border border-cyan-400/30 p-8 text-center shadow-2xl backdrop-blur-lg animate-fade-in">
          <h1 className="font-zentry text-4xl md:text-5xl font-black uppercase text-white mb-2">
            Co-op Quiz Complete!
          </h1>
          <p className="font-general text-2xl text-cyan-300 mb-6">Team Score</p>

          <div className="rounded-xl bg-black/40 border border-cyan-400/30 p-6 mb-6">
            <p className="text-6xl font-zentry text-white mb-4">{teamScore}</p>
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div key={member.id} className="text-sm text-white/80 bg-white/5 rounded px-3 py-2">
                  {member.username}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                const qid = quizId || quizData._id;
                const url = `/waiting-room?roomId=${encodeURIComponent(roomId)}&quizId=${encodeURIComponent(qid)}&username=${encodeURIComponent(username)}&mode=coop`;
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

  return (
    <div className="flex flex-col h-screen p-4 md:p-8" style={backgroundStyle}>
      {/* Minimal Team Scoreboard - Horizontal Layout */}
      <div className="w-full max-w-3xl mx-auto mb-4">
        <div className="rounded-xl px-3 py-2 md:px-4 border border-cyan-400/50 bg-black/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
          {/* Left: Score */}
          <div className="flex items-center gap-3">
            <span className="font-general text-xs sm:text-sm text-white/80">Team Score:</span>
            <span className="text-2xl sm:text-3xl font-zentry text-cyan-400">{teamScore}</span>
          </div>

          {/* Right: Players */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-general text-xs text-white/60">
              {teamMembers.length} Players:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {teamMembers.map((member) => (
                <span
                  key={member.id}
                  className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded"
                >
                  {member.username}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className={`w-full max-w-3xl mx-auto flex-1 flex items-center transition-opacity duration-300 ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}
      >
        <div className="w-full">
          {/* Header */}
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

          {/* Main Card */}
          <div className="bg-black/50 rounded-2xl border border-cyan-400/30 p-6 md:p-8 shadow-2xl backdrop-blur-md">
            {/* Timer Bar */}
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

            {/* Someone Answered Notification */}
            {someoneAnswered && !showFeedback && (
              <div className="mb-4 p-3 rounded-lg bg-blue-500/20 border border-blue-500/40 text-center">
                <p className="text-sm text-blue-300 font-general">
                  {answeringPlayer} is answering this question...
                </p>
              </div>
            )}

            <h2 className="font-general text-lg md:text-xl mb-8 font-bold text-white text-center">
              {currentQuestion.questionText}
            </h2>

            <div className="space-y-4 text-md">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={option}
                  onClick={() => handleNext(option)}
                  disabled={showFeedback || timeLeft === 0 || !canAnswer}
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
    </div>
  );
}
