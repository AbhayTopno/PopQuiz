import React from 'react';
import type { PlayersListProps } from '@/types';

export default function PlayersList({ players, mode }: PlayersListProps) {
  const getPlayerLabel = () => {
    switch (mode) {
      case '1v1':
        return '(2 max)';
      case '2v2':
        return '(4 max)';
      case 'coop':
        return '(2-10 players)';
      case 'custom':
        return '(2-10 players, any team composition)';
      case 'ffa':
        return '(2-10 players, free-for-all)';
      default:
        return '';
    }
  };

  const getStatusMessage = () => {
    if (players.length === 0) {
      return <span className="text-xs text-white/60">Waiting for players…</span>;
    }

    if (mode === '1v1' && players.length === 2) {
      return <span className="text-xs text-green-400">All players are here.</span>;
    }

    if (mode === '2v2' && players.length === 4) {
      return <span className="text-xs text-green-400">All players are here.</span>;
    }

    if (mode === 'custom' && players.length >= 2 && players.length <= 10) {
      return (
        <span className="text-xs text-cyan-400">
          {players.length} players ready for custom battle
        </span>
      );
    }

    if (mode === 'ffa' && players.length >= 2 && players.length <= 10) {
      return (
        <span className="text-xs text-yellow-400">
          {players.length} players ready for FFA battle
        </span>
      );
    }

    return null;
  };

  return (
    <>
      <div className="mb-3 text-sm font-semibold uppercase text-white/80">
        Players {getPlayerLabel()}
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
        {getStatusMessage()}
      </div>
    </>
  );
}
