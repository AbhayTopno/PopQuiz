'use client';

import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { useAuth } from '@/contexts/AuthContext';

interface ProfilePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfilePopup: React.FC<ProfilePopupProps> = ({ isOpen, onClose }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const popupRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { user, updateProfile, logout } = useAuth();

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
      setAvatar(user.avatar || '');
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) {
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
    } else {
      if (popupRef.current && overlayRef.current) {
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
        });
      }
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await updateProfile({ username, email, avatar });
      setIsEditing(false);
    } catch (err) {
      const defaultMessage = 'Profile update failed. Please try again.';
      if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError(defaultMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={handleOverlayClick}
      style={{
        backdropFilter: 'blur(10px)',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
    >
      <div
        ref={popupRef}
        className="relative w-full max-w-md rounded-2xl border border-white/20 bg-black/40 p-8 shadow-2xl"
        style={{ backdropFilter: 'blur(20px)' }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-2xl text-white/70 transition-colors hover:text-white"
        >
          ×
        </button>

        <h2 className="mb-6 text-center font-zentry text-3xl font-black uppercase text-white">
          Profile
        </h2>

        {!isEditing ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center">
              <div className="relative mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-white/30 bg-gradient-to-br from-blue-500 to-purple-600">
                {avatar ? (
                  <Image
                    src={avatar || '/placeholder.svg'}
                    alt={username}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <span className="font-zentry text-3xl font-black text-white">
                    {username?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <h3 className="font-zentry text-2xl font-bold text-white">{username}</h3>
              <p className="text-white/80">{email}</p>
            </div>

            <button
              onClick={() => setIsEditing(true)}
              className="w-full rounded-lg bg-blue-500 px-4 py-3 font-general font-semibold uppercase text-white transition-all hover:bg-blue-600"
            >
              Edit Profile
            </button>

            <button
              onClick={handleLogout}
              className="w-full rounded-lg bg-red-500 px-4 py-3 font-general font-semibold uppercase text-white transition-all hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block font-general text-sm text-white/80">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 backdrop-blur-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                placeholder="Enter your username"
                required
              />
            </div>

            <div>
              <label className="mb-2 block font-general text-sm text-white/80">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 backdrop-blur-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="mb-2 block font-general text-sm text-white/80">Avatar URL</label>
              <input
                type="text"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 backdrop-blur-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                placeholder="Enter avatar URL (optional)"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/50 bg-red-500/20 px-4 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-blue-500 px-4 py-3 font-general font-semibold uppercase text-white transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>

            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="w-full rounded-lg bg-gray-500 px-4 py-3 font-general font-semibold uppercase text-white transition-all hover:bg-gray-600"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfilePopup;
