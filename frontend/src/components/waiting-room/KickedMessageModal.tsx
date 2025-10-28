import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { KickedMessageModalProps } from '@/types';

export default function KickedMessageModal({ isOpen }: KickedMessageModalProps) {
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      const timeout = setTimeout(() => {
        router.push('/');
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, router]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-black/90 backdrop-blur-xl border border-red-500/50 rounded-lg p-8 max-w-sm mx-4 text-center">
        <div className="text-4xl mb-4">🚫</div>
        <h3 className="text-xl font-bold text-red-400 mb-2">You&apos;ve Been Kicked</h3>
        <p className="text-white/80 text-sm">Redirecting to home page...</p>
      </div>
    </div>
  );
}
