'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { QuizData } from '@/types';
import { getSocket } from '@/utils/socket';
import { calculateScore, type Difficulty } from '@/utils/scoring';
import CompactLeaderboard, { type CompactPlayer } from '@/components/CompactLeaderboard';
import TimerBar from '@/components/TimerBar';

type FFAPlayer = {
  id: string;
  username: string;
  avatar?: string;
  score: number;
  finished: boolean;
};

const FEEDBACK_DELAY_MS = 3000;

export default function FFAArenaClient() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId') || '';
  const quizId = searchParams.get('quizId') || '';
  const username = searchParams.get('username') || 'Player';
  const duration = parseInt(searchParams.get('duration') || '10');

  const socket = useMemo(() => getSocket(), []);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [players, setPlayers] = useState<FFAPlayer[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [selfFinished, setSelfFinished] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(duration);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [connected, setConnected] = useState(false);
  const joinedRef = useRef(false);
  const [pendingTimeoutReveal, setPendingTimeoutReveal] = useState(false);

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
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/quiz/${quizId}`);
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
  }, [duration]);

  // Socket connection and events
  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      if (!joinedRef.current && roomId) {
        joinedRef.current = true;
        socket.emit('join-ffa-room', { roomId, quizId, username });
      }
    };
    const onDisconnect = () => setConnected(false);

    // FFA player list update
    const onFFAPlayersUpdate = (data: { players: FFAPlayer[] }) => {
      setPlayers(data.players);
      // Update my score from the list
      const me = data.players.find((p) => p.id === socket.id);
      if (me) {
        setScore(me.score);
        // Check if I'm finished
        if (me.finished) {
          setSelfFinished(true);
        }
      }

      // Check if all players are finished
      const allFinished = data.players.length > 0 && data.players.every((p) => p.finished);
      if (allFinished && data.players.length >= 2) {
        setIsFinished(true);
      }
    };

    // Score update broadcast
    const onFFAScoreUpdate = (data: {
      playerId: string;
      username: string;
      score: number;
      currentQuestion: number;
      finished: boolean;
    }) => {
      if (data.playerId === socket.id) {
        setScore(data.score);
      }
      // Update in players list
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === data.playerId ? { ...p, score: data.score, finished: data.finished } : p,
        ),
      );
    };

    // Player finished
    const onFFAPlayerFinished = (data: { playerId: string; username: string; score: number }) => {
      setPlayers((prev) =>
        prev.map((p) => (p.id === data.playerId ? { ...p, score: data.score, finished: true } : p)),
      );
    };

    // Battle complete
    const onFFABattleComplete = (data: { players: FFAPlayer[] }) => {
      setPlayers(data.players);
      const me = data.players.find((p) => p.id === socket.id);
      if (me) setScore(me.score);
      setIsFinished(true);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('ffa-players-update', onFFAPlayersUpdate);
    socket.on('ffa-score-update', onFFAScoreUpdate);
    socket.on('ffa-player-finished', onFFAPlayerFinished);
    socket.on('ffa-battle-complete', onFFABattleComplete);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('ffa-players-update', onFFAPlayersUpdate);
      socket.off('ffa-score-update', onFFAScoreUpdate);
      socket.off('ffa-player-finished', onFFAPlayerFinished);
      socket.off('ffa-battle-complete', onFFABattleComplete);
    };
  }, [socket, roomId, username, quizId]);

  const handleNext = useCallback(
    (selectedOption: string | null) => {
      if (!quizData) return;

      setShowFeedback(true);
      setSelectedAnswer(selectedOption);

      const isCorrect =
        !!selectedOption &&
        selectedOption === quizData.questions[currentQuestionIndex].correctAnswer;

      const difficulty = (quizData.difficulty || 'medium') as Difficulty;
      const gainedPoints = calculateScore(difficulty, timeLeft, duration, !!isCorrect);
      const points = isCorrect ? gainedPoints : 0;
      const nextScore = prevScoreRef.current + points;

      if (isCorrect) {
        setScore(nextScore);
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

            // Emit score update (not finished)
            socket.emit('ffa-score-update', {
              roomId,
              score: nextScore,
              currentQuestion: nextIndex,
              finished: false,
            });
          } else {
            // Player finished
            setSelfFinished(true);
            socket.emit('ffa-player-finished', { roomId, username, score: nextScore });
            socket.emit('ffa-score-update', {
              roomId,
              score: nextScore,
              currentQuestion: nextIndex,
              finished: true,
            });
          }
        }, 300);
      }, FEEDBACK_DELAY_MS);
    },
    [quizData, currentQuestionIndex, duration, roomId, socket, username, timeLeft],
  );

  const prevScoreRef = useRef(score);
  useEffect(() => {
    prevScoreRef.current = score;
  }, [score]);

  // Timer
  useEffect(() => {
    if (isFinished || selfFinished || showFeedback) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (isFinished || selfFinished || showFeedback) return prev;

        const next = prev - 1;
        if (next <= 0) {
          setPendingTimeoutReveal(true);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isFinished, selfFinished, showFeedback, handleNext, duration, currentQuestionIndex]);

  const handleProgressTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== 'width') return;
      if (!pendingTimeoutReveal) return;
      if (timeLeft > 0) return;
      setPendingTimeoutReveal(false);
      handleNext(null);
    },
    [pendingTimeoutReveal, timeLeft, handleNext],
  );

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
          <p className="font-general text-xl text-gray-200">Preparing FFA battle...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = quizData.questions[currentQuestionIndex];
  const isTimeLow = timeLeft <= 5;

  if (isFinished) {
    // Sort players by score
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const myRank = sortedPlayers.findIndex((p) => p.id === socket.id) + 1;

    return (
      <div className="flex-center min-h-screen p-4" style={backgroundStyle}>
        <div className="w-full max-w-3xl bg-black/60 rounded-2xl border border-cyan-400/30 p-8 shadow-2xl backdrop-blur-lg animate-fade-in">
          <h1 className="font-zentry text-4xl md:text-5xl font-black uppercase text-white mb-2 text-center">
            FFA Battle Complete
          </h1>
          <p className="font-general text-xl text-cyan-300 mb-6 text-center">
            You ranked #{myRank} out of {players.length}
          </p>

          <div className="bg-black/40 rounded-xl border border-cyan-400/30 p-6 mb-6">
            <h2 className="font-general text-lg font-semibold text-white mb-4 text-center">
              Final Leaderboard
            </h2>
            <div className="space-y-2">
              {sortedPlayers.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    player.id === socket.id
                      ? 'bg-cyan-500/20 border border-cyan-400/50'
                      : 'bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-zentry text-lg ${
                        index === 0
                          ? 'text-yellow-400'
                          : index === 1
                            ? 'text-gray-300'
                            : index === 2
                              ? 'text-orange-400'
                              : 'text-white/70'
                      }`}
                    >
                      #{index + 1}
                    </span>
                    <span className="font-general text-white">
                      {player.username}
                      {player.id === socket.id && ' (You)'}
                    </span>
                  </div>
                  <span className="font-zentry text-xl text-white">{player.score}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                const url = `/waiting-room?roomId=${encodeURIComponent(roomId)}&quizId=${encodeURIComponent(quizId)}&username=${encodeURIComponent(username)}&mode=ffa`;
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
            Waiting for Others
          </h1>
          <p className="font-general text-xl text-cyan-300 mb-6">Your final score</p>
          <div className="rounded-xl bg-black/40 border border-cyan-400/30 p-6 mb-6">
            <p className="text-5xl font-zentry text-white">{score}</p>
          </div>
          <p className="text-white/70 font-general mb-4">
            Hang tight while others finish the battle...
          </p>

          {/* Show current standings */}
          <div className="bg-black/20 rounded-lg p-4">
            <h3 className="font-general text-sm text-white/80 mb-2">Current Standings</h3>
            <div className="space-y-1">
              {[...players]
                .sort((a, b) => b.score - a.score)
                .map((player, index) => (
                  <div
                    key={player.id}
                    className={`flex justify-between text-sm ${
                      player.id === socket.id ? 'text-cyan-300 font-semibold' : 'text-white/60'
                    }`}
                  >
                    <span>
                      #{index + 1} {player.username} {player.finished && '✓'}
                    </span>
                    <span>{player.score}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Sort players by score for leaderboard display
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col h-screen p-2 md:p-4 overflow-hidden" style={backgroundStyle}>
      {/* Compact Leaderboard (reusable) */}
      <CompactLeaderboard players={sortedPlayers as CompactPlayer[]} socketId={socket.id} />

      <div
        className={`w-full max-w-4xl mx-auto flex-1 flex flex-col transition-opacity duration-300 ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}
      >
        {/* Header */}
        <div className="mb-2 text-white">
          <div className="flex justify-center items-center mb-2">
            <h1 className="font-zentry text-xl md:text-2xl font-black uppercase text-gray-100 shadow-lg [text-shadow:_0_0_10px_rgb(239_68_68_/_50%)]">
              {quizData.topic}
            </h1>
          </div>
          <div className="flex justify-between items-center font-general text-sm font-semibold">
            <p className="capitalize text-yellow-300">Difficulty: {quizData.difficulty}</p>
            <p className="text-cyan-300">
              Question {currentQuestionIndex + 1} / {quizData.questions.length}
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-black/50 rounded-2xl border-2 border-cyan-400/30 p-4 md:p-6 shadow-2xl backdrop-blur-md flex flex-col">
          {/* Timer Bar (reusable) */}
          <TimerBar
            timeLeft={timeLeft}
            duration={duration}
            isTimeLow={isTimeLow}
            onTransitionEnd={handleProgressTransitionEnd}
          />

          <h2 className="font-general text-base md:text-lg mb-3 font-bold text-white text-center">
            {currentQuestion.questionText}
          </h2>

          {/* Spacing for feedback message */}
          <div className="min-h-[28px] flex items-center justify-center mb-2">
            {showFeedback && selectedAnswer === null && (
              <p className="text-center text-red-300 font-general text-base">Time&apos;s up!</p>
            )}
          </div>

          <div className="space-y-2.5 text-sm md:text-base">
            {currentQuestion.options.map((option, index) => (
              <button
                key={option}
                onClick={() => handleNext(option)}
                disabled={showFeedback || timeLeft === 0}
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
