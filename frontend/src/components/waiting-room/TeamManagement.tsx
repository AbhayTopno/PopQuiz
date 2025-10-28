import React from 'react';
import type { TeamManagementProps } from '@/types';

export default function TeamManagement({
  mode,
  players,
  teamAssignments,
  isHost,
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
}: TeamManagementProps) {
  if (mode !== '2v2' && mode !== 'custom') return null;

  return (
    <div>
      <label className="mb-2 block text-sm text-white/80 font-semibold">
        Team Assignments {isHost && '(Drag & Drop or Click)'}
        {mode === 'custom' && (
          <span className="text-xs text-cyan-400 ml-2">(Custom: Any team size)</span>
        )}
      </label>
      <div className="grid grid-cols-2 gap-3">
        {/* Team A */}
        <div
          className={`rounded-lg border p-3 transition-all ${
            dragOverTeam === 'teamA'
              ? 'border-cyan-400 bg-cyan-500/20 scale-105'
              : 'border-cyan-400/30 bg-cyan-500/5'
          }`}
          onDragOver={onDragOver}
          onDragEnter={() => onDragEnter('teamA')}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, 'teamA')}
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
                  onDragStart={(e) => onDragStart(e, playerId)}
                  onDragEnd={onDragEnd}
                  className={`flex items-center justify-between bg-cyan-500/10 rounded px-2 py-1.5 text-xs transition-opacity ${
                    isHost ? 'cursor-move' : ''
                  } ${draggedPlayerId === playerId ? 'opacity-50' : ''}`}
                >
                  <span className="text-white truncate">{player.name}</span>
                  {isHost && !isCurrentUser && (
                    <button
                      onClick={() => onKickPlayer(playerId, player.name)}
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
          onDragOver={onDragOver}
          onDragEnter={() => onDragEnter('teamB')}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, 'teamB')}
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
                  onDragStart={(e) => onDragStart(e, playerId)}
                  onDragEnd={onDragEnd}
                  className={`flex items-center justify-between bg-red-500/10 rounded px-2 py-1.5 text-xs transition-opacity ${
                    isHost ? 'cursor-move' : ''
                  } ${draggedPlayerId === playerId ? 'opacity-50' : ''}`}
                >
                  <span className="text-white truncate">{player.name}</span>
                  {isHost && !isCurrentUser && (
                    <button
                      onClick={() => onKickPlayer(playerId, player.name)}
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
          <div className="text-xs text-white/60 mb-2">Unassigned (Drag or Click to assign):</div>
          <div className="flex flex-wrap gap-2">
            {players
              .filter(
                (p) =>
                  !teamAssignments.teamA.includes(p.id) && !teamAssignments.teamB.includes(p.id),
              )
              .map((player) => {
                const isCurrentUser = player.id === socket.id;
                return (
                  <div
                    key={player.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, player.id)}
                    onDragEnd={onDragEnd}
                    className={`flex gap-1 ${draggedPlayerId === player.id ? 'opacity-50' : ''}`}
                  >
                    <button
                      onClick={() => onAssignPlayer(player.id, 'teamA')}
                      className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-2 py-1 rounded text-xs border border-cyan-400/30 cursor-move"
                      title="Assign to Team A or drag to team"
                    >
                      {player.name} → A
                    </button>
                    <button
                      onClick={() => onAssignPlayer(player.id, 'teamB')}
                      className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-2 py-1 rounded text-xs border border-red-400/30"
                      title="Assign to Team B"
                    >
                      {player.name} → B
                    </button>
                    {!isCurrentUser && (
                      <button
                        onClick={() => onKickPlayer(player.id, player.name)}
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
  );
}
