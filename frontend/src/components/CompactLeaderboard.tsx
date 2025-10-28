import React from 'react';

export type CompactPlayer = {
  id: string;
  username: string;
  avatar?: string;
  score: number;
  finished?: boolean;
};

type Props = {
  players: CompactPlayer[];
  socketId?: string;
  className?: string;
};

export default function CompactLeaderboard({ players, socketId, className = '' }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className={`w-full max-w-4xl mx-auto mb-3 ${className}`}>
      <div className="bg-black/50 rounded-xl border border-cyan-400/40 px-4 py-3 backdrop-blur-md shadow-lg">
        <div className="flex flex-wrap gap-x-6 gap-y-2 items-center justify-center text-sm">
          {sorted.map((player, index) => {
            const isMe = socketId && player.id === socketId;
            const rank = index + 1;
            let medal = '';
            let rankColor = 'text-white/70';

            if (rank === 1) {
              medal = '🥇';
              rankColor = 'text-yellow-400';
            } else if (rank === 2) {
              medal = '🥈';
              rankColor = 'text-gray-300';
            } else if (rank === 3) {
              medal = '🥉';
              rankColor = 'text-orange-400';
            }

            return (
              <div
                key={player.id}
                className={`flex items-center gap-2 ${isMe ? 'text-cyan-300 font-semibold' : 'text-white/90'}`}
                title={`${player.username} — ${player.score}pts`}
              >
                <span className={`font-zentry text-base ${rankColor}`}>{medal || `#${rank}`}</span>
                <span className="font-general truncate max-w-[100px]">
                  {player.username}
                  {player.finished && ' ✓'}
                </span>
                <span className="font-zentry font-bold text-base">{player.score}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
