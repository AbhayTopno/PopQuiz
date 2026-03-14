import { useEffect, useRef, useState } from 'react';
import { useSocketConnection } from '../useSocketConnection';

export type FFAPlayer = {
  id: string;
  username: string;
  avatar?: string;
  score: number;
  finished: boolean;
};

type FFASocketProps = {
  roomId: string;
  username: string;
  quizId: string;
  setScore: (score: number) => void;
  setIsFinished: (finished: boolean) => void;
  setSelfFinished: (finished: boolean) => void;
};

export function useFFASocket({
  roomId,
  username,
  quizId,
  setScore,
  setIsFinished,
  setSelfFinished,
}: FFASocketProps) {
  const { socket, connected } = useSocketConnection();
  const joinedRef = useRef(false);

  const [players, setPlayers] = useState<FFAPlayer[]>([]);

  useEffect(() => {
    if (connected && !joinedRef.current && roomId && quizId) {
      joinedRef.current = true;
      socket.emit('join-ffa-room', { roomId, quizId, username });
    }
  }, [connected, roomId, quizId, username, socket]);

  useEffect(() => {
    if (!socket) return;

    const onFFAPlayersUpdate = (data: { players: FFAPlayer[] }) => {
      setPlayers(data.players);
      const me = data.players.find((p) => p.id === socket.id);
      if (me) {
        setScore(me.score);
        if (me.finished) setSelfFinished(true);
      }

      const allFinished = data.players.length > 0 && data.players.every((p) => p.finished);
      if (allFinished && data.players.length >= 2) {
        setIsFinished(true);
      }
    };

    const onFFAScoreUpdate = (data: {
      playerId: string;
      username: string;
      score: number;
      currentQuestion: number;
      finished: boolean;
    }) => {
      if (data.playerId === socket.id) setScore(data.score);
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === data.playerId ? { ...p, score: data.score, finished: data.finished } : p,
        ),
      );
    };

    const onFFAPlayerFinished = (data: { playerId: string; username: string; score: number }) => {
      setPlayers((prev) =>
        prev.map((p) => (p.id === data.playerId ? { ...p, score: data.score, finished: true } : p)),
      );
    };

    const onFFABattleComplete = (data: { players: FFAPlayer[] }) => {
      setPlayers(data.players);
      const me = data.players.find((p) => p.id === socket.id);
      if (me) setScore(me.score);
      setIsFinished(true);
    };

    socket.on('ffa-players-update', onFFAPlayersUpdate);
    socket.on('ffa-score-update', onFFAScoreUpdate);
    socket.on('ffa-player-finished', onFFAPlayerFinished);
    socket.on('ffa-battle-complete', onFFABattleComplete);

    return () => {
      socket.off('ffa-players-update', onFFAPlayersUpdate);
      socket.off('ffa-score-update', onFFAScoreUpdate);
      socket.off('ffa-player-finished', onFFAPlayerFinished);
      socket.off('ffa-battle-complete', onFFABattleComplete);
    };
  }, [socket, setScore, setIsFinished, setSelfFinished]);

  return { socket, connected, players };
}
