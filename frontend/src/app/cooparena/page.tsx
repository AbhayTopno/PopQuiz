import { Metadata } from 'next';
import CoopArenaClient from './CoopArenaClient';

export const metadata: Metadata = {
  title: 'Co-op Arena | PopQuiz',
  description: 'Collaborative quiz gameplay',
};

type SearchParams = Promise<{
  roomId?: string;
  username?: string;
  quizId?: string;
  duration?: string;
}>;

async function fetchQuizData(quizId: string) {
  try {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${baseURL}/api/quiz/${quizId}`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      console.error(`Failed to fetch quiz: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('Error fetching quiz:', err);
    return null;
  }
}

export default async function CoopArenaPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { roomId, username, quizId, duration } = params;

  if (!roomId || !username || !quizId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Missing Parameters</h1>
          <p className="text-gray-400">Room ID, username, and quiz ID are required</p>
        </div>
      </div>
    );
  }

  const quizData = await fetchQuizData(quizId);

  if (!quizData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Quiz Not Found</h1>
          <p className="text-gray-400">Could not load quiz data</p>
        </div>
      </div>
    );
  }

  const durationNum = duration ? parseInt(duration, 10) : 10;

  return (
    <CoopArenaClient
      roomId={roomId}
      username={username}
      initialQuizData={quizData}
      initialDuration={durationNum}
      quizId={quizId}
    />
  );
}
