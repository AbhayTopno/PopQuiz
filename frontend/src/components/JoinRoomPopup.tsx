'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useRouter } from 'next/navigation';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const JoinRoomPopup: React.FC<Props> = ({ isOpen, onClose }) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setInput('');
    gsap.fromTo(
      overlayRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.3, ease: 'power2.out' },
    );
    gsap.fromTo(
      popupRef.current,
      { scale: 0.8, opacity: 0, y: 50 },
      { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.7)' },
    );
  }, [isOpen]);

  const handleClose = () => {
    if (overlayRef.current && popupRef.current) {
      gsap.to(popupRef.current, {
        scale: 0.8,
        opacity: 0,
        y: 50,
        duration: 0.3,
        ease: 'power2.in',
      });
      gsap.to(overlayRef.current, {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: onClose,
      });
    }
  };

  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  // Removed unused parseRoom helper to satisfy lint rules

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const raw = input.trim();
    if (!raw) {
      setError('Enter a valid URL, path, or room ID');
      return;
    }
    setIsJoining(true);
    try {
      // Absolute URL
      if (/^https?:\/\//i.test(raw)) {
        router.push(raw);
        handleClose();
        return;
      }
      // App-relative path
      if (raw.startsWith('/')) {
        router.push(raw);
        handleClose();
        return;
      }
      // Fallback: treat as room id for coop route
      if (/^[a-zA-Z0-9_-]{4,64}$/.test(raw)) {
        router.push(`/coop/${raw}`);
        handleClose();
        return;
      }
      setError('Enter a valid URL, path (starting with /), or room ID');
    } finally {
      setIsJoining(false);
    }
  };

  if (!isOpen) return null;

  const inputClass =
    'w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 backdrop-blur-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50';

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onOverlayClick}
      style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div
        ref={popupRef}
        className="relative w-full max-w-lg rounded-2xl border border-white/20 bg-black/40 p-8 shadow-2xl"
        style={{ backdropFilter: 'blur(20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-2xl text-white/70 transition-colors hover:text-white"
        >
          ×
        </button>

        <h2 className="mb-6 text-center font-zentry text-3xl font-black uppercase text-white">
          Join Room
        </h2>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block font-general text-sm text-white/80">
              Paste invite link or Room ID
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. https://site/coop/abcd1234 or abcd1234"
              className={inputClass}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/20 border border-red-500/50 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isJoining || !input.trim()}
              className="w-full rounded-lg bg-blue-500 px-4 py-3 font-general font-semibold uppercase text-white transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isJoining ? 'Joining...' : 'Join'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinRoomPopup;
