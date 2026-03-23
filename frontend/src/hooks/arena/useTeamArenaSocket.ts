import { useEffect, useRef, useState } from 'react';
import { useSocketConnection } from '../useSocketConnection';

export type TeamMember = {
  id: string;
  username: string;
  avatar?: string;
};

export type Team = {
  teamId: 'teamA' | 'teamB';
  members: TeamMember[];
  score: number;
  currentQuestionIndex: number;
  hasAnswered: boolean;
};

type TeamArenaSocketProps = {
  roomId: string;
  username: string;
  quizId: string;
  roomJoinEvent: 'join-2v2-room' | 'join-custom-room';
  setIsFinished: (finished: boolean) => void;
  setSelfTeamFinished: (finished: boolean) => void;
  onAnswerLockedCallback: (
    data: {
      teamId: 'teamA' | 'teamB';
      currentQuestion: number;
      answeredBy: string;
      answer: string | null;
      isCorrect: boolean;
      playerName?: string;
    },
    myTeamId: 'teamA' | 'teamB' | null,
    myTeam: Team | null,
  ) => void;
  onReconnectState?: (state: {
    currentQuestionIndex: number;
    score: number;
    questionStartTime: number;
    serverTime: number;
  }) => void;
};

export function useTeamArenaSocket({
  roomId,
  username,
  quizId,
  roomJoinEvent,
  setIsFinished,
  setSelfTeamFinished,
  onAnswerLockedCallback,
  onReconnectState,
}: TeamArenaSocketProps) {
  const { socket, connected } = useSocketConnection();
  const joinedRef = useRef(false);

  const [myTeamId, setMyTeamId] = useState<'teamA' | 'teamB' | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [opponentTeam, setOpponentTeam] = useState<Team | null>(null);

  useEffect(() => {
    if (connected && !joinedRef.current && roomId && quizId) {
      joinedRef.current = true;
      socket.emit(roomJoinEvent, { roomId, quizId, username });
    }
  }, [connected, roomId, quizId, username, roomJoinEvent, socket]);

  useEffect(() => {
    if (!socket) return;

    const onTeamAssignment = (data: { teamId: 'teamA' | 'teamB'; teams: Team[] }) => {
      setMyTeamId(data.teamId);
      const myTeamData = data.teams.find((t) => t.teamId === data.teamId);
      const oppTeamData = data.teams.find((t) => t.teamId !== data.teamId);
      if (myTeamData) setMyTeam(myTeamData);
      if (oppTeamData) setOpponentTeam(oppTeamData);
    };

    const onTeamsUpdate = (data: { teams: Team[]; totalPlayers: number }) => {
      setMyTeamId((currentMyTeamId) => {
        if (!currentMyTeamId) return currentMyTeamId;
        const myTeamData = data.teams.find((t) => t.teamId === currentMyTeamId);
        const oppTeamData = data.teams.find((t) => t.teamId !== currentMyTeamId);
        if (myTeamData) setMyTeam(myTeamData);
        if (oppTeamData) setOpponentTeam(oppTeamData);
        return currentMyTeamId;
      });
    };

    const onTeamScoreUpdate = (data: { teamId: 'teamA' | 'teamB'; score: number }) => {
      setMyTeamId((currentMyTeamId) => {
        if (data.teamId === currentMyTeamId) {
          setMyTeam((prev) => (prev ? { ...prev, score: data.score } : null));
        } else {
          setOpponentTeam((prev) => (prev ? { ...prev, score: data.score } : null));
        }
        return currentMyTeamId;
      });
    };

    const onTeamAnswerLocked = (data: {
      teamId: 'teamA' | 'teamB';
      currentQuestion: number;
      answeredBy: string;
      answer: string | null;
      isCorrect: boolean;
      playerName?: string;
    }) => {
      setMyTeamId((currentMyTeamId) => {
        setMyTeam((currentMyTeam) => {
          onAnswerLockedCallback(data, currentMyTeamId, currentMyTeam);
          return currentMyTeam;
        });
        return currentMyTeamId;
      });
    };

    const onTeamFinished = (data: { teamId: 'teamA' | 'teamB'; score: number }) => {
      setMyTeamId((currentMyTeamId) => {
        if (data.teamId === currentMyTeamId) {
          setSelfTeamFinished(true);
          setMyTeam((prev) => (prev ? { ...prev, score: data.score } : null));
        } else {
          setOpponentTeam((prev) => (prev ? { ...prev, score: data.score } : null));
        }
        return currentMyTeamId;
      });
    };

    const onBattleComplete = (data: { teams: Team[] }) => {
      setMyTeamId((currentMyTeamId) => {
        const myFinalTeam = data.teams.find((t) => t.teamId === currentMyTeamId);
        const oppFinalTeam = data.teams.find((t) => t.teamId !== currentMyTeamId);
        if (myFinalTeam) setMyTeam(myFinalTeam);
        if (oppFinalTeam) setOpponentTeam(oppFinalTeam);
        setIsFinished(true);
        return currentMyTeamId;
      });
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
    }) => {
      if (!data.gameStarted) return;
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

    socket.on('team-assignment', onTeamAssignment);
    socket.on('teams-update', onTeamsUpdate);
    socket.on('team-score-update', onTeamScoreUpdate);
    socket.on('team-answer-locked', onTeamAnswerLocked);
    socket.on('team-finished', onTeamFinished);
    socket.on('2v2-battle-complete', onBattleComplete);
    socket.on('room-state', onRoomState);

    return () => {
      socket.off('team-assignment', onTeamAssignment);
      socket.off('teams-update', onTeamsUpdate);
      socket.off('team-score-update', onTeamScoreUpdate);
      socket.off('team-answer-locked', onTeamAnswerLocked);
      socket.off('team-finished', onTeamFinished);
      socket.off('2v2-battle-complete', onBattleComplete);
      socket.off('room-state', onRoomState);
    };
  }, [
    socket,
    setIsFinished,
    setSelfTeamFinished,
    onAnswerLockedCallback,
    onReconnectState,
    username,
  ]);

  return { socket, connected, myTeamId, myTeam, opponentTeam };
}
