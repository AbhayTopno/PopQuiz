import React from 'react';
import type { CountdownOverlayProps } from '@/types';

export default function CountdownOverlay({ countdown }: CountdownOverlayProps) {
  if (countdown === null) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="text-9xl font-bold text-white animate-pulse">{countdown}</div>
    </div>
  );
}
