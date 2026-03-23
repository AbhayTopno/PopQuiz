'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { QuizData } from '@/types';
import { calculateScore, type Difficulty } from '@/utils/scoring';
import { useTeamArenaSocket } from '@/hooks/arena/useTeamArenaSocket';
import { useQuizTimer } from '@/hooks/quiz/useQuizTimer';
import { getApiUrl } from '@/lib/config';

const FEEDBACK_DELAY_MS = 3000;

export default function CustomArenaClient() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId') || '';
  const quizId = searchParams.get('quizId') || '';
  const username = searchParams.get('username') || 'Player';
  const duration = parseInt(searchParams.get('duration') || '10');

  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const [isFinished, setIsFinished] = useState(false);
  const [selfTeamFinished, setSelfTeamFinished] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [answeringPlayer, setAnsweringPlayer] = useState<string | null>(null);

  const { socket, connected, myTeamId, myTeam, opponentTeam } = useTeamArenaSocket({
    roomId,
    username,
    quizId,
    roomJoinEvent: 'join-custom-room',
    setIsFinished,
    setSelfTeamFinished,
    onAnswerLockedCallback: (data, myId, myTeamData) => {
      if (data.teamId === myId) {
        const answeringMember = myTeamData?.members.find((m) => m.id === data.answeredBy);
        if (answeringMember) {
          setAnsweringPlayer(answeringMember.username);
        }

        if (data.answeredBy !== socket.id) {
          setIsLocked(true);
          setShowFeedback(true);
          setSelectedAnswer(data.answer);
        }

        setTimeout(() => {
          setIsFadingOut(true);
          setTimeout(() => {
            const nextIndex = currentQuestionIndex + 1;
            if (nextIndex < (quizData?.questions.length || 0)) {
              setCurrentQuestionIndex(nextIndex);
              setSelectedAnswer(null);
              setShowFeedback(false);
              setTimeLeft(duration);
              setIsFadingOut(false);
              setIsLocked(false);
              setAnsweringPlayer(null);
            } else {
              socket.emit('team-quiz-finished', { roomId, teamId: myId });
              setSelfTeamFinished(true);
            }
          }, 300);
        }, FEEDBACK_DELAY_MS);
      }
    },
    onReconnectState: (state) => {
      setCurrentQuestionIndex(state.currentQuestionIndex);
      const elapsed = Math.floor((state.serverTime - state.questionStartTime) / 1000);
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);
    },
  });

  const { timeLeft, setTimeLeft, handleProgressTransitionEnd } = useQuizTimer({
    initialDuration: duration,
    isPaused: isFinished || selfTeamFinished || showFeedback || isLocked,
    questionIndex: currentQuestionIndex,
    onTimeoutReveal: () => {
      handleNext(null);
    },
  });

  const backgroundStyle = {
    backgroundImage: `url(${'/img/Quiz.png'})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  } as const;

  // Fetch quiz data
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const response = await fetch(`${getApiUrl()}/api/quiz/${quizId}`);
        if (!response.ok) throw new Error('Failed to fetch quiz');
        const data = await response.json();
        setQuizData(data);
      } catch (error) {
        console.error('Error fetching quiz:', error);
      }
    };

    if (quizId) fetchQuiz();
  }, [quizId]);

  useEffect(() => {
    setTimeLeft(duration);
  }, [duration, setTimeLeft]);

  // Socket connection and events moved to hook

  const handleNext = useCallback(
    (selectedOption: string | null) => {
      if (!quizData || !myTeamId || isLocked) return;

      setIsLocked(true);
      setShowFeedback(true);
      setSelectedAnswer(selectedOption);

      const isCorrect =
        !!selectedOption &&
        selectedOption === quizData.questions[currentQuestionIndex].correctAnswer;

      const difficulty = (quizData.difficulty || 'medium') as Difficulty;
      const gainedPoints = calculateScore(difficulty, timeLeft, duration, !!isCorrect);
      const points = isCorrect ? gainedPoints : 0;

      socket.emit('submit-team-answer', {
        roomId,
        teamId: myTeamId,
        answer: selectedOption,
        isCorrect,
        points,
        currentQuestion: currentQuestionIndex,
        timeLeft,
      });
    },
    [quizData, currentQuestionIndex, duration, roomId, socket, myTeamId, timeLeft, isLocked],
  );

  const prevScoreRef = useRef(myTeam?.score ?? 0);
  useEffect(() => {
    prevScoreRef.current = myTeam?.score ?? 0;
  }, [myTeam?.score]);

  // Timer functionality moved to useQuizTimer hook

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
        <div className="w-full max-w-md bg-black/50 p-8 rounded-2xl border border-cyan-400/30 shadow-lg backdrop-blur-md">
          <h1 className="font-zentry text-4xl font-black uppercase text-white mb-4">Loading...</h1>
          <p className="font-general text-xl text-gray-200">Preparing your custom battle</p>
        </div>
      </div>
    );
  }

  const currentQuestion = quizData.questions[currentQuestionIndex];
  const timePercentage = (timeLeft / duration) * 100;
  const isTimeLow = timeLeft <= 5;

  if (isFinished) {
    const myScore = myTeam?.score ?? 0;
    const oppScore = opponentTeam?.score ?? 0;
    const result =
      myScore === oppScore ? 'Draw' : myScore > oppScore ? 'Your Team Wins!' : 'Your Team Loses';

    return (
      <div className="flex-center min-h-screen p-4" style={backgroundStyle}>
        <div className="w-full max-w-2xl bg-black/60 rounded-2xl border border-cyan-400/30 p-8 text-center shadow-2xl backdrop-blur-lg animate-fade-in">
          <h1 className="font-zentry text-4xl md:text-5xl font-black uppercase text-white mb-2">
            Custom Battle Complete
          </h1>
          <p className="font-general text-xl text-cyan-300 mb-6">{result}</p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="rounded-xl bg-black/40 border border-cyan-400/30 p-4">
              <p className="text-sm text-white/70 mb-2">
                {myTeamId === 'teamA' ? 'Team A (Your Team)' : 'Team B (Your Team)'}
              </p>
              <p className="text-4xl font-zentry text-white mb-3">{myScore}</p>
              <div className="space-y-1">
                {myTeam?.members.map((member) => (
                  <p key={member.id} className="text-xs text-white/60">
                    {member.username}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-black/40 border border-cyan-400/30 p-4">
              <p className="text-sm text-white/70 mb-2">
                {myTeamId === 'teamA' ? 'Team B (Opponent)' : 'Team A (Opponent)'}
              </p>
              <p className="text-4xl font-zentry text-white mb-3">{oppScore}</p>
              <div className="space-y-1">
                {opponentTeam?.members.map((member) => (
                  <p key={member.id} className="text-xs text-white/60">
                    {member.username}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                const url = `/waiting-room?roomId=${encodeURIComponent(roomId)}&quizId=${encodeURIComponent(quizId)}&username=${encodeURIComponent(username)}&mode=custom`;
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

  if (selfTeamFinished && !isFinished) {
    return (
      <div className="flex-center min-h-screen p-4" style={backgroundStyle}>
        <div className="w-full max-w-2xl bg-black/60 rounded-2xl border border-cyan-400/30 p-8 text-center shadow-2xl backdrop-blur-lg animate-fade-in">
          <h1 className="font-zentry text-4xl md:text-5xl font-black uppercase text-white mb-2">
            Waiting for Opponent Team
          </h1>
          <p className="font-general text-xl text-cyan-300 mb-6">Your team&apos;s final score</p>
          <div className="rounded-xl bg-black/40 border border-cyan-400/30 p-6 mb-6">
            <p className="text-5xl font-zentry text-white">{myTeam?.score ?? 0}</p>
            <div className="space-y-1 mt-4">
              {myTeam?.members.map((member) => (
                <p key={member.id} className="text-sm text-white/60">
                  {member.username}
                </p>
              ))}
            </div>
          </div>
          <p className="text-white/70 font-general">Hang tight while the opponent team finishes…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-center flex-col min-h-screen p-2 md:p-4" style={backgroundStyle}>
      {/* Team Scoreboard */}
      <div className="w-full max-w-4xl mb-4 grid grid-cols-2 gap-4">
        <div
          className={`rounded-xl p-4 border-2 ${(myTeam?.score ?? 0) >= (opponentTeam?.score ?? 0) ? 'border-green-400/50' : 'border-cyan-400/30'} bg-black/40`}
        >
          <div className="flex items-center justify-between text-white mb-2">
            <span className="font-general font-bold text-base">
              Team A {myTeamId === 'teamA' && '(You)'}
            </span>
            <div className="text-5xl font-zentry text-white">{myTeam?.score ?? 0}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {myTeam?.members.map((member) => (
              <span
                key={member.id}
                className="text-sm text-white/80 bg-white/10 px-3 py-1 rounded-md"
              >
                {member.username}
              </span>
            ))}
          </div>
        </div>
        <div
          className={`rounded-xl p-4 border-2 ${(opponentTeam?.score ?? 0) > (myTeam?.score ?? 0) ? 'border-green-400/50' : 'border-cyan-400/30'} bg-black/40`}
        >
          <div className="flex items-center justify-between text-white mb-2">
            <span className="font-general font-bold text-base">
              Team B {myTeamId === 'teamB' && '(You)'}
            </span>
            <div className="text-5xl font-zentry text-white">{opponentTeam?.score ?? 0}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {opponentTeam?.members.map((member) => (
              <span
                key={member.id}
                className="text-sm text-white/80 bg-white/10 px-3 py-1 rounded-md"
              >
                {member.username}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`w-full max-w-4xl transition-opacity duration-300 ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}
      >
        {/* Header */}
        <div className="mb-4 text-white">
          <div className="flex justify-center items-center mb-2">
            <h1 className="font-zentry text-2xl md:text-3xl font-black uppercase text-gray-100 shadow-lg [text-shadow:_0_0_10px_rgb(239_68_68_/_50%)]">
              {quizData.topic}
            </h1>
          </div>
          <div className="flex justify-between items-center text-cyan-300/80 font-general text-sm">
            <p className="capitalize">Difficulty: {quizData.difficulty}</p>
            <p>
              Question {currentQuestionIndex + 1} / {quizData.questions.length}
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-black/50 rounded-2xl border-2 border-cyan-400/30 p-6 md:p-8 shadow-2xl backdrop-blur-md">
          {/* Timer Bar */}
          <div className="mb-6 flex items-center gap-3">
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
                style={{
                  width: `${Math.max(0, Math.min(100, timePercentage))}%`,
                }}
                onTransitionEnd={handleProgressTransitionEnd}
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

          <h2 className="font-general text-lg md:text-xl mb-6 font-bold text-white text-center">
            {currentQuestion.questionText}
          </h2>

          {/* Reserved space for notifications */}
          <div className="mb-4 h-12 flex items-center justify-center">
            {answeringPlayer && showFeedback && selectedAnswer !== null && (
              <div className="w-full p-3 rounded-lg bg-blue-500/20 border border-blue-500/40 text-center">
                <p className="text-sm text-blue-300 font-general">
                  {answeringPlayer} answered! Team advancing together...
                </p>
              </div>
            )}
            {showFeedback && selectedAnswer === null && (
              <p className="text-center text-red-300 font-general text-base">Time&apos;s up!</p>
            )}
          </div>

          <div className="space-y-3 text-base">
            {currentQuestion.options.map((option, index) => (
              <button
                key={option}
                onClick={() => handleNext(option)}
                disabled={showFeedback || timeLeft === 0 || isLocked}
                className={getButtonClass(option)}
                aria-label={`Option ${String.fromCharCode(65 + index)}: ${cleanOption(option)}`}
              >
                <span className="font-semibold mr-3 bg-cyan-500/80 text-black rounded px-2 py-1 text-sm">
                  {String.fromCharCode(65 + index)}
                </span>
                {cleanOption(option)}
              </button>
            ))}
          </div>
          {isLocked && !showFeedback && (
            <p className="mt-4 text-center text-cyan-300 font-general animate-pulse text-base">
              Waiting for teammate to answer...
            </p>
          )}
        </div>

        {!connected && (
          <p className="mt-2 text-center text-[10px] text-red-300">
            Disconnected from server… attempting to reconnect
          </p>
        )}
      </div>
    </div>
  );
}
