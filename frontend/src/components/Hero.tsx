'use client';

import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/all';
import { TiLocationArrow } from 'react-icons/ti';
import { FC, useEffect, useRef, useState } from 'react';

import Button from './Button';
import VideoPreview from './VideoPreview';
import QuizPopup from './QuizPopup';

gsap.registerPlugin(ScrollTrigger);

const videoTitles = [
  'M<b>a</b>rvel',
  'Web Ser<b>i</b>es',
  'A<b>n</b>ime',
  'Footb<b>a</b>ll',
];

const Hero: FC = () => {
  const [currentIndex, setCurrentIndex] = useState<number>(1);
  const [backgroundIndex, setBackgroundIndex] = useState<number>(1);
  const [hasClicked, setHasClicked] = useState<boolean>(false);
  const [isNextVideoReady, setIsNextVideoReady] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadedVideos, setLoadedVideos] = useState<number>(0);

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('');

  const totalVideos = 4;
  const animatingVdRef = useRef<HTMLVideoElement | null>(null);
  const backgroundVdRef = useRef<HTMLVideoElement | null>(null);

  const handleVideoLoad = (): void => {
    setLoadedVideos((prev) => prev + 1);
  };

  useEffect(() => {
    if (loadedVideos >= 2) {
      setLoading(false);
    }
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [loadedVideos]);

  const handleMiniVdClick = (): void => {
    if (hasClicked) return;
    setIsNextVideoReady(false);
    setHasClicked(true);
    setCurrentIndex((prevIndex) => (prevIndex % totalVideos) + 1);
  };

  useGSAP(
    () => {
      if (hasClicked && isNextVideoReady) {
        gsap.set('#next-video', { visibility: 'visible' });
        gsap.to('#next-video', {
          transformOrigin: 'center center',
          scale: 1,
          width: '100%',
          height: '100%',
          duration: 1,
          ease: 'power1.inOut',
          onStart: () => {
            if (animatingVdRef.current) {
              animatingVdRef.current.play();
            }
          },
          onComplete: () => {
            setBackgroundIndex(currentIndex);
            gsap.set('#next-video', {
              visibility: 'hidden',
              width: '16rem',
              height: '16rem',
            });
            setHasClicked(false);
            setIsNextVideoReady(false);
          },
        });

        gsap.from('#current-video', {
          transformOrigin: 'center center',
          scale: 0,
          duration: 1.5,
          ease: 'power1.inOut',
        });
      }
    },
    { dependencies: [isNextVideoReady, hasClicked, currentIndex] }
  );

  useGSAP(() => {
    gsap.set('#video-frame', {
      clipPath: 'polygon(14% 0, 72% 0, 88% 90%, 0 95%)',
      borderRadius: '0% 0% 40% 10%',
    });
    gsap.from('#video-frame', {
      clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
      borderRadius: '0% 0% 0% 0%',
      ease: 'power1.inOut',
      scrollTrigger: {
        trigger: '#video-frame',
        start: 'center center',
        end: 'bottom center',
        scrub: true,
      },
    });
  });

  // CHANGE 1: Updated selector to target the new specific class
  useGSAP(
    () => {
      gsap.from('.dynamic-title', {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: 'power3.out',
      });
    },
    { dependencies: [backgroundIndex] }
  );

  const getVideoSrc = (index: number): string =>
    `videos/hero-${index}.hevc.mp4`;

  const openPopup = () => {
    const currentTitle = videoTitles[backgroundIndex - 1]
      .replace(/<b>|<\/b>/g, '')
      .toLowerCase()
      .replace(/\s+/g, '');
    setSelectedTopic(currentTitle);
    setIsPopupOpen(true);
  };

  return (
    <div className="relative h-dvh w-screen overflow-x-hidden">
      {loading && (
        <div className="flex-center absolute z-[100] h-dvh w-screen overflow-hidden bg-violet-50">
          <div className="three-body">
            <div className="three-body__dot"></div>
            <div className="three-body__dot"></div>
            <div className="three-body__dot"></div>
          </div>
        </div>
      )}

      <div
        id="video-frame"
        className="relative z-10 h-dvh w-screen overflow-hidden rounded-lg bg-black"
      >
        <div>
          <div className="absolute top-1/2 left-1/2 translate-x-[-50%] translate-y-[-50%] z-50 size-64 cursor-pointer">
            <VideoPreview>
              <div
                onClick={handleMiniVdClick}
                className="size-64 scale-50 opacity-0 transition-all duration-500 ease-in-out hover:scale-105 hover:opacity-100 hover:rotate-[-3deg] overflow-hidden rounded-lg"
              >
                <video
                  key={`preview-${currentIndex}`}
                  src={getVideoSrc((currentIndex % totalVideos) + 1)}
                  loop
                  muted
                  autoPlay
                  playsInline
                  id="current-video"
                  className="w-full h-full object-cover object-center"
                  onLoadedData={handleVideoLoad}
                />
              </div>
            </VideoPreview>
          </div>
          <video
            ref={animatingVdRef}
            src={getVideoSrc(currentIndex)}
            loop
            muted
            id="next-video"
            className="absolute top-1/2 left-1/2 translate-x-[-50%] translate-y-[-50%] z-20 size-64 object-cover object-center"
            style={{ visibility: 'hidden' }}
            playsInline
            onLoadedData={handleVideoLoad}
            onCanPlay={() => {
              if (hasClicked) {
                setIsNextVideoReady(true);
              }
            }}
          />
          <video
            ref={backgroundVdRef}
            key={`background-${backgroundIndex}`}
            src={getVideoSrc(backgroundIndex)}
            autoPlay
            loop
            muted
            playsInline
            className="absolute left-0 top-0 size-full object-cover object-center"
            onLoadedData={handleVideoLoad}
          />
        </div>

        {/* CHANGE 2: Added 'dynamic-title' class */}
        <h1
          key={`title-1-${backgroundIndex}`}
          className="dynamic-title special-font hero-heading absolute bottom-5 right-5 z-40 text-blue-75"
          dangerouslySetInnerHTML={{ __html: videoTitles[backgroundIndex - 1] }}
        />
        <div className="absolute left-0 top-0 z-40 size-full">
          <div className="mt-24 px-5 sm:px-10">
            <h1 className="special-font hero-heading text-blue-100">
              challe<b>n</b>ge
            </h1>
            <p className="mb-5 max-w-64 font-robert-regular text-blue-100">
              Step Into the Quizverse <br /> Master the Game of Knowledge
            </p>

            <Button
              id="watch-trailer"
              title="Test Your Mind"
              leftIcon={<TiLocationArrow />}
              containerClass="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:opacity-90 text-white flex-center gap-1"
              onClick={openPopup}
            />
          </div>
        </div>
      </div>

      {/* CHANGE 2: Added 'dynamic-title' class */}
      <h1
        key={`title-2-${backgroundIndex}`}
        className="dynamic-title special-font hero-heading absolute bottom-5 right-5 text-black"
        dangerouslySetInnerHTML={{ __html: videoTitles[backgroundIndex - 1] }}
      />

      <QuizPopup
        open={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        topic={selectedTopic}
      />
    </div>
  );
};

export default Hero;
