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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

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
    const navElement = navContainerRef.current;
    if (!navElement) return;

    if (currentScrollY === 0) {
      setIsNavVisible(true);
      navElement.classList.remove('floating-nav');
    } else if (currentScrollY > lastScrollY) {
      setIsNavVisible(false);
      navElement.classList.add('floating-nav');
    } else if (currentScrollY < lastScrollY) {
      setIsNavVisible(true);
      navElement.classList.add('floating-nav');
    }

    setLastScrollY(currentScrollY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScrollY]);

  useEffect(() => {
    const menuElement = mobileMenuRef.current;
    if (!menuElement) return;

    if (isMobileMenuOpen) {
      // Animate menu sliding in from right
      gsap.fromTo(menuElement, { x: '100%' }, { x: '0%', duration: 0.4, ease: 'power2.out' });

      // Animate menu items one by one
      const menuItems = menuElement.querySelectorAll('.mobile-menu-item');
      gsap.fromTo(
        menuItems,
        { x: 50, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.3,
          stagger: 0.1,
          delay: 0.2,
          ease: 'power2.out',
        },
      );
    } else {
      // Animate menu sliding out to right
      gsap.to(menuElement, {
        x: '100%',
        duration: 0.3,
        ease: 'power2.in',
      });
    }

    // Cleanup function
    return () => {
      gsap.killTweensOf(menuElement);
      if (menuElement) {
        const menuItems = menuElement.querySelectorAll('.mobile-menu-item');
        gsap.killTweensOf(menuItems);
      }
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const navElement = navContainerRef.current;
    if (!navElement) return;

    gsap.to(navElement, {
      y: isNavVisible ? 0 : -100,
      opacity: isNavVisible ? 1 : 0,
      duration: 0.2,
    });

    // Cleanup function
    return () => {
      gsap.killTweensOf(navElement);
    };
  }, [isNavVisible]);

  return (
    <>
      <div
        ref={navContainerRef}
        className="fixed inset-x-0 top-4 z-50 h-16 border-none transition-all duration-700 sm:inset-x-6"
      >
        <header className="absolute top-1/2 w-full -translate-y-1/2">
          <nav className="flex size-full items-center justify-between py-4 px-4 sm:px-10">
            <div className="flex items-center gap-7">
              <h1 className="special-font uppercase font-zentry font-black text-xl sm:text-[2rem] text-blue-100">
                POP<b>Q</b>UIZ
              </h1>
            </div>

            <div className="flex h-full items-center gap-2 sm:gap-4">
              {/* Desktop Menu - hidden on mobile */}
              <div className="hidden lg:flex items-center gap-2 sm:gap-3">
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

              {/* Desktop Audio & Profile - visible only on large screens */}
              <button
                onClick={toggleAudioIndicator}
                className="hidden lg:flex ml-2 sm:ml-6 items-center space-x-0.5"
              >
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
                className="hidden lg:flex ml-2 sm:ml-3 md:ml-4 h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white/30 bg-gradient-to-br from-blue-500 to-purple-600 transition-all hover:scale-110 hover:border-white/50"
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

              {/* Mobile Menu Button - visible only on mobile/tablet */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden ml-2 flex items-center justify-center w-8 h-8 text-blue-100 hover:text-white transition-colors"
                aria-label="Open menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              </button>
            </div>
          </nav>
        </header>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Sidebar */}
      <div
        ref={mobileMenuRef}
        className="fixed top-0 right-0 h-full w-[280px] backdrop-blur-xl bg-black/40 border-l border-white/20 z-[70] lg:hidden shadow-2xl"
        style={{ transform: 'translateX(100%)' }}
      >
        <div className="flex flex-col h-full p-6">
          {/* Top Bar with Audio, Profile, and Close Button */}
          <div className="mobile-menu-item flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              {/* Profile Button */}
              <button
                onClick={() => {
                  handleAvatarClick();
                  setIsMobileMenuOpen(false);
                }}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white/30 bg-gradient-to-br from-blue-500 to-purple-600 transition-all hover:scale-110 hover:border-white/50"
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

              {/* Audio Button */}
              <button onClick={toggleAudioIndicator} className="flex items-center space-x-0.5">
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
            </div>

            {/* Close Button */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-white hover:text-blue-200 transition-colors"
              aria-label="Close menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-8 h-8"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Menu Items */}
          <nav className="flex flex-col gap-6">
            {navItems.map((item, index) => {
              if (item === 'Daily') return null;
              if (item === 'Custom') {
                return (
                  <button
                    key={index}
                    className="mobile-menu-item text-left text-2xl font-zentry font-bold text-white hover:text-blue-200 transition-colors uppercase"
                    onClick={() => {
                      setIsQuizPopupOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    {item}
                  </button>
                );
              }
              const href = `#${item.toLowerCase()}`;
              return (
                <a
                  key={index}
                  href={href}
                  className="mobile-menu-item text-2xl font-zentry font-bold text-white hover:text-blue-200 transition-colors uppercase"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item}
                </a>
              );
            })}
            <button
              onClick={() => {
                setIsJoinPopupOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="mobile-menu-item text-left text-2xl font-zentry font-bold text-white hover:text-blue-200 transition-colors uppercase"
            >
              Join Room
            </button>
          </nav>
        </div>
      </div>

      <AuthPopup isOpen={isAuthPopupOpen} onClose={() => setIsAuthPopupOpen(false)} />
      <ProfilePopup isOpen={isProfilePopupOpen} onClose={() => setIsProfilePopupOpen(false)} />
      <JoinRoomPopup isOpen={isJoinPopupOpen} onClose={() => setIsJoinPopupOpen(false)} />
      <QuizPopup open={isQuizPopupOpen} onClose={() => setIsQuizPopupOpen(false)} topic={''} />
    </>
  );
};

export default NavBar;
