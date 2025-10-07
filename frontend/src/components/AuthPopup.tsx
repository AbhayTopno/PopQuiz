'use client';

import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useAuth } from '@/contexts/AuthContext';

interface AuthPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthPopup: React.FC<AuthPopupProps> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const popupRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const { login, signup } = useAuth();

  useEffect(() => {
    if (isOpen) {
      // Animate popup entrance
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: 'power2.out' }
      );
      gsap.fromTo(
        popupRef.current,
        { scale: 0.8, opacity: 0, y: 50 },
        { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.7)' }
      );
    } else {
      // Animate popup exit
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

    if (!email || !password || (!isLogin && !username)) {
      setError('All fields are required');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Invalid email format');
      setIsLoading(false);
      return;
    }

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(username, email, password);
      }
      onClose();
      setEmail('');
      setPassword('');
      setUsername('');
    } catch (err) {
      const defaultMessage = isLogin
        ? 'Invalid credentials'
        : 'Signup failed. Please try again.';
      if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError(defaultMessage);
      }
    } finally {
      setIsLoading(false);
    }
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
          {isLogin ? 'Login' : 'Sign Up'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="mb-2 block font-general text-sm text-white/80">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 backdrop-blur-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                placeholder="Enter your username"
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="mb-2 block font-general text-sm text-white/80">
              Email
            </label>
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
            <label className="mb-2 block font-general text-sm text-white/80">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 backdrop-blur-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              placeholder="Enter your password"
              required
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
            {isLoading ? 'Processing...' : isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="font-general text-sm text-white/70 transition-colors hover:text-white"
          >
            {isLogin
              ? "Don't have an account? Sign Up"
              : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPopup;
