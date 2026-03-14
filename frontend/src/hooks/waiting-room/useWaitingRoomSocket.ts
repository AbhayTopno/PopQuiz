import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSocketConnection } from '../useSocketConnection';
import { handleQuizStartRouting } from '@/utils/gameModes';
import type {
  WaitingRoomPlayer,
  ChatMessage,
  QuizSettings,
  TeamAssignments,
  ServerPlayer,
  ServerChatMessage,
} from '@/types';

type UseWaitingRoomSocketProps = {
  roomId: string;
  quizId?: string;
  username: string;
  avatar?: string;
  isHost: boolean;
  mode: string;
  initialSettings: {
    topic: string;
    difficulty: string;
    count: number;
    duration: number;
  };
};

export function useWaitingRoomSocket({
  roomId,
  quizId,
  username,
  avatar,
  isHost,
  mode,
  initialSettings,
}: UseWaitingRoomSocketProps) {
  const router = useRouter();
  const { socket, connected } = useSocketConnection();
  const mountedRef = useRef(false);

  const [settings, setSettings] = useState<QuizSettings>({
    topic: initialSettings.topic,
    difficulty: initialSettings.difficulty,
    questionCount: initialSettings.count || 5,
    duration: initialSettings.duration,
  });

  const [players, setPlayers] = useState<WaitingRoomPlayer[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignments>({ teamA: [], teamB: [] });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (mountedRef.current || !connected) return;
    mountedRef.current = true;

    const payload = {
      roomId,
      quizId,
      username: username && username.trim(),
      avatar: avatar ?? '',
      mode: mode || '1v1',
    };

    socket.emit('join-room', payload);

    return () => {
      socket.emit('leave-room', { roomId });
    };
  }, [socket, connected, roomId, quizId, username, avatar, mode]);

  useEffect(() => {
    if (!socket) return;

    const handleUsers = (list: WaitingRoomPlayer[]) => setPlayers(list);

    const handleSettingsUpdate = (s: {
      topic: string;
      difficulty: string;
      count?: number;
      questionCount?: number;
      duration: number;
    }) =>
      setSettings({
        topic: s.topic,
        difficulty: s.difficulty,
        questionCount: s.count || s.questionCount || 5,
        duration: s.duration,
      });

    const handleChatHistory = (history: ServerChatMessage[]) =>
      setMessages((m) =>
        m.length
          ? m
          : history.map(
              (msg) =>
                ({
                  id: msg.id,
                  name: msg.username ?? msg.name ?? 'Player',
                  text: msg.message ?? msg.text ?? '',
                  ts: msg.timestamp ?? msg.ts ?? Date.now(),
                  system: (msg.username ?? msg.name) === 'System',
                }) as ChatMessage,
            ),
      );

    const handleTeamAssignments = (data: { teamA: string[]; teamB: string[] }) => {
      setTeamAssignments(data);
      setPlayers((prevPlayers) =>
        prevPlayers.map((p) => ({
          ...p,
          teamId: data.teamA.includes(p.id)
            ? 'teamA'
            : data.teamB.includes(p.id)
              ? 'teamB'
              : undefined,
        })),
      );
    };

    socket.on('room:users', handleUsers);

    socket.on(
      'room-state',
      (data: {
        players?: ServerPlayer[];
        messages?: ServerChatMessage[];
        teamAssignments?: TeamAssignments;
      }) => {
        if (data.players) {
          setPlayers(
            data.players.map((p: ServerPlayer) => ({
              id: p.id,
              name: p.username ?? p.name ?? 'Player',
            })),
          );
        }
        if (data.messages) handleChatHistory(data.messages);
        if (data.teamAssignments) handleTeamAssignments(data.teamAssignments);
      },
    );

    socket.on('player-joined', (data: { player: ServerPlayer }) => {
      setPlayers((prev) => {
        if (prev.find((p) => p.id === data.player.id)) return prev;
        return [...prev, { id: data.player.id, name: data.player.username ?? 'Player' }];
      });
    });

    socket.on('player-left', (data: { playerId: string }) => {
      setPlayers((prev) => prev.filter((p) => p.id !== data.playerId));
      setTeamAssignments((prev) => ({
        teamA: prev.teamA.filter((id) => id !== data.playerId),
        teamB: prev.teamB.filter((id) => id !== data.playerId),
      }));
    });

    socket.on('settings:update', handleSettingsUpdate);
    socket.on('settings:current', handleSettingsUpdate);
    socket.on('team-assignments', handleTeamAssignments);

    socket.on('chat-message', (msg: ServerChatMessage) => {
      setMessages((m) => [
        ...m,
        {
          id: msg.id,
          name: msg.username ?? 'Player',
          text: msg.message ?? '',
          ts: msg.timestamp ?? Date.now(),
          system: (msg.username ?? '') === 'System',
        },
      ]);
    });

    const handleQuizStart = (payload: { quizId: string; duration: number }) => {
      handleQuizStartRouting(mode, roomId, payload.quizId, payload.duration, username, router);
    };

    socket.on('quiz:start', handleQuizStart);
    socket.on('game-start', handleQuizStart);

    socket.on('room:full', (data?: { message?: string }) => {
      if (!isHost) {
        alert(data?.message || 'Room is full');
        router.push('/');
      }
    });

    const handleCountdown = (sec: number) => setCountdown(sec);
    socket.on('versus:countdown', handleCountdown);
    socket.on('coop:countdown', handleCountdown);
    socket.on('ffa:countdown', handleCountdown);

    socket.on('player-kicked', (data: { message: string }) => {
      setKickedMessage(data.message);
      setTimeout(() => router.push('/'), 5000);
    });

    return () => {
      socket.off('room:users', handleUsers);
      socket.off('room-state');
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('settings:update', handleSettingsUpdate);
      socket.off('settings:current', handleSettingsUpdate);
      socket.off('team-assignments', handleTeamAssignments);
      socket.off('chat-message');
      socket.off('quiz:start');
      socket.off('game-start');
      socket.off('room:full');
      socket.off('versus:countdown');
      socket.off('coop:countdown');
      socket.off('ffa:countdown');
      socket.off('player-kicked');
    };
  }, [socket, router, isHost, mode, roomId, username]);

  const updateSettings = useCallback(
    (partial: Partial<QuizSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        if (isHost) {
          socket.emit('settings:update', {
            roomId,
            settings: {
              topic: next.topic,
              difficulty: next.difficulty,
              count: next.questionCount,
              duration: next.duration,
            },
          });
        }
        return next;
      });
    },
    [isHost, roomId, socket],
  );

  const sendMessage = useCallback(
    (message: string) => {
      if (message && connected) {
        socket.emit('send-message', { roomId, message });
      }
    },
    [connected, roomId, socket],
  );

  const assignPlayerToTeam = useCallback(
    (playerId: string, teamId: 'teamA' | 'teamB') => {
      if (!isHost) return;
      setTeamAssignments((prev) => {
        const newTeamA = prev.teamA.filter((id) => id !== playerId);
        const newTeamB = prev.teamB.filter((id) => id !== playerId);
        if (teamId === 'teamA') newTeamA.push(playerId);
        else newTeamB.push(playerId);

        const newAssignments = { teamA: newTeamA, teamB: newTeamB };
        socket.emit('update-team-assignments', { roomId, teamAssignments: newAssignments });
        return newAssignments;
      });
    },
    [isHost, roomId, socket],
  );

  return {
    socket,
    connected,
    settings,
    updateSettings,
    players,
    teamAssignments,
    setTeamAssignments,
    messages,
    sendMessage,
    countdown,
    kickedMessage,
    assignPlayerToTeam,
  };
}
