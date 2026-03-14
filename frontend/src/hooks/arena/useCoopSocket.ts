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
};

export function useCoopSocket({
  roomId,
  username,
  quizId,
  setIsFinished,
  onAnswerLockedCallback,
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

    socket.on('coop-team-update', onTeamUpdate);
    socket.on('coop-answer-locked', onAnswerLocked);
    socket.on('coop-score-update', onScoreUpdate);
    socket.on('coop-quiz-complete', onQuizComplete);

    return () => {
      socket.off('coop-team-update', onTeamUpdate);
      socket.off('coop-answer-locked', onAnswerLocked);
      socket.off('coop-score-update', onScoreUpdate);
      socket.off('coop-quiz-complete', onQuizComplete);
    };
  }, [socket, setIsFinished, onAnswerLockedCallback]);

  return { socket, connected, teamMembers, teamScore };
}
