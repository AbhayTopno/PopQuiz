import { useEffect, useRef, useState } from 'react';
import { useSocketConnection } from '../useSocketConnection';
import { TeamMember } from './useTeamArenaSocket';

type CoopSocketProps = {
  roomId: string;
  username: string;
  quizId: string;
  setIsFinished: (finished: boolean) => void;
  onAnswerLockedCallback: (data: {
    answeredBy: string;
    playerName: string;
    answer: string;
    isCorrect: boolean;
  }) => void;
  onReconnectState?: (state: {
    currentQuestionIndex: number;
    score: number;
    questionStartTime: number;
    serverTime: number;
  }) => void;
};

export function useCoopSocket({
  roomId,
  username,
  quizId,
  setIsFinished,
  onAnswerLockedCallback,
  onReconnectState,
}: CoopSocketProps) {
  const { socket, connected } = useSocketConnection();
  const joinedRef = useRef(false);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamScore, setTeamScore] = useState(0);

  useEffect(() => {
    if (connected && !joinedRef.current && roomId && quizId) {
      joinedRef.current = true;
      socket.emit('join-coop-room', { roomId, quizId, username });
    }
  }, [connected, roomId, quizId, username, socket]);

  useEffect(() => {
    if (!socket) return;

    const onTeamUpdate = (data: { members: TeamMember[]; score: number }) => {
      setTeamMembers(data.members);
      setTeamScore(data.score);
    };

    const onAnswerLocked = (data: {
      answeredBy: string;
      playerName: string;
      answer: string;
      isCorrect: boolean;
    }) => {
      onAnswerLockedCallback(data);
    };

    const onScoreUpdate = (data: { score: number }) => {
      setTeamScore(data.score);
    };

    const onQuizComplete = (data: { finalScore: number; members: TeamMember[] }) => {
      setTeamScore(data.finalScore);
      setTeamMembers(data.members);
      setIsFinished(true);
    };

    const onRoomState = (data: {
      players: {
        id: string;
        username: string;
        score: number;
        currentQuestionIndex: number;
        questionStartTime: number;
      }[];
      gameStarted: boolean;
      serverTime: number;
      teamScore?: number;
    }) => {
      if (!data.gameStarted) return;
      if (data.teamScore !== undefined) setTeamScore(data.teamScore);

      const me = data.players.find((p) => p.username === username || p.id === socket.id);
      if (me && onReconnectState) {
        onReconnectState({
          currentQuestionIndex: me.currentQuestionIndex || 0,
          score: me.score || 0,
          questionStartTime: me.questionStartTime || Date.now(),
          serverTime: data.serverTime || Date.now(),
        });
      }
    };

    socket.on('coop-team-update', onTeamUpdate);
    socket.on('coop-answer-locked', onAnswerLocked);
    socket.on('coop-score-update', onScoreUpdate);
    socket.on('coop-quiz-complete', onQuizComplete);
    socket.on('room-state', onRoomState);

    return () => {
      socket.off('coop-team-update', onTeamUpdate);
      socket.off('coop-answer-locked', onAnswerLocked);
      socket.off('coop-score-update', onScoreUpdate);
      socket.off('coop-quiz-complete', onQuizComplete);
      socket.off('room-state', onRoomState);
    };
  }, [socket, setIsFinished, onAnswerLockedCallback, onReconnectState, username]);

  return { socket, connected, teamMembers, teamScore };
}
