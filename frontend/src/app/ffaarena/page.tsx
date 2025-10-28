import { Suspense } from 'react';
import FFAArenaClient from './FFAArenaClient';

export default function FFAArenaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-black text-white">
          <p>Loading FFA Arena...</p>
        </div>
      }
    >
      <FFAArenaClient />
    </Suspense>
  );
}
