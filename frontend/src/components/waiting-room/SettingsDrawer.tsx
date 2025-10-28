import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import SettingsPanel from './SettingsPanel';
import TeamManagement from './TeamManagement';
import type { SettingsDrawerProps } from '@/types';

export default function SettingsDrawer({
  isOpen,
  onClose,
  roomId,
  mode,
  settings,
  updateSettings,
  isHost,
  copied,
  onCopyLink,
  players,
  teamAssignments,
  socket,
  draggedPlayerId,
  dragOverTeam,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onKickPlayer,
  onAssignPlayer,
}: SettingsDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      gsap.to(backdropRef.current, { opacity: 1, duration: 0.3 });
      gsap.to(drawerRef.current, { x: 0, duration: 0.3, ease: 'power2.out' });
    } else {
      gsap.to(backdropRef.current, { opacity: 0, duration: 0.3 });
      gsap.to(drawerRef.current, { x: '100%', duration: 0.3, ease: 'power2.in' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/70 z-40 opacity-0"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed right-0 top-0 h-full w-[320px] bg-black/90 backdrop-blur-xl border-l border-white/20 z-50 overflow-y-auto translate-x-full"
      >
        <div className="p-6">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl"
          >
            ×
          </button>

          <h2 className="text-xl font-bold text-white mb-6">Settings</h2>

          {/* Settings Panel */}
          <SettingsPanel
            roomId={roomId}
            settings={settings}
            updateSettings={updateSettings}
            isHost={isHost}
            copied={copied}
            onCopyLink={onCopyLink}
          />

          {/* Team Management (if applicable) */}
          <div className="mt-6">
            <TeamManagement
              mode={mode}
              players={players}
              teamAssignments={teamAssignments}
              isHost={isHost}
              socket={socket}
              draggedPlayerId={draggedPlayerId}
              dragOverTeam={dragOverTeam}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onKickPlayer={onKickPlayer}
              onAssignPlayer={onAssignPlayer}
            />
          </div>
        </div>
      </div>
    </>
  );
}
