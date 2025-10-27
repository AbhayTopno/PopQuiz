'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QuizData } from '@/types';
import { getSocket } from '@/utils/socket';
import { calculateScore, type Difficulty } from '@/utils/scoring';

type ArenaClientProps = {
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

type Team = {
  teamId: 'teamA' | 'teamB';
  members: TeamMember[];
  score: number;
  currentQuestionIndex: number;
  hasAnswered: boolean;
};

const FEEDBACK_DELAY_MS = 3000;

export default function ArenaClient({
  roomId,
  username,
  initialQuizData,
  initialDuration = 10,
  quizId,
}: ArenaClientProps) {
  const socket = useMemo(() => getSocket(), []);
  const [quizData] = useState<QuizData | null>(initialQuizData ?? null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  // Team states instead of individual opponent
  const [myTeamId, setMyTeamId] = useState<'teamA' | 'teamB' | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [opponentTeam, setOpponentTeam] = useState<Team | null>(null);

  const [isFinished, setIsFinished] = useState(false);
  const [selfTeamFinished, setSelfTeamFinished] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(initialDuration);
  const [duration] = useState<number>(initialDuration);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [connected, setConnected] = useState(false);
  const joinedRef = useRef(false);
  const [pendingTimeoutReveal, setPendingTimeoutReveal] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [answeringPlayer, setAnsweringPlayer] = useState<string | null>(null);

  const backgroundStyle = {
    backgroundImage: `url(${'/img/Quiz.png'})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  } as const;

  useEffect(() => {
    setTimeLeft(duration);
  }, [duration]);

  // Connect/join if needed and wire events
  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      // Join 2v2 room
      if (!joinedRef.current && roomId) {
        joinedRef.current = true;
        socket.emit('join-2v2-room', { roomId, quizId: quizId || initialQuizData._id, username });
      }
    };
    const onDisconnect = () => setConnected(false);

    // Receive team assignment when joining
    const onTeamAssignment = (data: { teamId: 'teamA' | 'teamB'; teams: Team[] }) => {
      console.log('🎯 Received team assignment:', data.teamId, 'Teams:', data.teams);
      setMyTeamId(data.teamId);
      const myTeamData = data.teams.find((t) => t.teamId === data.teamId);
      const oppTeamData = data.teams.find((t) => t.teamId !== data.teamId);
      if (myTeamData) setMyTeam(myTeamData);
      if (oppTeamData) setOpponentTeam(oppTeamData);
    };

    // Teams update when players join/leave (broadcasted to all players)
    const onTeamsUpdate = (data: { teams: Team[]; totalPlayers: number }) => {
      if (!myTeamId) return; // Wait until we know our team
      const myTeamData = data.teams.find((t) => t.teamId === myTeamId);
      const oppTeamData = data.teams.find((t) => t.teamId !== myTeamId);
      if (myTeamData) setMyTeam(myTeamData);
      if (oppTeamData) setOpponentTeam(oppTeamData);
    };

    // Team score updates (real-time score broadcasting for both teams)
    const onTeamScoreUpdate = (data: {
      teamId: 'teamA' | 'teamB';
      score: number;
      currentQuestion: number;
      answeredBy: string;
      answer: string | null;
      isCorrect: boolean;
    }) => {
      if (data.teamId === myTeamId) {
        setMyTeam((prev) => (prev ? { ...prev, score: data.score } : null));
      } else {
        setOpponentTeam((prev) => (prev ? { ...prev, score: data.score } : null));
      }
    };

    // COOP MECHANIC: When ANY teammate answers, ALL team members see same feedback and advance together
    const onTeamAnswerLocked = (data: {
      teamId: 'teamA' | 'teamB';
      currentQuestion: number;
      answeredBy: string;
      answer: string | null;
      isCorrect: boolean;
    }) => {
      // Process if it's MY team (regardless of who answered)
      if (data.teamId === myTeamId) {
        // Find the answering player's name
        const answeringMember = myTeam?.members.find((m) => m.id === data.answeredBy);
        if (answeringMember) {
          setAnsweringPlayer(answeringMember.username);
        }

        // If I'm NOT the one who answered, lock me and show feedback
        if (data.answeredBy !== socket.id) {
          setIsLocked(true);
          setShowFeedback(true);
          setSelectedAnswer(data.answer);
        }
        // Note: If I AM the answering player, handleNext already set showFeedback and selectedAnswer

        // ALL team members advance together after feedback delay
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
              setIsLocked(false);
              setAnsweringPlayer(null);
            } else {
              // Quiz finished - only the answering player emits finish
              if (data.answeredBy === socket.id) {
                socket.emit('team-quiz-finished', { roomId, teamId: myTeamId });
              }
              // All players should see waiting/finished state
              setSelfTeamFinished(true);
            }
          }, 300);
        }, FEEDBACK_DELAY_MS);
      }
    };

    // When a team finishes
    const onTeamFinished = (data: {
      teamId: 'teamA' | 'teamB';
      score: number;
      members: TeamMember[];
    }) => {
      if (data.teamId === myTeamId) {
        setSelfTeamFinished(true);
        setMyTeam((prev) => (prev ? { ...prev, score: data.score } : null));
      } else {
        setOpponentTeam((prev) => (prev ? { ...prev, score: data.score } : null));
      }
    };

    // Battle complete - both teams finished
    const onBattleComplete = (data: { teams: Team[] }) => {
      const myFinalTeam = data.teams.find((t) => t.teamId === myTeamId);
      const oppFinalTeam = data.teams.find((t) => t.teamId !== myTeamId);
      if (myFinalTeam) setMyTeam(myFinalTeam);
      if (oppFinalTeam) setOpponentTeam(oppFinalTeam);
      setIsFinished(true);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('team-assignment', onTeamAssignment);
    socket.on('teams-update', onTeamsUpdate);
    socket.on('team-score-update', onTeamScoreUpdate);
    socket.on('team-answer-locked', onTeamAnswerLocked);
    socket.on('team-finished', onTeamFinished);
    socket.on('2v2-battle-complete', onBattleComplete);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('team-assignment', onTeamAssignment);
      socket.off('teams-update', onTeamsUpdate);
      socket.off('team-score-update', onTeamScoreUpdate);
      socket.off('team-answer-locked', onTeamAnswerLocked);
      socket.off('team-finished', onTeamFinished);
      socket.off('2v2-battle-complete', onBattleComplete);
    };
  }, [
    socket,
    roomId,
    username,
    quizId,
    initialQuizData?._id,
    myTeamId,
    currentQuestionIndex,
    duration,
  ]);

  // Note: score updates are emitted inline where state changes to avoid stale closures

  const handleNext = useCallback(
    (selectedOption: string | null) => {
      if (!quizData || !myTeamId || isLocked) return;

      console.log(`📤 Submitting answer for ${myTeamId}. Socket ID:`, socket.id);

      // Lock immediately (coop behavior)
      setIsLocked(true);
      setShowFeedback(true);
      setSelectedAnswer(selectedOption);

      const isCorrect =
        !!selectedOption &&
        selectedOption === quizData.questions[currentQuestionIndex].correctAnswer;

      // Calculate scoring based on difficulty and remaining time
      const difficulty = (quizData.difficulty || 'medium') as Difficulty;
      const gainedPoints = calculateScore(difficulty, timeLeft, duration, !!isCorrect);
      const points = isCorrect ? gainedPoints : 0;

      // Emit team answer to backend (cooperative scoring)
      // Backend will broadcast 'team-answer-locked' which advances ALL team members together
      socket.emit('submit-team-answer', {
        roomId,
        teamId: myTeamId,
        answer: selectedOption,
        isCorrect,
        points,
        currentQuestion: currentQuestionIndex,
        timeLeft,
      });

      // Note: Advancement is handled by the 'team-answer-locked' socket event
      // which ensures ALL team members advance together (including the answering player)
    },
    [quizData, currentQuestionIndex, duration, roomId, socket, myTeamId, timeLeft, isLocked],
  );

  // Keep a ref of latest team score to avoid stale closure in timeouts
  const prevScoreRef = useRef(myTeam?.score ?? 0);
  useEffect(() => {
    prevScoreRef.current = myTeam?.score ?? 0;
  }, [myTeam?.score]);

  // Timer
  useEffect(() => {
    if (isFinished || selfTeamFinished || showFeedback || isLocked) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        // Avoid triggering transitions if we've already finished or are showing feedback
        if (isFinished || selfTeamFinished || showFeedback || isLocked) return prev;

        const next = prev - 1;
        if (next <= 0) {
          // Show 0s and wait until the progress bar width reaches zero, then reveal
          setPendingTimeoutReveal(true);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [
    isFinished,
    selfTeamFinished,
    showFeedback,
    handleNext,
    duration,
    currentQuestionIndex,
    isLocked,
  ]);

  // When the progress bar finishes shrinking to zero width, reveal the answer for timeout
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

  // UI helpers
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
    const myScore = myTeam?.score ?? 0;
    const oppScore = opponentTeam?.score ?? 0;
    const result =
      myScore === oppScore ? 'Draw' : myScore > oppScore ? 'Your Team Wins!' : 'Your Team Loses';

    return (
      <div className="flex-center min-h-screen p-4" style={backgroundStyle}>
        <div className="w-full max-w-2xl bg-black/60 rounded-2xl border border-cyan-400/30 p-8 text-center shadow-2xl backdrop-blur-lg animate-fade-in">
          <h1 className="font-zentry text-4xl md:text-5xl font-black uppercase text-white mb-2">
            2v2 Battle Complete
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
                const qid = quizId || quizData._id;
                const url = `/waiting-room?roomId=${encodeURIComponent(roomId)}&quizId=${encodeURIComponent(qid)}&username=${encodeURIComponent(username)}&mode=2v2`;
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

  // If the team finished but opponent team hasn't yet, show waiting screen
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

  const leading = (a: number, b: number) => (a === b ? 'Tie' : a > b ? 'Leading' : 'Trailing');

  return (
    <div className="flex-center flex-col min-h-screen p-4 md:p-8" style={backgroundStyle}>
      {/* Team Scoreboard */}
      <div className="w-full max-w-3xl mb-4 grid grid-cols-2 gap-3">
        <div
          className={`rounded-xl p-4 border ${(myTeam?.score ?? 0) >= (opponentTeam?.score ?? 0) ? 'border-green-400/50' : 'border-cyan-400/30'} bg-black/40`}
        >
          <div className="flex items-center justify-between text-white mb-2">
            <span className="font-general font-bold">
              {myTeamId === 'teamA' ? 'Team A (You)' : 'Team B (You)'}
            </span>
            <span className="text-xs text-white/60">
              {leading(myTeam?.score ?? 0, opponentTeam?.score ?? 0)}
            </span>
          </div>
          <div className="text-3xl font-zentry text-white mb-2">{myTeam?.score ?? 0}</div>
          <div className="space-y-1">
            {myTeam?.members.map((member) => (
              <p key={member.id} className="text-xs text-white/60">
                {member.username}
              </p>
            ))}
          </div>
        </div>
        <div
          className={`rounded-xl p-4 border ${(opponentTeam?.score ?? 0) > (myTeam?.score ?? 0) ? 'border-green-400/50' : 'border-cyan-400/30'} bg-black/40`}
        >
          <div className="flex items-center justify-between text-white mb-2">
            <span className="font-general font-bold">
              {myTeamId === 'teamA' ? 'Team B' : 'Team A'}
            </span>
            <span className="text-xs text-white/60">
              {leading(opponentTeam?.score ?? 0, myTeam?.score ?? 0)}
            </span>
          </div>
          <div className="text-3xl font-zentry text-white mb-2">{opponentTeam?.score ?? 0}</div>
          <div className="space-y-1">
            {opponentTeam?.members.map((member) => (
              <p key={member.id} className="text-xs text-white/60">
                {member.username}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`w-full max-w-3xl transition-opacity duration-300 ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}
      >
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
          {/* Timer Bar with right-side timer pill */}
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

          {/* Teammate Answered Notification */}
          {answeringPlayer && showFeedback && (
            <div className="mb-4 p-3 rounded-lg bg-blue-500/20 border border-blue-500/40 text-center">
              <p className="text-sm text-blue-300 font-general">
                {answeringPlayer} answered! Team advancing together...
              </p>
            </div>
          )}

          <div className="space-y-4 text-md">
            {currentQuestion.options.map((option, index) => (
              <button
                key={option}
                onClick={() => handleNext(option)}
                disabled={showFeedback || timeLeft === 0 || isLocked}
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
          {isLocked && !showFeedback && (
            <p className="mt-4 text-center text-cyan-300 font-general animate-pulse">
              Waiting for teammate to answer...
            </p>
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
