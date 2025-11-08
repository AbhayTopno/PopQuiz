'use client';

import React, { useRef } from 'react';
import gsap from 'gsap';

import Button from './Button';
import AnimatedTitle from './AnimatedTitle';
import Image from 'next/image';

const FloatingImage: React.FC = () => {
  const frameRef = useRef<HTMLImageElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    const { clientX, clientY } = e;
    const element = frameRef.current;

    if (!element) return;

    const rect = element.getBoundingClientRect();
    const xPos = clientX - rect.left;
    const yPos = clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((yPos - centerY) / centerY) * -10;
    const rotateY = ((xPos - centerX) / centerX) * 10;

    gsap.to(element, {
      duration: 0.3,
      rotateX,
      rotateY,
      transformPerspective: 500,
      ease: 'power1.inOut',
    });
  };

  const handleMouseLeave = () => {
    const element = frameRef.current;

    if (element) {
      gsap.to(element, {
        duration: 0.3,
        rotateX: 0,
        rotateY: 0,
        ease: 'power1.inOut',
      });
    }
  };

  return (
    <div id="story" className="min-h-dvh w-full max-w-[100vw] bg-black text-blue-50">
      <div className="flex size-full flex-col items-center py-8 sm:py-10 pb-16 sm:pb-24">
        <p className="font-general text-xs sm:text-[10px] uppercase">the arena of knowledge</p>

        <div className="relative size-full">
          <AnimatedTitle
            title="the st<b>o</b>ry of <br /> a quizverse reb<b>o</b>rn"
            containerClass="mt-4 sm:mt-5 pointer-events-none mix-blend-difference relative z-10"
          />

          <div className="story-img-container">
            <div className="story-img-mask">
              <div className="story-img-content">
                <Image
                  ref={frameRef}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  onMouseUp={handleMouseLeave}
                  onMouseEnter={handleMouseLeave}
                  src="/img/entrance.webp"
                  alt="entrance.webp"
                  className="object-contain"
                  fill
                />
              </div>
            </div>

            {/* for the rounded corner */}
            <svg className="invisible absolute size-0" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="flt_tag">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
                  <feColorMatrix
                    in="blur"
                    mode="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
                    result="flt_tag"
                  />
                  <feComposite in="SourceGraphic" in2="flt_tag" operator="atop" />
                </filter>
              </defs>
            </svg>
          </div>
        </div>

        <div className="-mt-60 sm:-mt-64 flex w-full justify-center px-4 sm:me-44 sm:justify-end">
          <div className="flex h-full w-fit flex-col items-center sm:items-start">
            <p className="mt-3 max-w-xs sm:max-w-sm text-center text-sm sm:text-base font-circular-web text-violet-50 sm:text-start">
              Beyond every question lies a gateway—PopQuiz, where curiosity fuels challenge. Step
              inside and prove your mastery across infinite realms of knowledge.
            </p>

            <Button
              id="realm-btn"
              title="begin your journey"
              containerClass="mt-4 sm:mt-5 text-sm sm:text-base"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingImage;
