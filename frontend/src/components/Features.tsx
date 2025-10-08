'use client';

import React, { useState, useRef, useEffect } from 'react';
import { TiLocationArrow } from 'react-icons/ti';
import { BentoTiltProps, BentoCardProps } from '../types';
import QuizPopup from './QuizPopup';

export const BentoTilt: React.FC<BentoTiltProps> = ({ children, className = '', onClick }) => {
  const [transformStyle, setTransformStyle] = useState<string>('');
  const itemRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!itemRef.current) return;

    const { left, top, width, height } = itemRef.current.getBoundingClientRect();

    const relativeX = (event.clientX - left) / width;
    const relativeY = (event.clientY - top) / height;

    const tiltX = (relativeY - 0.5) * 5;
    const tiltY = (relativeX - 0.5) * -5;

    const newTransform = `perspective(700px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(.95, .95, .95)`;
    setTransformStyle(newTransform);
  };

  const handleMouseLeave = () => {
    setTransformStyle('');
  };

  return (
    <div
      ref={itemRef}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ transform: transformStyle }}
    >
      {children}
    </div>
  );
};

export const BentoCard: React.FC<BentoCardProps> = ({
  src,
  title,
  description,
  isComingSoon,
  onOpen,
}) => {
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [hoverOpacity, setHoverOpacity] = useState(0);
  const hoverButtonRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    if (videoRef.current?.parentElement) {
      observer.observe(videoRef.current.parentElement);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!hoverButtonRef.current) return;
    const rect = hoverButtonRef.current.getBoundingClientRect();

    setCursorPosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  const handleMouseEnter = () => setHoverOpacity(1);
  const handleMouseLeave = () => setHoverOpacity(0);

  return (
    <div className="relative size-full">
      <video
        ref={videoRef}
        src={isVisible ? src : undefined}
        loop
        muted
        autoPlay={isVisible}
        playsInline // Added for better mobile compatibility
        className="absolute left-0 top-0 size-full object-cover object-center"
      />
      <div className="relative z-10 flex size-full flex-col justify-between p-5 text-blue-50">
        <div>
          <h1 className="bento-title special-font">{title}</h1>
          {description && <p className="mt-3 max-w-64 text-xs md:text-base">{description}</p>}
        </div>

        {isComingSoon && (
          <div
            ref={hoverButtonRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={onOpen}
            className="border-hsla relative flex w-fit cursor-pointer items-center gap-1 overflow-hidden rounded-full bg-black px-5 py-2 text-xs uppercase text-white"
          >
            <div
              className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
              style={{
                opacity: hoverOpacity,
                background: `radial-gradient(100px circle at ${cursorPosition.x}px ${cursorPosition.y}px, #656fe288, #00000026)`,
              }}
            />
            <TiLocationArrow className="relative z-20" />
            <p className="relative z-20">Vamos</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Features: React.FC = () => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('');

  const openPopup = (topic: string) => {
    setSelectedTopic(topic);
    setIsPopupOpen(true);
  };

  return (
    <section className="bg-black pb-52">
      <div className="container mx-auto px-3 md:px-10">
        <div className="px-5 py-32">
          <p className="font-circular-web text-lg text-blue-50">Step Into the Quizverse</p>
          <p className="max-w-md font-circular-web text-lg text-blue-50 opacity-50">
            Enter a dynamic world of knowledge where real-time battles, solo challenges, and
            AI-powered quizzes blend into one seamless and thrilling experience.
          </p>
        </div>

        <BentoTilt className="border-hsla relative mb-7 h-96 w-full overflow-hidden rounded-md md:h-[65vh]">
          <BentoCard
            src="https://cdn.jsdelivr.net/gh/AbhayTopno/Resources@1.0.0/feature-1.hevc.mp4"
            title={
              <>
                C<b>a</b>rs
              </>
            }
            isComingSoon
            onOpen={() => openPopup('cars')}
          />
        </BentoTilt>

        <div className="grid h-[135vh] w-full grid-cols-2 grid-rows-3 gap-7">
          <BentoTilt className="bento-tilt_1 row-span-1 md:col-span-1 md:row-span-2">
            <BentoCard
              src="https://cdn.jsdelivr.net/gh/AbhayTopno/Resources@1.0.0/feature-2.hevc.mp4"
              title={
                <>
                  G<b>a</b>ming
                </>
              }
              isComingSoon
              onOpen={() => openPopup('gaming')}
            />
          </BentoTilt>

          <BentoTilt className="bento-tilt_1 row-span-1 ms-32 md:col-span-1 md:ms-0">
            <BentoCard
              src="https://cdn.jsdelivr.net/gh/AbhayTopno/Resources@1.0.0/feature-3.hevc.mp4"
              title={<>History</>}
              isComingSoon
              onOpen={() => openPopup('history')}
            />
          </BentoTilt>

          <BentoTilt className="bento-tilt_1 me-14 md:col-span-1 md:me-0">
            <BentoCard
              src="https://cdn.jsdelivr.net/gh/AbhayTopno/Resources@1.0.0/feature-4.hevc.mp4"
              title={<>DC</>}
              isComingSoon
              onOpen={() => openPopup('dc')}
            />
          </BentoTilt>

          <BentoTilt className="bento-tilt_2" onClick={() => openPopup('')}>
            <div className="relative flex size-full flex-col justify-between bg-gradient-to-r from-violet-900 via-indigo-900 to-gray-900 p-5">
              <h1 className="bento-title special-font max-w-64 text-white">
                Cr<b>e</b>ate y<b>o</b>ur <br /> own quiz a<b>d</b>venture!
              </h1>
              <TiLocationArrow className="absolute bottom-10 right-10 scale-[5] text-slate-300" />
            </div>
          </BentoTilt>

          <BentoTilt className="bento-tilt_2">
            <BentoCard
              src="https://cdn.jsdelivr.net/gh/AbhayTopno/Resources@1.0.0/feature-5.hevc.mp4"
              title={
                <>
                  M<b>u</b>sic
                </>
              }
              isComingSoon
              onOpen={() => openPopup('music')}
            />
          </BentoTilt>
        </div>
      </div>

      <QuizPopup open={isPopupOpen} onClose={() => setIsPopupOpen(false)} topic={selectedTopic} />
    </section>
  );
};

export default Features;
