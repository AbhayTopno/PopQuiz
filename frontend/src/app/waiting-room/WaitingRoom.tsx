'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { getSocket } from '@/utils/socket';
import PlayersList from '@/components/waiting-room/PlayersList';
import ChatBox from '@/components/waiting-room/ChatBox';
import SettingsPanel from '@/components/waiting-room/SettingsPanel';
import TeamManagement from '@/components/waiting-room/TeamManagement';
import StartButton from '@/components/waiting-room/StartButton';
import SettingsDrawer from '@/components/waiting-room/SettingsDrawer';
import CountdownOverlay from '@/components/waiting-room/CountdownOverlay';
import KickConfirmModal from '@/components/waiting-room/KickConfirmModal';
import KickedMessageModal from '@/components/waiting-room/KickedMessageModal';
import type {
  WaitingRoomProps,
  WaitingRoomPlayer,
  ChatMessage,
  QuizSettings,
  TeamAssignments,
  ServerPlayer,
  ServerChatMessage,
} from '@/types';

const WaitingRoom: React.FC<WaitingRoomProps> = ({
  roomId,
  quizId,
  username,
  avatar,
  isHost,
  mode,
  initialSettings,
}) => {
  const router = useRouter();
  const socket = useMemo(() => getSocket(), []);
  const mountedRef = useRef(false);

  const [settings, setSettings] = useState<QuizSettings>({
    topic: initialSettings.topic,
    difficulty: initialSettings.difficulty,
    questionCount: initialSettings.count,
    duration: initialSettings.duration,
  });
  const [players, setPlayers] = useState<WaitingRoomPlayer[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignments>({ teamA: [], teamB: [] });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [dragOverTeam, setDragOverTeam] = useState<'teamA' | 'teamB' | null>(null);
  const [kickConfirm, setKickConfirm] = useState<{ playerId: string; playerName: string } | null>(
    null,
  );
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);

  // Connect and join/create room (runs once)
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const onConnect = () => {
      setConnected(true);
      const payload = {
        roomId,
        quizId,
        username: username && username.trim(),
        avatar: avatar ?? '',
        mode: mode || '1v1',
      };

      // Backend uses 'join-room' for both creating and joining
      socket.emit('join-room', payload);
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onConnectError = (error: Error) => {
      console.error('âŒ Socket connection error:', error);
      setConnected(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    if (socket.connected) {
      onConnect();
    } else {
      socket.connect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.emit('leave-room', { roomId });
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, roomId, isHost, mode]);

  // Effect for handling incoming socket events
  useEffect(() => {
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
    const handleSettingsCurrent = (s: {
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
    const handleChat = (payload: ChatMessage) => setMessages((m) => [...m, payload]);
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

    // Handle team assignments update
    const handleTeamAssignments = (data: { teamA: string[]; teamB: string[] }) => {
      setTeamAssignments(data);
      // Update players with their team assignments
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

    const handleQuizStart = (payload: { quizId: string; duration: number }) => {
      if (mode === '1v1') {
        router.push(
          `/1v1arena?roomId=${roomId}&quizId=${payload.quizId}&duration=${payload.duration}&username=${username}`,
        );
      } else if (mode === '2v2') {
        router.push(
          `/2v2arena?roomId=${roomId}&quizId=${payload.quizId}&duration=${payload.duration}&username=${username}`,
        );
      } else if (mode === 'coop') {
        router.push(
          `/cooparena?roomId=${roomId}&quizId=${payload.quizId}&duration=${payload.duration}&username=${username}`,
        );
      } else if (mode === 'custom') {
        router.push(
          `/customarena?roomId=${roomId}&quizId=${payload.quizId}&duration=${payload.duration}&username=${username}`,
        );
      } else if (mode === 'ffa') {
        router.push(
          `/ffaarena?roomId=${roomId}&quizId=${payload.quizId}&duration=${payload.duration}&username=${username}`,
        );
      } else {
        router.push(`/quiz/${payload.quizId}?duration=${payload.duration}`);
      }
    };
    const handleRoomFull = (data?: { message?: string; maxCapacity?: number }) => {
      if (!isHost) {
        alert(data?.message || 'Room is full');
        router.push('/');
      }
    };
    const handleCountdown = (sec: number) => setCountdown(sec);

    // Handle being kicked from room
    const handlePlayerKicked = (data: { message: string }) => {
      setKickedMessage(data.message);
      // Redirect to home after 5 seconds
      setTimeout(() => {
        router.push('/');
      }, 5000);
    };

    // Map old events to new ones
    socket.on('room:users', handleUsers);
    socket.on(
      'room-state',
      (data: {
        players?: ServerPlayer[];
        messages?: ServerChatMessage[];
        teamAssignments?: { teamA: string[]; teamB: string[] };
      }) => {
        if (data.players) {
          setPlayers(
            data.players.map((p) => ({ id: p.id, name: p.username ?? p.name ?? 'Player' })),
          );
        }
        if (data.messages) handleChatHistory(data.messages);
        if (data.teamAssignments) handleTeamAssignments(data.teamAssignments);
      },
    );
    socket.on(
      'player-joined',
      (data: { player: { id: string; username?: string; avatar?: string } }) => {
        setPlayers((prev) => {
          const exists = prev.find((p) => p.id === data.player.id);
          if (exists) return prev;
          return [...prev, { id: data.player.id, name: data.player.username ?? 'Player' }];
        });
      },
    );
    socket.on('player-left', (data: { playerId: string }) => {
      setPlayers((prev) => prev.filter((p) => p.id !== data.playerId));
      // Remove from team assignments
      setTeamAssignments((prev) => ({
        teamA: prev.teamA.filter((id) => id !== data.playerId),
        teamB: prev.teamB.filter((id) => id !== data.playerId),
      }));
    });
    socket.on('settings:update', handleSettingsUpdate);
    socket.on('settings:current', handleSettingsCurrent);
    socket.on('team-assignments', handleTeamAssignments);
    socket.on(
      'chat-message',
      (msg: {
        id: string;
        username?: string;
        message?: string;
        timestamp?: number;
        avatar?: string;
      }) => {
        handleChat({
          id: msg.id,
          name: msg.username ?? 'Player',
          text: msg.message ?? '',
          ts: msg.timestamp ?? Date.now(),
          system: (msg.username ?? '') === 'System',
        });
      },
    );
    socket.on('quiz:start', handleQuizStart);
    socket.on('game-start', handleQuizStart);
    socket.on('room:full', handleRoomFull);
    socket.on('versus:countdown', handleCountdown);
    socket.on('coop:countdown', handleCountdown);
    socket.on('ffa:countdown', handleCountdown);
    socket.on('player-kicked', handlePlayerKicked);

    return () => {
      socket.off('room:users', handleUsers);
      socket.off('room-state');
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('settings:update', handleSettingsUpdate);
      socket.off('settings:current', handleSettingsCurrent);
      socket.off('team-assignments', handleTeamAssignments);
      socket.off('chat-message');
      socket.off('quiz:start', handleQuizStart);
      socket.off('game-start', handleQuizStart);
      socket.off('room:full', handleRoomFull);
      socket.off('versus:countdown', handleCountdown);
      socket.off('coop:countdown', handleCountdown);
      socket.off('ffa:countdown', handleCountdown);
      socket.off('player-kicked', handlePlayerKicked);
    };
  }, [socket, router, isHost, mode, roomId, username]);

  // Animate elements on mount
  useEffect(() => {
    gsap.from('.waiting-room-container', {
      opacity: 0,
      y: 20,
      duration: 0.5,
      ease: 'power2.out',
    });
  }, []);

  const closeSettings = () => {
    setIsSettingsOpen(false);
  };

  const updateSettings = (partial: Partial<QuizSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      if (isHost) {
        // Map questionCount to count for backend
        const backendSettings = {
          topic: next.topic,
          difficulty: next.difficulty,
          count: next.questionCount,
          duration: next.duration,
        };
        socket.emit('settings:update', { roomId, settings: backendSettings });
      }
      return next;
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = messageInput.trim();
    if (!text || !connected) return;

    socket.emit('send-message', { roomId, message: text });
    setMessageInput('');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        window.location.href.replace(/([?&])host=1(&|$)/, '$1').replace(/[?&]$/, ''),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error('Copy failed', e);
    }
  };

  const handleLetsGo = async () => {
    if (!settings.topic.trim()) {
      alert('Please enter a quiz topic');
      return;
    }
    setIsGenerating(true);
    try {
      // If quizId already exists (user joined an existing room), use it directly
      if (quizId && quizId !== 'new') {
        if (mode === '1v1') {
          socket.emit('versus:init', { roomId, quizId, duration: settings.duration });
        } else if (mode === '2v2') {
          socket.emit('2v2:init', { roomId, quizId, duration: settings.duration });
        } else if (mode === 'coop') {
          socket.emit('coop:init', { roomId, quizId, duration: settings.duration });
        } else if (mode === 'custom') {
          socket.emit('custom:init', { roomId, quizId, duration: settings.duration });
        } else if (mode === 'ffa') {
          socket.emit('ffa:init', { roomId, quizId, duration: settings.duration });
        } else {
          socket.emit('quiz:start', { roomId, quizId, duration: settings.duration });
        }
        return;
      }

      // Generate new quiz
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/quiz/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: settings.topic.trim(),
          difficulty: settings.difficulty,
          count: settings.questionCount,
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        const errorMsg = e.message || `Failed to generate quiz (${res.status})`;
        console.error('Quiz generation failed:', errorMsg);
        alert(errorMsg);
        throw new Error(errorMsg);
      }

      const data = await res.json();

      if (!data.quizId) {
        const errorMsg = 'No quiz ID returned from server';
        console.error(errorMsg);
        alert(errorMsg);
        throw new Error(errorMsg);
      }

      if (mode === '1v1') {
        socket.emit('versus:init', { roomId, quizId: data.quizId, duration: settings.duration });
      } else if (mode === '2v2') {
        socket.emit('2v2:init', { roomId, quizId: data.quizId, duration: settings.duration });
      } else if (mode === 'coop') {
        socket.emit('coop:init', { roomId, quizId: data.quizId, duration: settings.duration });
      } else if (mode === 'custom') {
        socket.emit('custom:init', { roomId, quizId: data.quizId, duration: settings.duration });
      } else if (mode === 'ffa') {
        socket.emit('ffa:init', { roomId, quizId: data.quizId, duration: settings.duration });
      } else {
        socket.emit('quiz:start', { roomId, quizId: data.quizId, duration: settings.duration });
      }
    } catch (e) {
      console.error('Error in handleLetsGo:', e);
      if (e instanceof Error) {
        alert(`Error: ${e.message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLeaveRoom = () => {
    socket.emit('leave-room', { roomId });
    socket.disconnect();
    router.push('/');
  };

  const handleKickPlayer = (playerId: string, playerName: string) => {
    if (!isHost) return;
    setKickConfirm({ playerId, playerName });
  };

  const confirmKick = () => {
    if (!kickConfirm || !isHost) return;
    socket.emit('kick-player', { roomId, playerId: kickConfirm.playerId });
    setKickConfirm(null);
  };

  const cancelKick = () => {
    setKickConfirm(null);
  };

  const assignPlayerToTeam = (playerId: string, teamId: 'teamA' | 'teamB') => {
    if (!isHost) return;

    setTeamAssignments((prev) => {
      // Remove player from both teams first
      const newTeamA = prev.teamA.filter((id) => id !== playerId);
      const newTeamB = prev.teamB.filter((id) => id !== playerId);

      // Add to selected team
      if (teamId === 'teamA') {
        newTeamA.push(playerId);
      } else {
        newTeamB.push(playerId);
      }

      const newAssignments = { teamA: newTeamA, teamB: newTeamB };

      // Emit to server
      socket.emit('update-team-assignments', { roomId, teamAssignments: newAssignments });

      return newAssignments;
    });
  };

  // Auto-assign players by default (alternating) for 2v2 and custom modes
  useEffect(() => {
    if ((mode !== '2v2' && mode !== 'custom') || !isHost) return;

    const unassignedPlayers = players.filter(
      (p) => !teamAssignments.teamA.includes(p.id) && !teamAssignments.teamB.includes(p.id),
    );

    if (unassignedPlayers.length > 0) {
      setTeamAssignments((prev) => {
        const newTeamA = [...prev.teamA];
        const newTeamB = [...prev.teamB];

        unassignedPlayers.forEach((player) => {
          // Assign to whichever team has fewer players; if equal, assign to Team A
          if (newTeamA.length < newTeamB.length) {
            newTeamA.push(player.id);
          } else if (newTeamB.length < newTeamA.length) {
            newTeamB.push(player.id);
          } else {
            // Equal counts: assign to Team A
            newTeamA.push(player.id);
          }
        });

        const newAssignments = { teamA: newTeamA, teamB: newTeamB };

        // Emit to server
        socket.emit('update-team-assignments', { roomId, teamAssignments: newAssignments });

        return newAssignments;
      });
    }
  }, [players, mode, isHost, roomId, socket, teamAssignments.teamA, teamAssignments.teamB]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, playerId: string) => {
    if (!isHost) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', playerId);
    setDraggedPlayerId(playerId);
  };

  const handleDragEnd = () => {
    setDraggedPlayerId(null);
    setDragOverTeam(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isHost) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (teamId: 'teamA' | 'teamB') => {
    if (!isHost) return;
    setDragOverTeam(teamId);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isHost) return;
    // Only clear if we're leaving the container itself, not a child
    if (e.currentTarget === e.target) {
      setDragOverTeam(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetTeam: 'teamA' | 'teamB') => {
    if (!isHost) return;
    e.preventDefault();
    const playerId = e.dataTransfer.getData('text/plain');
    if (playerId) {
      assignPlayerToTeam(playerId, targetTeam);
    }
    setDraggedPlayerId(null);
    setDragOverTeam(null);
  };

  return (
    <div className="waiting-room-container flex h-screen flex-col bg-gradient-to-br from-slate-900 to-black text-white p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-zentry text-2xl md:text-3xl font-black uppercase">
          {mode === '1v1'
            ? '1v1 Waiting Room'
            : mode === '2v2'
              ? '2v2 Waiting Room'
              : mode === 'custom'
                ? 'Custom Battle Waiting Room'
                : mode === 'ffa'
                  ? 'FFA Waiting Room'
                  : 'Co-op Waiting Room'}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="md:hidden rounded-lg bg-white/10 px-4 py-2 font-general text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            Settings
          </button>
          <button
            onClick={handleLeaveRoom}
            className="rounded-lg bg-red-500/20 px-4 py-2 font-general text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/30"
          >
            Leave Room
          </button>
        </div>
      </div>

      {/* Main Content - 50% Chat / 50% Settings */}
      <div className="flex flex-1 flex-col md:flex-row gap-4 md:gap-6 overflow-hidden">
        {/* Chat Section - 50% on desktop */}
        <div className="order-2 md:order-1 w-full md:w-1/2 flex flex-col min-h-0">
          <div className="rounded-2xl border border-white/20 bg-white/5 p-4 backdrop-blur flex flex-col h-full min-h-0">
            <PlayersList players={players} mode={mode} />
            <ChatBox
              messages={messages}
              messageInput={messageInput}
              setMessageInput={setMessageInput}
              onSendMessage={handleSendMessage}
              connected={connected}
            />
          </div>
        </div>

        {/* Settings Section - 50% on desktop (hidden on small screens) */}
        <div className="order-1 md:order-2 w-full md:w-1/2 flex-col min-h-0 hidden md:flex">
          <div className="rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur flex flex-col h-full min-h-0">
            <h2 className="mb-4 text-lg font-semibold">Settings</h2>
            <div className="space-y-4 flex-1 overflow-y-auto pr-2">
              <SettingsPanel
                roomId={roomId}
                settings={settings}
                updateSettings={updateSettings}
                isHost={isHost}
                copied={copied}
                onCopyLink={copyLink}
              />

              <TeamManagement
                mode={mode}
                players={players}
                teamAssignments={teamAssignments}
                isHost={isHost}
                socket={socket}
                draggedPlayerId={draggedPlayerId}
                dragOverTeam={dragOverTeam}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onKickPlayer={handleKickPlayer}
                onAssignPlayer={assignPlayerToTeam}
              />
            </div>

            {/* Let's Go button at the bottom */}
            {isHost && (
              <StartButton
                mode={mode}
                players={players}
                teamAssignments={teamAssignments}
                isGenerating={isGenerating}
                countdown={countdown}
                topicValid={settings.topic.trim().length > 0}
                onStart={handleLetsGo}
              />
            )}
          </div>
        </div>
      </div>

      {/* Settings Drawer (mobile) */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        roomId={roomId}
        mode={mode}
        settings={settings}
        updateSettings={updateSettings}
        isHost={isHost}
        copied={copied}
        onCopyLink={copyLink}
        players={players}
        teamAssignments={teamAssignments}
        socket={socket}
        draggedPlayerId={draggedPlayerId}
        dragOverTeam={dragOverTeam}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKickPlayer={handleKickPlayer}
        onAssignPlayer={assignPlayerToTeam}
      />

      {/* Game Starting Overlay */}
      <CountdownOverlay countdown={countdown} />

      {/* Kick Confirmation Popup */}
      <KickConfirmModal
        isOpen={kickConfirm !== null}
        playerName={kickConfirm?.playerName || ''}
        onConfirm={confirmKick}
        onCancel={cancelKick}
      />

      {/* Kicked Player Message */}
      <KickedMessageModal isOpen={kickedMessage !== null} />
    </div>
  );
};

export default WaitingRoom;
