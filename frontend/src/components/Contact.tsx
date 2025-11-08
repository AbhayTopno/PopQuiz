import React from 'react';
import AnimatedTitle from './AnimatedTitle';
import Button from './Button';
import { ImageClipBoxProps } from '../types';
import Image from 'next/image';

const ImageClipBox: React.FC<ImageClipBoxProps> = ({ src, clipClass }) => (
  // The parent div's height is crucial for the image to display.
  // The height is now handled via Tailwind classes on the parent in the main component.
  <div className={clipClass}>
    <Image src={src} alt="" layout="fill" objectFit="cover" />
  </div>
);

const Contact: React.FC = () => {
  return (
    <div
      id="contact"
      className="my-12 sm:my-20 min-h-96 w-full max-w-[1200px] mx-auto px-4 sm:px-10 relative"
    >
      <div className="relative rounded-lg bg-black py-16 sm:py-24 text-blue-50 overflow-visible">
        <div className="absolute -left-32 top-0 hidden h-full w-72 overflow-hidden sm:block sm:w-96 z-10">
          <ImageClipBox
            src="/img/contact-1.webp"
            clipClass="contact-clip-path-1 absolute h-full w-full"
          />
          <ImageClipBox
            src="/img/contact-2.webp"
            clipClass="contact-clip-path-2 absolute h-full w-full translate-y-40"
          />
        </div>

        <div className="absolute -top-20 -right-10 w-40 h-[250px] sm:-top-10 sm:-right-20 sm:w-60 sm:h-[350px] z-20">
          <ImageClipBox src="/img/swordman.webp" clipClass="sword-man-clip-path h-full w-full" />
        </div>

        <div className="flex flex-col items-center text-center px-4 relative z-30">
          <p className="mb-6 sm:mb-10 font-general text-[10px] uppercase">Join PopQuiz</p>

          <AnimatedTitle
            title="reach o<b>u</b>t and<br /> sh<b>a</b>re your <br /><b>q</b>uiz i<b>d</b>eas"
            containerClass="special-font !text-3xl sm:!text-[4rem] w-full font-zentry !font-black !leading-[.9]"
          />

          <Button title="contact us" containerClass="mt-6 sm:mt-10 cursor-pointer" />
        </div>
      </div>
    </div>
  );
};

export default Contact;
