// app/quiz/[roomName]/page.tsx
import React from 'react';
import { notFound } from 'next/navigation';
import QuizClient from './QuizClient';
import Link from 'next/link';
import { QuizData } from '@/types';

// Force dynamic rendering (SSR) for this route
export const dynamic = 'force-dynamic';

type Props = {
  // CHANGE: Updated params type to Promise<{ roomName: string }> to match Next.js 15+ expectations for dynamic routes
  params: Promise<{ roomName: string }>;
  // CHANGE: Updated searchParams type to Promise<{ [key: string]: string | string[] | undefined }> | undefined to match Next.js 15+ expectations
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function QuizPage({ params, searchParams }: Props) {
  // CHANGE: Await params to extract roomName, since params is now a Promise
  const { roomName } = await params;
  // CHANGE: Await searchParams to get the resolved object, since searchParams is now a Promise (handle as optional)
  const resolvedSearchParams = await searchParams;

  const apiBase = process.env.NEXT_PUBLIC_API_URL;

  if (!roomName) {
    return notFound();
  }

  // SSR fetch: fresh on every request
  const res = await fetch(`${apiBase}/api/quiz/${encodeURIComponent(roomName)}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 404) return notFound();

    return (
      <div className="flex-center h-screen p-4">
        <div className="max-w-xl w-full bg-black/50 p-6 rounded-lg text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Failed to load quiz</h2>
          <p className="text-gray-300 mb-4">Server responded with status {res.status}.</p>
          <Link href="/" className="underline text-cyan-300">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const quizData: QuizData = await res.json();

  // CHANGE: Use resolvedSearchParams instead of searchParams for accessing duration
  const durationParam =
    typeof resolvedSearchParams?.duration === 'string'
      ? parseInt(resolvedSearchParams.duration, 10)
      : undefined;
  const duration = Number.isFinite(durationParam) ? durationParam : undefined;

  return <QuizClient initialQuizData={quizData} initialDuration={duration} />;
}
