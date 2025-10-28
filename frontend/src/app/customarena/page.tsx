import { Suspense } from 'react';
import CustomArenaClient from './CustomArenaClient';

export default function CustomArenaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-black">
          <p className="text-white">Loading custom arena...</p>
        </div>
      }
    >
      <CustomArenaWrapper />
    </Suspense>
  );
}

function CustomArenaWrapper() {
  // This will be handled by CustomArenaClient similar to 2v2arena
  return <CustomArenaClient />;
}
