'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import WaitingRoom from '@/app/waiting-room/WaitingRoom';
import { useAuth } from '@/contexts/AuthContext';

function WaitingRoomContent() {
  const searchParams = useSearchParams();
  const { user, currentUser } = useAuth();
  const roomId = searchParams.get('roomId') || '';
  const quizId = searchParams.get('quizId') || '';
  const urlUsername = searchParams.get('username') || 'Guest';
  const urlAvatar = searchParams.get('avatar') || undefined;
  // Refresh and prefer authenticated user for accurate username/avatar
  useEffect(() => {
    currentUser().catch(() => {});
  }, [currentUser]);

  const resolvedUsername = user?.username ?? urlUsername;
  const resolvedAvatar = user?.avatar ?? urlAvatar;
  const isHost = searchParams.get('host') === '1';
  const mode = searchParams.get('mode') || '1v1';

  // Extract initial settings from URL params
  const topic = searchParams.get('topic') || '';
  const difficulty = searchParams.get('difficulty') || 'medium';
  const count = parseInt(searchParams.get('count') || '10', 10);
  const duration = parseInt(searchParams.get('duration') || '30', 10);

  const initialSettings = {
    topic,
    difficulty,
    count: Math.min(50, Math.max(1, count)),
    duration: Math.min(300, Math.max(5, duration)),
  };

  if (!roomId || !quizId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <h1 className="font-zentry text-3xl font-black text-white">Invalid Room or Quiz ID</h1>
          <p className="mt-4 font-general text-white/70">Please create a new quiz battle.</p>
        </div>
      </div>
    );
  }

  return (
    <WaitingRoom
      roomId={roomId}
      quizId={quizId}
      username={resolvedUsername}
      avatar={resolvedAvatar}
      isHost={isHost}
      mode={mode}
      initialSettings={initialSettings}
    />
  );
}

export default function WaitingRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <div className="text-center">
            <h1 className="font-zentry text-3xl font-black text-white animate-pulse">Loading...</h1>
          </div>
        </div>
      }
    >
      <WaitingRoomContent />
    </Suspense>
  );
}
