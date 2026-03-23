import { useEffect, useRef, useState } from 'react';
import { useSocketConnection } from '../useSocketConnection';

type LeaderboardEntry = {
  playerId: string;
  username: string;
  avatar?: string;
  score: number;
  currentQuestionIndex: number;
};

type PlayerState = {
  id: string;
  username: string;
  score: number;
  currentQuestionIndex: number;
  questionStartTime: number;
};

type RoomStateData = {
  roomType: string;
  gameStarted: boolean;
  gameFinished: boolean;
  quizId: string;
  players: PlayerState[];
  serverTime: number;
};

type ArenaSocketProps = {
  roomId: string;
  username: string;
  quizId?: string;
};

export function useArenaSocket({
  roomId,
  username,
  quizId,
  setScore,
  setIsFinished,
  onReconnectState,
}: ArenaSocketProps & {
  setScore: (score: number) => void;
  setIsFinished: (finished: boolean) => void;
  onReconnectState?: (state: {
    currentQuestionIndex: number;
    score: number;
    questionStartTime: number;
    serverTime: number;
  }) => void;
}) {
  const { socket, connected } = useSocketConnection();
  const joinedRef = useRef(false);

  const [opponent, setOpponent] = useState<{ id?: string; username: string; score: number } | null>(
    null,
  );

  useEffect(() => {
    if (connected && !joinedRef.current && roomId && quizId) {
      joinedRef.current = true;
      socket.emit('join-room', { roomId, quizId, username });
      socket.emit('get-leaderboard', { roomId });
    }
  }, [connected, roomId, quizId, username, socket]);

  useEffect(() => {
    const onScoreBroadcast = (data: {
      id: string;
      username: string;
      score: number;
      currentQuestion: number;
      finished: boolean;
    }) => {
      if (!socket.id || data.id === socket.id) {
        setScore(data.score);
      } else {
        setOpponent((_prev) => ({ id: data.id, username: data.username, score: data.score }));
      }
    };

    const onLeaderboard = (entries: LeaderboardEntry[]) => {
      if (!socket.id) return;
      const me = entries.find((e) => e.playerId === socket.id);
      const other = entries.find((e) => e.playerId !== socket.id);
      if (me) setScore(me.score);
      if (other) setOpponent({ id: other.playerId, username: other.username, score: other.score });
    };

    const onOpponentFinished = ({
      username: opp,
      score: s,
    }: {
      username: string;
      score: number;
    }) => {
      setOpponent((prev) => ({ ...(prev || { username: opp }), score: s }));
    };

    const onBattleComplete = ({
      players,
    }: {
      players: { id: string; username: string; score: number }[];
    }) => {
      const me = players.find((p) => p.id === socket.id);
      const other = players.find((p) => p.id !== socket.id);
      if (me) setScore(me.score);
      if (other) setOpponent({ id: other.id, username: other.username, score: other.score });
      setIsFinished(true);
    };

    const onRoomState = (data: RoomStateData) => {
      if (!data.gameStarted) return;
      if (!socket.id) return;
      const me = data.players.find(
        (p: PlayerState) => p.username === username || p.id === socket.id,
      );
      if (me && onReconnectState) {
        onReconnectState({
          currentQuestionIndex: me.currentQuestionIndex || 0,
          score: me.score || 0,
          questionStartTime: me.questionStartTime || Date.now(),
          serverTime: data.serverTime || Date.now(),
        });
      }
    };

    socket.on('score-update-broadcast', onScoreBroadcast);
    socket.on('leaderboard-update', onLeaderboard);
    socket.on('opponent-finished', onOpponentFinished);
    socket.on('battle-complete', onBattleComplete);
    socket.on('room-state', onRoomState);

    return () => {
      socket.off('score-update-broadcast', onScoreBroadcast);
      socket.off('leaderboard-update', onLeaderboard);
      socket.off('opponent-finished', onOpponentFinished);
      socket.off('battle-complete', onBattleComplete);
      socket.off('room-state', onRoomState);
    };
  }, [socket, setIsFinished, setScore, onReconnectState, username]);

  return {
    socket,
    connected,
    opponent,
  };
}
