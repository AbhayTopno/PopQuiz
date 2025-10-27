'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { getSocket } from '@/utils/socket';

interface WaitingRoomProps {
  roomId: string;
  quizId: string;
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
}

interface Player {
  id: string;
  name: string;
  teamId?: string; // 'teamA' or 'teamB'
}

interface ChatMessage {
  id: string;
  name: string;
  text: string;
  ts: number;
  system?: boolean;
}

interface Settings {
  topic: string;
  difficulty: string;
  count: number;
  duration: number;
}

interface TeamAssignments {
  teamA: string[]; // Array of player IDs
  teamB: string[]; // Array of player IDs
}

const difficulties = ['easy', 'medium', 'hard'];

// Types for server-emitted payloads to avoid `any`
interface ServerPlayer {
  id: string;
  username?: string;
  name?: string;
  avatar?: string;
}

interface ServerChatMessage {
  id: string;
  username?: string;
  name?: string;
  message?: string;
  text?: string;
  timestamp?: number;
  ts?: number;
}

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

  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [players, setPlayers] = useState<Player[]>([]);
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

  // Refs for slide-in settings drawer (mobile)
  const settingsOverlayRef = useRef<HTMLDivElement | null>(null);
  const settingsPanelRef = useRef<HTMLDivElement | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

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
      console.error('❌ Socket connection error:', error);
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
    const handleUsers = (list: Player[]) => setPlayers(list);
    const handleSettingsUpdate = (s: Settings) => setSettings(s);
    const handleSettingsCurrent = (s: Settings) => setSettings(s);
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
      socket.off('player-kicked', handlePlayerKicked);
    };
  }, [socket, router, isHost, mode, roomId, username]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Animate elements on mount
  useEffect(() => {
    gsap.from('.waiting-room-container', {
      opacity: 0,
      y: 20,
      duration: 0.5,
      ease: 'power2.out',
    });
  }, []);

  // Animate settings drawer open/close (mobile)
  useEffect(() => {
    if (!isSettingsOpen) return;
    // open
    gsap.fromTo(
      settingsOverlayRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.3, ease: 'power2.out' },
    );
    gsap.fromTo(
      settingsPanelRef.current,
      { x: 320, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.35, ease: 'power2.out' },
    );
  }, [isSettingsOpen]);

  const closeSettings = () => {
    if (settingsOverlayRef.current && settingsPanelRef.current) {
      gsap.to(settingsPanelRef.current, {
        x: 320,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
      });
      gsap.to(settingsOverlayRef.current, {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => setIsSettingsOpen(false),
      });
    } else {
      setIsSettingsOpen(false);
    }
  };

  const updateSettings = (partial: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      if (isHost) {
        socket.emit('settings:update', { roomId, settings: next });
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
    if (!settings.topic.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/quiz/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: settings.topic.trim(),
          difficulty: settings.difficulty,
          count: settings.count,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || 'Failed to generate quiz');
      }
      const data = await res.json();
      if (!data.quizId) throw new Error('No quiz ID');

      if (mode === '1v1') {
        socket.emit('versus:init', { roomId, quizId: data.quizId, duration: settings.duration });
      } else if (mode === '2v2') {
        socket.emit('2v2:init', { roomId, quizId: data.quizId, duration: settings.duration });
      } else if (mode === 'coop') {
        socket.emit('coop:init', { roomId, quizId: data.quizId, duration: settings.duration });
      } else {
        socket.emit('quiz:start', { roomId, quizId: data.quizId, duration: settings.duration });
      }
    } catch (e) {
      console.error(e);
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

  // Auto-assign players by default (alternating)
  useEffect(() => {
    if (mode !== '2v2' || !isHost) return;

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

  const initial = (n: string) => (n && n.trim() ? n.trim()[0].toUpperCase() : 'U');

  return (
    <div className="waiting-room-container flex h-screen flex-col bg-gradient-to-br from-slate-900 to-black text-white p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-zentry text-2xl md:text-3xl font-black uppercase">
          {mode === '1v1'
            ? '1v1 Waiting Room'
            : mode === '2v2'
              ? '2v2 Waiting Room'
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
            <div className="mb-3 text-sm font-semibold uppercase text-white/80">
              Players{' '}
              {mode === '1v1'
                ? '(2 max)'
                : mode === '2v2'
                  ? '(4 max)'
                  : mode === 'coop'
                    ? '(2-10 players)'
                    : ''}
            </div>
            <div className="mb-4 flex flex-wrap gap-2 overflow-auto max-h-24">
              {players.map((p, i) => (
                <span
                  key={p.id}
                  className={`rounded px-2 py-1 text-xs flex items-center gap-1 ${
                    i === 0
                      ? 'border-2 border-purple-500/50 bg-purple-500/10 text-purple-300'
                      : 'bg-white/10'
                  }`}
                >
                  {p.name}
                </span>
              ))}
              {players.length === 0 && (
                <span className="text-xs text-white/60">Waiting for players…</span>
              )}
              {mode === '1v1' && players.length === 2 && (
                <span className="text-xs text-green-400">All players are here.</span>
              )}
              {mode === '2v2' && players.length === 4 && (
                <span className="text-xs text-green-400">All players are here.</span>
              )}
            </div>

            <div className="mb-2 text-sm font-semibold uppercase text-white/80">Chat</div>
            <div className="flex-1 overflow-hidden mb-2">
              <div
                ref={chatContainerRef}
                className="h-full overflow-auto rounded-lg border border-white/10 bg-black/30 p-2 text-xs"
              >
                {messages.length === 0 && <div className="text-white/60">No messages yet.</div>}
                {messages.map((msg, idx) => {
                  const showHeader =
                    msg.system ||
                    idx === 0 ||
                    messages[idx - 1].system ||
                    messages[idx - 1].name !== msg.name;
                  return (
                    <div key={`${msg.id}-${msg.ts}`} className={showHeader ? 'mb-2' : 'mb-1 pl-7'}>
                      {msg.system ? (
                        <div className="text-center text-white/50 italic py-1">{msg.text}</div>
                      ) : (
                        <>
                          {showHeader && (
                            <div className="flex items-center gap-2 mb-1 p-2">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white/90 text-[10px]">
                                {initial(msg.name)}
                              </div>
                              <span className="text-white/70 text-[11px]">{msg.name}</span>
                            </div>
                          )}
                          <div className={!showHeader ? 'text-white/90' : 'pl-7 text-white/90'}>
                            {msg.text}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                <div ref={messageEndRef} />
              </div>
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-white/20 bg-black/10 shadow-2xl px-3 py-2 font-mono text-sm truncate"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message…"
                disabled={!connected}
              />
              <button
                disabled={!connected}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                Send
              </button>
            </form>
            {!connected && (
              <div className="mt-2 text-xs text-red-400">Disconnected from server…</div>
            )}
          </div>
        </div>

        {/* Settings Section - 50% on desktop (hidden on small screens) */}
        <div className="order-1 md:order-2 w-full md:w-1/2 flex-col min-h-0 hidden md:flex">
          <div className="rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur flex flex-col h-full min-h-0">
            <h2 className="mb-4 text-lg font-semibold">Settings</h2>
            <div className="space-y-4 flex-1 overflow-y-auto pr-2">
              <div>
                <label className="mb-1 block text-sm text-white/80">Room ID</label>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-lg border border-white/20 bg-black/10 shadow-2xl px-3 py-2 font-mono text-sm truncate">
                    {roomId}
                  </div>
                  <button
                    onClick={copyLink}
                    className={`rounded-lg px-3 py-2 text-xs transition-colors whitespace-nowrap ${
                      copied
                        ? 'bg-green-500 text-white'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Team Management for 2v2 */}
              {mode === '2v2' && (
                <div>
                  <label className="mb-2 block text-sm text-white/80 font-semibold">
                    Team Assignments {isHost && '(Drag & Drop or Click)'}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Team A */}
                    <div
                      className={`rounded-lg border p-3 transition-all ${
                        dragOverTeam === 'teamA'
                          ? 'border-cyan-400 bg-cyan-500/20 scale-105'
                          : 'border-cyan-400/30 bg-cyan-500/5'
                      }`}
                      onDragOver={handleDragOver}
                      onDragEnter={() => handleDragEnter('teamA')}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, 'teamA')}
                    >
                      {React.createElement(
                        'div',
                        { className: 'text-xs font-semibold text-cyan-300 mb-2' },
                        'TEAM A',
                      )}
                      <div className="space-y-2 min-h-[60px]">
                        {teamAssignments.teamA.map((playerId) => {
                          const player = players.find((p) => p.id === playerId);
                          if (!player) return null;
                          const isCurrentUser = playerId === socket.id;
                          return (
                            <div
                              key={playerId}
                              draggable={isHost}
                              onDragStart={(e) => handleDragStart(e, playerId)}
                              onDragEnd={handleDragEnd}
                              className={`flex items-center justify-between bg-cyan-500/10 rounded px-2 py-1.5 text-xs transition-opacity ${
                                isHost ? 'cursor-move' : ''
                              } ${draggedPlayerId === playerId ? 'opacity-50' : ''}`}
                            >
                              <span className="text-white truncate">{player.name}</span>
                              {isHost && !isCurrentUser && (
                                <button
                                  onClick={() => handleKickPlayer(playerId, player.name)}
                                  className="text-red-600 hover:text-red-500 ml-2 text-sm font-bold"
                                  title="Kick player from room"
                                >
                                  ⨯
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {teamAssignments.teamA.length === 0 && (
                          <div className="text-xs text-white/40 italic">
                            {isHost ? 'Drop players here' : 'No players yet'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Team B */}
                    <div
                      className={`rounded-lg border p-3 transition-all ${
                        dragOverTeam === 'teamB'
                          ? 'border-red-400 bg-red-500/20 scale-105'
                          : 'border-red-400/30 bg-red-500/5'
                      }`}
                      onDragOver={handleDragOver}
                      onDragEnter={() => handleDragEnter('teamB')}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, 'teamB')}
                    >
                      <div className="text-xs font-semibold text-red-300 mb-2">TEAM B</div>
                      <div className="space-y-2 min-h-[60px]">
                        {teamAssignments.teamB.map((playerId) => {
                          const player = players.find((p) => p.id === playerId);
                          if (!player) return null;
                          const isCurrentUser = playerId === socket.id;
                          return (
                            <div
                              key={playerId}
                              draggable={isHost}
                              onDragStart={(e) => handleDragStart(e, playerId)}
                              onDragEnd={handleDragEnd}
                              className={`flex items-center justify-between bg-red-500/10 rounded px-2 py-1.5 text-xs transition-opacity ${
                                isHost ? 'cursor-move' : ''
                              } ${draggedPlayerId === playerId ? 'opacity-50' : ''}`}
                            >
                              <span className="text-white truncate">{player.name}</span>
                              {isHost && !isCurrentUser && (
                                <button
                                  onClick={() => handleKickPlayer(playerId, player.name)}
                                  className="text-red-600 hover:text-red-500 ml-2 text-sm font-bold"
                                  title="Kick player from room"
                                >
                                  ⨯
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {teamAssignments.teamB.length === 0 && (
                          <div className="text-xs text-white/40 italic">
                            {isHost ? 'Drop players here' : 'No players yet'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Unassigned Players */}
                  {isHost && (
                    <div className="mt-3">
                      <div className="text-xs text-white/60 mb-2">
                        Unassigned (Drag or Click to assign):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {players
                          .filter(
                            (p) =>
                              !teamAssignments.teamA.includes(p.id) &&
                              !teamAssignments.teamB.includes(p.id),
                          )
                          .map((player) => {
                            const isCurrentUser = player.id === socket.id;
                            return (
                              <div
                                key={player.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, player.id)}
                                onDragEnd={handleDragEnd}
                                className={`flex gap-1 ${draggedPlayerId === player.id ? 'opacity-50' : ''}`}
                              >
                                <button
                                  onClick={() => assignPlayerToTeam(player.id, 'teamA')}
                                  className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-2 py-1 rounded text-xs border border-cyan-400/30 cursor-move"
                                  title="Assign to Team A or drag to team"
                                >
                                  {player.name} → A
                                </button>
                                <button
                                  onClick={() => assignPlayerToTeam(player.id, 'teamB')}
                                  className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-2 py-1 rounded text-xs border border-red-400/30"
                                  title="Assign to Team B"
                                >
                                  {player.name} → B
                                </button>
                                {!isCurrentUser && (
                                  <button
                                    onClick={() => handleKickPlayer(player.id, player.name)}
                                    className="text-red-600 hover:text-red-500 px-2 text-sm font-bold"
                                    title="Kick player from room"
                                  >
                                    ⨯
                                  </button>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm text-white/80">Quiz Topic</label>
                <input
                  className="w-full rounded-lg border border-white/20 bg-black/10 shadow-2xl px-3 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  value={settings.topic}
                  onChange={(e) => updateSettings({ topic: e.target.value })}
                  disabled={!isHost}
                  placeholder="Enter topic..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/80">Difficulty</label>
                <div className="flex gap-2">
                  {difficulties.map((d) => (
                    <button
                      key={d}
                      disabled={!isHost}
                      onClick={() => updateSettings({ difficulty: d })}
                      className={`px-3 py-2 rounded-lg text-sm capitalize transition-colors ${
                        settings.difficulty === d
                          ? 'bg-blue-500'
                          : 'bg-white/10 shadow-2xl hover:bg-white/20 disabled:opacity-50'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm text-white/80">Questions</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className="w-full rounded-lg border border-white/20 bg-black/10 shadow-2xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    value={settings.count}
                    onChange={(e) =>
                      updateSettings({
                        count: Math.min(50, Math.max(1, Number(e.target.value || 1))),
                      })
                    }
                    disabled={!isHost}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-white/80">Duration (sec)</label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    className="w-full rounded-lg border border-white/20 bg-black/10 shadow-2xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    value={settings.duration}
                    onChange={(e) =>
                      updateSettings({
                        duration: Math.min(300, Math.max(5, Number(e.target.value || 10))),
                      })
                    }
                    disabled={!isHost}
                  />
                </div>
              </div>
            </div>

            {/* Let's Go button at the bottom */}
            {isHost && (
              <div className="mt-4 pt-4 border-t border-white/20">
                <button
                  onClick={handleLetsGo}
                  disabled={
                    isGenerating ||
                    !settings.topic.trim() ||
                    (mode === '1v1' && players.length < 2) ||
                    (mode === '2v2' &&
                      (teamAssignments.teamA.length !== 2 || teamAssignments.teamB.length !== 2)) ||
                    (mode === 'coop' && players.length < 2)
                  }
                  className="w-full rounded-lg bg-blue-500 px-4 py-3 text-sm font-semibold uppercase hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating
                    ? 'Generating...'
                    : countdown !== null
                      ? `Starting in ${countdown}`
                      : "Let's go"}
                </button>
                {mode === '2v2' &&
                  (teamAssignments.teamA.length !== 2 || teamAssignments.teamB.length !== 2) && (
                    <p className="mt-2 text-xs text-yellow-400 text-center">
                      Each team needs exactly 2 players to start
                    </p>
                  )}
                {mode === 'coop' && players.length < 2 && (
                  <p className="mt-2 text-xs text-yellow-400 text-center">
                    Minimum 2 players required to start co-op
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings Drawer (mobile) */}
      {isSettingsOpen && (
        <div
          ref={settingsOverlayRef}
          className="fixed inset-0 z-[100] flex items-stretch justify-end"
          style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSettings();
          }}
        >
          <div
            ref={settingsPanelRef}
            className="relative h-full w-[90%] max-w-md rounded-l-2xl border border-white/20 bg-black/40 p-5 shadow-2xl overflow-y-auto"
            style={{ backdropFilter: 'blur(20px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeSettings}
              className="absolute right-4 top-4 text-2xl text-white/70 transition-colors hover:text-white"
            >
              ×
            </button>

            <h2 className="mb-4 text-lg font-semibold">Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-white/80">Room ID</label>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-lg border border-white/20 bg-white/5 px-3 py-2 font-mono text-sm truncate">
                    {roomId}
                  </div>
                  <button
                    onClick={copyLink}
                    className={`rounded-lg px-3 py-2 text-xs transition-colors whitespace-nowrap ${
                      copied
                        ? 'bg-green-500 text-white'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Team Management for 2v2 in Mobile */}
              {mode === '2v2' && (
                <div>
                  <label className="mb-2 block text-sm text-white/80 font-semibold">
                    Team Assignments {isHost && '(Drag & Drop or Click)'}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Team A */}
                    <div
                      className={`rounded-lg border p-3 transition-all ${
                        dragOverTeam === 'teamA'
                          ? 'border-cyan-400 bg-cyan-500/20 scale-105'
                          : 'border-cyan-400/30 bg-cyan-500/5'
                      }`}
                      onDragOver={handleDragOver}
                      onDragEnter={() => handleDragEnter('teamA')}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, 'teamA')}
                    >
                      <div className="text-xs font-semibold text-cyan-300 mb-2">TEAM A</div>
                      <div className="space-y-2 min-h-[60px]">
                        {teamAssignments.teamA.map((playerId) => {
                          const player = players.find((p) => p.id === playerId);
                          if (!player) return null;
                          const isCurrentUser = playerId === socket.id;
                          return (
                            <div
                              key={playerId}
                              draggable={isHost}
                              onDragStart={(e) => handleDragStart(e, playerId)}
                              onDragEnd={handleDragEnd}
                              className={`flex items-center justify-between bg-cyan-500/10 rounded px-2 py-1.5 text-xs transition-opacity ${
                                isHost ? 'cursor-move' : ''
                              } ${draggedPlayerId === playerId ? 'opacity-50' : ''}`}
                            >
                              <span className="text-white truncate">{player.name}</span>
                              {isHost && !isCurrentUser && (
                                <button
                                  onClick={() => handleKickPlayer(playerId, player.name)}
                                  className="text-red-600 hover:text-red-500 ml-2 text-sm font-bold"
                                  title="Kick player from room"
                                >
                                  ⨯
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {teamAssignments.teamA.length === 0 && (
                          <div className="text-xs text-white/40 italic">
                            {isHost ? 'Drop players here' : 'No players yet'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Team B */}
                    <div
                      className={`rounded-lg border p-3 transition-all ${
                        dragOverTeam === 'teamB'
                          ? 'border-red-400 bg-red-500/20 scale-105'
                          : 'border-red-400/30 bg-red-500/5'
                      }`}
                      onDragOver={handleDragOver}
                      onDragEnter={() => handleDragEnter('teamB')}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, 'teamB')}
                    >
                      <div className="text-xs font-semibold text-red-300 mb-2">TEAM B</div>
                      <div className="space-y-2 min-h-[60px]">
                        {teamAssignments.teamB.map((playerId) => {
                          const player = players.find((p) => p.id === playerId);
                          if (!player) return null;
                          const isCurrentUser = playerId === socket.id;
                          return (
                            <div
                              key={playerId}
                              draggable={isHost}
                              onDragStart={(e) => handleDragStart(e, playerId)}
                              onDragEnd={handleDragEnd}
                              className={`flex items-center justify-between bg-red-500/10 rounded px-2 py-1.5 text-xs transition-opacity ${
                                isHost ? 'cursor-move' : ''
                              } ${draggedPlayerId === playerId ? 'opacity-50' : ''}`}
                            >
                              <span className="text-white truncate">{player.name}</span>
                              {isHost && !isCurrentUser && (
                                <button
                                  onClick={() => handleKickPlayer(playerId, player.name)}
                                  className="text-red-600 hover:text-red-500 ml-2 text-sm font-bold"
                                  title="Kick player from room"
                                >
                                  ⨯
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {teamAssignments.teamB.length === 0 && (
                          <div className="text-xs text-white/40 italic">
                            {isHost ? 'Drop players here' : 'No players yet'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Unassigned Players */}
                  {isHost && (
                    <div className="mt-3">
                      <div className="text-xs text-white/60 mb-2">
                        Unassigned (Drag or Click to assign):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {players
                          .filter(
                            (p) =>
                              !teamAssignments.teamA.includes(p.id) &&
                              !teamAssignments.teamB.includes(p.id),
                          )
                          .map((player) => {
                            const isCurrentUser = player.id === socket.id;
                            return (
                              <div
                                key={player.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, player.id)}
                                onDragEnd={handleDragEnd}
                                className={`flex gap-1 ${draggedPlayerId === player.id ? 'opacity-50' : ''}`}
                              >
                                <button
                                  onClick={() => assignPlayerToTeam(player.id, 'teamA')}
                                  className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-2 py-1 rounded text-xs border border-cyan-400/30 cursor-move"
                                  title="Assign to Team A or drag to team"
                                >
                                  {player.name} → A
                                </button>
                                <button
                                  onClick={() => assignPlayerToTeam(player.id, 'teamB')}
                                  className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-2 py-1 rounded text-xs border border-red-400/30"
                                  title="Assign to Team B"
                                >
                                  {player.name} → B
                                </button>
                                {!isCurrentUser && (
                                  <button
                                    onClick={() => handleKickPlayer(player.id, player.name)}
                                    className="text-red-600 hover:text-red-500 px-2 text-sm font-bold"
                                    title="Kick player from room"
                                  >
                                    ⨯
                                  </button>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm text-white/80">Quiz Topic</label>
                <input
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  value={settings.topic}
                  onChange={(e) => updateSettings({ topic: e.target.value })}
                  disabled={!isHost}
                  placeholder="Enter topic..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/80">Difficulty</label>
                <div className="flex gap-2">
                  {difficulties.map((d) => (
                    <button
                      key={d}
                      disabled={!isHost}
                      onClick={() => updateSettings({ difficulty: d })}
                      className={`px-3 py-2 rounded-lg text-sm capitalize transition-colors ${
                        settings.difficulty === d
                          ? 'bg-blue-500'
                          : 'bg-white/10 hover:bg-white/20 disabled:opacity-50'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm text-white/80">Questions</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    value={settings.count}
                    onChange={(e) =>
                      updateSettings({
                        count: Math.min(50, Math.max(1, Number(e.target.value || 1))),
                      })
                    }
                    disabled={!isHost}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-white/80">Duration (sec)</label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    value={settings.duration}
                    onChange={(e) =>
                      updateSettings({
                        duration: Math.min(300, Math.max(5, Number(e.target.value || 10))),
                      })
                    }
                    disabled={!isHost}
                  />
                </div>
              </div>

              {isHost && (
                <div className="pt-2">
                  <button
                    onClick={handleLetsGo}
                    disabled={
                      isGenerating ||
                      !settings.topic.trim() ||
                      (mode === '1v1' && players.length < 2) ||
                      (mode === '2v2' &&
                        (teamAssignments.teamA.length !== 2 ||
                          teamAssignments.teamB.length !== 2)) ||
                      (mode === 'coop' && players.length < 2)
                    }
                    className="w-full rounded-lg bg-blue-500 px-4 py-3 text-sm font-semibold uppercase hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGenerating
                      ? 'Generating...'
                      : countdown !== null
                        ? `Starting in ${countdown}`
                        : "Let's go"}
                  </button>
                  {mode === '2v2' &&
                    (teamAssignments.teamA.length !== 2 || teamAssignments.teamB.length !== 2) && (
                      <p className="mt-2 text-xs text-yellow-400 text-center">
                        Each team needs exactly 2 players to start
                      </p>
                    )}
                  {mode === 'coop' && players.length < 2 && (
                    <p className="mt-2 text-xs text-yellow-400 text-center">
                      Minimum 2 players required to start co-op
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Game Starting Overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="text-center">
            <h2 className="font-zentry text-5xl font-black uppercase text-white animate-pulse">
              Starting in {countdown}
            </h2>
            <p className="mt-4 font-general text-xl text-white/70">Get ready for the battle...</p>
          </div>
        </div>
      )}

      {/* Kick Confirmation Popup */}
      {kickConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="bg-black/90 rounded-2xl border border-red-500/50 p-8 max-w-md mx-4 text-center shadow-2xl">
            <h2 className="font-zentry text-3xl font-black uppercase text-white mb-4">
              Kick Player?
            </h2>
            <p className="font-general text-lg text-white/80 mb-6">
              Are you sure you want to remove{' '}
              <span className="text-red-400 font-bold">{kickConfirm.playerName}</span> from the
              room?
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={cancelKick}
                className="rounded-lg bg-gray-600 px-6 py-3 font-general font-semibold uppercase text-white transition-all hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={confirmKick}
                className="rounded-lg bg-red-600 px-6 py-3 font-general font-semibold uppercase text-white transition-all hover:bg-red-500"
              >
                Kick Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kicked Player Message */}
      {kickedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
          <div className="bg-black/90 rounded-2xl border border-red-500/50 p-8 max-w-md mx-4 text-center shadow-2xl">
            <h2 className="font-zentry text-4xl font-black uppercase text-red-500 mb-4">Kicked!</h2>
            <p className="font-general text-lg text-white mb-6">{kickedMessage}</p>
            <p className="font-general text-sm text-white/60">
              Redirecting to home in 5 seconds...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaitingRoom;
