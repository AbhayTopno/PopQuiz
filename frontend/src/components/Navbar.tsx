'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import gsap from 'gsap';
import { useWindowScroll } from 'react-use';
import { useAuth } from '@/contexts/AuthContext';
import AuthPopup from './AuthPopup';
import ProfilePopup from './ProfilePopup';
import Image from 'next/image';
import JoinRoomPopup from './JoinRoomPopup';
import QuizPopup from './QuizPopup';

const navItems: string[] = ['Daily', 'Custom', 'About', 'Contact'];

const NavBar: React.FC = () => {
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isIndicatorActive, setIsIndicatorActive] = useState(false);
  const [isAuthPopupOpen, setIsAuthPopupOpen] = useState(false);
  const [isProfilePopupOpen, setIsProfilePopupOpen] = useState(false);
  const [isJoinPopupOpen, setIsJoinPopupOpen] = useState(false);
  const [isQuizPopupOpen, setIsQuizPopupOpen] = useState(false);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const navContainerRef = useRef<HTMLDivElement | null>(null);

  const { y: currentScrollY } = useWindowScroll();
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const { user, isAuthenticated } = useAuth();

  const toggleAudioIndicator = () => {
    setIsAudioPlaying((prev) => !prev);
    setIsIndicatorActive((prev) => !prev);
  };

  const handleAvatarClick = () => {
    if (isAuthenticated) {
      setIsProfilePopupOpen(true);
    } else {
      setIsAuthPopupOpen(true);
    }
  };

  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaying) {
        audioElementRef.current.play();
      } else {
        audioElementRef.current.pause();
      }
    }
  }, [isAudioPlaying]);

  useEffect(() => {
    if (!navContainerRef.current) return;

    if (currentScrollY === 0) {
      setIsNavVisible(true);
      navContainerRef.current.classList.remove('floating-nav');
    } else if (currentScrollY > lastScrollY) {
      setIsNavVisible(false);
      navContainerRef.current.classList.add('floating-nav');
    } else if (currentScrollY < lastScrollY) {
      setIsNavVisible(true);
      navContainerRef.current.classList.add('floating-nav');
    }

    setLastScrollY(currentScrollY);
  }, [currentScrollY, lastScrollY]);

  useEffect(() => {
    gsap.to(navContainerRef.current, {
      y: isNavVisible ? 0 : -100,
      opacity: isNavVisible ? 1 : 0,
      duration: 0.2,
    });
  }, [isNavVisible]);

  return (
    <>
      <div
        ref={navContainerRef}
        className="fixed inset-x-0 top-4 z-50 h-16 border-none transition-all duration-700 sm:inset-x-6"
      >
        <header className="absolute top-1/2 w-full -translate-y-1/2">
          <nav className="flex size-full items-center justify-between py-4 px-10">
            <div className="flex items-center gap-7">
              <h1 className="special-font  uppercase font-zentry font-black text-[2rem]  text-blue-100">
                POP<b>Q</b>UIZ
              </h1>
            </div>

            <div className="flex h-full items-center gap-4">
              <div className="hidden md:flex items-center gap-3">
                {navItems.map((item, index) => {
                  if (item === 'Daily') return null; // skip for now
                  if (item === 'Custom') {
                    return (
                      <button
                        key={index}
                        className="nav-hover-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          setIsQuizPopupOpen(true);
                        }}
                      >
                        {item}
                      </button>
                    );
                  }
                  const href = `#${item.toLowerCase()}`;
                  return (
                    <a key={index} href={href} className="nav-hover-btn">
                      {item}
                    </a>
                  );
                })}
                <button onClick={() => setIsJoinPopupOpen(true)} className="nav-hover-btn">
                  Join Room
                </button>
              </div>

              <button onClick={toggleAudioIndicator} className="ml-6 flex items-center space-x-0.5">
                <audio ref={audioElementRef} className="hidden" src="/audio/loop.mp3" loop />
                {[1, 2, 3, 4].map((bar) => (
                  <div
                    key={bar}
                    className={clsx('indicator-line', {
                      active: isIndicatorActive,
                    })}
                    style={{
                      animationDelay: `${bar * 0.1}s`,
                    }}
                  />
                ))}
              </button>

              <button
                onClick={handleAvatarClick}
                className="ml-4 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white/30 bg-gradient-to-br from-blue-500 to-purple-600 transition-all hover:scale-110 hover:border-white/50"
              >
                {isAuthenticated && user ? (
                  user.avatar ? (
                    <Image
                      src={user.avatar || '/placeholder.svg'}
                      alt={user.username}
                      className="h-full w-full object-cover"
                      layout="fill"
                    />
                  ) : (
                    <span className="font-zentry text-lg font-black text-white">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                  )
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="h-6 w-6 text-white"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </nav>
        </header>
      </div>

      <AuthPopup isOpen={isAuthPopupOpen} onClose={() => setIsAuthPopupOpen(false)} />
      <ProfilePopup isOpen={isProfilePopupOpen} onClose={() => setIsProfilePopupOpen(false)} />
      <JoinRoomPopup isOpen={isJoinPopupOpen} onClose={() => setIsJoinPopupOpen(false)} />
      <QuizPopup open={isQuizPopupOpen} onClose={() => setIsQuizPopupOpen(false)} topic={''} />
    </>
  );
};

export default NavBar;
