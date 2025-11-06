// app/2v2arena/page.tsx
import React from 'react';
import { notFound } from 'next/navigation';
import Arena2v2Client from '@/app/2v2arena/ArenaClient';
import { QuizData } from '@/types';
import { getApiUrl } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default async function Arena2v2Page({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolved = await searchParams;
  const roomId = typeof resolved?.roomId === 'string' ? resolved.roomId : '';
  const quizId = typeof resolved?.quizId === 'string' ? resolved.quizId : '';
  const username = typeof resolved?.username === 'string' ? resolved.username : 'Player';
  const durationParam =
    typeof resolved?.duration === 'string' ? parseInt(resolved.duration, 10) : undefined;
  const duration = Number.isFinite(durationParam) ? (durationParam as number) : 10;

  if (!roomId || !quizId) return notFound();

  const apiBase = getApiUrl();
  const res = await fetch(`${apiBase}/api/quiz/${encodeURIComponent(quizId)}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 404) return notFound();
    throw new Error(`Failed to load quiz: ${res.status}`);
  }

  const quizData: QuizData = await res.json();

  return (
    <Arena2v2Client
      roomId={roomId}
      username={username}
      initialQuizData={quizData}
      initialDuration={duration}
      quizId={quizId}
    />
  );
}
