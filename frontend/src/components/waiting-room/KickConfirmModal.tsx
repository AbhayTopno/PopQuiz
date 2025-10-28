import React from 'react';
import type { KickConfirmModalProps } from '@/types';

export default function KickConfirmModal({
  isOpen,
  playerName,
  onConfirm,
  onCancel,
}: KickConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-black/90 backdrop-blur-xl border border-white/20 rounded-lg p-6 max-w-sm mx-4">
        <h3 className="text-lg font-bold text-white mb-2">Kick Player?</h3>
        <p className="text-white/80 text-sm mb-4">
          Are you sure you want to kick{' '}
          <span className="font-semibold text-red-400">{playerName}</span> from the room?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Kick
          </button>
        </div>
      </div>
    </div>
  );
}
