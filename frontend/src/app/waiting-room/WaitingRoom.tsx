'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import PlayersList from '@/components/waiting-room/PlayersList';
import ChatBox from '@/components/waiting-room/ChatBox';
import SettingsPanel from '@/components/waiting-room/SettingsPanel';
import TeamManagement from '@/components/waiting-room/TeamManagement';
import StartButton from '@/components/waiting-room/StartButton';
import SettingsDrawer from '@/components/waiting-room/SettingsDrawer';
import CountdownOverlay from '@/components/waiting-room/CountdownOverlay';
import KickConfirmModal from '@/components/waiting-room/KickConfirmModal';
import KickedMessageModal from '@/components/waiting-room/KickedMessageModal';
import { getApiUrl } from '@/lib/config';
import { useWaitingRoomSocket } from '@/hooks/waiting-room/useWaitingRoomSocket';
import { getModeConfig } from '@/utils/gameModes';
import type { WaitingRoomProps } from '@/types';

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [dragOverTeam, setDragOverTeam] = useState<'teamA' | 'teamB' | null>(null);
  const [kickConfirm, setKickConfirm] = useState<{ playerId: string; playerName: string } | null>(
    null,
  );
  const [messageInput, setMessageInput] = useState('');

  const {
    socket,
    connected,
    settings,
    updateSettings,
    players,
    teamAssignments,
    messages,
    sendMessage,
    countdown,
    kickedMessage,
    assignPlayerToTeam,
  } = useWaitingRoomSocket({
    roomId,
    quizId,
    username,
    avatar,
    isHost,
    mode,
    initialSettings,
  });

  useEffect(() => {
    gsap.from('.waiting-room-container', {
      opacity: 0,
      y: 20,
      duration: 0.5,
      ease: 'power2.out',
    });
  }, []);

  const closeSettings = () => setIsSettingsOpen(false);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = messageInput.trim();
    if (text) {
      sendMessage(text);
      setMessageInput('');
    }
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
      if (quizId && quizId !== 'new') {
        const config = getModeConfig(mode);
        socket.emit(config.initEvent, { roomId, quizId, duration: settings.duration });
        return;
      }

      const res = await fetch(`${getApiUrl()}/api/quiz/generate`, {
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

      const config = getModeConfig(mode);
      socket.emit(config.initEvent, { roomId, quizId: data.quizId, duration: settings.duration });
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

  const cancelKick = () => setKickConfirm(null);

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

  const titleForMode =
    mode === '1v1'
      ? '1v1 Waiting Room'
      : mode === '2v2'
        ? '2v2 Waiting Room'
        : mode === 'custom'
          ? 'Custom Battle Waiting Room'
          : mode === 'ffa'
            ? 'FFA Waiting Room'
            : 'Co-op Waiting Room';

  return (
    <div className="waiting-room-container flex h-screen flex-col bg-gradient-to-br from-slate-900 to-black text-white p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-zentry text-2xl md:text-3xl font-black uppercase">{titleForMode}</h1>
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

      <div className="flex flex-1 flex-col md:flex-row gap-4 md:gap-6 overflow-hidden">
        <div className="order-2 md:order-1 w-full md:w-1/2 flex flex-col flex-1 min-h-0">
          <div className="rounded-2xl border border-white/20 bg-white/5 p-4 backdrop-blur flex flex-col h-full min-h-0">
            <PlayersList
              players={players}
              mode={mode}
              isHost={isHost}
              socket={socket}
              onKickPlayer={handleKickPlayer}
            />
            <ChatBox
              messages={messages}
              messageInput={messageInput}
              setMessageInput={setMessageInput}
              onSendMessage={handleSendMessage}
              connected={connected}
            />
          </div>
        </div>

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

            {isHost && (
              <StartButton
                mode={mode}
                players={players}
                teamAssignments={teamAssignments}
                isGenerating={isGenerating}
                countdown={countdown}
                topicValid={settings.topic.trim().length > 0}
                isHost={isHost}
                onStart={handleLetsGo}
              />
            )}
          </div>
        </div>
      </div>

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

      <CountdownOverlay countdown={countdown} />

      <KickConfirmModal
        isOpen={kickConfirm !== null}
        playerName={kickConfirm?.playerName || ''}
        onConfirm={confirmKick}
        onCancel={cancelKick}
      />

      <KickedMessageModal isOpen={kickedMessage !== null} />
    </div>
  );
};

export default WaitingRoom;
