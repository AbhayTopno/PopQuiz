'use client';

import React from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/all';

import AnimatedTitle from '@/components/AnimatedTitle';
import Image from 'next/image';

gsap.registerPlugin(ScrollTrigger);

const About: React.FC = () => {
  useGSAP(() => {
    const clipAnimation = gsap.timeline({
      scrollTrigger: {
        trigger: '#clip',
        start: 'center center',
        end: '+=800 center',
        scrub: 0.5,
        pin: true,
        pinSpacing: true,
      },
    });

    clipAnimation.to('.mask-clip-path', {
      width: '100vw',
      height: '100vh',
      borderRadius: 0,
    });
  });

  return (
    <div
      id="about"
      className="min-h-screen w-screen flex flex-col items-center justify-center text-center"
    >
      <div className="relative mb-8 mt-36 flex flex-col items-center gap-5">
        <p className="font-general text-sm uppercase md:text-[10px]">Welcome to PopQuiz</p>

        <AnimatedTitle
          title="Ch<b>a</b>llenge your mind <br /> in the ult<b>i</b>mate quiz adventure"
          containerClass="mt-5 !text-black text-center"
        />

        <div className="about-subtext">
          <p>Test your knowledge across genres, solo or with friends</p>
          <p className="text-gray-500">
            PopQuiz brings real-time duels, group battles, and AI-powered quizzes into one exciting
            platform for everyone.
          </p>
        </div>
      </div>

      <div className="h-dvh w-screen" id="clip">
        <div className="mask-clip-path about-image">
          <Image
            src="/img/about.webp"
            alt="Background"
            className="absolute left-0 top-0 size-full object-cover"
            fill
            objectFit="cover"
          />
        </div>
      </div>
    </div>
  );
};

export default About;
