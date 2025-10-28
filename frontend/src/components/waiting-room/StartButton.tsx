import React from 'react';
import type { StartButtonProps } from '@/types';

export default function StartButton({
  mode,
  players,
  teamAssignments,
  isGenerating,
  countdown,
  topicValid,
  onStart,
}: StartButtonProps) {
  const isDisabled = () => {
    if (isGenerating || !topicValid) return true;

    switch (mode) {
      case '1v1':
        return players.length < 2;
      case '2v2':
        return teamAssignments.teamA.length !== 2 || teamAssignments.teamB.length !== 2;
      case 'coop':
        return players.length < 2;
      case 'custom':
        return (
          teamAssignments.teamA.length === 0 ||
          teamAssignments.teamB.length === 0 ||
          players.length < 2
        );
      case 'ffa':
        return players.length < 2 || players.length > 10;
      default:
        return false;
    }
  };

  const getValidationMessage = () => {
    if (
      mode === '2v2' &&
      (teamAssignments.teamA.length !== 2 || teamAssignments.teamB.length !== 2)
    ) {
      return 'Each team needs exactly 2 players to start';
    }
    if (
      mode === 'custom' &&
      (teamAssignments.teamA.length === 0 || teamAssignments.teamB.length === 0)
    ) {
      return 'Both teams need at least 1 player to start';
    }
    if (mode === 'coop' && players.length < 2) {
      return 'Need at least 2 players to start';
    }
    if (mode === 'ffa' && (players.length < 2 || players.length > 10)) {
      return 'Need 2-10 players for FFA battle';
    }
    return null;
  };

  const validationMessage = getValidationMessage();

  return (
    <div className="mt-4 pt-4 border-t border-white/20">
      <button
        onClick={onStart}
        disabled={isDisabled()}
        className="w-full rounded-lg bg-blue-500 px-4 py-3 text-sm font-semibold uppercase hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isGenerating
          ? 'Generating...'
          : countdown !== null
            ? `Starting in ${countdown}`
            : "Let's go"}
      </button>
      {validationMessage && (
        <p className="mt-2 text-xs text-yellow-400 text-center">{validationMessage}</p>
      )}
    </div>
  );
}
